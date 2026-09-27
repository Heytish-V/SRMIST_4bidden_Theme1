export default function WhyThisResult({ result, query = "" }) {
  if (!result) return null;

  const sb = result.score_breakdown || {};
  const evidence = result.evidence || [];
  const confidence = result.confidence_level || "MEDIUM";

  const getConfidenceStyle = (level) => {
    switch (level) {
      case "HIGH":
        return {
          color: "var(--semantic-success, #5fa657)",
          borderColor: "var(--semantic-success, #5fa657)",
        };
      case "LOW":
        return {
          color: "var(--text-muted, #999999)",
          borderColor: "var(--border-hairline-strong, #3a3a3a)",
        };
      case "MEDIUM":
      default:
        return {
          color: "var(--semantic-warning, #d4a017)",
          borderColor: "var(--semantic-warning, #d4a017)",
        };
    }
  };

  const confStyle = getConfidenceStyle(confidence);

  // Generate domain-level human-readable explainability (100% repository-agnostic)
  const generateNarrative = () => {
    const sym = result.symbol || "";
    const file = result.file || "";
    const rawWhy = result.why_matched || "";

    // 1. If backend already returned a rich semantic explanation (not a raw formula)
    if (rawWhy && !rawWhy.startsWith("Dense(") && !rawWhy.startsWith("Hybrid(")) {
      return rawWhy;
    }

    // 2. Token overlap analysis between query and code symbol / file
    const queryTokens = (query || "")
      .toLowerCase()
      .split(/[^a-zA-Z0-9_]+/)
      .filter((t) => t.length > 2);

    const symTokens = sym.toLowerCase().split(/[^a-zA-Z0-9_]+/);
    const fileTokens = file.toLowerCase().split(/[^a-zA-Z0-9_]+/);

    const matchingSymTokens = queryTokens.filter((t) =>
      symTokens.some((st) => st.includes(t) || t.includes(st))
    );
    const matchingFileTokens = queryTokens.filter((t) =>
      fileTokens.some((ft) => ft.includes(t) || t.includes(ft))
    );

    // 3. Multi-factor score reasoning
    const semanticScore = sb.semantic ?? 0;
    const bm25Score = sb.bm25 ?? 0;
    const graphScore = sb.graph ?? 0;
    const symbolScore = sb.symbol ?? 0;

    const details = [];

    if (matchingSymTokens.length > 0) {
      details.push(
        `symbol '${sym}' directly matches query keyword${matchingSymTokens.length > 1 ? "s" : ""} [${matchingSymTokens.join(", ")}]`
      );
    } else if (symbolScore > 0.5) {
      details.push(`symbol '${sym}' demonstrates strong lexical relevance`);
    }

    if (matchingFileTokens.length > 0) {
      details.push(
        `module '${file}' aligns with domain context [${matchingFileTokens.join(", ")}]`
      );
    }

    if (semanticScore > 0.6) {
      details.push(`dense vector similarity (${semanticScore.toFixed(2)}) indicates high semantic intent match`);
    }

    if (graphScore > 0.5) {
      details.push(`elevated architectural call-graph centrality (${graphScore.toFixed(2)})`);
    } else if (graphScore > 0) {
      details.push(`verified topological call linkage (${graphScore.toFixed(2)})`);
    }

    if (details.length === 0) {
      details.push(
        `dense semantic similarity (${semanticScore.toFixed(2)}) and BM25 lexical alignment (${bm25Score.toFixed(2)})`
      );
    }

    return `Ranked by Code Intelligence: ${details.join("; ")} in '${file}'.`;
  };

  return (
    <div className="bugatti-why-card">
      {/* Header */}
      <div className="bugatti-why-header">
        <div>
          <div className="bugatti-why-title">WHY THIS RESULT</div>
          <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px", fontFamily: "var(--font-mono)" }}>
            EXPLAINABLE MULTI-FACTOR REASONING
          </div>
        </div>
        <span
          className="bugatti-confidence-tag"
          style={{
            color: confStyle.color,
            borderColor: confStyle.borderColor,
          }}
        >
          {confidence} CONFIDENCE
        </span>
      </div>

      {/* Score Breakdown Grid - Spec Cell Format */}
      <div className="bugatti-why-spec-grid">
        <div className="bugatti-why-spec-cell">
          <div className="bugatti-why-spec-value">{(sb.semantic ?? 0).toFixed(2)}</div>
          <div className="bugatti-why-spec-label">SEMANTIC</div>
        </div>

        <div className="bugatti-why-spec-cell">
          <div className="bugatti-why-spec-value">{(sb.bm25 ?? 0).toFixed(2)}</div>
          <div className="bugatti-why-spec-label">BM25</div>
        </div>

        <div className="bugatti-why-spec-cell">
          <div className="bugatti-why-spec-value">{(sb.symbol ?? 0).toFixed(2)}</div>
          <div className="bugatti-why-spec-label">SYMBOL</div>
        </div>

        <div className="bugatti-why-spec-cell">
          <div className="bugatti-why-spec-value">{(sb.graph ?? 0).toFixed(2)}</div>
          <div className="bugatti-why-spec-label">GRAPH</div>
        </div>
      </div>

      {/* Structured Evidence Chain */}
      {evidence.length > 0 && (
        <div className="bugatti-why-evidence-section">
          <div className="bugatti-section-caption">FACTUAL EVIDENCE CHAIN</div>

          <div className="bugatti-evidence-list">
            {evidence.map((ev, idx) => (
              <div key={idx} className="bugatti-evidence-row">
                <div className="bugatti-evidence-left">
                  <span className="bugatti-evidence-factor">{ev.factor}</span>
                  <span className="bugatti-evidence-desc">{ev.description}</span>
                </div>
                <span className="bugatti-evidence-score">
                  {typeof ev.score === "number" ? ev.score.toFixed(3) : ev.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reason / Narrative in Cormorant Garamond Serif */}
      <div className="bugatti-why-narrative">
        <div className="bugatti-section-caption">SEMANTIC SYNTHESIS</div>
        <p className="bugatti-why-reason-text">
          {generateNarrative()}
        </p>
      </div>
    </div>
  );
}