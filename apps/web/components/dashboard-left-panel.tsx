// apps/web/components/dashboard-left-panel.tsx
//
// Left column of the Create window: the giant live-forms numeral, the
// workspace overview (Total / Live / Replies) and shortcuts.

import Link from "next/link";
import { ArrowUpRight, LayoutTemplate, Sparkles } from "lucide-react";
import { pad2 } from "~/components/doc-strip";

interface DashboardLeftPanelProps {
  totalForms: number;
  publishedForms: number;
  replies: number;
  closedForms?: number;
  draftForms?: number;
  loading?: boolean;
}

export function DashboardLeftPanel({
  totalForms,
  publishedForms,
  closedForms = 0,
  draftForms,
  loading,
}: DashboardLeftPanelProps) {
  const drafts = draftForms ?? Math.max(0, totalForms - publishedForms - closedForms);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 border border-border bg-card px-3 py-2 text-xs font-medium">
        <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
        Dockett workspace
      </div>

      <div className="px-1">
        <div className="numeral text-[104px]" aria-label={`${totalForms} total forms`}>
          {loading ? "–" : totalForms}
        </div>
        <div className="mono-label-sm mt-1 text-muted-foreground">Total forms</div>
      </div>

      <section className="bg-primary p-3.5 text-primary-foreground" aria-label="Overview">
        <h3 className="text-sm font-bold">Overview</h3>
        <dl className="mt-2 grid grid-cols-3 gap-2">
          {[
            { v: publishedForms, l: "Live" },
            { v: closedForms, l: "Closed" },
            { v: drafts, l: "Draft" },
          ].map((s) => (
            <div key={s.l}>
              <dd className="font-display text-[34px] leading-none font-extrabold">
                {loading ? "–" : s.v}
              </dd>
              <dt className="mono-label-sm mt-1 opacity-90">{s.l}</dt>
            </div>
          ))}
        </dl>
      </section>

      <Link
        href="/dashboard/analytics"
        className="group flex items-center justify-between border border-border bg-card px-3 py-2.5 font-mono text-[11px] transition-colors hover:border-foreground/60"
      >
        <span className="flex items-center gap-2">
          <span aria-hidden="true">▤</span> Analytics
        </span>
        <ArrowUpRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </Link>
      <Link
        href="/dashboard/templates"
        className="group flex items-center justify-between border border-border bg-card px-3 py-2.5 font-mono text-[11px] transition-colors hover:border-foreground/60"
      >
        <span className="flex items-center gap-2">
          <LayoutTemplate className="size-3.5" aria-hidden="true" /> Browse templates
        </span>
        <ArrowUpRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </Link>
    </div>
  );
}

export { pad2 };
