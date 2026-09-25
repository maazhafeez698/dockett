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
import { BarChart3, Download, Eye, ExternalLink, FileStack } from "lucide-react";

import { AppShell } from "~/components/app-shell";
import { Button } from "~/components/ui/button";
import { useListForms } from "~/hooks/api/form";
import { useGetFormAnalytics, useListSubmissions, useExportData } from "~/hooks/api/analytics";
import { SubmissionDetail } from "~/components/analytics/submission-detail";
import { toast } from "sonner";

const DEVICE_COLORS: Record<string, string> = {
  DESKTOP: "var(--primary)",
  MOBILE: "#22C55E",
  TABLET: "#F59E0B",
  UNKNOWN: "var(--muted-foreground)",
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight">{value}</p>
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
    fields: { id: string; label: string }[];
    submissions: {
      id: string;
      createdAt: string | null;
      isAuthenticated: boolean;
      values: { fieldId: string; value: string }[];
    }[];
  },
) {
  const header = ["#", "Submitted At", ...data.fields.map((f) => f.label)];

  const rows = data.submissions.map((s, i) => {
    const byField = new Map(s.values.map((v) => [v.fieldId, v.value]));
    return [
      String(i + 1),
      formatCsvTimestamp(s.createdAt),
      ...data.fields.map((f) => byField.get(f.id) ?? ""),
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
    <div className="glass animate-pulse rounded-2xl p-5">
      <div className="h-3 w-20 rounded bg-muted" />
      <div className="mt-3 h-8 w-14 rounded bg-muted" />
    </div>
  );
}

export default function AnalyticsPage() {
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

  return (
    <AppShell>
      <div className="flex h-full">
        {/* Forms sidebar */}
        <aside className="w-64 shrink-0 border-r border-border/60 px-4 py-6">
          <h1 className="text-lg font-semibold">Analytics</h1>
          <p className="mt-1 text-xs text-muted-foreground">Select a form to view insights</p>

          <p className="mt-6 mb-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            Forms
          </p>
          {formsLoading ? (
            <div className="text-xs text-muted-foreground">Loading...</div>
          ) : forms && forms.length > 0 ? (
            <ul className="space-y-0.5">
              {forms.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFormId(f.id);
                      setSelectedSubmissionId(null);
                    }}
                    className={`flex w-full items-center gap-2 truncate rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                      selectedFormId === f.id
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    <FileStack className="size-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{f.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No forms yet.</p>
          )}
        </aside>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto px-8 py-8">
          {!selectedFormId || !selectedForm ? (
            <div className="flex h-full min-h-[60vh] flex-col items-center justify-center text-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted">
                <BarChart3 className="size-6 text-muted-foreground" />
              </div>
              <p className="text-lg font-semibold">View Analytics</p>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                Select a form from the sidebar to view its response analytics and insights.
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
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">{selectedForm.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {analytics ? `${analytics.totalResponses} responses` : "—"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/forms/${selectedForm.id}`}>
                      <ExternalLink className="mr-1.5 size-3.5" /> Open Builder
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={exporting || !analytics || analytics.totalResponses === 0}
                    onClick={handleExport}
                  >
                    <Download className="mr-1.5 size-3.5" />{" "}
                    {exporting ? "Exporting..." : "Export CSV"}
                  </Button>
                </div>
              </div>

              {analyticsLoading || !analytics ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <StatCardSkeleton />
                    <StatCardSkeleton />
                    <StatCardSkeleton />
                  </div>
                  <div className="glass h-64 animate-pulse rounded-2xl" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <StatCard label="Total Responses" value={analytics.totalResponses} />
                    <StatCard label="Completion Rate" value={`${analytics.completionRate}%`} />
                    <StatCard label="Total Views" value={analytics.totalViews} />
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
                    <div className="glass rounded-2xl p-5">
                      <p className="text-sm font-semibold">Response Timeline</p>
                      <div className="mt-4 h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.timeline}>
                            <CartesianGrid
                              strokeDasharray="3 3"
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
                              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                              axisLine={false}
                              tickLine={false}
                              interval="preserveStartEnd"
                            />
                            <YAxis
                              allowDecimals={false}
                              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                              axisLine={false}
                              tickLine={false}
                              width={24}
                            />
                            <Tooltip
                              labelFormatter={(d: string) => new Date(d).toLocaleDateString()}
                              contentStyle={{
                                background: "var(--popover)",
                                border: "1px solid var(--border)",
                                borderRadius: 8,
                                fontSize: 12,
                              }}
                            />
                            <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="glass rounded-2xl p-5">
                      <p className="text-sm font-semibold">Device Breakdown</p>
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
                                  innerRadius={45}
                                  outerRadius={70}
                                  paddingAngle={2}
                                >
                                  {deviceData.map((d) => (
                                    <Cell key={d.name} fill={DEVICE_COLORS[d.name]} />
                                  ))}
                                </Pie>
                                <Tooltip
                                  contentStyle={{
                                    background: "var(--popover)",
                                    border: "1px solid var(--border)",
                                    borderRadius: 8,
                                    fontSize: 12,
                                  }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="mt-3 space-y-1.5">
                            {deviceData.map((d) => (
                              <div
                                key={d.name}
                                className="flex items-center justify-between text-xs"
                              >
                                <span className="flex items-center gap-1.5 text-muted-foreground">
                                  <span
                                    className="size-2 rounded-full"
                                    style={{ background: DEVICE_COLORS[d.name] }}
                                  />
                                  {d.name.charAt(0) + d.name.slice(1).toLowerCase()}
                                </span>
                                <span className="font-medium">{d.value}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="glass rounded-2xl p-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Latest Responses</p>
                      <span className="text-xs text-muted-foreground">
                        {submissionsLoading ? "Loading..." : `${submissions?.length ?? 0} total`}
                      </span>
                    </div>

                    {submissionsLoading ? (
                      <div className="mt-4 space-y-2">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="glass h-14 animate-pulse rounded-xl" />
                        ))}
                      </div>
                    ) : latest.length === 0 ? (
                      <p className="mt-4 text-sm text-muted-foreground">No responses yet.</p>
                    ) : (
                      <div className="mt-4 space-y-2">
                        {latest.map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between rounded-xl border border-border/50 px-4 py-3"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                                {s.label.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{s.label}</p>
                                <p className="text-xs text-muted-foreground">
                                  {s.createdAt ? new Date(s.createdAt).toLocaleString() : "—"}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                  s.isComplete
                                    ? "bg-green-500/15 text-green-500"
                                    : "bg-amber-500/15 text-amber-500"
                                }`}
                              >
                                {s.isComplete ? "Completed" : "Partial"}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => setSelectedSubmissionId(s.id)}
                              >
                                <Eye className="size-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
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
