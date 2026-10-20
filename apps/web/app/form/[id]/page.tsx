// apps/web/app/form/[id]/page.tsx
//
// Respondent-facing fill page. Flow:
//   1. getFormAccessInfo (always public) — cheap metadata, decides which
//      gate (if any) to show before we try to load the real fields.
//   2. If gated (access code / sign-in), show that screen first.
//   3. getFormWithFields (with accessCode if applicable) — the server
//      re-checks everything regardless of what the client already showed.
//   4. Render via the form's template shell, pacing fields per its
//      submissionLayout.

"use client";

import { use, useState } from "react";
import Link from "next/link";
import { AlertCircle, KeyRound, Lock, LogIn } from "lucide-react";

import { useGetFormAccessInfo, useGetFormWithFields } from "~/hooks/api/form";
import { useCreateSubmission } from "~/hooks/api/form-submission";
import { useUser } from "~/hooks/api/auth";
import { useSubmissionFlow } from "~/hooks/use-submission-flow";
import { FormTemplateRenderer } from "~/components/form-templates";
import { FormUploadProvider } from "~/components/form-upload-context";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

function CenteredMessage({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="flex max-w-sm flex-col items-center gap-3 border border-foreground/70 bg-card p-8 text-center shadow-[5px_5px_0_0_var(--hard-shadow)]">
        {icon}
        <p className="font-display text-2xl leading-tight font-extrabold">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
        {action}
      </div>
    </div>
  );
}

function AccessCodeGate({
  onSubmit,
  submitting,
  error,
}: {
  onSubmit: (code: string) => void;
  submitting: boolean;
  error?: string | null;
}) {
  const [code, setCode] = useState("");

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(code.trim());
        }}
        className="flex w-full max-w-sm flex-col items-center gap-4 border border-foreground/70 bg-card p-8 text-center shadow-[5px_5px_0_0_var(--hard-shadow)]"
      >
        <KeyRound className="size-8 text-muted-foreground" />
        <p className="font-display text-2xl leading-tight font-extrabold">
          This form needs an access code
        </p>
        <p className="text-sm text-muted-foreground">
          Ask whoever shared this form's link for the code.
        </p>
        <div className="w-full space-y-1.5 text-left">
          <Label htmlFor="access-code">Access code</Label>
          <Input
            id="access-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. 7F3KQ2"
            className="text-center tracking-[0.3em] uppercase"
            maxLength={12}
            autoFocus
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={!code.trim() || submitting} className="w-full">
          {submitting ? "Checking..." : "Continue"}
        </Button>
      </form>
    </div>
  );
}

export default function PublicFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const {
    accessInfo,
    isLoading: accessInfoLoading,
    error: accessInfoError,
  } = useGetFormAccessInfo(id);
  const { user, isLoading: userLoading } = useUser();

  const [enteredCode, setEnteredCode] = useState<string | undefined>(undefined);

  const needsCodeAttempt =
    accessInfo?.submissionAccess === "ACCESS_CODE" && enteredCode === undefined;
  const needsLogin = accessInfo?.submissionAccess === "AUTHENTICATED_ONLY" && !userLoading && !user;

  const {
    form,
    isLoading: formLoading,
    error: formError,
  } = useGetFormWithFields(id, enteredCode, !!accessInfo && !needsCodeAttempt && !needsLogin);

  const { createSubmissionAsync, isPending: submitting } = useCreateSubmission();
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fields = form?.fields ?? [];
  const flow = useSubmissionFlow(fields, form?.submissionLayout ?? "ONE_AT_A_TIME");

  if (accessInfoLoading) return null;

  if (accessInfoError || !accessInfo) {
    return (
      <CenteredMessage
        icon={<AlertCircle className="size-8 text-muted-foreground" />}
        title="Form not found"
        body="This form doesn't exist, or the link is incorrect."
      />
    );
  }

  if (accessInfo.status !== "PUBLISHED") {
    return (
      <CenteredMessage
        icon={<Lock className="size-8 text-muted-foreground" />}
        title="Not accepting responses"
        body="This form isn't published right now. Check back later."
      />
    );
  }

  // Plan states, shown up front (the API enforces both again when a response is submitted).
  if (accessInfo.planUnavailable) {
    return (
      <CenteredMessage
        icon={<Lock className="size-8 text-muted-foreground" />}
        title="Temporarily unavailable"
        body="This form is paused right now. Please check back later or contact the person who shared it."
      />
    );
  }

  if (accessInfo.responseLimitReached) {
    return (
      <CenteredMessage
        icon={<Lock className="size-8 text-muted-foreground" />}
        title="Response limit reached"
        body="This form has received the maximum number of responses for this month. Please try again later."
      />
    );
  }

  if (needsLogin) {
    return (
      <CenteredMessage
        icon={<LogIn className="size-8 text-muted-foreground" />}
        title="Sign in to continue"
        body={`"${accessInfo.title}" only accepts responses from signed-in Dockett accounts.`}
        action={
          <Button asChild className="w-full">
            <Link href={`/signin?next=/form/${id}`}>Sign in</Link>
          </Button>
        }
      />
    );
  }

  if (needsCodeAttempt) {
    return (
      <AccessCodeGate
        submitting={formLoading}
        error={
          enteredCode !== undefined && formError
            ? "That code didn't work — double check and try again."
            : null
        }
        onSubmit={(code) => setEnteredCode(code)}
      />
    );
  }

  if (formError && !needsCodeAttempt) {
    if (formError.message === "ACCESS_CODE_REQUIRED" || formError.data?.code === "FORBIDDEN") {
      return (
        <AccessCodeGate
          submitting={formLoading}
          error="That code didn't work — try again."
          onSubmit={setEnteredCode}
        />
      );
    }
    return (
      <CenteredMessage
        icon={<AlertCircle className="size-8 text-muted-foreground" />}
        title="Can't load this form"
        body={formError.message || "Something went wrong."}
      />
    );
  }

  if (formLoading || !form) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (form?.submissionLayout === "ALL_AT_ONCE" && !flow.isLastStep) {
      flow.onNext();
      return;
    }
    if (!flow.validateAll()) return;

    try {
      await createSubmissionAsync({
        formId: id,
        values: flow.toSubmissionValues(),
        accessCode: enteredCode,
      });
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit");
    }
  }

  const classic = !form.template || form.template === "CLASSIC";

  return (
    <div
      className={
        classic
          ? "flex min-h-dvh items-center justify-center bg-background px-4 py-10"
          : "min-h-screen bg-background px-4 py-10 sm:py-16"
      }
    >
      <FormUploadProvider formId={id} accessCode={enteredCode}>
        <FormTemplateRenderer
          template={form.template}
          title={form.title}
          description={form.description}
          fields={fields}
          visibleFields={flow.visibleFields}
          values={flow.values}
          onChange={flow.onChange}
          missingFieldIds={flow.missingFieldIds}
          layout={form.submissionLayout}
          stepIndex={flow.step}
          stepCount={flow.stepCount}
          stepStartIndex={flow.stepStartIndex}
          isFirstStep={flow.isFirstStep}
          isLastStep={flow.isLastStep}
          onNext={flow.onNext}
          onBack={flow.onBack}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitted={submitted}
          errorMessage={submitError}
        />
      </FormUploadProvider>
    </div>
  );
}
