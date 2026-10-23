// apps/web/app/dashboard/analytics/page.tsx
//
// Layout: a slim sidebar of the user's forms on the left, and on the right
// either an empty state, the selected form's analytics overview, or (once
// the eye icon on a response card is clicked) that single submission's
// full detail. The overview and detail views share the same ordered
// submission list so prev/next paging in the detail view walks the real
// response order, not just the handful of cards shown on the overview.

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Eye, ExternalLink } from "lucide-react";

import { AppShell } from "~/components/app-shell";
import { useAuthGuard } from "~/hooks/use-auth-guard";
import { parseStoredFiles } from "~/lib/file-answer";
import { Button } from "~/components/ui/button";
import { useListForms } from "~/hooks/api/form";
import { useGetFormAnalytics, useListSubmissions, useExportData } from "~/hooks/api/analytics";
import { SubmissionDetail } from "~/components/analytics/submission-detail";
import { toast } from "sonner";

const DEVICE_COLORS: Record<string, string> = {
  DESKTOP: "var(--primary)",
  MOBILE: "var(--foreground)",
  TABLET: "color-mix(in srgb, var(--foreground) 35%, var(--card))",
  UNKNOWN: "var(--muted-foreground)",
};

const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--foreground)",
  borderRadius: 0,
  fontSize: 12,
  fontFamily: "var(--font-mono)",
} as const;

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div
      className={`border p-4 ${
        accent ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
      }`}
    >
      <p className={`mono-label-sm ${accent ? "opacity-90" : "text-muted-foreground"}`}>{label}</p>
      <p className="font-display mt-2 text-[44px] leading-none font-extrabold">{value}</p>
    </div>
  );
}

function toCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** "2026-09-24 5:10 PM" — readable in a spreadsheet, not an ISO string. */
function formatCsvTimestamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const datePart = d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timePart = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${datePart} ${timePart}`;
}

/** Real per-field export — one column per form field, using the field's
 * exact label as the header, in field order. A serial number stands in for
 * a submission id (meaningless to a form owner), and there's no "signed
 * in" column — not useful information for most owners reading a CSV. */
function downloadSubmissionsCsv(
  formTitle: string,
  data: {
    fields: { id: string; label: string; type: string }[];
    submissions: {
      id: string;
      createdAt: string | null;
      isAuthenticated: boolean;
      respondentEmail?: string | null;
      version?: number | null;
      values: { fieldId: string; value: string }[];
    }[];
  },
) {
  const header = ["#", "Submitted At", "Email", "Version", ...data.fields.map((f) => f.label)];

  const rows = data.submissions.map((s, i) => {
    const byField = new Map(s.values.map((v) => [v.fieldId, v.value]));
    return [
      String(i + 1),
      formatCsvTimestamp(s.createdAt),
      s.respondentEmail ?? "",
      s.version ? String(s.version) : "",
      ...data.fields.map((f) => {
        const raw = byField.get(f.id) ?? "";
        // file answers are stored as references; the export lists file names
        return f.type === "FILE_UPLOAD" ? parseStoredFiles(raw).map((x) => x.name).join("; ") : raw;
      }),
    ];
  });

  const csv = [header, ...rows].map((row) => row.map(toCsvCell).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${formTitle.replace(/\s+/g, "-").toLowerCase() || "form"}-responses.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function StatCardSkeleton() {
  return (
    <div className="animate-pulse border border-border bg-card p-4">
      <div className="h-3 w-20 bg-muted" />
      <div className="mt-3 h-10 w-16 bg-muted" />
    </div>
  );
}

export default function AnalyticsPage() {
  const { ready } = useAuthGuard();
  const { forms, isLoading: formsLoading } = useListForms();
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const selectedForm = forms?.find((f) => f.id === selectedFormId) ?? null;
  const { analytics, isLoading: analyticsLoading } = useGetFormAnalytics(selectedFormId);
  const { submissions, isLoading: submissionsLoading } = useListSubmissions(selectedFormId);
  const { fetchExportData } = useExportData();

  async function handleExport() {
    if (!selectedForm) return;
    setExporting(true);
    try {
      const data = await fetchExportData(selectedForm.id);
      if (data.submissions.length === 0) {
        toast.info("No responses to export yet.");
        return;
      }
      downloadSubmissionsCsv(selectedForm.title, data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to export responses");
    } finally {
      setExporting(false);
    }
  }

  const orderedIds = [...(submissions ?? [])].reverse().map((s) => s.id);
  const latest = [...(submissions ?? [])].reverse().slice(0, 10);

  const deviceData = analytics
    ? (["DESKTOP", "MOBILE", "TABLET", "UNKNOWN"] as const)
        .map((k) => ({ name: k, value: analytics.deviceBreakdown[k] }))
        .filter((d) => d.value > 0)
    : [];
  const deviceTotal = deviceData.reduce((n, d) => n + d.value, 0);

  if (!ready) return null;

  return (
    <AppShell docLabel="Analytics">
      <div className="grid gap-4 p-3 sm:p-4 lg:grid-cols-[224px_minmax(0,1fr)] lg:p-5">
        {/* Forms list */}
        <aside className="self-start border border-border bg-card p-4 lg:sticky lg:top-0">
          <h1 className="font-display text-2xl font-extrabold">Analytics</h1>
          <p className="mono-label-sm mt-4 text-muted-foreground">Forms</p>
          {formsLoading ? (
            <div className="mt-2 text-xs text-muted-foreground">Loading...</div>
          ) : forms && forms.length > 0 ? (
            <ul className="mt-2 max-h-[40vh] overflow-y-auto lg:max-h-[60vh]">
              {forms.map((f) => (
                <li key={f.id} className="border-b border-dashed border-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFormId(f.id);
                      setSelectedSubmissionId(null);
                    }}
                    aria-current={selectedFormId === f.id ? "true" : undefined}
                    className={`my-0.5 flex w-full items-center gap-2 truncate rounded-[2px] px-2 py-2 text-left font-mono text-[11px] transition-colors ${
                      selectedFormId === f.id
                        ? "bg-primary font-bold text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <span className="truncate">{f.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">No forms yet.</p>
          )}
        </aside>

        {/* Main content */}
        <div className="min-w-0">
          {!selectedFormId || !selectedForm ? (
            <div className="flex min-h-[50vh] flex-col items-center justify-center border border-dashed border-foreground/40 p-8 text-center">
              <p className="numeral text-[72px]">00</p>
              <p className="font-display mt-3 text-2xl font-extrabold">View analytics</p>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                Select a form to see its responses, completion rate and devices.
              </p>
            </div>
          ) : selectedSubmissionId ? (
            <SubmissionDetail
              submissionId={selectedSubmissionId}
              orderedIds={orderedIds}
              onSelect={setSelectedSubmissionId}
              onClose={() => setSelectedSubmissionId(null)}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display truncate text-[28px] leading-tight font-extrabold text-primary">
                    {selectedForm.title}
                  </h2>
                  <p className="mono-label-sm mt-1 text-muted-foreground">
                    {analytics ? `${analytics.totalResponses} responses` : "—"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/forms/${selectedForm.id}`}>
                      Open builder <ExternalLink />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={exporting || !analytics || analytics.totalResponses === 0}
                    onClick={handleExport}
                  >
                    <Download /> {exporting ? "Exporting..." : "Export CSV"}
                  </Button>
                </div>
              </div>

              {analyticsLoading || !analytics ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <StatCardSkeleton />
                    <StatCardSkeleton />
                    <StatCardSkeleton />
                  </div>
                  <div className="h-64 animate-pulse border border-border bg-card" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <StatCard label="Total responses" value={analytics.totalResponses} />
                    <StatCard label="Completion rate" value={`${analytics.completionRate}%`} accent />
                    <StatCard label="Total views" value={analytics.totalViews} />
                  </div>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_300px]">
                    <div className="border border-border bg-card p-4">
                      <p className="font-display text-lg font-extrabold">Response timeline</p>
                      <div className="mt-3 h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.timeline}>
                            <CartesianGrid
                              strokeDasharray="2 4"
                              stroke="var(--border)"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="date"
                              tickFormatter={(d: string) =>
                                new Date(d).toLocaleDateString(undefined, {
                                  day: "2-digit",
                                  month: "short",
                                })
                              }
                              tick={{ fontSize: 10, fill: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}
                              axisLine={false}
                              tickLine={false}
                              interval="preserveStartEnd"
                            />
                            <YAxis
                              allowDecimals={false}
                              tick={{ fontSize: 10, fill: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}
                              axisLine={false}
                              tickLine={false}
                              width={24}
                            />
                            <Tooltip
                              cursor={{ fill: "var(--accent)" }}
                              labelFormatter={(d: string) => new Date(d).toLocaleDateString()}
                              contentStyle={TOOLTIP_STYLE}
                            />
                            <Bar dataKey="count" fill="var(--primary)" radius={0} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="border border-border bg-card p-4">
                      <p className="font-display text-lg font-extrabold">Devices</p>
                      {deviceData.length === 0 ? (
                        <div className="flex h-56 items-center justify-center text-xs text-muted-foreground">
                          No views yet
                        </div>
                      ) : (
                        <>
                          <div className="h-40">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={deviceData}
                                  dataKey="value"
                                  nameKey="name"
                                  innerRadius={46}
                                  outerRadius={72}
                                  paddingAngle={0}
                                  stroke="var(--card)"
                                  strokeWidth={2}
                                >
                                  {deviceData.map((d) => (
                                    <Cell key={d.name} fill={DEVICE_COLORS[d.name]} />
                                  ))}
                                </Pie>
                                <Tooltip contentStyle={TOOLTIP_STYLE} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1">
                            {deviceData.map((d) => (
                              <span
                                key={d.name}
                                className="mono-label-sm flex items-center gap-1.5 text-muted-foreground"
                              >
                                <span
                                  className="size-2 rounded-[1px]"
                                  style={{ background: DEVICE_COLORS[d.name] }}
                                />
                                {d.name.charAt(0) + d.name.slice(1).toLowerCase()}{" "}
                                {Math.round((d.value / deviceTotal) * 100)}%
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="border border-border bg-card p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-display text-lg font-extrabold">Latest responses</p>
                      <span className="mono-label-sm text-muted-foreground">
                        {submissionsLoading ? "Loading..." : `${submissions?.length ?? 0} total`}
                      </span>
                    </div>

                    {submissionsLoading ? (
                      <div className="mt-3 space-y-2">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="h-12 animate-pulse border border-border bg-muted" />
                        ))}
                      </div>
                    ) : latest.length === 0 ? (
                      <p className="mt-3 text-sm text-muted-foreground">No responses yet.</p>
                    ) : (
                      <ul className="mt-2">
                        {latest.map((s) => (
                          <li
                            key={s.id}
                            className="flex items-center justify-between gap-3 border-b border-dashed border-border py-2.5 last:border-b-0"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex size-8 shrink-0 items-center justify-center rounded-[3px] bg-primary/15 font-mono text-[10px] font-bold text-primary">
                                {s.label.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{s.label}</p>
                                <p className="font-mono text-[10px] text-muted-foreground">
                                  {s.createdAt ? new Date(s.createdAt).toLocaleString() : "—"}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`mono-label-sm rounded-[2px] border px-1.5 py-[3px] ${
                                  s.isComplete
                                    ? "border-success/60 text-success"
                                    : "border-amber-500/60 text-amber-600 dark:text-amber-400"
                                }`}
                              >
                                {s.isComplete ? "Completed" : "Partial"}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="View response"
                                onClick={() => setSelectedSubmissionId(s.id)}
                              >
                                <Eye />
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
