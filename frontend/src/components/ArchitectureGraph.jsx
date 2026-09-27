import { useState, useMemo } from "react";

export default function ArchitectureGraph({
  graphData,
  selected,
  onSelectNode,
  results = [],
  isExpanded = false,
  onToggleExpand,
}) {
  const [hoveredNode, setHoveredNode] = useState(null);

  const parsedGraph = useMemo(() => {
    if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
      return null;
    }

    const center = graphData.center_id;
    const nodes = graphData.nodes || [];
    const edges = graphData.edges || [];

    const callers = new Set();
    const callees = new Set();
    edges.forEach((e) => {
      if (e.target === center) callers.add(e.source);
      if (e.source === center) callees.add(e.target);
    });

    const otherNodes = nodes.filter((n) => n.id !== center);
    const centerNode = nodes.find((n) => n.id === center) || {
      id: center,
      symbol: center.split("::").pop() || center,
      file: "",
    };

    // Calculate intelligent geometric positions
    // Left quadrant for callers, right quadrant for callees, center in middle
    const callerList = otherNodes.filter((n) => callers.has(n.id));
    const calleeList = otherNodes.filter((n) => !callers.has(n.id));

    const positions = {};
    positions[center] = { x: 50, y: 50 };

    // Layout callers on the left (x: 18% to 26%)
    const callerCount = callerList.length;
    callerList.forEach((n, idx) => {
      const step = 70 / Math.max(callerCount, 1);
      const startY = 15 + (70 - (callerCount - 1) * step) / 2;
      positions[n.id] = {
        x: callerCount === 1 ? 22 : 18 + (idx % 2) * 8,
        y: callerCount === 1 ? 50 : startY + idx * step,
      };
    });

    // Layout callees on the right (x: 74% to 82%)
    const calleeCount = calleeList.length;
    calleeList.forEach((n, idx) => {
      const step = 70 / Math.max(calleeCount, 1);
      const startY = 15 + (70 - (calleeCount - 1) * step) / 2;
      positions[n.id] = {
        x: calleeCount === 1 ? 78 : 74 + (idx % 2) * 8,
        y: calleeCount === 1 ? 50 : startY + idx * step,
      };
    });

    return {
      center,
      centerNode,
      nodes,
      edges,
      callers,
      callees,
      otherNodes,
      positions,
    };
  }, [graphData]);

  if (!parsedGraph) {
    return (
      <div className="bugatti-graph-panel bugatti-empty-graph-panel">
        <div className="bugatti-graph-header">
          <div>
            <div className="bugatti-graph-title">ARCHITECTURE & CALL GRAPH TOPOLOGY</div>
            <div className="bugatti-graph-sub">REACTIVE AST SUBGRAPH ENGINE · DEPTH 2</div>
          </div>
          <div className="bugatti-graph-status-tag">STANDBY</div>
        </div>

        <div className="bugatti-graph-canvas bugatti-graph-canvas-empty">
          <div className="bugatti-grid-lines"></div>
          <div className="bugatti-crosshair"></div>
          <div className="bugatti-empty-graph-text">
            <span>CODE ARCHITECTURE TOPOLOGY</span>
            <p>Execute an agent search or select a code candidate to resolve call neighborhood</p>
          </div>
        </div>
      </div>
    );
  }

  const { center, centerNode, nodes, edges, callers, callees, otherNodes, positions } = parsedGraph;

  const activeInspectNode = hoveredNode
    ? nodes.find((n) => n.id === hoveredNode)
    : selected
    ? nodes.find((n) => n.id === selected.chunk_id) || centerNode
    : centerNode;

  return (
    <div className={`bugatti-graph-panel ${isExpanded ? "is-expanded" : ""}`}>
      {/* Topology Header */}
      <div className="bugatti-graph-header">
        <div>
          <div className="bugatti-graph-title">ARCHITECTURE & CALL GRAPH TOPOLOGY</div>
          <div className="bugatti-graph-sub">
            NEIGHBORHOOD: {centerNode.symbol} · {nodes.length} NODES · {edges.length} RELATIONS
          </div>
        </div>

        <div className="bugatti-graph-controls">
          {onToggleExpand && (
            <button
              className="bugatti-outline-pill-btn bugatti-btn-sm"
              onClick={onToggleExpand}
              title="Toggle Viewport Size"
            >
              {isExpanded ? "COMPACT VIEW" : "EXPAND TOPOLOGY"}
            </button>
          )}

          <div className="bugatti-legend-pills">
            <span className="bugatti-legend-pill pill-center">CENTER CHUNK</span>
            <span className="bugatti-legend-pill pill-caller">CALLERS ({callers.size})</span>
            <span className="bugatti-legend-pill pill-callee">CALLEES ({callees.size})</span>
          </div>
        </div>
      </div>

      {/* Interactive Topology Canvas */}
      <div className="bugatti-graph-canvas">
        <div className="bugatti-grid-lines"></div>

        {/* SVG Edge Connectors with Directional Hairlines */}
        <svg className="bugatti-graph-svg">
          <defs>
            <marker
              id="arrow-caller"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 8 5 L 0 9 z" fill="#c3d9f3" />
            </marker>
            <marker
              id="arrow-callee"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 8 5 L 0 9 z" fill="#999999" />
            </marker>
          </defs>

          {edges.map((e, idx) => {
            const posSource = positions[e.source];
            const posTarget = positions[e.target];
            if (!posSource || !posTarget) return null;

            const isCallerEdge = e.target === center;

            return (
              <line
                key={`edge-${idx}`}
                x1={`${posSource.x}%`}
                y1={`${posSource.y}%`}
                x2={`${posTarget.x}%`}
                y2={`${posTarget.y}%`}
                stroke={isCallerEdge ? "var(--accent-link, #c3d9f3)" : "var(--border-hairline-strong, #3a3a3a)"}
                strokeWidth="1"
                strokeDasharray={e.relation === "imports" ? "3,3" : "none"}
                markerEnd={isCallerEdge ? "url(#arrow-caller)" : "url(#arrow-callee)"}
              />
            );
          })}
        </svg>

        {/* Center Node */}
        <div
          className={`bugatti-node node-center ${selected?.chunk_id === center ? "is-selected" : ""}`}
          style={{
            left: `${positions[center].x}%`,
            top: `${positions[center].y}%`,
          }}
          onMouseEnter={() => setHoveredNode(center)}
          onMouseLeave={() => setHoveredNode(null)}
          onClick={() => {
            const match = results.find((r) => r.chunk_id === center);
            if (match && onSelectNode) onSelectNode(match);
          }}
          title={center}
        >
          <div className="bugatti-node-badge">CENTER</div>
          <div className="bugatti-node-symbol">{centerNode.symbol}</div>
          <div className="bugatti-node-file">{centerNode.file ? centerNode.file.split(/[/\\]/).pop() : "ACTIVE CHUNK"}</div>
        </div>

        {/* Other Nodes (Callers & Callees) */}
        {otherNodes.map((node) => {
          const pos = positions[node.id];
          if (!pos) return null;

          const isCaller = callers.has(node.id);
          const isCallee = callees.has(node.id);
          const isSelected = selected?.chunk_id === node.id;
          const nodeTypeClass = node.is_external
            ? "node-external"
            : isCaller
            ? "node-caller"
            : "node-callee";

          const shortFile = node.file ? node.file.split(/[/\\]/).pop() : "";

          return (
            <div
              key={node.id}
              className={`bugatti-node ${nodeTypeClass} ${isSelected ? "is-selected" : ""}`}
              style={{
                left: `${pos.x}%`,
                top: `${pos.y}%`,
              }}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => {
                const match = results.find((r) => r.chunk_id === node.id);
                if (match && onSelectNode) {
                  onSelectNode(match);
                } else if (onSelectNode) {
                  onSelectNode({
                    chunk_id: node.id,
                    symbol: node.symbol,
                    file: node.file,
                    start_line: node.start_line,
                    end_line: node.end_line,
                    code: `# Subgraph node: ${node.id}\n# File: ${node.file}`,
                    final_score: 0.85,
                    score_breakdown: { semantic: 0.85, bm25: 0.8, symbol: 1.0, graph: 1.0 },
                    why_matched: `Referenced directly in call graph neighborhood of ${centerNode.symbol}.`,
                  });
                }
              }}
              title={node.id}
            >
              <div className="bugatti-node-badge">
                {node.is_external ? "EXTERNAL" : isCaller ? "CALLER" : "CALLEE"}
              </div>
              <div className="bugatti-node-symbol">{node.symbol}</div>
              {shortFile && <div className="bugatti-node-file">{shortFile}</div>}
            </div>
          );
        })}
      </div>

      {/* Bottom Node Inspector Bar */}
      {activeInspectNode && (
        <div className="bugatti-graph-inspector">
          <div className="bugatti-inspect-item">
            <span className="bugatti-inspect-label">INSPECTED SYMBOL</span>
            <span className="bugatti-inspect-value">{activeInspectNode.symbol}</span>
          </div>
          <div className="bugatti-inspect-item">
            <span className="bugatti-inspect-label">LOCATION</span>
            <span className="bugatti-inspect-value">
              {activeInspectNode.file || "unknown"}
              {activeInspectNode.start_line ? ` : L${activeInspectNode.start_line}–${activeInspectNode.end_line}` : ""}
            </span>
          </div>
          <div className="bugatti-inspect-item">
            <span className="bugatti-inspect-label">ROLE IN GRAPH</span>
            <span className="bugatti-inspect-value" style={{ color: "var(--accent-link, #c3d9f3)" }}>
              {activeInspectNode.id === center
                ? "FOCAL CENTER"
                : callers.has(activeInspectNode.id)
                ? "CALLER TO FOCAL"
                : "CALLEE OF FOCAL"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
