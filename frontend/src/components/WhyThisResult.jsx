export default function WhyThisResult({ result }) {
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

  return (
    <div className="bugatti-why-card">
      {/* Header */}
      <div className="bugatti-why-header">
        <div className="bugatti-why-title">WHY THIS RESULT</div>
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
          <div className="bugatti-section-caption">EVIDENCE CHAIN</div>

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
        <div className="bugatti-section-caption">EXPLAINABILITY SYNTHESIS</div>
        <p className="bugatti-why-reason-text">
          {result.why_matched || "Verified multi-factor score breakdown aggregated above."}
        </p>
      </div>
    </div>
  );
}