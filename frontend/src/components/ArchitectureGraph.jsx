import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  createContext,
  useContext,
} from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Handle,
  Position,
  Background,
  BackgroundVariant,
  MarkerType,
  BaseEdge,
  getSmoothStepPath,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// ==========================================================================
// GRAPH FOCUS CONTEXT (Decouples Selection/Hover from Layout Calculations)
// ==========================================================================

const GraphFocusContext = createContext({
  selectedId: null,
  hoveredId: null,
  connectedNodeIds: new Set(),
  activeCenterId: null,
});

// ==========================================================================
// CUSTOM NODE COMPONENTS (Bugatti Pure-Black Minimal Technical Style)
// ==========================================================================

function PrismCustomNode({ data, id }) {
  const { selectedId, hoveredId, connectedNodeIds } = useContext(GraphFocusContext);

  const focusId = hoveredId || selectedId;
  const isSelected = selectedId === id;
  const isConn = !focusId || connectedNodeIds.has(id);
  const isDimmed = Boolean(focusId && !isConn);
  const isHighlighted = Boolean(focusId && isConn && id !== focusId);

  const role = data.role || "callee"; // 'center' | 'caller' | 'callee' | 'external'
  const isExternal = data.is_external || data.file === "external";

  let roleBorder = "var(--border-hairline, #262626)";
  let badgeColor = "var(--text-muted, #999999)";

  if (role === "center") {
    roleBorder = "var(--border-white, #ffffff)";
    badgeColor = "var(--border-white, #ffffff)";
  } else if (role === "caller") {
    roleBorder = "var(--accent-link, #c3d9f3)";
    badgeColor = "var(--accent-link, #c3d9f3)";
  } else if (role === "callee") {
    roleBorder = "var(--border-hairline-strong, #3a3a3a)";
    badgeColor = "var(--text-muted, #999999)";
  }

  if (isSelected || isHighlighted) {
    roleBorder = "var(--border-white, #ffffff)";
  }

  const shortFile =
    data.file && data.file !== "external"
      ? data.file.split(/[/\\]/).pop()
      : "";

  return (
    <div
      className={`bugatti-flow-node ${role} ${isSelected ? "is-selected" : ""} ${
        isDimmed ? "is-dimmed" : ""
      }`}
      style={{
        border: `1px ${isExternal ? "dashed" : "solid"} ${roleBorder}`,
        backgroundColor: isSelected
          ? "var(--bg-surface-elevated, #1f1f1f)"
          : "var(--bg-surface-soft, #0d0d0d)",
        opacity: isDimmed ? 0.22 : 1.0,
        transition: "border-color 0.15s ease, opacity 0.2s ease, background-color 0.15s ease",
      }}
    >
      {/* Target Handle (Left) */}
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        style={{
          background: isSelected ? "#ffffff" : "var(--border-hairline-strong, #3a3a3a)",
          width: 7,
          height: 7,
          borderRadius: 0,
          border: "none",
        }}
      />

      <div className="bugatti-node-badge" style={{ color: badgeColor }}>
        {role === "center" ? "● FOCAL CHUNK" : role.toUpperCase()}
      </div>

      <div className="bugatti-node-symbol" title={data.symbol}>
        {data.symbol}
      </div>

      <div className="bugatti-node-file" title={data.file}>
        {shortFile ? (
          <>
            {shortFile}
            {data.start_line != null ? ` : L${data.start_line}–${data.end_line}` : ""}
          </>
        ) : isExternal ? (
          "EXTERNAL RUNTIME"
        ) : (
          "CODEBASE"
        )}
      </div>

      {/* Source Handle (Right) */}
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={{
          background: isSelected ? "#ffffff" : "var(--border-hairline-strong, #3a3a3a)",
          width: 7,
          height: 7,
          borderRadius: 0,
          border: "none",
        }}
      />
    </div>
  );
}

