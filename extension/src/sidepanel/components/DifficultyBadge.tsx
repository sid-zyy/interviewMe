import type { Difficulty, ProblemSource } from "../../lib/types";
import { siteMeta } from "../../lib/sites";

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  if (difficulty === "Unknown") return null;
  return <span className={`badge ${difficulty.toLowerCase()}`}>{difficulty}</span>;
}

export function SiteBadge({ source }: { source: ProblemSource }) {
  const { label, color } = siteMeta(source);
  return (
    <span className="badge site">
      <i style={{ background: color }} />
      {label}
    </span>
  );
}
