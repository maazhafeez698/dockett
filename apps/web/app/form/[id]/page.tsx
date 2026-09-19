// apps/web/app/form/[id]/page.tsx

"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { useGetFormWithFields } from "~/hooks/api/form";
import { useCreateSubmission } from "~/hooks/api/form-submission";
import { Button } from "~/components/ui/button";
import { FormFieldRenderer } from "~/components/form-field-renderer";
import { getFormTheme } from "~/lib/form-themes";

export default function PublicFormPage() {
  const params = useParams();
  const formId = params?.id as string | undefined;

  const { form, isLoading } = useGetFormWithFields(formId ?? "");
  const { createSubmissionAsync, status, error } = useCreateSubmission();

  const [values, setValues] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [missingFieldIds, setMissingFieldIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!form?.fields) return;
    const initial: Record<string, string> = {};
    for (const f of form.fields) initial[f.id] = "";
    setValues(initial);
  }, [form?.fields]);

  const handleChange = (fieldId: string, v: string) => {
    setValues((s) => ({ ...s, [fieldId]: v }));
    setMissingFieldIds((s) => {
      if (!s.has(fieldId)) return s;
      const next = new Set(s);
      next.delete(fieldId);
      return next;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formId || !form?.fields) return;

    // Client-side check purely for immediate feedback — the server
    // re-validates this regardless, since a client check alone can't be
    // trusted (anyone can call the API directly).
    const missing = form.fields.filter((f) => f.isRequired && !values[f.id]?.trim());

    if (missing.length > 0) {
      setMissingFieldIds(new Set(missing.map((f) => f.id)));
      return;
    }

    const payload = {
      formId,
      values: Object.entries(values).map(([fieldId, value]) => ({ fieldId, value })),
    };

    try {
      await createSubmissionAsync(payload);
      setSubmitted(true);
      setValues((s) => Object.fromEntries(Object.keys(s).map((k) => [k, ""])));
      setMissingFieldIds(new Set());
    } catch (err) {
      console.error("Submission failed:", err);
    }
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading form…
      </main>
    );
  }

  if (!form) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Form not found.
      </main>
    );
  }

  const theme = getFormTheme(form.theme);

  return (
    <main className="min-h-screen bg-background">
      {/* Theme hero band — the vibrant accent-card treatment, applied here
          as a page header rather than a literal card. */}
      <div
        className="px-6 py-16"
        style={{
          background: `linear-gradient(135deg, ${theme.gradient[0]}, ${theme.gradient[1]})`,
        }}
      >
        <div className="mx-auto max-w-2xl" style={{ color: theme.onGradient }}>
          <h1 className="text-3xl font-semibold tracking-tight">{form.title}</h1>
          {form.description ? <p className="mt-2 opacity-80">{form.description}</p> : null}
        </div>
      </div>

      <div className="mx-auto -mt-8 max-w-2xl px-6 pb-16">
        <div className="glass-strong rounded-3xl p-6 sm:p-8">
          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <CheckCircle2 className="size-10" style={{ color: theme.accent }} />
              <p className="text-lg font-medium">Thank you.</p>
              <p className="text-sm text-muted-foreground">Your submission has been received.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-6">
              {form.fields.map((f) => (
                <FormFieldRenderer
                  key={f.id}
                  field={f}
                  value={values[f.id] ?? ""}
                  onChange={(v) => handleChange(f.id, v)}
                  isMissing={missingFieldIds.has(f.id)}
                  accent={theme.accent}
                />
              ))}

              {error ? <div className="text-sm text-destructive">{error.message}</div> : null}
              {missingFieldIds.size > 0 ? (
                <div className="text-sm text-destructive">Please fill in all required fields.</div>
              ) : null}

              <Button
                type="submit"
                disabled={status === "pending"}
                style={{ background: theme.accent, color: "#fff" }}
                className="w-full border-0 hover:opacity-90"
              >
                {status === "pending" ? "Submitting..." : "Submit"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
