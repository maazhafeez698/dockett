// apps/web/app/form/[id]/submissions/page.tsx

"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useGetSubmissionsByFormId } from "~/hooks/api/form-submission";
import { useGetFields } from "~/hooks/api/form-field";
import { AppShell } from "~/components/app-shell";

type Submission = {
  id: string;
  formId?: string | null;
  values?: { fieldId: string; value: string }[] | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export default function FormSubmissions() {
  const params = useParams();
  const formId = params?.id as string | undefined;

  const { submissions, isLoading: subsLoading, error } = useGetSubmissionsByFormId(formId ?? "");
  const { fields, isLoading: fieldsLoading } = useGetFields(formId ?? "");

  const rows = useMemo(() => (submissions ?? []) as Submission[], [submissions]);
  const orderedFields = useMemo(
    () => (fields ?? []).slice().sort((a, b) => parseFloat(a.index) - parseFloat(b.index)),
    [fields],
  );

  const loading = subsLoading || fieldsLoading;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="glass-strong rounded-2xl p-6">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Form responses</p>
              <h1 className="text-2xl font-semibold tracking-tight">Submissions</h1>
            </div>
            <div className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
              Total: {rows.length}
            </div>
          </div>

          {loading ? (
            <div className="glass rounded-xl p-6 text-sm text-muted-foreground">
              Loading submissions...
            </div>
          ) : error ? (
            <div className="glass rounded-xl p-6 text-sm text-destructive">
              Error loading submissions.
            </div>
          ) : rows.length === 0 ? (
            <div className="glass rounded-xl p-6 text-sm text-muted-foreground">
              No submissions yet.
            </div>
          ) : (
            <div className="overflow-auto rounded-xl border border-border">
              <table className="min-w-full table-fixed text-sm">
                <thead className="bg-muted/60 text-left">
                  <tr>
                    <th className="w-1/5 px-4 py-3 font-medium text-muted-foreground">Submitted</th>
                    {orderedFields.map((f) => (
                      <th
                        key={f.id}
                        className="px-4 py-3 text-left font-medium text-muted-foreground"
                      >
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border odd:bg-muted/20">
                      <td className="px-4 py-3 align-top text-xs text-muted-foreground">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString() : "-"}
                      </td>
                      {orderedFields.map((f) => {
                        const v = r.values?.find((x) => x.fieldId === f.id);
                        return (
                          <td key={f.id} className="px-4 py-3 align-top text-xs">
                            {v ? v.value : "-"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
