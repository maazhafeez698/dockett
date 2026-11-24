"use client";

import { useEffect, useState } from "react";

export const DOC_NUMBER = "DK-4721";

export const pad2 = (n: number) => String(Math.max(0, n)).padStart(2, "0");

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function formatDocDate(d: Date) {
  return `${pad2(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

interface DocStripProps {
  // Page name, e.g. "CREATE FORM". Rendered after the document number in Ember.
  label: string;
  // ZONE cell — the number of live (published) forms, zero-padded.
  zone?: string;
  className?: string;
}

function Cell({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 px-2.5 py-1.5 ${className ?? ""}`}>
      <div className="mono-label-sm text-muted-foreground">{label}</div>
      <div className="truncate font-mono text-[11px] leading-tight font-bold tracking-[0.04em] uppercase">
        {children}
      </div>
    </div>
  );
}

export function DocStrip({ label, zone = "07", className }: DocStripProps) {
  const [date, setDate] = useState("");
  useEffect(() => setDate(formatDocDate(new Date())), []);

  return (
    <div
      className={`grid grid-cols-[1fr_auto] border border-foreground/70 bg-card sm:grid-cols-[minmax(0,2.4fr)_repeat(4,minmax(0,1fr))] ${className ?? ""}`}
    >
      <Cell label="Document" className="text-primary sm:border-r sm:border-foreground/40">
        {DOC_NUMBER} · {label}
      </Cell>
      <Cell label="Type" className="hidden sm:block sm:border-r sm:border-foreground/40">
        STD
      </Cell>
      <Cell label="Class" className="hidden sm:block sm:border-r sm:border-foreground/40">
        A1
      </Cell>
      <Cell label="Zone" className="hidden sm:block sm:border-r sm:border-foreground/40">
        {zone}
      </Cell>
      <Cell label="Date" className="text-right sm:text-left">
        {date || "—"}
      </Cell>
    </div>
  );
}
