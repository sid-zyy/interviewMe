import { Lightbulb, RotateCcw, ThumbsUp, Timer, TrendingUp } from "lucide-react";
import { fmtSecs } from "./Thread";
import type { InterviewScoreResponse } from "../../lib/types";
import { RUBRIC_LABELS } from "../../lib/types";

function barColor(score: number) {
  if (score >= 4) return "var(--success)";
  if (score >= 2.5) return "var(--warning)";
  return "var(--danger)";
}

function ringColor(overall: number) {
  if (overall >= 75) return "var(--success)";
  if (overall >= 50) return "var(--warning)";
  return "var(--danger)";
}

function verdict(overall: number) {
  if (overall >= 85) return "Strong hire";
  if (overall >= 70) return "Hire";
  if (overall >= 50) return "Lean hire";
  return "Keep practicing";
}

export function ScoreCard({ score, onRestart }: { score: InterviewScoreResponse; onRestart: () => void }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score.overall)) / 100;

  return (
    <>
      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="score-head">
          <div className="ring">
            <svg width="92" height="92" viewBox="0 0 92 92">
              <circle cx="46" cy="46" r={r} fill="none" stroke="var(--bg-surface-raised)" strokeWidth="7" />
              <circle
                cx="46"
                cy="46"
                r={r}
                fill="none"
                stroke={ringColor(score.overall)}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - pct)}
                style={{ transition: "stroke-dashoffset 1s var(--ease)" }}
              />
            </svg>
            <div className="ring-value">
              <strong>{score.overall}</strong>
              <span>/ 100</span>
            </div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="eyebrow" style={{ color: ringColor(score.overall) }}>{verdict(score.overall)}</div>
            <p className="score-summary">{score.summary}</p>
            {score.hintsUsed > 0 && (
              <div className="penalty">
                <Lightbulb size={12} />
                {score.hintsUsed} hint{score.hintsUsed === 1 ? "" : "s"} · −{score.hintPenalty} pts
              </div>
            )}
          </div>
        </div>
        {score.timing?.answers > 0 && (
          <div className="timing-row" aria-label="Answer pacing">
            <span className="badge unknown"><Timer size={11} /> Avg answer {fmtSecs(score.timing.avgAnswerSeconds)}</span>
            <span className="badge unknown">Longest {fmtSecs(score.timing.longestAnswerSeconds)}</span>
            {score.timing.autoHints > 0 && (
              <span className="badge medium">{score.timing.autoHints} timed hint{score.timing.autoHints === 1 ? "" : "s"}</span>
            )}
          </div>
        )}
      </section>

      <section className="card rubric" aria-label="Rubric breakdown">
        <span className="eyebrow">Breakdown</span>
        {score.scores.map((s) => (
          <div key={s.component}>
            <div className="rubric-row-head">
              <span>{RUBRIC_LABELS[s.component]}</span>
              <span>{s.score}/5</span>
            </div>
            <div className="bar">
              <div style={{ width: `${(s.score / 5) * 100}%`, background: barColor(s.score) }} />
            </div>
            <p className="rubric-feedback">{s.feedback}</p>
          </div>
        ))}
      </section>

      {(score.strengths?.length > 0 || score.improvements?.length > 0) && (
        <section className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {score.strengths?.length > 0 && (
            <div className="list-block">
              <h4 style={{ color: "var(--success)" }}><ThumbsUp size={13} /> What went well</h4>
              <ul>{score.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
          {score.improvements?.length > 0 && (
            <div className="list-block">
              <h4 style={{ color: "var(--accent)" }}><TrendingUp size={13} /> Work on next</h4>
              <ul>{score.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
        </section>
      )}

      <button className="btn lg block" onClick={onRestart}>
        <RotateCcw size={15} /> Practice again
      </button>
    </>
  );
}
