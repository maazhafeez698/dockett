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

export interface EndpointNodeData {
  kicker: string;
  title: string;
  [key: string]: unknown;
}

const handleCls = "!size-[7px] !min-h-0 !min-w-0 !rounded-none !border-0 !bg-primary";

export const NODE_WIDTH = 188;
export const NODE_HEIGHT = 66;

export function FieldNode({ data }: { data: FieldNodeData }) {
  return (
    <div
      style={{ width: NODE_WIDTH }}
      className={`group relative bg-card px-2.5 py-2 transition-colors ${
        data.selected
          ? "border-2 border-primary shadow-[3px_3px_0_0_var(--hard-shadow)]"
          : "border border-foreground/70 hover:border-primary"
      }`}
    >
      <Handle id="t-in" type="target" position={Position.Top} className={handleCls} />
      <Handle id="l-in" type="target" position={Position.Left} className={handleCls} />
      <Handle id="r-in" type="target" position={Position.Right} className={handleCls} />

      <div className="mb-1 flex items-center justify-between gap-1">
        <span className="mono-label-sm truncate text-muted-foreground">{data.typeLabel}</span>
        <div className="flex items-center gap-1">
          {data.isRequired ? (
            <span className="mono-label-sm rounded-[2px] border border-foreground/60 px-1 py-px text-[8px]">
              REQ
            </span>
          ) : null}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              data.onDelete();
            }}
            className="block text-muted-foreground transition-colors hover:text-destructive md:hidden md:group-hover:block"
            aria-label="Delete field"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      </div>

      <div className="truncate text-[13px] leading-tight font-bold">{data.label}</div>

      <Handle id="b-out" type="source" position={Position.Bottom} className={handleCls} />
      <Handle id="l-out" type="source" position={Position.Left} className={handleCls} style={{ top: "70%" }} />
      <Handle id="r-out" type="source" position={Position.Right} className={handleCls} style={{ top: "70%" }} />
    </div>
  );
}

export function StartNode({ data }: { data: EndpointNodeData }) {
  return (
    <div
      style={{ width: NODE_WIDTH - 40 }}
      className="bg-primary px-2.5 py-2 text-primary-foreground"
    >
      <div className="mono-label-sm opacity-90">{data.kicker}</div>
      <div className="text-[13px] leading-tight font-bold">{data.title}</div>
      <Handle id="r-out" type="source" position={Position.Right} className={handleCls} />
      <Handle id="b-out" type="source" position={Position.Bottom} className={handleCls} />
      <Handle id="l-out" type="source" position={Position.Left} className={handleCls} />
    </div>
  );
}

export function EndNode({ data }: { data: EndpointNodeData }) {
  return (
    <div
      style={{ width: NODE_WIDTH - 40 }}
      className="bg-primary px-2.5 py-2 text-primary-foreground"
    >
      <Handle id="l-in" type="target" position={Position.Left} className={handleCls} />
      <Handle id="r-in" type="target" position={Position.Right} className={handleCls} />
      <Handle id="t-in" type="target" position={Position.Top} className={handleCls} />
      <div className="mono-label-sm opacity-90">{data.kicker}</div>
      <div className="text-[13px] leading-tight font-bold">{data.title}</div>
    </div>
  );
}
