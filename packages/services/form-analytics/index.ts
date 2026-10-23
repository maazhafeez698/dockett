// packages/services/form-analytics/index.ts

import { db, desc, eq } from "@repo/database";
import { formFieldsTable } from "@repo/database/models/form-field";
import { formSubmissionsTable } from "@repo/database/models/form-submission";
import { formVersionsTable } from "@repo/database/models/form-version";
import { formViewsTable } from "@repo/database/models/form-view";
import { assertFormOwnership } from "@repo/services/form";

import {
  recordViewInput,
  type RecordViewInputType,
  getFormAnalyticsInput,
  type GetFormAnalyticsInputType,
  getSubmissionDetailInput,
  type GetSubmissionDetailInputType,
} from "./model";
import { buildResponseTimeline } from "./timeline";

/** Small, deliberately unsophisticated UA sniff — no dependency, just
 * enough signal for a device-mix chart, not a precise analytics product. */
function classifyDevice(
  userAgent: string | undefined,
): "DESKTOP" | "MOBILE" | "TABLET" | "UNKNOWN" {
  if (!userAgent) return "UNKNOWN";
  const ua = userAgent.toLowerCase();
  if (ua.includes("ipad") || (ua.includes("tablet") && !ua.includes("mobile"))) return "TABLET";
  if (ua.includes("mobi") || ua.includes("iphone") || ua.includes("android")) return "MOBILE";
  return "DESKTOP";
}

export default class FormAnalyticsService {
  /** Fire-and-forget from the caller's point of view — errors are
   * swallowed so a tracking hiccup never breaks the actual page load. */
  public async recordView(payload: RecordViewInputType) {
    try {
      const { formId, userAgent } = await recordViewInput.parseAsync(payload);
      await db.insert(formViewsTable).values({ formId, device: classifyDevice(userAgent) });
    } catch {
      // best-effort only
    }
  }

  public async getFormAnalytics(payload: GetFormAnalyticsInputType) {
    const { formId, userId, timeZone = "UTC" } = await getFormAnalyticsInput.parseAsync(payload);
    await assertFormOwnership(formId, userId);

    const fields = await db
      .select({ id: formFieldsTable.id })
      .from(formFieldsTable)
      .where(eq(formFieldsTable.formId, formId));
    const totalFieldCount = fields.length;

    const submissions = await db
      .select({
        id: formSubmissionsTable.id,
        values: formSubmissionsTable.values,
        submittedBy: formSubmissionsTable.submittedBy,
        createdAt: formSubmissionsTable.createdAt,
      })
      .from(formSubmissionsTable)
      .where(eq(formSubmissionsTable.formId, formId))
      .orderBy(formSubmissionsTable.createdAt);

    const totalResponses = submissions.length;

    // "Complete" = every field (not just required ones) has a non-empty
    // answer — a real, computable definition rather than a guess, since
    // every stored submission already satisfied required-field validation
    // at submit time.
    const fullyAnsweredCount = submissions.filter((s) => {
      const values = s.values ?? [];
      if (totalFieldCount === 0) return true;
      const answered = values.filter((v) => v.value.trim().length > 0).length;
      return answered >= totalFieldCount;
    }).length;
    const completionRate =
      totalResponses === 0 ? 0 : Math.round((fullyAnsweredCount / totalResponses) * 100);

    const views = await db
      .select({ device: formViewsTable.device })
      .from(formViewsTable)
      .where(eq(formViewsTable.formId, formId));

    const deviceBreakdown = { DESKTOP: 0, MOBILE: 0, TABLET: 0, UNKNOWN: 0 };
    for (const v of views) deviceBreakdown[v.device] += 1;
    const totalViews = views.length;

    const timeline = buildResponseTimeline(submissions, timeZone);

    return {
      totalResponses,
      totalViews,
      completionRate,
      deviceBreakdown,
      timeline,
    };
  }

  /** Every submission, oldest first, with a display label — powers both the
   * "Latest Responses" cards (client takes the tail) and prev/next paging
   * inside the submission-detail view, so both stay in the same order. */
  public async listSubmissions(payload: GetFormAnalyticsInputType) {
    const { formId, userId } = await getFormAnalyticsInput.parseAsync(payload);
    await assertFormOwnership(formId, userId);

    const fields = await db
      .select({ id: formFieldsTable.id })
      .from(formFieldsTable)
      .where(eq(formFieldsTable.formId, formId));
    const totalFieldCount = fields.length;

    const submissions = await db
      .select({
        id: formSubmissionsTable.id,
        values: formSubmissionsTable.values,
        submittedBy: formSubmissionsTable.submittedBy,
        createdAt: formSubmissionsTable.createdAt,
      })
      .from(formSubmissionsTable)
      .where(eq(formSubmissionsTable.formId, formId))
      .orderBy(formSubmissionsTable.createdAt);

    return submissions.map((s) => {
      const values = s.values ?? [];
      // file answers are JSON references, not something to show as a response title
      const isFileRef = (v: string) => v.startsWith('[{"id"');
      const emailLike = values.find((v) => !isFileRef(v.value) && /\S+@\S+\.\S+/.test(v.value));
      const firstAnswer = values.find((v) => v.value.trim().length > 0 && !isFileRef(v.value));
      const label = emailLike?.value ?? firstAnswer?.value ?? "Anonymous response";
      const answeredCount = values.filter((v) => v.value.trim().length > 0).length;

      return {
        id: s.id,
        label,
        isComplete: totalFieldCount > 0 && answeredCount >= totalFieldCount,
        isAuthenticated: !!s.submittedBy,
        createdAt: s.createdAt ? s.createdAt.toISOString() : null,
      };
    });
  }

