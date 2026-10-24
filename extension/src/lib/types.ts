// Shared types between content script, background, and side panel UI.
// Keep this in sync with backend/src/types.ts

export type ProblemSource =
  | "leetcode"
  | "neetcode"
  | "hackerrank"
  | "codeforces"
  | "geeksforgeeks"
  | "codechef"
  | "atcoder"
  | "generic";

export type Difficulty = "Easy" | "Medium" | "Hard" | "Unknown";

export interface ScrapedProblem {
  source: ProblemSource;
  slug: string;
  url?: string;
  title: string;
  difficulty: Difficulty;
  descriptionText: string; // cleaned, TTS-friendly text
  constraints: string[];
  examples: string[];
}

export type RubricComponent =
  | "inputs_outputs"
  | "constraints"
  | "edge_cases"
  | "approach"
  | "complexity";

export const RUBRIC_COMPONENTS: RubricComponent[] = [
  "inputs_outputs",
  "constraints",
  "edge_cases",
  "approach",
  "complexity",
];

export const RUBRIC_LABELS: Record<RubricComponent, string> = {
  inputs_outputs: "Inputs & outputs",
  constraints: "Constraints",
  edge_cases: "Edge cases",
  approach: "Approach",
  complexity: "Complexity",
};

// 0 = no hint. 1..4 is the escalation ladder (see backend/src/lib/hints.ts).
export type HintLevel = 0 | 1 | 2 | 3 | 4;

export const HINT_NAMES: Record<Exclude<HintLevel, 0>, string> = {
  1: "Nudge",
  2: "Direction",
  3: "Specific",
  4: "Near-answer",
};

export interface HintState {
  level: HintLevel;
  target: RubricComponent | null;
  stuckStreak: number;
  totalHints: number;
  autoHints: number; // hints triggered by the answer clock
  maxLevelReached: HintLevel;
}

export interface RubricScore {
  component: RubricComponent;
  score: number; // 0-5
  feedback: string;
}

export interface InterviewTurnResponse {
  message: string; // interviewer's spoken reply
  checklistCovered: RubricComponent[];
  stuckSignalDetected: boolean;
  hintLevel: HintLevel;
  hint: HintState;
}

export interface InterviewScoreResponse {
  scores: RubricScore[];
  overall: number; // 0-100, after hint penalty
  summary: string;
  strengths: string[];
  improvements: string[];
  hintsUsed: number;
  hintPenalty: number;
  timing: AnswerTiming;
}

export interface HealthResponse {
  ok: boolean;
  gemini: boolean;
  whisper: { provider: string; model: string; configured: boolean };
}

// Messages passed between content script <-> background <-> side panel
export type RuntimeMessage =
  | { type: "PROBLEM_SCRAPED"; payload: ScrapedProblem }
  | { type: "ACTIVE_PROBLEM_CHANGED"; payload: ScrapedProblem | null }
  | { type: "SUBMISSION_DETECTED"; payload: { slug: string; passed: boolean } }
  | { type: "REQUEST_CURRENT_PROBLEM" };

export type HintReason = "button" | "timeout";

export interface AnswerTiming {
  answers: number;
  avgAnswerSeconds: number;
  longestAnswerSeconds: number;
  autoHints: number;
}
