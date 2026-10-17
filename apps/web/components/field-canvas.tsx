// apps/web/components/field-canvas.tsx
//
// The Canvas (node) view. The form is a flow: START → each field → END,
// laid out as a serpentine grid. Drag a node to a new slot to reorder; drag
// from one node's handle to another to move it there; click the ADD NODE
// toolbar (or drag from it) to add fields.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MarkerType,
  MiniMap,
  Panel,
  useReactFlow,
  useViewport,
  type Node,
  type Edge,
  type Connection,
  type NodeMouseHandler,
  type OnNodeDrag,
} from "@xyflow/react";
// React Flow ships this stylesheet without TypeScript declarations.
import "@xyflow/react/dist/style.css";

import {
  EndNode,
  FieldNode,
  NODE_HEIGHT,
  NODE_WIDTH,
  StartNode,
  type EndpointNodeData,
  type FieldNodeData,
} from "~/components/field-node";
import { PALETTE, TYPE_MIME, type FieldType } from "~/components/builder/field-types";

const H_GAP = 252;
const V_GAP = 138;
const ORIGIN_X = 30;
const ORIGIN_Y = 30;

const nodeTypes = { field: FieldNode, start: StartNode, end: EndNode };

export interface CanvasField {
  id: string;
  label: string;
  description?: string | null;
  isRequired: boolean;
  type: string;
  typeLabel: string;
}

interface FieldCanvasProps {
  fields: CanvasField[];
  selectedFieldId: string | null;
  onSelectField: (id: string | null) => void;
  /** Resolves true when the server accepted the new order. */
  onReorder: (orderedIds: string[]) => Promise<boolean> | void;
  onDeleteField: (id: string) => void;
  /** Field type dragged from the ADD NODE bar + the field it should land after. */
  onDropNewField: (type: string, afterFieldId: string | undefined) => void;
  onAddField: (type: FieldType) => void;
}

type AnyNode = Node<FieldNodeData> | Node<EndpointNodeData>;

/** Slot `i` of the serpentine: row 0 runs left→right, row 1 right→left, … */
function slotPosition(i: number, columns: number) {
  const row = Math.floor(i / columns);
  const inRow = i % columns;
  const col = row % 2 === 0 ? inRow : columns - 1 - inRow;
  return { x: ORIGIN_X + col * H_GAP, y: ORIGIN_Y + row * V_GAP, row, col };
}