  /** Full per-field data for CSV export — field labels as columns, one row
   * per submission, in the same order as listSubmissions. */
  public async getExportData(payload: GetFormAnalyticsInputType) {
    const { formId, userId } = await getFormAnalyticsInput.parseAsync(payload);
    await assertFormOwnership(formId, userId);

    // Columns = every field of every published version (newest wording wins), plus any live fields
    // that older, pre-versioning responses may refer to — so no response loses a column.
    const versions = await db
      .select({ id: formVersionsTable.id, version: formVersionsTable.version, snapshot: formVersionsTable.snapshot })
      .from(formVersionsTable)
      .where(eq(formVersionsTable.formId, formId))
      .orderBy(desc(formVersionsTable.version));
    const columns = new Map<string, { id: string; label: string; type: string }>();
    for (const v of versions) {
      for (const f of v.snapshot.fields) if (!columns.has(f.id)) columns.set(f.id, { id: f.id, label: f.label, type: f.type });
    }
    const liveFields = await db
      .select({ id: formFieldsTable.id, label: formFieldsTable.label, type: formFieldsTable.type })
      .from(formFieldsTable)
      .where(eq(formFieldsTable.formId, formId))
      .orderBy(formFieldsTable.index);
    for (const f of liveFields) if (!columns.has(f.id)) columns.set(f.id, f);
    const versionNumber = new Map(versions.map((v) => [v.id, v.version]));

    const submissions = await db
      .select({
        id: formSubmissionsTable.id,
        values: formSubmissionsTable.values,
        submittedBy: formSubmissionsTable.submittedBy,
        versionId: formSubmissionsTable.versionId,
        respondentEmail: formSubmissionsTable.respondentEmail,
        createdAt: formSubmissionsTable.createdAt,
      })
      .from(formSubmissionsTable)
      .where(eq(formSubmissionsTable.formId, formId))
      .orderBy(formSubmissionsTable.createdAt);

    return {
      fields: [...columns.values()],
      submissions: submissions.map((s) => ({
        id: s.id,
        createdAt: s.createdAt ? s.createdAt.toISOString() : null,
        isAuthenticated: !!s.submittedBy,
        respondentEmail: s.respondentEmail ?? null,
        version: s.versionId ? (versionNumber.get(s.versionId) ?? null) : null,
        values: s.values ?? [],
      })),
    };
  }

  public async getSubmissionDetail(payload: GetSubmissionDetailInputType) {
    const { submissionId, userId } = await getSubmissionDetailInput.parseAsync(payload);

    const rows = await db
      .select({
        id: formSubmissionsTable.id,
        formId: formSubmissionsTable.formId,
        values: formSubmissionsTable.values,
        submittedBy: formSubmissionsTable.submittedBy,
        versionId: formSubmissionsTable.versionId,
        respondentEmail: formSubmissionsTable.respondentEmail,
        createdAt: formSubmissionsTable.createdAt,
      })
      .from(formSubmissionsTable)
      .where(eq(formSubmissionsTable.id, submissionId));

    const submission = rows[0];
    if (!submission || !submission.formId) throw new Error("Submission not found");

    await assertFormOwnership(submission.formId, userId);

    // Read the response against the version it was submitted to (its labels, its fields).
    let versionNo: number | null = null;
    let fields: { id: string; label: string; type: string }[];
    const ver = submission.versionId
      ? (
          await db
            .select({ version: formVersionsTable.version, snapshot: formVersionsTable.snapshot })
            .from(formVersionsTable)
            .where(eq(formVersionsTable.id, submission.versionId))
        )[0]
      : undefined;
    if (ver) {
      versionNo = ver.version;
      fields = ver.snapshot.fields.map((f) => ({ id: f.id, label: f.label, type: f.type }));
    } else {
      // Responses collected before versioning existed: the live fields are all there is.
      fields = await db
        .select({ id: formFieldsTable.id, label: formFieldsTable.label, type: formFieldsTable.type })
        .from(formFieldsTable)
        .where(eq(formFieldsTable.formId, submission.formId))
        .orderBy(formFieldsTable.index);
    }

    const valueByFieldId = new Map((submission.values ?? []).map((v) => [v.fieldId, v.value]));

    const answers = fields.map((f) => ({
      fieldId: f.id,
      label: f.label,
      type: f.type,
      value: valueByFieldId.get(f.id) ?? "",
    }));

    return {
      id: submission.id,
      formId: submission.formId,
      isAuthenticated: !!submission.submittedBy,
      respondentEmail: submission.respondentEmail ?? null,
      version: versionNo,
      createdAt: submission.createdAt ? submission.createdAt.toISOString() : null,
      answers,
    };
  }
}
