import type { AnswerTiming, HintLevel, HintState, RubricComponent, Session } from "../types.js";
import { RUBRIC_COMPONENTS } from "../types.js";

// Phase 7: the hint escalation ladder lives here as explicit backend state
// rather than being left to the model. The model is told exactly which rung
// it may use; the backend decides when to climb.
//
//   1 nudge      — a question that points at the area, nothing more
//   2 direction  — names the concept/category to think about
//   3 specific   — names the technique or data structure
//   4 near-answer — walks through the key step, stopping short of the full solution

export const HINT_LADDER: Record<Exclude<HintLevel, 0>, { name: string; guide: string }> = {
  1: {
    name: "Nudge",
    guide:
      "A gentle Socratic question that points at the area to think about. Do not name any technique or data structure.",
  },
  2: {
    name: "Direction",
    guide:
      "Name the general concept or category to consider (e.g. 'what if you traded memory for speed?'). Still no specific data structure or algorithm.",
  },
  3: {
    name: "Specific",
    guide:
      "Name the specific technique or data structure that unlocks the problem, and ask how they'd apply it.",
  },
  4: {
    name: "Near-answer",
    guide:
      "Describe the key step of the approach concretely, stopping just short of the full solution. Ask them to finish the reasoning.",
  },
};

// Cheap pre-check so we can escalate on the same turn the candidate asks for
// help, instead of waiting for the model's stuck flag one turn later.
const STUCK_PATTERNS = [
  /\bi\s*(do\s*n[o']?t|dunno)\s*know\b/i,
  /\bno idea\b/i,
  /\b(i'?m|i am)\s*(stuck|lost|confused|not sure)\b/i,
  /\b(give|need|can i get|could i get)\s*(me\s*)?(a\s*)?hint\b/i,
  /\bjust tell me\b/i,
  /\bnot sure (how|what|where)\b/i,
  /\bwhat should i do\b/i,
];

export function looksStuck(text: string): boolean {
  const t = text.trim();
  if (t.split(/\s+/).length <= 3 && /\b(um+|uh+|hmm+)\b/i.test(t)) return true;
  return STUCK_PATTERNS.some((re) => re.test(t));
}

export function initialHintState(): HintState {
  return { level: 0, target: null, stuckStreak: 0, totalHints: 0, autoHints: 0, maxLevelReached: 0 };
}

export function nextUncovered(session: Session): RubricComponent | null {
  return RUBRIC_COMPONENTS.find((c) => !session.checklistCovered.has(c)) ?? null;
}

// Level the next hint should be given at, if one is given this turn.
export function nextHintLevel(state: HintState): Exclude<HintLevel, 0> {
  return Math.min(4, state.level + 1) as Exclude<HintLevel, 0>;
}

// Called before the model runs, so the prompt can say what's allowed.
// `forced` is true when the candidate pressed the hint button.
export function planHint(
  session: Session,
  candidateText: string | null,
  forced: boolean
): { mustHint: boolean; level: Exclude<HintLevel, 0>; target: RubricComponent | null } {
  const target = nextUncovered(session);
  const state = session.hint;

  // Ladder restarts when the candidate moves on to a different checklist item.
  if (state.target !== target) {
    state.target = target;
    state.level = 0;
    state.stuckStreak = 0;
  }

  // Escalate when they explicitly ask, sound stuck now, or were still stuck
  // last turn (the model's flag) — the latter is what climbs the ladder.
  const stuckNow =
    forced ||
    (candidateText !== null && looksStuck(candidateText)) ||
    state.stuckStreak >= 1;
  return { mustHint: stuckNow, level: nextHintLevel(state), target };
}

// Called after the model responds, with what it actually did.
export function commitHint(
  session: Session,
  opts: { stuck: boolean; hintLevelGiven: HintLevel; allowedLevel: Exclude<HintLevel, 0> }
): HintLevel {
  const state = session.hint;
  // Never let the model skip rungs or go past the allowed one.
  const given = Math.min(opts.hintLevelGiven, opts.allowedLevel) as HintLevel;

  if (given > 0) {
    state.level = given;
    state.totalHints += 1;
    if (given > state.maxLevelReached) state.maxLevelReached = given;
  }
  state.stuckStreak = opts.stuck ? state.stuckStreak + 1 : 0;
  return given;
}

export function answerTiming(session: Session): AnswerTiming {
  const secs = session.history
    .map((t) => t.answerSeconds)
    .filter((s): s is number => typeof s === "number" && s >= 0);
  const total = secs.reduce((a, b) => a + b, 0);
  return {
    answers: secs.length,
    avgAnswerSeconds: secs.length ? Math.round(total / secs.length) : 0,
    longestAnswerSeconds: secs.length ? Math.round(Math.max(...secs)) : 0,
    autoHints: session.hint.autoHints,
  };
}

// Score penalty in points (out of 100). Deeper hints cost more.
export function hintPenalty(session: Session): number {
  const costs: Record<HintLevel, number> = { 0: 0, 1: 2, 2: 4, 3: 7, 4: 11 };
  return session.history.reduce((sum, t) => sum + (t.hintLevel ? costs[t.hintLevel] : 0), 0);
}
