"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock, Copy, Info, KeyRound, Mail, RefreshCw, UserRound } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { usePublishForm, useRegenerateAccessCode } from "~/hooks/api/form";
import { toastError } from "~/lib/plan-limit";

export type PublicationStatus = "DRAFT" | "PUBLISHED" | "CLOSED";

export interface PublicationState {
  status: PublicationStatus;
  closedReason?: "MANUAL" | "SCHEDULED" | "INACTIVE" | null;
  submissionAccess: "ANYONE" | "ACCESS_CODE";
  accessCode: string | null;
  respondentIdentity: "ANONYMOUS" | "VERIFIED_EMAIL";
  oneResponsePerEmail: boolean;
  closesAt: string | null;
  version: number | null;
  hasUnpublishedChanges: boolean;
}

export interface PublishResult {
  status: PublicationStatus;
  version: number | null;
  createdVersion: boolean;
  closesAt: string | null;
  accessCode: string | null;
}

interface PublishFormDialogProps {
  formId: string;
  form: PublicationState;
  /** Called after a successful save that left the form PUBLISHED (the caller opens the Share dialog). */
  onPublished: (result: PublishResult) => void;
  children: ReactNode;
}

const MIN = 1;
const HOUR = 60;
const DAY = 24 * 60;
const MAX_MINUTES = 30 * DAY;
const MIN_MINUTES = 5;

const PRESETS: { label: string; minutes: number }[] = [
  { label: "15 min", minutes: 15 },
  { label: "30 min", minutes: 30 },
  { label: "1 hour", minutes: HOUR },
  { label: "6 hours", minutes: 6 * HOUR },
  { label: "12 hours", minutes: 12 * HOUR },
  { label: "24 hours", minutes: DAY },
  { label: "2 days", minutes: 2 * DAY },
  { label: "7 days", minutes: 7 * DAY },
];
const UNIT_MINUTES = { minutes: MIN, hours: HOUR, days: DAY } as const;
type Unit = keyof typeof UNIT_MINUTES;

