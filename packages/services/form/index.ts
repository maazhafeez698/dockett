import { randomInt } from "node:crypto";
import { and, db, desc, eq, isNull, lte } from "@repo/database";
import {
  PlanLimitError,
  assertTemplateAllowed,
  getUserPlan,
  isFormSuspended,
  isResponseLimitReached,
  templateForOwner,
  withPublishLimit,
} from "@repo/services/billing";
import { formsTable } from "@repo/database/models/form";
import { formFieldsTable } from "@repo/database/models/form-field";
import { formVersionsTable } from "@repo/database/models/form-version";
import { logger } from "@repo/logger";
import { analyzeConditionalLogic, logicOf } from "@repo/services/form-logic";
import { backfillPublishedVersions, ensurePublishedVersion } from "./ensure-version";
import { env } from "../env";
import {
  MAX_AUTO_CLOSE_MINUTES,
  MIN_AUTO_CLOSE_MINUTES,
  buildSnapshot,
  effectiveState,
  hashSnapshot,
  inactivityMs,
} from "./publication";

import {
  createFormInput,
  type CreateFormInputType,
  createFormFromTemplateInput,
  type CreateFormFromTemplateInputType,
  listFormsByUserIdInput,
  type ListFormsByUserIdInputType,
  getFormWithFieldsInput,
  type GetFormWithFieldsInputType,
  updateFormInput,
  type UpdateFormInputType,
  deleteFormInput,
  type DeleteFormInputType,
  regenerateAccessCodeInput,
  type RegenerateAccessCodeInputType,
  publishFormInput,
  type PublishFormInputType,
} from "./model";

/**
 * Shared ownership guard, used by every service that needs to confirm a
 * form belongs to the caller (form fields, submissions, and the form
 * service itself). A non-owner and a non-existent form get the same error
 * — deliberately not distinguishing the two so a probing request can't
 * learn whether a given formId exists.
 */
export async function assertFormOwnership(formId: string, userId: string) {
  const rows = await db
    .select({ id: formsTable.id, createdBy: formsTable.createdBy })
    .from(formsTable)
    .where(eq(formsTable.id, formId));

  const form = rows[0];
  if (!form || form.createdBy !== userId) {
    throw new Error("Form not found");
  }

  return form;
}

function toLabelKey(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Short, human-typeable code — unambiguous alphabet (no 0/O/1/I). */
function generateAccessCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += alphabet[randomInt(alphabet.length)]; // CSPRNG: the code is a real access gate
  }
  return code;
}

const FIELD_COLUMNS = {
  id: formFieldsTable.id,
  formId: formFieldsTable.formId,
  label: formFieldsTable.label,
  labelKey: formFieldsTable.labelKey,
  description: formFieldsTable.description,
  placeholder: formFieldsTable.placeholder,
  isRequired: formFieldsTable.isRequired,
  config: formFieldsTable.config,
  index: formFieldsTable.index,
  type: formFieldsTable.type,
  createdAt: formFieldsTable.createdAt,
  updatedAt: formFieldsTable.updatedAt,
};

/** A transaction or the pool — anything that can run these queries. */
type Db = Pick<typeof db, "select" | "insert" | "update">;

async function loadLiveFields(formId: string, executor: Db = db) {
  return executor
    .select(FIELD_COLUMNS)
    .from(formFieldsTable)
    .where(eq(formFieldsTable.formId, formId))
    .orderBy(formFieldsTable.index);
}

/** The deprecated "sign in to respond" mode is treated as an open link. */
const normalizeAccess = (a: string): "ANYONE" | "ACCESS_CODE" => (a === "ACCESS_CODE" ? "ACCESS_CODE" : "ANYONE");

const FORM_SELECT_COLUMNS = {
  id: formsTable.id,
  title: formsTable.title,
  description: formsTable.description,
  status: formsTable.status,
  submissionAccess: formsTable.submissionAccess,
  respondentIdentity: formsTable.respondentIdentity,
  oneResponsePerEmail: formsTable.oneResponsePerEmail,
  publishedVersionId: formsTable.publishedVersionId,
  closesAt: formsTable.closesAt,
  closedReason: formsTable.closedReason,
  lastActivityAt: formsTable.lastActivityAt,
  template: formsTable.template,
  submissionLayout: formsTable.submissionLayout,
  accessCode: formsTable.accessCode,
  createdBy: formsTable.createdBy,
  createdAt: formsTable.createdAt,
  updatedAt: formsTable.updatedAt,
};