function CanvasInner({
  fields,
  selectedFieldId,
  onSelectField,
  onReorder,
  onDeleteField,
  onDropNewField,
  onAddField,
}: FieldCanvasProps) {
  const { screenToFlowPosition, zoomIn, zoomOut, fitView, setViewport } = useReactFlow();
  const { x, y, zoom } = useViewport();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(4);
  const [isEditingZoom, setIsEditingZoom] = useState(false);
  const [zoomInput, setZoomInput] = useState(String(Math.round(zoom * 100)));
  const [zoomError, setZoomError] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resizeObserver = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? canvas.clientWidth;
      const nextColumns = width < 520 ? 1 : width < 900 ? 2 : 4;
      setColumns((current) => (current === nextColumns ? current : nextColumns));
    });
    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void fitView({ padding: 0.14, maxZoom: 1, duration: 150 });
    });
    return () => cancelAnimationFrame(frame);
  }, [columns, fitView]);

  useEffect(() => {
    if (!isEditingZoom) setZoomInput(String(Math.round(zoom * 100)));
  }, [isEditingZoom, zoom]);

  const commitZoom = () => {
    const percentage = Number(zoomInput);
    if (!Number.isFinite(percentage) || percentage < 25 || percentage > 200) {
      setZoomError(true);
      return;
    }
    setZoomError(false);
    setIsEditingZoom(false);
    setZoomInput(String(Math.round(percentage)));
    void setViewport({ x, y, zoom: percentage / 100 }, { duration: 150 });
  };

  const buildNodes = useCallback(
    (list: CanvasField[]): AnyNode[] => {
      const start: Node<EndpointNodeData> = {
        id: "__start",
        type: "start",
        draggable: false,
        selectable: false,
        deletable: false,
        position: { x: slotPosition(0, columns).x, y: slotPosition(0, columns).y },
        data: { kicker: "START", title: "Form opens" },
      };
      const body: Node<FieldNodeData>[] = list.map((f, i) => {
        const p = slotPosition(i + 1, columns);
        return {
          id: f.id,
          type: "field",
          position: { x: p.x, y: p.y },
          data: {
            label: f.label,
            typeLabel: f.typeLabel,
            isRequired: f.isRequired,
            description: f.description,
            selected: f.id === selectedFieldId,
            onDelete: () => onDeleteField(f.id),
          },
        };
      });
      const endPos = slotPosition(list.length + 1, columns);
      const end: Node<EndpointNodeData> = {
        id: "__end",
        type: "end",
        draggable: false,
        selectable: false,
        deletable: false,
        position: { x: endPos.x, y: endPos.y },
        data: { kicker: "END", title: "Submit" },
      };
      return [start, ...body, end];
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns, selectedFieldId],
  );

  const [nodes, setNodes] = useState<AnyNode[]>(() => buildNodes(fields));

  // The canonical order and content always come from the server; local drag
  // state is transient and re-synced after every change.
  useEffect(() => {
    setNodes(buildNodes(fields));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, fields, selectedFieldId]);

  const edges: Edge[] = useMemo(() => {
    const ids = ["__start", ...fields.map((f) => f.id), "__end"];
    const out: Edge[] = [];
    for (let i = 0; i < ids.length - 1; i++) {
      const a = slotPosition(i, columns);
      const b = slotPosition(i + 1, columns);
      let sourceHandle = "b-out";
      let targetHandle = "t-in";
      if (a.row === b.row) {
        const ltr = a.row % 2 === 0;
        sourceHandle = ltr ? "r-out" : "l-out";
        targetHandle = ltr ? "l-in" : "r-in";
      }
      out.push({
        id: `${ids[i]}->${ids[i + 1]}`,
        source: ids[i]!,
        target: ids[i + 1]!,
        sourceHandle,
        targetHandle,
        type: "smoothstep",
        style: { stroke: "var(--primary)", strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "var(--primary)", width: 14, height: 14 },
      });
    }
    return out;
  }, [columns, fields]);

  const handleNodeClick: NodeMouseHandler = (_e, node) => {
    if (node.id === "__start" || node.id === "__end") onSelectField(null);
    else onSelectField(node.id);
  };

  const handleConnect = useCallback(
    ({ source, target }: Connection) => {
      if (!source || !target || source === target) return;
      const order = fields.map((f) => f.id);
      const from = order.indexOf(source);
      const to = order.indexOf(target);
      if (from === -1 || to === -1) return;

      const next = [...order];
      next.splice(from, 1);
      next.splice(next.indexOf(target), 0, source);
      if (next.join(",") !== order.join(",")) void onReorder(next);
    },
    [fields, onReorder],
  );

  /** Index (0..n-1) of the field slot nearest to a point in flow space. */
  const nearestFieldIndex = (px: number, py: number) => {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < fields.length; i++) {
      const p = slotPosition(i + 1, columns);
      const d = (p.x + NODE_WIDTH / 2 - px) ** 2 + (p.y + NODE_HEIGHT / 2 - py) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  };

  const handleNodeDragStop: OnNodeDrag<AnyNode> = (_e, dragged) => {
    const order = fields.map((f) => f.id);
    const from = order.indexOf(dragged.id);
    if (from === -1) return;

    const target = nearestFieldIndex(
      dragged.position.x + NODE_WIDTH / 2,
      dragged.position.y + NODE_HEIGHT / 2,
    );
    if (target === from) {
      // snap back to the grid so a small drag doesn't leave the node offset
      setNodes(buildNodes(fields));
      return;
    }
    const next = [...order];
    next.splice(from, 1);
    next.splice(target, 0, dragged.id);
    void onReorder(next);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(TYPE_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent) => {
    const type = e.dataTransfer.getData(TYPE_MIME);
    if (!type) return;
    e.preventDefault();
    const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    if (fields.length === 0) return onDropNewField(type, undefined);
    // land after the nearest slot's field, unless dropped before its centre in flow order
    const idx = nearestFieldIndex(p.x, p.y);
    const slot = slotPosition(idx + 1, columns);
    const before = p.y < slot.y || (p.y < slot.y + NODE_HEIGHT && p.x < slot.x);
    const after = before ? fields[idx - 1]?.id : fields[idx]!.id;
    onDropNewField(type, after);
  };

  return (
    <div ref={canvasRef} className="dotgrid h-full min-w-0 w-full" onDragOver={handleDragOver} onDrop={handleDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={() => onSelectField(null)}
        onConnect={handleConnect}
        onNodeDragStop={handleNodeDragStop}
        onNodesChange={(changes) => {
          // live dragging stays smooth; the canonical position is re-asserted
          // from `fields` after every server round-trip above.
          setNodes((nds) =>
            nds.map((n) => {
              const change = changes.find((c) => "id" in c && c.id === n.id && c.type === "position");
              return change && "position" in change && change.position
                ? { ...n, position: change.position }
                : n;
            }),
          );
        }}
        fitView
        fitViewOptions={{ padding: 0.14, maxZoom: 1 }}
        minZoom={0.25}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.2}
          color="color-mix(in srgb, var(--foreground) 24%, transparent)"
        />

        {/* zoom */}
        <Panel
          position="bottom-left"
          className="flex items-center border border-border bg-card p-0.5 shadow-[2px_2px_0_0_var(--hard-shadow)]"
        >
          <button
            type="button"
            onClick={() => void zoomOut()}
            className="flex size-7 items-center justify-center font-mono text-sm text-muted-foreground hover:text-foreground"
            aria-label="Zoom out"
            title="Zoom out"
          >
            –
          </button>
          <input
            type="number"
            min={25}
            max={200}
            step={1}
            value={zoomInput}
            onFocus={() => setIsEditingZoom(true)}
            onChange={(event) => {
              setZoomInput(event.target.value);
              setZoomError(false);
            }}
            onBlur={commitZoom}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                setZoomInput(String(Math.round(zoom * 100)));
                setZoomError(false);
                event.currentTarget.blur();
              }
            }}
            className={`h-7 w-10 [appearance:textfield] border-0 bg-transparent p-0 text-center font-mono text-[10px] tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none ${
              zoomError ? "text-destructive" : "text-foreground"
            }`}
            aria-label="Canvas zoom percentage"
            aria-invalid={zoomError}
            title={zoomError ? "Enter a zoom percentage from 25 to 200" : "Zoom percentage (25-200)"}
          />
          <span className="pr-1 font-mono text-[10px] text-muted-foreground">%</span>
          <button
            type="button"
            onClick={() => void zoomIn()}
            className="flex size-7 items-center justify-center font-mono text-sm text-muted-foreground hover:text-foreground"
            aria-label="Zoom in"
            title="Zoom in"
          >
            +
          </button>
          <span className="mx-1 h-4 w-px bg-border" />
          <button
            type="button"
            onClick={() => void fitView({ padding: 0.14, maxZoom: 1, duration: 200 })}
            className="mono-label-sm px-2 py-2 text-muted-foreground hover:text-foreground"
            aria-label="Fit canvas to view"
            title="Fit canvas to view"
          >
            Fit
          </button>
        </Panel>

        {/* add node */}
        <Panel position="bottom-center" className="!mb-2 max-w-[calc(100%-1rem)] sm:!mb-3">
          <div className="scrollbar-none flex min-w-0 max-w-full items-center gap-0.5 overflow-x-auto rounded-md bg-solid p-1 text-solid-foreground">
            <span className="mono-label-sm shrink-0 px-2 opacity-70">Add node</span>
            {PALETTE.map(({ type, short, icon: Icon }) => (
              <button
                key={type}
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(TYPE_MIME, type);
                  e.dataTransfer.setData("text/plain", type);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => onAddField(type)}
                title={`Add ${short}`}
                aria-label={`Add ${short} node`}
                className="flex size-8 shrink-0 cursor-grab items-center justify-center rounded-[2px] transition-colors hover:bg-primary hover:text-primary-foreground active:cursor-grabbing"
              >
                <Icon className="size-3.5" />
              </button>
            ))}
          </div>
        </Panel>

        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          nodeColor="var(--primary)"
          nodeStrokeWidth={0}
          maskColor="color-mix(in srgb, var(--foreground) 8%, transparent)"
          className="!hidden !h-[70px] !w-[110px] md:!block"
          ariaLabel="Canvas map"
        />

        {fields.length === 0 ? (
          <Panel position="top-center" className="pointer-events-none !top-[42%]">
            <div className="border border-dashed border-foreground/40 bg-card p-6 text-center">
              <p className="font-display text-lg font-extrabold">No nodes yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Click a field type in the ADD NODE bar below to add your first question.
              </p>
            </div>
          </Panel>
        ) : null}
      </ReactFlow>
    </div>
  );
}

export function FieldCanvas(props: FieldCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
