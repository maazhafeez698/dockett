// apps/web/app/form/[id]/submissions/page.tsx

"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useGetSubmissionsByFormId } from "~/hooks/api/form-submission";
import { useGetFields } from "~/hooks/api/form-field";

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

  const loading = subsLoading || fieldsLoading;

  if (loading) return <div className="min-h-screen bg-black px-6 py-6 text-white">Loading submissions…</div>;
  if (error) return <div className="min-h-screen bg-black px-6 py-6 text-red-400">Error loading submissions</div>;

  return (
    <main className="min-h-screen bg-black px-6 py-6 text-white">
      <div className="mx-auto max-w-5xl rounded-md border border-white/10 bg-white/5 p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-white/60">Form responses</p>
            <h2 className="text-2xl font-semibold tracking-tight">Submissions</h2>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/70">
            Total: {rows.length}
          </div>
        </div>

        {fields && fields.length > 0 && (
          <div className="mb-5 text-xs text-white/50">
            Fields: {fields.map((f) => f.label).join(", ")}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="rounded-md border border-white/10 bg-white/5 p-4 text-sm text-white/60">
            No submissions yet.
          </div>
        ) : (
          <div className="overflow-auto rounded-md border border-white/10">
            <table className="min-w-full table-fixed text-sm">
              <thead className="bg-zinc-900 text-left text-white">
                <tr>
                  <th className="w-1/5 px-4 py-3 font-medium text-white/80">Submitted</th>
                  {(fields ?? [])
                    .slice()
                    .sort((a, b) => parseFloat(a.index) - parseFloat(b.index))
                    .map((f) => (
                      <th key={f.id} className="px-4 py-3 text-left text-sm font-medium text-white/80">
                        {f.label}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-white/10 odd:bg-white/5 even:bg-zinc-950/40">
                    <td className="px-4 py-3 align-top text-xs text-white/70">
                      {r.createdAt ? new Date(r.createdAt).toLocaleString() : "-"}
                    </td>

                    {(fields ?? [])
                      .slice()
                      .sort((a, b) => parseFloat(a.index) - parseFloat(b.index))
                      .map((f) => {
                        const v = r.values?.find((x) => x.fieldId === f.id);
                        return (
                          <td key={f.id} className="px-4 py-3 align-top text-xs text-white/80">
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
    </main>
  );
}
