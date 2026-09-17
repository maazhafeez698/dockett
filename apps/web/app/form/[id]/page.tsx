// apps/web/app/form/[id]/page.tsx

"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";

import { useGetFormWithFields } from "~/hooks/api/form";
import { useCreateSubmission } from "~/hooks/api/form-submission";

import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";

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

  if (isLoading) return <div className="p-6">Loading form…</div>;
  if (!form) return <div className="p-6">Form not found.</div>;

  return (
    <main className="min-h-screen bg-black text-white px-6 py-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold mb-2">{form.title}</h1>
        {form.description ? <p className="text-white/60 mb-6">{form.description}</p> : null}

        {submitted ? (
          <div className="mb-6 rounded-md bg-white/5 p-4 text-white/80">
            Thank you. Your submission has been received.
          </div>
        ) : null}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {form.fields.map((f) => {
            const isMissing = missingFieldIds.has(f.id);

            return (
              <div key={f.id} className="space-y-1">
                <label className="block text-sm text-white/80">
                  {f.label}
                  {f.isRequired ? <span className="ml-1 text-red-400">*</span> : null}
                </label>

                {f.type === "TEXT" && (
                  <Input
                    value={values[f.id] ?? ""}
                    onChange={(e) => handleChange(f.id, e.target.value)}
                    placeholder={f.placeholder ?? ""}
                    required={f.isRequired}
                    aria-invalid={isMissing}
                    className={isMissing ? "border-red-400" : undefined}
                  />
                )}

                {f.type === "NUMBER" && (
                  <Input
                    type="number"
                    value={values[f.id] ?? ""}
                    onChange={(e) => handleChange(f.id, e.target.value)}
                    placeholder={f.placeholder ?? ""}
                    required={f.isRequired}
                    aria-invalid={isMissing}
                    className={isMissing ? "border-red-400" : undefined}
                  />
                )}

                {f.type === "EMAIL" && (
                  <Input
                    type="email"
                    value={values[f.id] ?? ""}
                    onChange={(e) => handleChange(f.id, e.target.value)}
                    placeholder={f.placeholder ?? ""}
                    required={f.isRequired}
                    aria-invalid={isMissing}
                    className={isMissing ? "border-red-400" : undefined}
                  />
                )}

                {f.type === "PASSWORD" && (
                  <Input
                    type="password"
                    value={values[f.id] ?? ""}
                    onChange={(e) => handleChange(f.id, e.target.value)}
                    placeholder={f.placeholder ?? ""}
                    required={f.isRequired}
                    aria-invalid={isMissing}
                    className={isMissing ? "border-red-400" : undefined}
                  />
                )}

                {f.type === "YES_NO" && (
                  <select
                    value={values[f.id] ?? ""}
                    onChange={(e) => handleChange(f.id, e.target.value)}
                    required={f.isRequired}
                    aria-invalid={isMissing}
                    className={`w-full rounded-md border bg-transparent px-3 py-2 text-sm text-white ${
                      isMissing ? "border-red-400" : ""
                    }`}
                  >
                    <option value="">Select...</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                )}

                {f.description ? (
                  <div className="text-sm text-white/60">{f.description}</div>
                ) : null}
                {isMissing ? (
                  <div className="text-sm text-red-400">This field is required.</div>
                ) : null}
              </div>
            );
          })}

          {error ? <div className="text-sm text-red-400">{error.message}</div> : null}
          {missingFieldIds.size > 0 ? (
            <div className="text-sm text-red-400">Please fill in all required fields.</div>
          ) : null}

          <div>
            <Button type="submit" disabled={status === "pending"} className="bg-white text-black">
              {status === "pending" ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </form>
      </div>
    </main>
  );
}