const formatWhen = (d: Date) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(d);

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5 border-t border-dashed border-border pt-4 first:border-t-0 first:pt-0">
      <div>
        <h3 className="mono-label-sm text-muted-foreground">{title}</h3>
        {hint ? <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Choice({
  selected,
  onClick,
  icon,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left transition-colors ${
        selected ? "border-primary bg-primary/10" : "border-border hover:border-foreground/40"
      }`}
    >
      <span
        className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-[3px] ${
          selected ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm leading-tight font-bold">{title}</span>
        <span className="block text-[11px] leading-snug text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

export function PublishFormDialog({ formId, form, onPublished, children }: PublishFormDialogProps) {
  const router = useRouter();
  const { publishFormAsync, isPending } = usePublishForm();
  const { regenerateAccessCodeAsync, isPending: regenerating } = useRegenerateAccessCode();

  const [open, setOpen] = useState(false);

  // ---- draft of the settings, re-seeded every time the dialog opens ----
  const [status, setStatus] = useState<PublicationStatus>("PUBLISHED");
  const [accessMode, setAccessMode] = useState<"ANYONE" | "ACCESS_CODE">("ANYONE");
  const [identity, setIdentity] = useState<"ANONYMOUS" | "VERIFIED_EMAIL">("ANONYMOUS");
  const [onePerEmail, setOnePerEmail] = useState(false);
  const [autoOn, setAutoOn] = useState(false);
  // "keep" = leave the existing schedule alone; "set" = (re)start the clock from the moment of saving
  const [autoMode, setAutoMode] = useState<"keep" | "set">("set");
  const [preset, setPreset] = useState<number | "custom">(DAY);
  const [customValue, setCustomValue] = useState("3");
  const [customUnit, setCustomUnit] = useState<Unit>("hours");
  const [accessCode, setAccessCode] = useState<string | null>(null);

  const [now, setNow] = useState(() => Date.now());

  const hasSchedule = form.status === "PUBLISHED" && !!form.closesAt && new Date(form.closesAt).getTime() > Date.now();

  useEffect(() => {
    if (!open) return;
    setStatus(form.status === "DRAFT" ? "PUBLISHED" : form.status);
    setAccessMode(form.submissionAccess);
    setIdentity(form.respondentIdentity);
    setOnePerEmail(form.oneResponsePerEmail);
    setAccessCode(form.accessCode);
    setAutoOn(hasSchedule);
    setAutoMode(hasSchedule ? "keep" : "set");
    setPreset(DAY);
    setCustomValue("3");
    setCustomUnit("hours");
    setNow(Date.now());
    // re-seed only when the dialog opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // keep the "exact closing time" preview honest while the dialog stays open
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [open]);

  const customMinutes = Math.round(Number(customValue) * UNIT_MINUTES[customUnit]);
  const chosenMinutes = preset === "custom" ? customMinutes : preset;
  const customInvalid =
    preset === "custom" && (!Number.isFinite(customMinutes) || customMinutes < MIN_MINUTES || customMinutes > MAX_MINUTES);

  const closingAt = useMemo(() => {
    if (!autoOn) return null;
    if (autoMode === "keep" && form.closesAt) return new Date(form.closesAt);
    if (!Number.isFinite(chosenMinutes) || customInvalid) return null;
    return new Date(now + chosenMinutes * 60_000);
  }, [autoOn, autoMode, form.closesAt, chosenMinutes, customInvalid, now]);

  const publishing = status === "PUBLISHED";
  const nextVersion = (form.version ?? 0) + (form.hasUnpublishedChanges || form.version === null ? 1 : 0);

  const buttonLabel = isPending
    ? "Saving…"
    : status === "PUBLISHED"
      ? form.status === "PUBLISHED" && !form.hasUnpublishedChanges
        ? "Save changes"
        : form.version === null
          ? "Publish"
          : `Publish version ${nextVersion}`
      : status === "CLOSED"
        ? "Close form"
        : form.status === "DRAFT"
          ? "Save as draft"
          : "Take offline";

  const blocked = isPending || (publishing && autoOn && autoMode === "set" && (customInvalid || !Number.isFinite(chosenMinutes)));

  async function handleSave() {
    try {
      const result = await publishFormAsync({
        formId,
        status,
        accessMode,
        respondentIdentity: identity,
        oneResponsePerEmail: identity === "VERIFIED_EMAIL" ? onePerEmail : false,
        // undefined = keep the existing schedule, null = none, {minutes} = from now
        autoClose: !publishing ? null : !autoOn ? null : autoMode === "keep" ? undefined : { minutes: chosenMinutes },
      });
      setOpen(false);
      if (result.status === "PUBLISHED") {
        toast.success(
          result.createdVersion
            ? `Version ${result.version} is live.`
            : form.status === "PUBLISHED"
              ? "Changes saved."
              : `Published (version ${result.version}).`,
        );
        // Only now — after the server confirmed — does the Share dialog open.
        onPublished({
          status: result.status,
          version: result.version,
          createdVersion: result.createdVersion,
          closesAt: result.closesAt,
          accessCode: result.accessCode,
        });
      } else {
        toast.success(result.status === "CLOSED" ? "Form closed. Existing responses are kept." : "Form saved as a draft.");
      }
    } catch (err) {
      // The previous publication is untouched (the server saves atomically).
      toastError(err, "Couldn't save. Your published version is unchanged.", () => router.push("/dashboard/billing"));
    }
  }

  async function handleNewCode() {
    try {
      const res = await regenerateAccessCodeAsync({ formId });
      setAccessCode(res.accessCode);
      setAccessMode("ACCESS_CODE");
      toast.success("New access code generated. The old one stops working.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate a new code");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[92dvh] gap-4 overflow-y-auto p-5 sm:max-w-[520px]">
        <DialogHeader className="text-left">
          <DialogTitle>Publish</DialogTitle>
          <DialogDescription>
            {form.version === null
              ? "Nothing is live yet. Publishing creates version 1."
              : `Version ${form.version} is ${form.status === "PUBLISHED" ? "live" : "the last published version"}.`}
          </DialogDescription>
        </DialogHeader>

        {form.hasUnpublishedChanges && form.version !== null ? (
          <div className="flex items-start gap-2 border border-primary/50 bg-primary/10 px-3 py-2 text-xs">
            <Info className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span>
              You have <b>unpublished changes</b>. Respondents keep seeing version {form.version} until you publish
              version {nextVersion}. Existing responses stay with the version they answered.
            </span>
          </div>
        ) : null}

        {/* ---------------- STATUS ---------------- */}
        <Section title="Status">
          <div className="grid grid-cols-3 border border-foreground/70 p-0.5" role="radiogroup" aria-label="Status">
            {(
              [
                ["DRAFT", "Draft"],
                ["PUBLISHED", "Published"],
                ["CLOSED", "Closed"],
              ] as const
            ).map(([value, text]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={status === value}
                onClick={() => setStatus(value)}
                className={`mono-label-sm rounded-[2px] px-2 py-2.5 transition-colors ${
                  status === value ? "bg-solid text-solid-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {text}
              </button>
            ))}
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            {status === "PUBLISHED"
              ? "Live at the link. Every publication that changes the form creates a new immutable version."
              : status === "CLOSED"
                ? "Stops accepting responses. Nothing is deleted — every response stays available."
                : "Offline: the link doesn't open. Your published versions and responses are kept."}
          </p>
        </Section>

        {/* ---------------- ACCESS ---------------- */}
        <Section title="Access" hint="Forms are never listed publicly. Only people you share the link with can open them.">
          <div className="space-y-2" role="radiogroup" aria-label="Access">
            <Choice
              selected={accessMode === "ANYONE"}
              onClick={() => setAccessMode("ANYONE")}
              icon={<UserRound className="size-3.5" />}
              title="Anyone with the link"
              description="No code needed."
            />
            <Choice
              selected={accessMode === "ACCESS_CODE"}
              onClick={() => setAccessMode("ACCESS_CODE")}
              icon={<KeyRound className="size-3.5" />}
              title="Link + access code"
              description="Respondents also enter a code you share separately."
            />
          </div>
          {accessMode === "ACCESS_CODE" ? (
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={accessCode ?? ""}
                placeholder="Generated when you save"
                aria-label="Access code"
                className="font-mono tracking-[0.3em]"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!accessCode}
                aria-label="Copy access code"
                onClick={() => {
                  if (accessCode) void navigator.clipboard.writeText(accessCode).then(() => toast.success("Code copied"));
                }}
              >
                <Copy />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={regenerating || !accessCode}
                aria-label="Generate a new access code"
                title="New code (the old one stops working)"
                onClick={handleNewCode}
              >
                <RefreshCw className={regenerating ? "animate-spin" : ""} />
              </Button>
            </div>
          ) : null}
        </Section>

        {/* ---------------- RESPONDENT IDENTITY ---------------- */}
        <Section title="Respondent identity" hint="Respondents never need a Dockett account.">
          <div className="space-y-2" role="radiogroup" aria-label="Respondent identity">
            <Choice
              selected={identity === "ANONYMOUS"}
              onClick={() => setIdentity("ANONYMOUS")}
              icon={<UserRound className="size-3.5" />}
              title="Anonymous"
              description="Anyone with the link can submit, with no verification."
            />
            <Choice
              selected={identity === "VERIFIED_EMAIL"}
              onClick={() => setIdentity("VERIFIED_EMAIL")}
              icon={<Mail className="size-3.5" />}
              title="Verified email"
              description="Respondents confirm their email with a magic link before answering. The address is saved with the response."
            />
          </div>
          {identity === "VERIFIED_EMAIL" ? (
            <div className="flex items-center justify-between gap-3 border border-border px-3 py-2.5">
              <label htmlFor="one-per-email" className="min-w-0 cursor-pointer">
                <span className="block text-sm leading-tight font-bold">One response per verified email</span>
                <span className="block text-[11px] leading-snug text-muted-foreground">
                  A second submission from the same address is refused.
                </span>
              </label>
              <Switch id="one-per-email" checked={onePerEmail} onCheckedChange={setOnePerEmail} />
            </div>
          ) : null}
        </Section>

        {/* ---------------- AUTOMATIC CLOSURE ---------------- */}
        <Section title="Automatic closure">
          <div
            className={`rounded-md border px-3 py-2.5 transition-colors ${
              autoOn && publishing ? "border-primary bg-primary/10" : "border-border"
            } ${publishing ? "" : "opacity-60"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="auto-close" className="flex min-w-0 cursor-pointer items-center gap-2.5">
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-[3px] ${
                    autoOn && publishing ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <Clock className="size-3.5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm leading-tight font-bold">Automatically close form</span>
                  <span className="block text-[11px] leading-snug text-muted-foreground">
                    {publishing ? "Stop accepting responses at a set time." : "Available while the form is published."}
                  </span>
                </span>
              </label>
              <Switch
                id="auto-close"
                checked={autoOn && publishing}
                disabled={!publishing}
                onCheckedChange={(v) => {
                  setAutoOn(v);
                  if (v && !hasSchedule) setAutoMode("set");
                }}
              />
            </div>

            {autoOn && publishing ? (
              <div className="mt-3 space-y-3 border-t border-dashed border-border pt-3">
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Close after">
                  {PRESETS.map((p) => {
                    const sel = autoMode === "set" && preset === p.minutes;
                    return (
                      <button
                        key={p.minutes}
                        type="button"
                        role="radio"
                        aria-checked={sel}
                        onClick={() => {
                          setPreset(p.minutes);
                          setAutoMode("set");
                        }}
                        className={`mono-label-sm rounded-[2px] border px-2.5 py-2 transition-colors ${
                          sel ? "border-solid bg-solid text-solid-foreground" : "border-foreground/40 hover:bg-accent"
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={autoMode === "set" && preset === "custom"}
                    onClick={() => {
                      setPreset("custom");
                      setAutoMode("set");
                    }}
                    className={`mono-label-sm rounded-[2px] border px-2.5 py-2 transition-colors ${
                      autoMode === "set" && preset === "custom"
                        ? "border-solid bg-solid text-solid-foreground"
                        : "border-foreground/40 hover:bg-accent"
                    }`}
                  >
                    Custom
                  </button>
                </div>

                {autoMode === "set" && preset === "custom" ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={customValue}
                      onChange={(e) => setCustomValue(e.target.value)}
                      aria-label="Custom duration"
                      aria-invalid={customInvalid}
                      className="w-24"
                    />
                    <div className="grid grid-cols-3 border border-foreground/50 p-0.5">
                      {(Object.keys(UNIT_MINUTES) as Unit[]).map((u) => (
                        <button
                          key={u}
                          type="button"
                          aria-pressed={customUnit === u}
                          onClick={() => setCustomUnit(u)}
                          className={`mono-label-sm rounded-[2px] px-2 py-2 ${
                            customUnit === u ? "bg-solid text-solid-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {customInvalid ? (
                  <p role="alert" className="text-[11px] text-destructive">
                    Choose between 5 minutes and 30 days.
                  </p>
                ) : null}

                <p className="text-xs" aria-live="polite">
                  {closingAt ? (
                    <>
                      {autoMode === "keep" ? "Scheduled to close " : "Will close "}
                      <b>{formatWhen(closingAt)}</b>
                      {autoMode === "set" ? " (counted from when you save)" : ""}.
                    </>
                  ) : (
                    "Pick a duration."
                  )}
                </p>
              </div>
            ) : null}
          </div>
          <p className="text-[11px] leading-snug text-muted-foreground">
            {autoOn && publishing
              ? "Closing is done by the server at that exact time, even if you close this page. Responses are kept."
              : "Without it the form stays open until you close it. Any form that gets no responses for 30 days is closed automatically."}
          </p>
        </Section>

        <DialogFooter className="flex-row justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" variant={status === "PUBLISHED" ? "ember" : "default"} onClick={handleSave} disabled={blocked}>
            {buttonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
