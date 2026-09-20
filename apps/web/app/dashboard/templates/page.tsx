// apps/web/app/dashboard/templates/page.tsx

import { AppShell } from "~/components/app-shell";
import { LayoutTemplate } from "lucide-react";

const UPCOMING_CATEGORIES = [
  { name: "Professional", blurb: "Clean, corporate-ready forms" },
  { name: "Education", blurb: "Lecture sign-ups, quizzes, feedback" },
  { name: "Team & collaboration", blurb: "Internal requests, planning" },
  { name: "Developer console", blurb: "IDE-inspired, monospace, technical" },
  { name: "Retro / Windows XP", blurb: "Playful, nostalgic chrome" },
  { name: "+ 7 more", blurb: "Each with its own structure, not just a palette" },
];

export default function TemplatesPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Form Templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A dedicated set of genuinely distinct, structurally different templates — not the same
            layout recolored. Coming in its own phase.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {UPCOMING_CATEGORIES.map((c) => (
            <div key={c.name} className="glass flex items-center gap-3 rounded-2xl p-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
                <LayoutTemplate className="size-4 text-primary" />
              </div>
              <div>
                <div className="text-sm font-medium">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.blurb}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