function GroupSummaryNode({ data, id }) {
  const { selectedId, hoveredId, connectedNodeIds } = useContext(GraphFocusContext);
  const focusId = hoveredId || selectedId;
  const isConn = !focusId || connectedNodeIds.has(id);
  const isDimmed = Boolean(focusId && !isConn);

  return (
    <div
      className={`bugatti-group-node ${isDimmed ? "is-dimmed" : ""}`}
      onClick={data.onToggle}
      title="Click to toggle group expansion"
      style={{
        opacity: isDimmed ? 0.22 : 1.0,
        transition: "opacity 0.2s ease",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        style={{
          background: "var(--accent-link, #c3d9f3)",
          width: 7,
          height: 7,
          borderRadius: 0,
          border: "none",
        }}
      />
      <div className="bugatti-group-badge">AGGREGATE GROUP</div>
      <div className="bugatti-group-label">
        {data.isExpanded ? "▼ COLLAPSE" : "► EXPAND"} {data.count} {data.label}
      </div>
      <div className="bugatti-group-hint">
        {data.isExpanded ? "Click to collapse" : "Click to view all nodes"}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        style={{
          background: "var(--accent-link, #c3d9f3)",
          width: 7,
          height: 7,
          borderRadius: 0,
          border: "none",
        }}
      />
    </div>
  );
}

// ==========================================================================
// CUSTOM EDGE COMPONENT (Dynamic Highlighting without Array Recreation)
// ==========================================================================

function PrismCustomEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}) {
  const { selectedId, hoveredId } = useContext(GraphFocusContext);
  const focusId = hoveredId || selectedId;

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  const isDashed = Boolean(data?.isDashed);
  const isConnected = !focusId || focusId === source || focusId === target;
  const isHighlighted = Boolean(focusId && (focusId === source || focusId === target));
  const isDimmed = Boolean(focusId && !isConnected);

  let strokeColor = "var(--border-hairline-strong, #3a3a3a)";
  let strokeWidth = 1;

  if (isHighlighted) {
    strokeWidth = 2;
    if (focusId === source) {
      strokeColor = "#ffffff";
    } else {
      strokeColor = "var(--accent-link, #c3d9f3)";
    }
  } else if (isDashed) {
    strokeColor = "#444444";
  }

  return (
    <BaseEdge
      path={edgePath}
      style={{
        stroke: strokeColor,
        strokeWidth,
        strokeDasharray: isDashed ? "4,4" : undefined,
        opacity: isDimmed ? 0.15 : 0.85,
        transition: "stroke 0.15s ease, opacity 0.15s ease, stroke-width 0.15s ease",
      }}
      markerEnd={
        isDashed
          ? undefined
          : {
              type: MarkerType.ArrowClosed,
              color: isHighlighted ? strokeColor : "#555555",
              width: 12,
              height: 12,
            }
      }
    />
  );
}

const nodeTypes = {
  prismNode: PrismCustomNode,
  groupNode: GroupSummaryNode,
};

const edgeTypes = {
  prismEdge: PrismCustomEdge,
};

// ==========================================================================
// INNER FLOW COMPONENT (Consumes ReactFlow instance)
// ==========================================================================