export default class FormService {
  public async createForm(payload: CreateFormInputType) {
    const { title, description, createdBy, template, submissionLayout } =
      await createFormInput.parseAsync(payload);

    // Plan gate: premium templates (Developer, Retro, Ticket) need a plan that includes them.
    await assertTemplateAllowed(createdBy, template);

    const result = await db
      .insert(formsTable)
      .values({
        title,
        description,
        createdBy,
        ...(template ? { template } : {}),
        ...(submissionLayout ? { submissionLayout } : {}),
      })
      .returning({ id: formsTable.id });

    if (!result || result.length === 0 || !result[0]?.id)
      throw new Error("Something went wrong while creating the form");

    return { id: result[0].id };
  }

  /**
   * Creates a form and its fields from a gallery template in one call —
   * fields land in the given order (sequential inserts, same reasoning as
   * FormFieldService: index is derived from insertion order).
   */
  public async createFormFromTemplate(payload: CreateFormFromTemplateInputType) {
    const { title, description, createdBy, template, submissionLayout, fields } =
      await createFormFromTemplateInput.parseAsync(payload);

    await assertTemplateAllowed(createdBy, template);

    const result = await db
      .insert(formsTable)
      .values({ title, description, createdBy, template, submissionLayout })
      .returning({ id: formsTable.id });

    const formId = result[0]?.id;
    if (!formId) throw new Error("Something went wrong while creating the form");

    let index = 1;
    for (const field of fields) {
      await db.insert(formFieldsTable).values({
        formId,
        label: field.label,
        labelKey: toLabelKey(field.label),
        type: field.type,
        description: field.description,
        placeholder: field.placeholder,
        isRequired: field.isRequired ?? false,
        config: field.config ?? null,
        index: String(index),
      });
      index += 1;
    }

    return { id: formId };
  }

