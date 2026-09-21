// apps/web/components/field-node.tsx

import { Handle, Position } from "@xyflow/react";
import { Trash2 } from "lucide-react";

export interface FieldNodeData {
  label: string;
  typeLabel: string;
  isRequired: boolean;
  description?: string | null;
  selected: boolean;
  onDelete: () => void;
  [key: string]: unknown;
}

export function FieldNode({ data }: { data: FieldNodeData }) {
  return (
    <div
      className={`w-[260px] rounded-xl border bg-card p-3 shadow-sm transition-colors ${
        data.selected ? "border-primary ring-2 ring-primary/40" : "border-border"
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-primary" />

      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-mono text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
          {data.typeLabel}
        </span>
        <div className="flex items-center gap-1.5">
          {data.isRequired ? (
            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
              REQ
            </span>
          ) : null}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              data.onDelete();
            }}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Delete field"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="truncate text-sm font-medium">{data.label}</div>
      {data.description ? (
        <div className="mt-0.5 truncate text-xs text-muted-foreground">{data.description}</div>
      ) : null}

      <Handle type="source" position={Position.Bottom} className="!bg-primary" />
    </div>
  );
}
