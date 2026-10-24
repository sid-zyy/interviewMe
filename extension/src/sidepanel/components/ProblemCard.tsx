import { useState } from "react";
import type { ScrapedProblem } from "../../lib/types";
import { DifficultyBadge, SiteBadge } from "./DifficultyBadge";

export function ProblemCard({ problem, compact }: { problem: ScrapedProblem; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const preview = problem.descriptionText
    .replace(/[*_`#>]/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim();

  return (
    <section className="card problem-card" aria-label="Current problem">
      <div className="problem-meta">
        <SiteBadge source={problem.source} />
        <DifficultyBadge difficulty={problem.difficulty} />
        {problem.constraints.length > 0 && (
          <span className="badge unknown">{problem.constraints.length} constraints</span>
        )}
      </div>
      <h1 className="problem-title">{problem.title}</h1>
      {!compact && (
        <>
          <div className={`problem-preview${open ? " open" : ""}`}>{preview}</div>
          <button className="link-btn" onClick={() => setOpen((o) => !o)}>
            {open ? "Show less" : "Show full statement"}
          </button>
        </>
      )}
    </section>
  );
}