  public async listFormsByUserId(payload: ListFormsByUserIdInputType) {
    const { userId } = await listFormsByUserIdInput.parseAsync(payload);

    const rows = await db
      .select(FORM_SELECT_COLUMNS)
      .from(formsTable)
      .where(eq(formsTable.createdBy, userId));

    // Show what the form IS right now (a form whose deadline just passed is already closed),
    // even if the background sweep has not flipped the column yet.
    const now = new Date();
    const forms = rows.map((f) => {
      const eff = effectiveState(f, now);
      return { ...f, status: eff.status, closedReason: eff.closedReason };
    });

    // After a downgrade the OLDEST published forms (up to the plan limit) stay live; the rest are
    // suspended. The same rule is enforced on the public endpoints (see isFormSuspended).
    const plan = await getUserPlan(userId);
    const limit = plan.limits.maxActiveForms;
    const suspended = new Set<string>();
    if (limit !== null) {
      const published = forms
        .filter((f) => f.status === "PUBLISHED")
        .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0) || (a.id < b.id ? -1 : 1));
      published.slice(limit).forEach((f) => suspended.add(f.id));
    }

    // accessCode isn't secret from the owner (it's their own form's list).
    return forms.map((f) => ({
      ...f,
      submissionAccess: normalizeAccess(f.submissionAccess),
      planSuspended: suspended.has(f.id),
    }));
  }

  /** The published snapshot of a form, or null if it was never published. */
  private async getPublishedVersion(versionId: string | null) {
    if (!versionId) return null;
    const rows = await db
      .select({
        id: formVersionsTable.id,
        version: formVersionsTable.version,
        contentHash: formVersionsTable.contentHash,
        snapshot: formVersionsTable.snapshot,
      })
      .from(formVersionsTable)
      .where(eq(formVersionsTable.id, versionId));
    return rows[0] ?? null;
  }

  /** Cheap, always-public metadata — used by the fill page to decide what
   * gate (if any) to show *before* attempting to load the actual fields. */
  public async getFormAccessInfo(formId: string) {
    const rows = await db
      .select(FORM_SELECT_COLUMNS)
      .from(formsTable)
      .where(eq(formsTable.id, formId));
    const form = rows[0];
    if (!form) throw new Error("Form not found");

    const eff = effectiveState(form);
    if (eff.due) void this.closeDueForms().catch(() => undefined); // lazy flip; the sweep also does this

    const published = eff.status === "PUBLISHED";
    // A form published before versioning existed gets its version 1 the first time it is needed.
    if (published && !form.publishedVersionId) form.publishedVersionId = await ensurePublishedVersion(form.id);
    // Respondents see the published version's title / description, not the draft's.
    const version = published ? await this.getPublishedVersion(form.publishedVersionId) : null;
    return {
      id: form.id,
      title: version?.snapshot.title ?? form.title,
      description: (version?.snapshot.description ?? form.description) ?? null,
      status: eff.status,
      closedReason: eff.closedReason,
      submissionAccess: normalizeAccess(form.submissionAccess),
      respondentIdentity: form.respondentIdentity,
      oneResponsePerEmail: form.oneResponsePerEmail,
      // A premium template is only served while its owner's plan includes it.
      // Snapshots are created from the form template enum; templateForOwner widens
      // its generic to string while applying the plan fallback.
      template: (await templateForOwner(form.createdBy, version?.snapshot.template ?? form.template)) as
        (typeof formsTable.$inferSelect)["template"],
      // Plan state, so the fill page can say so up front instead of failing at submit time.
      planUnavailable: published ? await isFormSuspended(form.id, form.createdBy) : false,
      responseLimitReached: published ? await isResponseLimitReached(form.id, form.createdBy) : false,
    };
  }

  public async getFormWithFields(payload: GetFormWithFieldsInputType) {
    const { formId, requesterId, accessCode, live } = await getFormWithFieldsInput.parseAsync(payload);

    const rows = await db
      .select(FORM_SELECT_COLUMNS)
      .from(formsTable)
      .where(eq(formsTable.id, formId));
    const first = rows[0];
    if (!first) throw new Error("Form not found");

    const isOwner = !!requesterId && requesterId === first.createdBy;
    const eff = effectiveState(first);
    if (eff.due) void this.closeDueForms().catch(() => undefined);
    if (eff.status === "PUBLISHED" && !first.publishedVersionId) {
      first.publishedVersionId = await ensurePublishedVersion(first.id);
    }

    if (!isOwner) {
      if (eff.status !== "PUBLISHED") {
        // Same message as "doesn't exist" — a draft form isn't distinguishable from a nonexistent
        // one to a non-owner (the fill page uses getFormAccessInfo to show "closed").
        throw new Error("Form not found");
      }
      if (await isFormSuspended(first.id, first.createdBy)) {
        throw new PlanLimitError("FORM_UNAVAILABLE", "This form is temporarily unavailable.");
      }
      if (normalizeAccess(first.submissionAccess) === "ACCESS_CODE") {
        if (!accessCode || accessCode.toUpperCase() !== (first.accessCode ?? "").toUpperCase()) {
          throw new Error("ACCESS_CODE_REQUIRED");
        }
      }
    }

    const publishedVersion = await this.getPublishedVersion(first.publishedVersionId);
    const liveFields = await loadLiveFields(first.id);
    const liveSnapshot = buildSnapshot(
      { title: first.title, description: first.description ?? null, template: first.template, submissionLayout: first.submissionLayout },
      liveFields,
    );

    // The builder (owner + live) and an owner previewing a never-published draft see the draft;
    // everyone else — and the owner on the public page — gets the exact published version.
    const useLive = isOwner && (live === true || !publishedVersion);
    if (!useLive && !publishedVersion) throw new Error("Form not found");
    const content = useLive ? liveSnapshot : publishedVersion!.snapshot;

    return {
      id: first.id,
      title: content.title,
      description: content.description ?? null,
      status: eff.status,
      closedReason: eff.closedReason,
      submissionAccess: normalizeAccess(first.submissionAccess),
      respondentIdentity: first.respondentIdentity,
      oneResponsePerEmail: first.oneResponsePerEmail,
      template: (await templateForOwner(first.createdBy, content.template)) as
        (typeof formsTable.$inferSelect)["template"],
      submissionLayout: content.submissionLayout as (typeof formsTable.$inferSelect)["submissionLayout"],
      // Only the owner ever sees the code itself — everyone else already
      // had to know it to get this far.
      accessCode: isOwner ? (first.accessCode ?? null) : null,
      // Versioning
      versionId: useLive ? null : publishedVersion!.id,
      version: publishedVersion?.version ?? null,
      hasUnpublishedChanges: isOwner
        ? !publishedVersion || hashSnapshot(liveSnapshot) !== publishedVersion.contentHash
        : false,
      closesAt: isOwner && first.closesAt ? first.closesAt.toISOString() : null,
      createdAt: first.createdAt ? first.createdAt.toISOString() : null,
      updatedAt: first.updatedAt ? first.updatedAt.toISOString() : null,
      fields: content.fields,
    };
  }

  /** Draft content only (title, description, design, pacing). Publishing goes through publishForm. */
  public async updateForm(payload: UpdateFormInputType) {
    const { formId, userId, title, description, template, submissionLayout } =
      await updateFormInput.parseAsync(payload);

    const form = await assertFormOwnership(formId, userId);
    void form;

    if (template !== undefined) await assertTemplateAllowed(userId, template);

    const patch: Partial<typeof formsTable.$inferInsert> = {};
    if (title !== undefined) patch.title = title;
    if (description !== undefined) patch.description = description;
    if (template !== undefined) patch.template = template;
    if (submissionLayout !== undefined) patch.submissionLayout = submissionLayout;
    if (Object.keys(patch).length === 0) throw new Error("Nothing to update");

    const updated = await db.update(formsTable).set(patch).where(eq(formsTable.id, formId)).returning(FORM_SELECT_COLUMNS);
    const row = updated[0];
    if (!row) throw new Error("Form not found");
    return { ...row, submissionAccess: normalizeAccess(row.submissionAccess) };
  }

  /**
   * Status, access, respondent identity and automatic closure — one atomic call.
   *
   *  - PUBLISHED: snapshots the live draft into an immutable version (reusing the latest version
   *    when nothing changed), then flips the form live. Everything happens in one transaction: if
   *    anything fails, the previous publication is untouched.
   *  - CLOSED: stops accepting responses; nothing is deleted.
   *  - DRAFT: takes the form offline; its versions and responses are kept.
   */
  public async publishForm(payload: PublishFormInputType) {
    const input = await publishFormInput.parseAsync(payload);
    const { formId, userId, status } = input;
    await assertFormOwnership(formId, userId);

    const identity = input.respondentIdentity;
    // "One response per email" only means something when the email is verified.
    const oneResponsePerEmail = identity === "VERIFIED_EMAIL" ? input.oneResponsePerEmail : false;

    const minutes = input.autoClose?.minutes;
    if (minutes !== undefined && (minutes < MIN_AUTO_CLOSE_MINUTES || minutes > MAX_AUTO_CLOSE_MINUTES)) {
      throw new Error("Automatic closure must be between 5 minutes and 30 days.");
    }

    const run = async (tx: Db) => {
      const locked = await (tx as typeof db)
        .select(FORM_SELECT_COLUMNS)
        .from(formsTable)
        .where(eq(formsTable.id, formId))
        .for("update");
      const form = locked[0];
      if (!form) throw new Error("Form not found");

      const now = new Date();
      const accessCode =
        input.accessMode === "ACCESS_CODE" ? (form.accessCode ?? generateAccessCode()) : null;
      const common = {
        submissionAccess: input.accessMode,
        accessCode,
        respondentIdentity: identity,
        oneResponsePerEmail,
      } as const;

      if (status !== "PUBLISHED") {
        await tx
          .update(formsTable)
          .set({ ...common, status, closesAt: null, closedReason: status === "CLOSED" ? "MANUAL" : null })
          .where(eq(formsTable.id, formId));
        return {
          id: formId,
          status,
          version: null as number | null,
          versionId: form.publishedVersionId,
          createdVersion: false,
          closesAt: null as string | null,
          accessCode,
        };
      }

      const fields = await loadLiveFields(formId, tx);
      if (fields.length === 0) throw new Error("Add at least one field before publishing.");

      if (form.submissionLayout === "ALL_AT_ONCE" && fields.some((field) => logicOf(field))) {
        throw new Error("Conditional logic requires One at a time field pacing. Change Field pacing in Form details, then publish again.");
      }

      const logicErrors = analyzeConditionalLogic(fields).errors;
      if (logicErrors.length > 0) throw new Error(logicErrors[0]!.message);

      const snapshot = buildSnapshot(
        { title: form.title, description: form.description ?? null, template: form.template, submissionLayout: form.submissionLayout },
        fields,
      );
      const hash = hashSnapshot(snapshot);

      const latest = (
        await tx
          .select({ id: formVersionsTable.id, version: formVersionsTable.version, contentHash: formVersionsTable.contentHash })
          .from(formVersionsTable)
          .where(eq(formVersionsTable.formId, formId))
          .orderBy(desc(formVersionsTable.version))
          .limit(1)
      )[0];

      let versionId: string;
      let version: number;
      let createdVersion = false;
      if (latest && latest.contentHash === hash) {
        versionId = latest.id;
        version = latest.version;
      } else {
        version = (latest?.version ?? 0) + 1;
        const inserted = await tx
          .insert(formVersionsTable)
          .values({ formId, version, contentHash: hash, snapshot, createdBy: userId })
          .returning({ id: formVersionsTable.id });
        versionId = inserted[0]!.id;
        createdVersion = true;
      }

      // Automatic closure: a fresh duration is measured from now (server clock). Not provided =
      // keep an existing future schedule of an already-published form.
      let closesAt: Date | null;
      if (minutes !== undefined) closesAt = new Date(now.getTime() + minutes * 60_000);
      else if (input.autoClose === null) closesAt = null;
      else closesAt = form.status === "PUBLISHED" && form.closesAt && form.closesAt > now ? form.closesAt : null;

      await tx
        .update(formsTable)
        .set({
          ...common,
          status: "PUBLISHED",
          publishedVersionId: versionId,
          closesAt,
          closedReason: null,
          lastActivityAt: now,
        })
        .where(eq(formsTable.id, formId));

      return {
        id: formId,
        status: "PUBLISHED" as const,
        version,
        versionId,
        createdVersion,
        closesAt: closesAt ? closesAt.toISOString() : null,
        accessCode,
      };
    };

    // Going (or staying) live is subject to the plan's active-form limit.
    const result =
      status === "PUBLISHED"
        ? await withPublishLimit(userId, formId, (tx) => run(tx as unknown as Db))
        : await db.transaction((tx) => run(tx as unknown as Db));

    return {
      ...result,
      submissionAccess: input.accessMode,
      respondentIdentity: identity,
      oneResponsePerEmail,
    };
  }

  /**
   * Closes every published form whose automatic closure is due, or that has had no activity for
   * FORM_INACTIVITY_CLOSE_DAYS. Idempotent and safe to run on several instances at once; reads and
   * submissions ALSO enforce these rules directly, so this is bookkeeping, not the gate.
   */
  public async closeDueForms(now: Date = new Date()) {
    const cutoff = new Date(now.getTime() - inactivityMs());
    const scheduled = await db
      .update(formsTable)
      .set({ status: "CLOSED", closedReason: "SCHEDULED" })
      .where(and(eq(formsTable.status, "PUBLISHED"), lte(formsTable.closesAt, now)))
      .returning({ id: formsTable.id });
    const idle = await db
      .update(formsTable)
      .set({ status: "CLOSED", closedReason: "INACTIVE" })
      .where(and(eq(formsTable.status, "PUBLISHED"), lte(formsTable.lastActivityAt, cutoff)))
      .returning({ id: formsTable.id });
    // Forms published before this feature have no activity stamp: start their clock now.
    await db
      .update(formsTable)
      .set({ lastActivityAt: now })
      .where(and(eq(formsTable.status, "PUBLISHED"), isNull(formsTable.lastActivityAt)));
    // Forms published before versioning existed get their version 1 (no manual data migration).
    const backfilled = await backfillPublishedVersions();
    if (backfilled > 0) logger.info(`created version 1 for ${backfilled} previously published form(s)`);
    const closed = scheduled.length + idle.length;
    if (closed > 0) logger.info(`closed ${scheduled.length} scheduled + ${idle.length} idle form(s)`);
    return { scheduled: scheduled.length, idle: idle.length };
  }

  /** Records activity (an accepted submission) so an active form is never closed as idle. */
  public async touchActivity(formId: string) {
    await db.update(formsTable).set({ lastActivityAt: new Date() }).where(eq(formsTable.id, formId));
  }

  /** Runs closeDueForms() on a timer. Returns a stop function. */
  public startLifecycle(): () => void {
    let running = false;
    const run = () => {
      if (running) return;
      running = true;
      this.closeDueForms()
        .catch((err) => logger.error(`form closing sweep failed: ${err instanceof Error ? err.message : err}`))
        .finally(() => {
          running = false;
        });
    };
    const interval = setInterval(run, env.FORM_CLOSE_SWEEP_SECONDS * 1000);
    const first = setTimeout(run, 5_000);
    interval.unref();
    first.unref();
    return () => {
      clearInterval(interval);
      clearTimeout(first);
    };
  }

  public async regenerateAccessCode(payload: RegenerateAccessCodeInputType) {
    const { formId, userId } = await regenerateAccessCodeInput.parseAsync(payload);
    await assertFormOwnership(formId, userId);

    const code = generateAccessCode();
    await db
      .update(formsTable)
      .set({ accessCode: code, submissionAccess: "ACCESS_CODE" })
      .where(eq(formsTable.id, formId));

    return { accessCode: code };
  }

  public async deleteForm(payload: DeleteFormInputType) {
    const { formId, userId } = await deleteFormInput.parseAsync(payload);

    await assertFormOwnership(formId, userId);

    // Fields and submissions cascade via the FK's onDelete: "cascade".
    await db.delete(formsTable).where(eq(formsTable.id, formId));

    return { id: formId };
  }
}
