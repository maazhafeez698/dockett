// apps/web/components/field-canvas.tsx

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
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

import { FieldNode, type FieldNodeData } from "~/components/field-node";

const ROW_HEIGHT = 130;
const COL_X = 40;

const nodeTypes = { field: FieldNode };

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
  onReorder: (orderedIds: string[]) => void;
  onDeleteField: (id: string) => void;
  /** Called with the field type dragged in from the palette, and the id of
   *  the field it should land after (undefined = at the very top). */
  onDropNewField: (type: string, afterFieldId: string | undefined) => void;
}

function CanvasInner({
  fields,
  selectedFieldId,
  onSelectField,
  onReorder,
  onDeleteField,
  onDropNewField,
}: FieldCanvasProps) {
  const { screenToFlowPosition, zoomIn, zoomOut, fitView, setViewport } = useReactFlow();
  const { x, y, zoom } = useViewport();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isEditingZoom, setIsEditingZoom] = useState(false);
  const [zoomInput, setZoomInput] = useState(String(Math.round(zoom * 100)));
  const [zoomError, setZoomError] = useState(false);

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
    (list: CanvasField[]): Node<FieldNodeData>[] =>
      list.map((f, i) => ({
        id: f.id,
        type: "field",
        position: { x: COL_X, y: i * ROW_HEIGHT },
        data: {
          label: f.label,
          typeLabel: f.typeLabel,
          isRequired: f.isRequired,
          description: f.description,
          selected: f.id === selectedFieldId,
          onDelete: () => onDeleteField(f.id),
        },
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedFieldId],
  );

  const [nodes, setNodes] = useState<Node<FieldNodeData>[]>(() => buildNodes(fields));

  // Re-sync node list + selection highlight whenever the server-side field
  // list changes (add/delete/reorder confirmed) — the canonical order and
  // content always comes from the server, local drag state is transient.
  useEffect(() => {
    setNodes(buildNodes(fields));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, selectedFieldId]);

  const edges: Edge[] = useMemo(
    () =>
      fields.slice(0, -1).map((f, i) => ({
        id: `${f.id}-${fields[i + 1]!.id}`,
        source: f.id,
        target: fields[i + 1]!.id,
        animated: true,
        style: { strokeDasharray: "4 4", stroke: "var(--primary)" },
      })),
    [fields],
  );

  const handleNodeClick: NodeMouseHandler = (_e, node) => onSelectField(node.id);
  const handlePaneClick = () => onSelectField(null);

  const handleConnect = useCallback(
    ({ source, target }: Connection) => {
      if (!source || !target || source === target) return;

      const currentOrder = fields.map((field) => field.id);
      const sourceIndex = currentOrder.indexOf(source);
      const targetIndex = currentOrder.indexOf(target);
      if (sourceIndex === -1 || targetIndex === -1) return;

      const reordered = [...currentOrder];
      reordered.splice(sourceIndex, 1);
      reordered.splice(reordered.indexOf(target), 0, source);

      if (reordered.join(",") !== currentOrder.join(",")) {
        onReorder(reordered);
      }
    },
    [fields, onReorder],
  );

  const handleNodeDragStop: OnNodeDrag<Node<FieldNodeData>> = (_e, draggedNode) => {
    // Reorder by the dragged node's new vertical position relative to the
    // others — simplest reliable mapping from "drag it somewhere" to a
    // linear order, without needing manual edge-endpoint rewiring.
    const reordered = [...nodes]
      .map((n) => (n.id === draggedNode.id ? { ...n, position: draggedNode.position } : n))
      .sort((a, b) => a.position.y - b.position.y)
      .map((n) => n.id);

    const currentOrder = fields.map((f) => f.id);
    if (reordered.join(",") !== currentOrder.join(",")) {
      onReorder(reordered);
    } else {
      // Snap back to the canonical grid even when the order didn't change,
      // so a small drag doesn't leave a node visually offset.
      setNodes(buildNodes(fields));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("application/formless-field-type");
    if (!type) return;

    const dropPoint = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    // Which existing field is this dropped above? Everything with a
    // smaller y than the drop point counts as "before" the new field.
    const before = nodes.filter((n) => n.position.y < dropPoint.y - ROW_HEIGHT / 2);
    const afterFieldId = before.length > 0 ? before[before.length - 1]!.id : undefined;

    onDropNewField(type, afterFieldId);
  };

  return (
    <div ref={wrapperRef} className="h-full w-full" onDragOver={handleDragOver} onDrop={handleDrop}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onConnect={handleConnect}
        onNodeDragStop={handleNodeDragStop}
        onNodesChange={(changes) => {
          // Allow live dragging to feel smooth; canonical position is
          // re-asserted from `fields` after every server round-trip above.
          setNodes((nds) =>
            nds.map((n) => {
              const change = changes.find(
                (c) => "id" in c && c.id === n.id && c.type === "position",
              );
              return change && "position" in change && change.position
                ? { ...n, position: change.position }
                : n;
            }),
          );
        }}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Panel
          position="bottom-left"
          className="glass-flat flex items-center rounded-md border border-white/10 bg-card/90 p-1 shadow-xl backdrop-blur-md"
        >
          <button
            type="button"
            onClick={() => void zoomOut()}
            className="flex size-8 items-center justify-center rounded-sm text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Zoom out"
            title="Zoom out"
          >
            -
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
            className={`h-8 w-14 border-0 bg-transparent p-0 text-center text-xs font-medium tabular-nums text-muted-foreground outline-none focus:text-foreground ${zoomError ? "text-destructive" : ""}`}
            aria-label="Canvas zoom percentage"
            aria-invalid={zoomError}
            title={
              zoomError ? "Enter a zoom percentage from 25 to 200" : "Zoom percentage (25-200)"
            }
          />
          <button
            type="button"
            onClick={() => void zoomIn()}
            className="flex size-8 items-center justify-center rounded-sm text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Zoom in"
            title="Zoom in"
          >
            +
          </button>
          <div className="mx-1 h-5 w-px bg-border/70" />
          <button
            type="button"
            onClick={() => void fitView({ padding: 0.2 })}
            className="flex h-8 items-center justify-center rounded-sm px-2 text-[11px] font-medium tracking-wide text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Fit canvas to view"
            title="Fit canvas to view"
          >
            FIT
          </button>
        </Panel>
        {fields.length === 0 ? (
          <Panel position="top-center" className="pointer-events-none !top-1/2 !-translate-y-1/2">
            <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
              Drag a field type from the left, or click one to add your first field.
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