function InnerArchitectureGraph({
  graphData,
  selected,
  onSelectNode,
  results = [],
  isExpanded = false,
  onToggleExpand,
  totalGraphNodes = null,
  onRecenterCandidate,
}) {
  const { zoomIn, zoomOut, fitView, setCenter } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Selection & Hover State
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);

  // Group Expand / Collapse State
  const [calleesExpanded, setCalleesExpanded] = useState(false);
  const [callersExpanded, setCallersExpanded] = useState(false);
  const [externalExpanded, setExternalExpanded] = useState(false);

  // UI State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchError, setSearchError] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(100);

  // Refs for Rock-Solid Stability
  const userPositionsRef = useRef(new Map());
  const lastCenterIdRef = useRef(null);

  // Parse raw backend graph data into pure topology maps
  const rawGraph = useMemo(() => {
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
      return null;
    }

    const center = graphData.center_id;
    const rawNodes = graphData.nodes || [];
    const rawEdges = graphData.edges || [];

    const isExt = (n) =>
      Boolean(
        n.is_external ||
          n.file === "external" ||
          (typeof n.id === "string" && n.id.startsWith("external::"))
      );

    const centerNode = rawNodes.find((n) => n.id === center) || {
      id: center,
      symbol: center.split("::").pop() || center,
      file: "external",
      is_external: isExt({ id: center, file: "external" }),
    };

    // Build directed adjacency maps
    const callerIds = new Set();
    const calleeIds = new Set();
    const nodeOutgoing = new Map();
    const nodeIncoming = new Map();

    rawEdges.forEach((e) => {
      if (e.target === center) callerIds.add(e.source);
      if (e.source === center) calleeIds.add(e.target);

      if (!nodeOutgoing.has(e.source)) nodeOutgoing.set(e.source, new Set());
      nodeOutgoing.get(e.source).add(e.target);

      if (!nodeIncoming.has(e.target)) nodeIncoming.set(e.target, new Set());
      nodeIncoming.get(e.target).add(e.source);
    });

    const otherNodes = rawNodes.filter((n) => n.id !== center);
    const internalCallers = [];
    const internalCallees = [];
    const externalNodes = [];

    otherNodes.forEach((n) => {
      if (isExt(n)) {
        externalNodes.push(n);
      } else if (callerIds.has(n.id)) {
        internalCallers.push(n);
      } else if (calleeIds.has(n.id)) {
        internalCallees.push(n);
      } else {
        internalCallees.push(n);
      }
    });

    return {
      center,
      centerNode,
      rawNodes,
      rawEdges,
      callerIds,
      calleeIds,
      nodeOutgoing,
      nodeIncoming,
      internalCallers,
      internalCallees,
      externalNodes,
    };
  }, [graphData]);

  // Compute connected neighbor IDs for the active focus (hover or selected)
  const connectedNodeIds = useMemo(() => {
    if (!rawGraph) return new Set();

    const focusId = hoveredNodeId || selectedNodeId || rawGraph.center;
    if (!focusId) return new Set();

    const connected = new Set([focusId]);
    const outgoing = rawGraph.nodeOutgoing.get(focusId);
    if (outgoing) outgoing.forEach((id) => connected.add(id));

    const incoming = rawGraph.nodeIncoming.get(focusId);
    if (incoming) incoming.forEach((id) => connected.add(id));

    return connected;
  }, [rawGraph, hoveredNodeId, selectedNodeId]);

  // Track user-dragged coordinates so they are NEVER lost during layout updates
  const handleNodesChange = useCallback(
    (changes) => {
      changes.forEach((change) => {
        if (change.type === "position" && change.position) {
          userPositionsRef.current.set(change.id, change.position);
        }
      });
      onNodesChange(changes);
    },
    [onNodesChange]
  );

  // Deterministic Layout Builder (Runs ONLY when graph dataset or expand states change)
  const buildLayout = useCallback(
    (forceReset = false) => {
      if (!rawGraph) {
        setNodes([]);
        setEdges([]);
        return;
      }

      const {
        center,
        centerNode,
        internalCallers,
        internalCallees,
        externalNodes,
      } = rawGraph;

      const flowNodes = [];
      const flowEdges = [];

      // Center focal coordinates
      const centerX = 550;
      const centerY = 320;

      const getNodePos = (nodeId, defX, defY) => {
        if (!forceReset && userPositionsRef.current.has(nodeId)) {
          return userPositionsRef.current.get(nodeId);
        }
        return { x: defX, y: defY };
      };

      // 1. ADD CENTER NODE
      flowNodes.push({
        id: center,
        type: "prismNode",
        position: getNodePos(center, centerX, centerY),
        data: {
          symbol: centerNode.symbol,
          file: centerNode.file,
          start_line: centerNode.start_line,
          end_line: centerNode.end_line,
          role: "center",
          is_external: centerNode.is_external,
        },
      });

      // 2. LAYOUT CALLERS (Left Column at x: 160)
      const callerX = 160;
      const totalCallers = internalCallers.length;

      if (!callersExpanded && totalCallers > 5) {
        // Collapsed View: Top 4 callers + Group summary
        const visibleCallers = internalCallers.slice(0, 4);
        const remainingCount = totalCallers - 4;
        const spacing = 95;
        const startY = centerY - (4 * spacing) / 2;

        visibleCallers.forEach((cNode, idx) => {
          flowNodes.push({
            id: cNode.id,
            type: "prismNode",
            position: getNodePos(cNode.id, callerX, startY + idx * spacing),
            data: {
              symbol: cNode.symbol,
              file: cNode.file,
              start_line: cNode.start_line,
              end_line: cNode.end_line,
              role: "caller",
              is_external: cNode.is_external,
            },
          });

          flowEdges.push({
            id: `edge-${cNode.id}-${center}`,
            source: cNode.id,
            target: center,
            type: "prismEdge",
          });
        });

        // Group Node
        flowNodes.push({
          id: "group-callers-more",
          type: "groupNode",
          position: getNodePos("group-callers-more", callerX, startY + 4 * spacing),
          data: {
            count: remainingCount,
            label: "MORE CALLERS",
            isExpanded: false,
            onToggle: () => setCallersExpanded(true),
          },
        });

        flowEdges.push({
          id: `edge-group-callers-${center}`,
          source: "group-callers-more",
          target: center,
          type: "prismEdge",
          data: { isDashed: true },
        });
      } else {
        // Expanded View: Multi-column grid to the left (8 per column)
        const nodesPerCol = 8;
        const spacing = 95;

        internalCallers.forEach((cNode, idx) => {
          const colIdx = Math.floor(idx / nodesPerCol);
          const rowIdx = idx % nodesPerCol;
          const colX = callerX - colIdx * 350;
          const countInCol = Math.min(
            nodesPerCol,
            totalCallers - colIdx * nodesPerCol
          );
          const startY = centerY - ((countInCol - 1) * spacing) / 2;

          flowNodes.push({
            id: cNode.id,
            type: "prismNode",
            position: getNodePos(cNode.id, colX, startY + rowIdx * spacing),
            data: {
              symbol: cNode.symbol,
              file: cNode.file,
              start_line: cNode.start_line,
              end_line: cNode.end_line,
              role: "caller",
              is_external: cNode.is_external,
            },
          });

          flowEdges.push({
            id: `edge-${cNode.id}-${center}`,
            source: cNode.id,
            target: center,
            type: "prismEdge",
          });
        });

        if (callersExpanded && totalCallers > 5) {
          flowNodes.push({
            id: "group-callers-collapse",
            type: "groupNode",
            position: getNodePos(
              "group-callers-collapse",
              callerX,
              centerY + 4.5 * spacing
            ),
            data: {
              count: totalCallers,
              label: "CALLERS",
              isExpanded: true,
              onToggle: () => setCallersExpanded(false),
            },
          });
        }
      }

      // 3. LAYOUT CALLEES (Right Multi-Column Grid to prevent any vertical stacking)
      const calleeBaseX = 960;
      const totalCallees = internalCallees.length;

      if (!calleesExpanded && totalCallees > 6) {
        // DIRECT VIEW: Show top 5 callees + 1 aggregate group node
        const visibleCallees = internalCallees.slice(0, 5);
        const remainingCount = totalCallees - 5;
        const spacing = 95;
        const startY = centerY - (5 * spacing) / 2;

        visibleCallees.forEach((cNode, idx) => {
          flowNodes.push({
            id: cNode.id,
            type: "prismNode",
            position: getNodePos(cNode.id, calleeBaseX, startY + idx * spacing),
            data: {
              symbol: cNode.symbol,
              file: cNode.file,
              start_line: cNode.start_line,
              end_line: cNode.end_line,
              role: "callee",
              is_external: cNode.is_external,
            },
          });

          flowEdges.push({
            id: `edge-${center}-${cNode.id}`,
            source: center,
            target: cNode.id,
            type: "prismEdge",
          });
        });

        // Group summary node
        flowNodes.push({
          id: "group-callees-more",
          type: "groupNode",
          position: getNodePos(
            "group-callees-more",
            calleeBaseX,
            startY + 5 * spacing
          ),
          data: {
            count: remainingCount,
            label: "MORE CALLEES",
            isExpanded: false,
            onToggle: () => setCalleesExpanded(true),
          },
        });

        flowEdges.push({
          id: `edge-${center}-group-callees`,
          source: center,
          target: "group-callees-more",
          type: "prismEdge",
          data: { isDashed: true },
        });
      } else {
        // FULL DISTRIBUTION ACROSS MULTIPLE COLUMNS (8 nodes per column)
        const nodesPerCol = 8;
        const spacing = 95;

        internalCallees.forEach((cNode, idx) => {
          const colIdx = Math.floor(idx / nodesPerCol);
          const rowIdx = idx % nodesPerCol;
          const colX = calleeBaseX + colIdx * 360;
          const countInCol = Math.min(
            nodesPerCol,
            totalCallees - colIdx * nodesPerCol
          );
          const startY = centerY - ((countInCol - 1) * spacing) / 2;

          flowNodes.push({
            id: cNode.id,
            type: "prismNode",
            position: getNodePos(cNode.id, colX, startY + rowIdx * spacing),
            data: {
              symbol: cNode.symbol,
              file: cNode.file,
              start_line: cNode.start_line,
              end_line: cNode.end_line,
              role: "callee",
              is_external: cNode.is_external,
            },
          });

          flowEdges.push({
            id: `edge-${center}-${cNode.id}`,
            source: center,
            target: cNode.id,
            type: "prismEdge",
          });
        });

        if (calleesExpanded && totalCallees > 6) {
          flowNodes.push({
            id: "group-callees-collapse",
            type: "groupNode",
            position: getNodePos(
              "group-callees-collapse",
              calleeBaseX,
              centerY + 4.5 * spacing
            ),
            data: {
              count: totalCallees,
              label: "CALLEES",
              isExpanded: true,
              onToggle: () => setCalleesExpanded(false),
            },
          });
        }
      }

      // 4. EXTERNAL RUNTIME CALLS CLUSTER (Bottom Region, non-overlapping)
      const totalExternals = externalNodes.length;

      if (totalExternals > 0) {
        const extBaseX = centerX;
        const extBaseY = centerY + 280;

        if (!externalExpanded) {
          // Single summary node by default
          flowNodes.push({
            id: "group-external-cluster",
            type: "groupNode",
            position: getNodePos(
              "group-external-cluster",
              extBaseX - 100,
              extBaseY
            ),
            data: {
              count: totalExternals,
              label: "EXTERNAL RUNTIME DEPS",
              isExpanded: false,
              onToggle: () => setExternalExpanded(true),
            },
          });

          flowEdges.push({
            id: `edge-${center}-ext-cluster`,
            source: center,
            target: "group-external-cluster",
            type: "prismEdge",
            data: { isDashed: true },
          });
        } else {
          // Render individual external dependencies in grid below
          const extNodesPerCol = 6;
          const extColSpacing = 280;
          const extRowSpacing = 80;

          externalNodes.forEach((eNode, idx) => {
            const colIdx = Math.floor(idx / extNodesPerCol);
            const rowIdx = idx % extNodesPerCol;
            const posX = extBaseX - 300 + colIdx * extColSpacing;
            const posY = extBaseY + rowIdx * extRowSpacing;

            flowNodes.push({
              id: eNode.id,
              type: "prismNode",
              position: getNodePos(eNode.id, posX, posY),
              data: {
                symbol: eNode.symbol,
                file: "external",
                start_line: null,
                end_line: null,
                role: "external",
                is_external: true,
              },
            });

            flowEdges.push({
              id: `edge-${center}-${eNode.id}`,
              source: center,
              target: eNode.id,
              type: "prismEdge",
              data: { isDashed: true },
            });
          });

          flowNodes.push({
            id: "group-external-collapse",
            type: "groupNode",
            position: getNodePos(
              "group-external-collapse",
              extBaseX - 100,
              extBaseY - 60
            ),
            data: {
              count: totalExternals,
              label: "EXTERNAL RUNTIME DEPS",
              isExpanded: true,
              onToggle: () => setExternalExpanded(false),
            },
          });
        }
      }

      setNodes(flowNodes);
      setEdges(flowEdges);
    },
    [
      rawGraph,
      callersExpanded,
      calleesExpanded,
      externalExpanded,
      setNodes,
      setEdges,
    ]
  );

  // Initial build and fitView triggered strictly ONCE when a new focal chunk arrives
  useEffect(() => {
    if (!rawGraph || !rawGraph.center) return;

    if (rawGraph.center !== lastCenterIdRef.current) {
      lastCenterIdRef.current = rawGraph.center;
      userPositionsRef.current.clear();
      setCalleesExpanded(false);
      setCallersExpanded(false);
      setExternalExpanded(false);
      setSelectedNodeId(rawGraph.center);

      // Build initial layout once
      buildLayout(true);

      // Perform a smooth fitView once after initial render
      const timer = setTimeout(() => {
        fitView({ padding: 0.25, duration: 500 });
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [rawGraph?.center, buildLayout, fitView]);

  // Re-layout when user toggles expand states
  useEffect(() => {
    if (rawGraph) {
      buildLayout(false);
    }
  }, [calleesExpanded, callersExpanded, externalExpanded, buildLayout, rawGraph]);

  // Synchronize external selected prop without destroying layout
  useEffect(() => {
    if (selected && selected.chunk_id) {
      setSelectedNodeId(selected.chunk_id);
    }
  }, [selected]);

  // Track zoom level ONLY at end of movement (Prevents 60 FPS re-render loops!)
  const handleMoveEnd = useCallback((_, viewport) => {
    if (viewport && typeof viewport.zoom === "number") {
      setCurrentZoom(Math.round(viewport.zoom * 100));
    }
  }, []);

  // Node Click: Highlight relationships & notify Monaco viewer if internal
  const handleNodeClick = useCallback(
    (_, node) => {
      if (node.id.startsWith("group-")) return;

      setSelectedNodeId(node.id);

      const targetData = node.data;
      if (!targetData || targetData.is_external || targetData.file === "external") {
        return; // External dependencies don't replace codebase code viewer
      }

      const match = results.find((r) => r.chunk_id === node.id);
      if (match && onSelectNode) {
        onSelectNode(match);
      } else if (onSelectNode) {
        onSelectNode({
          chunk_id: node.id,
          symbol: targetData.symbol,
          file: targetData.file,
          start_line: targetData.start_line,
          end_line: targetData.end_line,
          code: `# Inspecting Function: ${targetData.symbol}\n# Source File: ${targetData.file}\n# Lines: L${targetData.start_line || 1} - L${targetData.end_line || 100}`,
          final_score: 0.85,
          score_breakdown: { semantic: 0.85, bm25: 0.8, symbol: 1.0, graph: 1.0 },
          why_matched: `Selected directly from interactive architecture call graph topology.`,
        });
      }
    },
    [results, onSelectNode]
  );

  // Search/Find Function in Graph across currently indexed repository
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim() || !rawGraph) return;

    const query = searchQuery.trim().toLowerCase();
    const foundNode = rawGraph.rawNodes.find((n) => {
      const sym = (n.symbol || "").toLowerCase();
      const file = (n.file || "").toLowerCase();
      const id = (n.id || "").toLowerCase();
      return (
        sym === query ||
        sym.includes(query) ||
        file.includes(query) ||
        id.includes(query)
      );
    });

    if (foundNode) {
      setSearchError(null);
      setSelectedNodeId(foundNode.id);

      // Auto-expand group if node is currently inside a collapsed group
      if (rawGraph.calleeIds.has(foundNode.id) && !calleesExpanded) {
        setCalleesExpanded(true);
      }
      if (foundNode.is_external && !externalExpanded) {
        setExternalExpanded(true);
      }

      setTimeout(() => {
        const currentNode = nodes.find((n) => n.id === foundNode.id);
        if (currentNode) {
          setCenter(
            currentNode.position.x + 100,
            currentNode.position.y + 35,
            { zoom: 1.15, duration: 600 }
          );
        } else {
          fitView({ nodes: [{ id: foundNode.id }], duration: 600, padding: 0.4 });
        }
      }, 120);
    } else {
      setSearchError("Function not found in current indexed repository.");
      setTimeout(() => setSearchError(null), 3500);
    }
  };

  // Reset to initial deterministic positions
  const handleReset = useCallback(() => {
    userPositionsRef.current.clear();
    buildLayout(true);
    setCenter(550, 320, { zoom: 1, duration: 500 });
  }, [buildLayout, setCenter]);

  // Context value for seamless 60 FPS highlighting without re-rendering node arrays
  const focusContextValue = useMemo(
    () => ({
      selectedId: selectedNodeId,
      hoveredId: hoveredNodeId,
      connectedNodeIds,
      activeCenterId: rawGraph?.center,
    }),
    [selectedNodeId, hoveredNodeId, connectedNodeIds, rawGraph?.center]
  );

  if (!rawGraph) {
    return (
      <div className="bugatti-graph-panel bugatti-empty-graph-panel">
        <div className="bugatti-graph-header">
          <div>
            <div className="bugatti-graph-title">ARCHITECTURE & CALL GRAPH TOPOLOGY</div>
            <div className="bugatti-graph-sub">REACTIVE AST SUBGRAPH ENGINE</div>
          </div>
          <div className="bugatti-graph-status-tag">STANDBY</div>
        </div>
        <div className="bugatti-graph-canvas bugatti-graph-canvas-empty">
          <div className="bugatti-empty-graph-text">
            <span>NO ACTIVE SUBGRAPH RESOLVED</span>
            <p>Execute an agent search to inspect call hierarchy and architecture topology.</p>
          </div>
        </div>
      </div>
    );
  }

  const { centerNode, internalCallers, internalCallees, externalNodes } = rawGraph;

  // Selected node metadata for Inspector Bar
  const inspectId = selectedNodeId || rawGraph.center;
  const inspectNode =
    rawGraph.rawNodes.find((n) => n.id === inspectId) || centerNode;

  const nodeIncomingCount = rawGraph.rawEdges.filter(
    (e) => e.target === inspectId
  ).length;
  const nodeOutgoingCount = rawGraph.rawEdges.filter(
    (e) => e.source === inspectId
  ).length;

  return (
    <GraphFocusContext.Provider value={focusContextValue}>
      <div className={`bugatti-graph-panel ${isExpanded ? "is-expanded" : ""}`}>
        {/* 1. Header Toolbar */}
        <div className="bugatti-graph-header">
          <div className="bugatti-graph-header-left">
            <div className="bugatti-graph-title">ARCHITECTURE & CALL GRAPH TOPOLOGY</div>
            <div className="bugatti-graph-sub">
              FOCAL:{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                {centerNode.symbol}
              </strong>{" "}
              · {internalCallers.length} CALLERS · {internalCallees.length} CALLEES ·{" "}
              {externalNodes.length} EXTERNAL DEPS
            </div>
          </div>

          <div className="bugatti-graph-controls">
            {/* Search / Find Function */}
            <form onSubmit={handleSearchSubmit} className="bugatti-graph-search-form">
              <input
                className="bugatti-graph-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find function in graph..."
              />
              <button type="submit" className="bugatti-graph-search-btn">
                FIND
              </button>
              {searchError && (
                <span className="bugatti-search-not-found">{searchError}</span>
              )}
            </form>

            {/* View Modes */}
            <div className="bugatti-segmented-tabs" style={{ marginBottom: 0 }}>
              <button
                className={`bugatti-segmented-tab ${
                  !calleesExpanded && !externalExpanded ? "is-active" : ""
                }`}
                onClick={() => {
                  setCalleesExpanded(false);
                  setExternalExpanded(false);
                }}
              >
                DIRECT
              </button>
              <button
                className={`bugatti-segmented-tab ${calleesExpanded ? "is-active" : ""}`}
                onClick={() => setCalleesExpanded(!calleesExpanded)}
              >
                {calleesExpanded ? "COLLAPSE CALLEES" : `EXPAND CALLEES (${internalCallees.length})`}
              </button>
              {externalNodes.length > 0 && (
                <button
                  className={`bugatti-segmented-tab ${externalExpanded ? "is-active" : ""}`}
                  onClick={() => setExternalExpanded(!externalExpanded)}
                >
                  {externalExpanded ? "COLLAPSE EXT" : `EXT DEPS (${externalNodes.length})`}
                </button>
              )}
            </div>

            {/* Quick Recenter */}
            {onRecenterCandidate && (
              <button
                className="bugatti-outline-pill-btn bugatti-btn-sm"
                onClick={onRecenterCandidate}
                title="Re-center onto Candidate #1"
              >
                RE-CENTER #1
              </button>
            )}

            {/* Canvas Height Toggle */}
            {onToggleExpand && (
              <button
                className="bugatti-outline-pill-btn bugatti-btn-sm"
                onClick={onToggleExpand}
                title="Toggle Viewport Size"
              >
                {isExpanded ? "DEFAULT CANVAS" : "MAX CANVAS"}
              </button>
            )}
          </div>
        </div>

        {/* 2. Interactive Controls Toolbar (Zoom, Fit, Legend) */}
        <div className="bugatti-graph-toolbar">
          <div className="bugatti-flow-controls">
            <button
              className="bugatti-flow-ctrl-btn"
              onClick={() => zoomIn({ duration: 300 })}
              title="Zoom In"
            >
              +
            </button>
            <button
              className="bugatti-flow-ctrl-btn"
              onClick={() => zoomOut({ duration: 300 })}
              title="Zoom Out"
            >
              −
            </button>
            <button
              className="bugatti-flow-ctrl-btn"
              onClick={() => fitView({ padding: 0.25, duration: 500 })}
              title="Fit View"
            >
              FIT
            </button>
            <button
              className="bugatti-flow-ctrl-btn"
              onClick={handleReset}
              title="Restore Initial Positions"
            >
              RESET
            </button>
            <span className="bugatti-zoom-indicator">{currentZoom}%</span>
          </div>

          {/* Legend */}
          <div className="bugatti-legend-pills">
            <span className="bugatti-legend-pill pill-center">● FOCAL CHUNK</span>
            <span className="bugatti-legend-pill pill-caller">
              ← CALLERS ({internalCallers.length})
            </span>
            <span className="bugatti-legend-pill pill-callee">
              → CALLEES ({internalCallees.length})
            </span>
            {externalNodes.length > 0 && (
              <span className="bugatti-legend-pill" style={{ color: "#777777" }}>
                ··· EXTERNAL ({externalNodes.length})
              </span>
            )}
          </div>

          <div className="bugatti-flow-hint">
            <span>DRAG NODES TO REORGANIZE · SCROLL TO ZOOM · DRAG CANVAS TO PAN</span>
          </div>
        </div>

        {/* 3. Interactive Canvas */}
        <div
          className="bugatti-graph-canvas"
          style={{ height: isExpanded ? "640px" : "390px" }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            onNodeMouseEnter={(_, n) => setHoveredNodeId(n.id)}
            onNodeMouseLeave={() => setHoveredNodeId(null)}
            onMoveEnd={handleMoveEnd}
            nodesDraggable={true}
            nodesConnectable={false}
            elementsSelectable={true}
            panOnDrag={true}
            zoomOnScroll={true}
            zoomOnPinch={true}
            minZoom={0.15}
            maxZoom={2.5}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={28}
              size={1.2}
              color="rgba(255, 255, 255, 0.08)"
            />
          </ReactFlow>
        </div>

        {/* 4. Bottom Node Inspector Bar */}
        <div className="bugatti-graph-inspector">
          <div className="bugatti-inspect-item">
            <span className="bugatti-inspect-label">FUNCTION:</span>
            <span className="bugatti-inspect-value">{inspectNode.symbol}</span>
          </div>

          <div className="bugatti-inspect-item">
            <span className="bugatti-inspect-label">FILE:</span>
            <span className="bugatti-inspect-value">
              {inspectNode.file && inspectNode.file !== "external" ? (
                `${inspectNode.file}${
                  inspectNode.start_line != null
                    ? ` : L${inspectNode.start_line}–${inspectNode.end_line}`
                    : ""
                }`
              ) : (
                <span style={{ color: "var(--text-muted)" }}>
                  EXTERNAL RUNTIME / STDLIB
                </span>
              )}
            </span>
          </div>

          <div className="bugatti-inspect-item">
            <span className="bugatti-inspect-label">ROLE:</span>
            <span
              className="bugatti-inspect-value"
              style={{
                color:
                  inspectId === rawGraph.center
                    ? "var(--text-primary)"
                    : rawGraph.callerIds.has(inspectId)
                    ? "var(--accent-link, #c3d9f3)"
                    : "var(--text-muted)",
              }}
            >
              {inspectId === rawGraph.center
                ? "FOCAL CENTER CHUNK"
                : rawGraph.callerIds.has(inspectId)
                ? "DIRECT CALLER"
                : rawGraph.calleeIds.has(inspectId)
                ? "DIRECT CALLEE"
                : inspectNode.is_external
                ? "EXTERNAL DEPENDENCY"
                : "REPOSITORY CODEBASE"}
            </span>
          </div>

          <div className="bugatti-inspect-item">
            <span className="bugatti-inspect-label">TOPOLOGY:</span>
            <span className="bugatti-inspect-value">
              {nodeIncomingCount} INCOMING CALLS · {nodeOutgoingCount} OUTGOING CALLS
            </span>
          </div>
        </div>
      </div>
    </GraphFocusContext.Provider>
  );
}

// Wrap with Provider for React Flow context
export default function ArchitectureGraph(props) {
  return (
    <ReactFlowProvider>
      <InnerArchitectureGraph {...props} />
    </ReactFlowProvider>
  );
}
