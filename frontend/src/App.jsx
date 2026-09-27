import { useState, useRef, useCallback } from "react";
import Editor from "@monaco-editor/react";
import WhyThisResult from "./components/WhyThisResult";
import ArchitectureGraph from "./components/ArchitectureGraph";
import "./App.css";

const API = "http://127.0.0.1:8000";

function App() {
  const [query, setQuery] = useState(
    "Where is user authentication token validated and refreshed?"
  );
  const [results, setResults] = useState([]);
  const [trace, setTrace] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("READY");

  // Structural query state
  const [mode, setMode] = useState("search"); // "search" | "structural"
  const [funcBefore, setFuncBefore] = useState("sanitize_input");
  const [funcAfter, setFuncAfter] = useState("validate_signature");
  const [structuralResults, setStructuralResults] = useState(null);

  // Graph visualization state
  const [graphData, setGraphData] = useState(null);
  const [graphExpanded, setGraphExpanded] = useState(false);

  // View Mode: 'split' | 'topology' | 'code'
  const [viewMode, setViewMode] = useState("split");

  // Right Panel Tab: 'candidates' | 'trace' | 'why'
  const [rightTab, setRightTab] = useState("candidates");

  // Monaco editor ref for line highlighting
  const editorRef = useRef(null);
  const decorationsRef = useRef([]);

  // Repository switching state
  const [repoPath, setRepoPath] = useState("");
  const [indexing, setIndexing] = useState(false);
  const [indexStatus, setIndexStatus] = useState(null);
  const [activeRepo, setActiveRepo] = useState(null);

  const runSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setStatus("SEARCHING");
    setStructuralResults(null);

    try {
      const response = await fetch(`${API}/api/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          top_k: 5,
          enable_agent: true,
        }),
      });

      if (!response.ok) {
        throw new Error("API request failed");
      }

      const data = await response.json();

      setResults(data.results || []);
      setTrace(data.agent_trace || []);
      setSelected(data.results?.[0] || null);
      setStatus("COMPLETE");

      // Fetch graph for top result
      if (data.results?.[0]?.chunk_id) {
        fetchGraph(data.results[0].chunk_id);
      }
    } catch (error) {
      console.error(error);
      setStatus("API ERROR");
    } finally {
      setLoading(false);
    }
  };

  const runStructuralQuery = async () => {
    if (!funcBefore.trim() || !funcAfter.trim()) return;

    setLoading(true);
    setStatus("STRUCTURAL QUERY");
    setResults([]);
    setTrace([]);

    try {
      const response = await fetch(`${API}/api/structural-query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          func_before: funcBefore,
          func_after: funcAfter,
        }),
      });

      if (!response.ok) throw new Error("Structural query failed");

      const data = await response.json();
      setStructuralResults(data);
      setStatus("COMPLETE");
    } catch (error) {
      console.error(error);
      setStatus("API ERROR");
    } finally {
      setLoading(false);
    }
  };

  const fetchGraph = async (chunkId) => {
    try {
      const response = await fetch(
        `${API}/api/graph/subgraph?chunk_id=${encodeURIComponent(chunkId)}&depth=2`
      );
      if (response.ok) {
        const data = await response.json();
        setGraphData(data);
      }
    } catch (e) {
      // Graph viz is optional
    }
  };

  const indexRepo = async () => {
    if (!repoPath.trim()) return;

    setIndexing(true);
    setIndexStatus(null);

    try {
      const response = await fetch(`${API}/api/repository/index`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_path: repoPath }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || "Indexing failed");
      }

      const data = await response.json();
      setActiveRepo(data);
      setIndexStatus(`Indexed ${data.chunks_indexed} chunks, ${data.graph_nodes} graph nodes`);

      // Clear previous search results since the codebase changed
      setResults([]);
      setTrace([]);
      setSelected(null);
      setStructuralResults(null);
      setGraphData(null);
    } catch (error) {
      setIndexStatus(`ERROR: ${error.message}`);
    } finally {
      setIndexing(false);
    }
  };

  // Define custom Bugatti Pure-Black Monaco theme on mount
  const handleEditorDidMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    monaco.editor.defineTheme("prism-bugatti-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "", foreground: "cccccc", background: "000000" },
        { token: "keyword", foreground: "ffffff" },
        { token: "string", foreground: "c3d9f3" },
        { token: "comment", foreground: "666666", fontStyle: "italic" },
        { token: "number", foreground: "e6e6e6" },
        { token: "type", foreground: "ffffff" },
        { token: "function", foreground: "ffffff" },
        { token: "delimiter", foreground: "888888" },
      ],
      colors: {
        "editor.background": "#000000",
        "editor.foreground": "#cccccc",
        "editorLineNumber.foreground": "#3a3a3a",
        "editorLineNumber.activeForeground": "#ffffff",
        "editor.lineHighlightBackground": "#0d0d0d",
        "editor.lineHighlightBorder": "#262626",
        "editorCursor.foreground": "#ffffff",
        "editor.selectionBackground": "#262626",
        "editor.inactiveSelectionBackground": "#141414",
      },
    });

    monaco.editor.setTheme("prism-bugatti-dark");
  }, []);

  // Apply line decorations when selected result changes
  const applyDecorations = useCallback((editor, monaco) => {
    if (!editor || !selected || !monaco) return;

    const decorations = [];

    // Subtle first line decoration
    if (selected.start_line && selected.end_line) {
      decorations.push({
        range: new monaco.Range(1, 1, 1, 1),
        options: {
          isWholeLine: true,
          className: "bugatti-monaco-first-line",
        },
      });
    }

    // Highlight matched call sites from evidence
    if (selected.evidence) {
      for (const ev of selected.evidence) {
        if (ev.factor === "structural" && selected.why_matched) {
          const lineMatch = selected.why_matched.match(/line (\d+)/g);
          if (lineMatch) {
            for (const lm of lineMatch) {
              const lineNum = parseInt(lm.replace("line ", ""), 10);
              const relLine = lineNum - (selected.start_line - 1);
              if (relLine > 0) {
                decorations.push({
                  range: new monaco.Range(relLine, 1, relLine, 1),
                  options: {
                    isWholeLine: true,
                    className: "bugatti-monaco-call-highlight",
                  },
                });
              }
            }
          }
        }
      }
    }

    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      decorations
    );
  }, [selected]);

  return (
    <div className="bugatti-app">
      {/* ==========================================================================
          TOP NAVIGATION BAR (56px) — Minimal, Technical, Letterspaced Wordmark
          ========================================================================== */}
      <header className="bugatti-topbar">
        <div className="bugatti-topbar-left">
          <span className="bugatti-brand-tag">SAMSUNG PRISM // THEME 1</span>
          <div className="bugatti-status-badge">
            <span
              className="bugatti-status-dot"
              style={{
                backgroundColor:
                  status === "COMPLETE"
                    ? "var(--semantic-success)"
                    : status === "SEARCHING" || status === "STRUCTURAL QUERY"
                    ? "var(--accent-link)"
                    : status === "API ERROR"
                    ? "var(--semantic-danger)"
                    : "var(--text-muted)",
              }}
            ></span>
            <span>SYSTEM {status}</span>
          </div>
        </div>

        <div className="bugatti-topbar-center">
          <h1 className="bugatti-wordmark">AGENTIC CODE ARCHITECTURE</h1>
        </div>

        <div className="bugatti-topbar-right">
          {activeRepo ? (
            <div className="bugatti-repo-tag" title={activeRepo.repo_path}>
              PATH: {activeRepo.repo_path.split(/[/\\]/).pop()}
            </div>
          ) : (
            <div className="bugatti-repo-tag">DEMO_REPO ACTIVE</div>
          )}

          <div className="bugatti-view-switcher">
            <button
              className={`bugatti-view-trigger ${viewMode === "split" ? "is-active" : ""}`}
              onClick={() => {
                setViewMode("split");
                setGraphExpanded(false);
              }}
            >
              SPLIT COCKPIT
            </button>
            <button
              className={`bugatti-view-trigger ${viewMode === "topology" ? "is-active" : ""}`}
              onClick={() => {
                setViewMode("topology");
                setGraphExpanded(true);
              }}
            >
              TOPOLOGY FOCUS
            </button>
            <button
              className={`bugatti-view-trigger ${viewMode === "code" ? "is-active" : ""}`}
              onClick={() => {
                setViewMode("code");
                setGraphExpanded(false);
              }}
            >
              CODE FOCUS
            </button>
          </div>
        </div>
      </header>

      {/* ==========================================================================
          MASTER WORKSPACE
          ========================================================================== */}
      <main className={`bugatti-workspace mode-${viewMode}`}>
        {/* ------------------------------------------------------------------------
            LEFT PANEL: CONTROL & INGESTION DECK (310px)
            ------------------------------------------------------------------------ */}
        <section className="bugatti-panel">
          <div className="bugatti-panel-header">
            <div className="bugatti-panel-title">CONTROL & INGESTION</div>
            <div className="bugatti-panel-sub">CODEBASE DECK</div>
          </div>

          <div className="bugatti-panel-content">
            {/* Local Repository Ingestion */}
            <div className="bugatti-deck-section">
              <label className="bugatti-label">LOCAL REPOSITORY CORPUS</label>
              <div className="bugatti-input-underline-wrap">
                <input
                  className="bugatti-input-underline"
                  value={repoPath}
                  onChange={(e) => setRepoPath(e.target.value)}
                  placeholder="C:\path\to\repo"
                  onKeyDown={(e) => e.key === "Enter" && indexRepo()}
                />
                <button
                  className="bugatti-outline-pill-btn bugatti-btn-sm"
                  onClick={indexRepo}
                  disabled={indexing || !repoPath.trim()}
                >
                  {indexing ? "INDEXING…" : "INDEX"}
                </button>
              </div>

              {indexStatus && (
                <div
                  style={{
                    marginTop: "8px",
                    fontSize: "10px",
                    color: indexStatus.startsWith("ERROR")
                      ? "var(--semantic-danger)"
                      : "var(--semantic-success)",
                  }}
                >
                  {indexStatus}
                </div>
              )}
            </div>

            {/* Mode Switcher */}
            <div className="bugatti-deck-section">
              <label className="bugatti-label">QUERY EXECUTION MODE</label>
              <div className="bugatti-segmented-tabs">
                <div
                  className={`bugatti-segmented-tab ${mode === "search" ? "is-active" : ""}`}
                  onClick={() => setMode("search")}
                >
                  HYBRID RETRIEVAL
                </div>
                <div
                  className={`bugatti-segmented-tab ${mode === "structural" ? "is-active" : ""}`}
                  onClick={() => setMode("structural")}
                >
                  AST PATTERN
                </div>
              </div>

              {mode === "search" ? (
                <>
                  <label className="bugatti-label">NATURAL LANGUAGE INTENT</label>
                  <textarea
                    className="bugatti-textarea"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Enter query into the codebase..."
                  />

                  <button
                    className="bugatti-outline-pill-btn bugatti-btn-full"
                    onClick={runSearch}
                    disabled={loading}
                  >
                    {loading ? "EXECUTING REASONING AGENT…" : "EXECUTE AGENT SEARCH"}
                  </button>
                </>
              ) : (
                <>
                  <label className="bugatti-label">AST SEQUENCE ORDERING</label>
                  <p
                    style={{
                      fontSize: "11px",
                      color: "var(--text-muted)",
                      marginBottom: "10px",
                    }}
                  >
                    Find functions that invoke X strictly prior to Y
                  </p>

                  <div className="bugatti-struct-row">
                    <input
                      className="bugatti-input-underline"
                      value={funcBefore}
                      onChange={(e) => setFuncBefore(e.target.value)}
                      placeholder="func_before"
                    />
                    <span className="bugatti-struct-arrow">→</span>
                    <input
                      className="bugatti-input-underline"
                      value={funcAfter}
                      onChange={(e) => setFuncAfter(e.target.value)}
                      placeholder="func_after"
                    />
                  </div>

                  <button
                    className="bugatti-outline-pill-btn bugatti-btn-full"
                    onClick={runStructuralQuery}
                    disabled={loading}
                  >
                    {loading ? "PARSING AST FLOW…" : "EXECUTE STRUCTURAL QUERY"}
                  </button>
                </>
              )}
            </div>

            {/* Pipeline Telemetry */}
            <div className="bugatti-deck-section">
              <label className="bugatti-label">PIPELINE TELEMETRY</label>
              <div className="bugatti-telemetry-list">
                <div className="bugatti-telemetry-row">
                  <span className="bugatti-telemetry-label">TOP-K RETRIEVAL</span>
                  <span className="bugatti-telemetry-val">5 CHUNKS</span>
                </div>
                <div className="bugatti-telemetry-row">
                  <span className="bugatti-telemetry-label">DENSE EMBEDDINGS</span>
                  <span className="bugatti-telemetry-val">ONLINE</span>
                </div>
                <div className="bugatti-telemetry-row">
                  <span className="bugatti-telemetry-label">LEXICAL BM25</span>
                  <span className="bugatti-telemetry-val">ONLINE</span>
                </div>
                <div className="bugatti-telemetry-row">
                  <span className="bugatti-telemetry-label">SUBGRAPH REASONER</span>
                  <span className="bugatti-telemetry-val">ONLINE</span>
                </div>
                <div className="bugatti-telemetry-row">
                  <span className="bugatti-telemetry-label">AST VERIFIER</span>
                  <span className="bugatti-telemetry-val">ONLINE</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------------
            CENTER PANEL: THE VISUAL FOCUS — ARCHITECTURE STUDIO & MONACO CODE VIEWER
            ------------------------------------------------------------------------ */}
        <section className="bugatti-panel">
          <div className="bugatti-stage-container">
            {/* HERO 1: Architecture & Call Graph Studio */}
            <ArchitectureGraph
              graphData={graphData}
              selected={selected}
              results={results}
              isExpanded={graphExpanded}
              onToggleExpand={() => setGraphExpanded(!graphExpanded)}
              onSelectNode={(nodeOrChunk) => {
                setSelected(nodeOrChunk);
                if (nodeOrChunk.chunk_id) fetchGraph(nodeOrChunk.chunk_id);
              }}
            />

            {/* HERO 2: Precision Monaco Code Inspection */}
            <div className="bugatti-code-panel">
              <div className="bugatti-code-header">
                <span className="bugatti-code-filepath">
                  {selected
                    ? `${selected.file} :: ${selected.symbol}`
                    : "NO CHUNK SELECTED"}
                </span>

                <span className="bugatti-code-lines">
                  {selected
                    ? `LINES L${selected.start_line} – L${selected.end_line}`
                    : "AWAITING SELECTION"}
                </span>
              </div>

              <div className="bugatti-monaco-wrapper">
                <Editor
                  height="100%"
                  minHeight="340px"
                  language="python"
                  theme="prism-bugatti-dark"
                  value={
                    selected?.code ||
                    "# Select a code candidate or run an agent search to inspect source code.\n# Monaco syntax highlighting, line decorations, and call site evidence will project here."
                  }
                  onMount={(editor, monaco) => {
                    handleEditorDidMount(editor, monaco);
                    applyDecorations(editor, monaco);
                  }}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 13,
                    fontFamily: "JetBrains Mono, monospace",
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    glyphMargin: false,
                    padding: { top: 14, bottom: 14 },
                  }}
                />
              </div>

              {/* Bugatti Spec Cell Metric Bar */}
              {selected && (
                <div className="bugatti-spec-grid">
                  <div className="bugatti-spec-cell">
                    <div className="bugatti-spec-value">
                      {(selected.score_breakdown?.semantic ?? 0).toFixed(3)}
                    </div>
                    <div className="bugatti-spec-label">SEMANTIC DENSITY</div>
                  </div>

                  <div className="bugatti-spec-cell">
                    <div className="bugatti-spec-value">
                      {(selected.score_breakdown?.bm25 ?? 0).toFixed(3)}
                    </div>
                    <div className="bugatti-spec-label">LEXICAL BM25</div>
                  </div>

                  <div className="bugatti-spec-cell">
                    <div className="bugatti-spec-value">
                      {(selected.score_breakdown?.symbol ?? 0).toFixed(3)}
                    </div>
                    <div className="bugatti-spec-label">SYMBOL MATCH</div>
                  </div>

                  <div className="bugatti-spec-cell">
                    <div className="bugatti-spec-value">
                      {(selected.score_breakdown?.graph ?? 0).toFixed(3)}
                    </div>
                    <div className="bugatti-spec-label">GRAPH PROXIMITY</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------------
            RIGHT PANEL: CANDIDATES, EXPLAINABILITY & AGENT TRACE
            ------------------------------------------------------------------------ */}
        <section className="bugatti-panel">
          <div className="bugatti-tabs-header">
            <button
              className={`bugatti-tab-btn ${rightTab === "candidates" ? "is-active" : ""}`}
              onClick={() => setRightTab("candidates")}
            >
              CANDIDATES ({results.length})
            </button>
            <button
              className={`bugatti-tab-btn ${rightTab === "trace" ? "is-active" : ""}`}
              onClick={() => setRightTab("trace")}
            >
              AGENT TRACE ({trace.length})
            </button>
            <button
              className={`bugatti-tab-btn ${rightTab === "why" ? "is-active" : ""}`}
              onClick={() => setRightTab("why")}
            >
              EXPLAINABILITY
            </button>
          </div>

          <div className="bugatti-panel-content">
            {/* Structural Results Display (if in AST mode) */}
            {structuralResults && (
              <div style={{ marginBottom: "20px" }}>
                <div className="bugatti-label">{structuralResults.predicate}</div>
                {structuralResults.matches.length === 0 ? (
                  <div className="bugatti-empty-state">
                    No AST-verified matches found for predicate.
                  </div>
                ) : (
                  structuralResults.matches.map((match, idx) => (
                    <div className="bugatti-struct-card" key={idx}>
                      <span className="bugatti-struct-tier">
                        {match.confidence >= 1.0
                          ? "TIER 1 : AST-VERIFIED"
                          : "TIER 2 : REACHABILITY"}
                      </span>
                      <div className="bugatti-struct-caller">{match.caller}</div>
                      <div className="bugatti-struct-evidence">{match.evidence}</div>
                      <div
                        style={{
                          fontSize: "10px",
                          color: "var(--text-muted)",
                          marginTop: "6px",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {match.file} · L{match.start_line}–L{match.end_line}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 1: Candidates List */}
            {rightTab === "candidates" && (
              <>
                {results.length === 0 ? (
                  <div className="bugatti-empty-state">
                    NO CANDIDATES RETRIEVED YET.
                    <br />
                    EXECUTE AGENT SEARCH TO BEGIN.
                  </div>
                ) : (
                  <div className="bugatti-results-list">
                    {results.map((result) => {
                      const isSelected = selected?.chunk_id === result.chunk_id;
                      return (
                        <div
                          key={result.chunk_id}
                          className={`bugatti-result-card ${isSelected ? "is-selected" : ""}`}
                          onClick={() => {
                            setSelected(result);
                            if (result.chunk_id) fetchGraph(result.chunk_id);
                          }}
                        >
                          <div className="bugatti-result-top">
                            <span className="bugatti-result-rank">#{result.rank}</span>
                            <div className="bugatti-result-meta">
                              {result.confidence_level && (
                                <span
                                  className="bugatti-confidence-tag"
                                  style={{
                                    borderColor:
                                      result.confidence_level === "HIGH"
                                        ? "var(--semantic-success)"
                                        : result.confidence_level === "LOW"
                                        ? "var(--border-hairline-strong)"
                                        : "var(--semantic-warning)",
                                    color:
                                      result.confidence_level === "HIGH"
                                        ? "var(--semantic-success)"
                                        : result.confidence_level === "LOW"
                                        ? "var(--text-muted)"
                                        : "var(--semantic-warning)",
                                  }}
                                >
                                  {result.confidence_level}
                                </span>
                              )}
                              <span className="bugatti-result-score">
                                {result.final_score.toFixed(3)}
                              </span>
                            </div>
                          </div>

                          <div className="bugatti-result-symbol">{result.symbol}</div>
                          <div className="bugatti-result-file">
                            {result.file} : L{result.start_line}–{result.end_line}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Inline Explainability card under candidates if selected */}
                {selected && <WhyThisResult result={selected} />}
              </>
            )}

            {/* TAB 2: Agent Execution Trace */}
            {rightTab === "trace" && (
              <>
                {trace.length === 0 ? (
                  <div className="bugatti-empty-state">
                    NO AGENT TRACE AVAILABLE.
                    <br />
                    EXECUTE AN AGENT SEARCH TO STREAM REASONING STEPS.
                  </div>
                ) : (
                  <div className="bugatti-trace-timeline">
                    {trace.map((step) => (
                      <div className="bugatti-trace-step" key={step.step}>
                        <div className="bugatti-trace-num">{step.step}</div>
                        <div className="bugatti-trace-body">
                          <div className="bugatti-trace-tool">{step.tool}</div>
                          {step.target && (
                            <div className="bugatti-trace-target">{step.target}</div>
                          )}
                          <div className="bugatti-trace-result">{step.result}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* TAB 3: Dedicated Explainability & "Why This Result" */}
            {rightTab === "why" && (
              <>
                {selected ? (
                  <WhyThisResult result={selected} />
                ) : (
                  <div className="bugatti-empty-state">
                    SELECT A CODE CANDIDATE TO VIEW EXPLAINABILITY SYNTHESIS.
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;