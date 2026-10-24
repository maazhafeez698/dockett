import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "~/components/ui/badge";

export interface TicketForm {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  createdAt?: string | Date | null;
  planSuspended?: boolean;
}

export function StatusTag({ status, suspended }: { status: string; suspended?: boolean }) {
  if (suspended) return <Badge variant="destructive">Suspended</Badge>;
  if (status === "PUBLISHED") return <Badge variant="secondary">Published</Badge>;
  if (status === "DRAFT") return <Badge variant="ember">Draft</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

const TILT = ["-rotate-[0.6deg]", "rotate-[0.5deg]", "rotate-[0.35deg]", "-rotate-[0.45deg]"];

interface FormTicketCardProps {
  form: TicketForm;
  index?: number;
  action?: ReactNode;
}

export function FormTicketCard({ form, index = 0, action }: FormTicketCardProps) {
  return (
    <Link
      href={`/dashboard/forms/${form.id}`}
      className={`group relative flex min-h-[132px] flex-col border border-border border-t-2 border-t-foreground bg-card p-3.5 transition-transform duration-200 hover:z-10 hover:-translate-y-0.5 hover:rotate-0 hover:border-foreground/60 hover:border-t-primary motion-reduce:transform-none ${TILT[index % TILT.length]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-[17px] leading-tight font-bold tracking-[-0.03em]">
          {form.title}
        </h3>
        {action}
      </div>
      <p className="mt-1.5 line-clamp-3 text-xs leading-snug text-muted-foreground">
        {form.description || "No description"}
      </p>
      <div className="mt-auto flex items-center gap-2 pt-3">
        <StatusTag status={form.status} suspended={form.planSuspended} />
        <span className="font-mono text-[10px] text-muted-foreground">
          {form.createdAt ? new Date(form.createdAt).toLocaleDateString() : ""}
        </span>
      </div>
    </Link>
  );
}
