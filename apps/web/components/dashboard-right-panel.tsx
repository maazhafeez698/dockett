// apps/web/components/dashboard-right-panel.tsx

import Link from "next/link";
import { Sparkles } from "lucide-react";

interface DashboardRightPanelProps {
  totalForms: number;
  publishedForms: number;
}

export function DashboardRightPanel({ totalForms, publishedForms }: DashboardRightPanelProps) {
  return (
    <div className="flex flex-col gap-6 p-5">
      <div>
        <h3 className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Overview</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="glass rounded-xl p-3">
            <div className="text-2xl font-semibold">{totalForms}</div>
            <div className="text-xs text-muted-foreground">Total forms</div>
          </div>
          <div className="glass rounded-xl p-3">
            <div className="text-2xl font-semibold">{publishedForms}</div>
            <div className="text-xs text-muted-foreground">Published</div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Quick actions</h3>
        <div className="space-y-2">
          <Link href="/dashboard/analytics" className="glass block rounded-xl px-3 py-2.5 text-sm hover:bg-muted/40">
            Analytics
          </Link>
          <Link href="/dashboard/templates" className="glass block rounded-xl px-3 py-2.5 text-sm hover:bg-muted/40">
            Browse templates
          </Link>
        </div>
      </div>

      {/* Static for now — becomes real once Stripe/plans (Phase 7) exist. */}
      <div className="glass-strong mt-auto rounded-2xl p-4">
        <div className="mb-2 flex items-center gap-1.5 text-sm font-medium">
          <Sparkles className="size-4 text-primary" />
          Formless Pro
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Unlimited forms, advanced analytics, and AI generation credits.
        </p>
        <div className="rounded-lg bg-muted/60 px-3 py-2 text-center text-xs text-muted-foreground">Coming soon</div>
      </div>
    </div>
  );
}
