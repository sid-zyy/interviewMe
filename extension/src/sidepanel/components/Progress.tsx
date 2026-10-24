import { Check, Circle, Flag } from "lucide-react";
import type { HintState, RubricComponent } from "../../lib/types";
import { HINT_NAMES, RUBRIC_COMPONENTS, RUBRIC_LABELS } from "../../lib/types";

interface Props {
  covered: RubricComponent[];
  hint: HintState;
  onFinish: () => void;
  finishing: boolean;
}

export function Progress({ covered, hint, onFinish, finishing }: Props) {
  const done = new Set(covered);
  const target = RUBRIC_COMPONENTS.find((c) => !done.has(c));
  const level = hint.level;

  return (
    <section className="card progress" aria-label="Interview progress">
      <div className="progress-row">
        <span className="eyebrow">
          Checklist · {done.size}/{RUBRIC_COMPONENTS.length}
        </span>
        <button className="btn ghost" style={{ height: 26, padding: "0 8px" }} onClick={onFinish} disabled={finishing}>
          <Flag size={13} />
          Finish & score
        </button>
      </div>
      <div className="checklist">
        {RUBRIC_COMPONENTS.map((c) => (
          <span
            key={c}
            className={`check-chip${done.has(c) ? " done" : ""}${c === target ? " target" : ""}`}
          >
            {done.has(c) ? <Check size={12} strokeWidth={2.6} /> : <Circle size={10} />}
            {RUBRIC_LABELS[c]}
          </span>
        ))}
      </div>
      <div className="progress-row">
        <div className="ladder" title="Hints climb from a vague nudge to a near-answer. Deeper hints cost more points.">
          <span className="eyebrow">Hints</span>
          <div className="ladder-pips" aria-label={`Hint level ${level} of 4`}>
            {[1, 2, 3, 4].map((n) => (
              <span key={n} className={`pip${n <= level ? " on" : ""}`} />
            ))}
          </div>
        </div>
        <span className="ladder-label">
          {level > 0 ? HINT_NAMES[level as 1 | 2 | 3 | 4] : "None yet"}
          {hint.totalHints > 0 && ` · ${hint.totalHints} used`}
        </span>
      </div>
    </section>
  );
}
