import type { InterviewScoreResponse, RubricComponent } from "../../lib/types";

const LABELS: Record<RubricComponent, string> = {
  inputs_outputs: "Inputs & outputs",
  constraints: "Constraints",
  edge_cases: "Edge cases",
  approach: "Approach",
  complexity: "Complexity",
};

function barColor(score: number) {
  if (score >= 4) return "var(--success)";
  if (score >= 2) return "var(--warning)";
  return "var(--danger)";
}

export function ScoreCard({ score }: { score: InterviewScoreResponse }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        padding: 20,
        marginTop: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 32, fontWeight: 600 }}>
          {score.overall}
        </span>
        <span style={{ color: "var(--text-secondary)", fontSize: 14 }}>/ 100</span>
      </div>
      <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 0, marginBottom: 18 }}>
        {score.summary}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {score.scores.map((s) => (
          <div key={s.component}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12.5,
                marginBottom: 4,
              }}
            >
              <span style={{ color: "var(--text-primary)" }}>{LABELS[s.component]}</span>
              <span style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                {s.score}/5
              </span>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: "var(--radius-full)",
                background: "var(--bg-surface-raised)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${(s.score / 5) * 100}%`,
                  background: barColor(s.score),
                  borderRadius: "var(--radius-full)",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "4px 0 0" }}>
              {s.feedback}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
