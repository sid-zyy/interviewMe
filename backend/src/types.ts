// Mirrors extension/src/lib/types.ts. Kept as a plain duplicate for MVP
// simplicity — consider a shared workspace package once this stabilizes.

export type ProblemSource =
  | "leetcode"
  | "neetcode"
  | "hackerrank"
  | "codeforces"
  | "geeksforgeeks"
  | "codechef"
  | "atcoder"
  | "generic";

export interface ScrapedProblem {
  source: ProblemSource;
  slug: string;
  url?: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard" | "Unknown";
  descriptionText: string;
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

// 0 = no hint given. 1..4 is the escalation ladder, see lib/hints.ts.
export type HintLevel = 0 | 1 | 2 | 3 | 4;

export interface RubricScore {
  component: RubricComponent;
  score: number;
  feedback: string;
}

export interface HintState {
  level: HintLevel; // highest level reached on the current target
  target: RubricComponent | null; // checklist item the ladder is pushing toward
  stuckStreak: number; // consecutive turns the candidate looked stuck
  totalHints: number; // across the whole session, used for scoring
  autoHints: number; // subset of totalHints triggered by the answer clock
  maxLevelReached: HintLevel;
}

// Why a hint was requested outside a normal turn.
export type HintReason = "button" | "timeout";

export interface AnswerTiming {
  answers: number;
  avgAnswerSeconds: number;
  longestAnswerSeconds: number;
  autoHints: number;
}

export interface InterviewTurnResponse {
  message: string;
  checklistCovered: RubricComponent[];
  stuckSignalDetected: boolean;
  hintLevel: HintLevel; // level of the hint in this message, 0 if none
  hint: HintState;
}

export interface InterviewScoreResponse {
  scores: RubricScore[];
  overall: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  hintsUsed: number;
  hintPenalty: number;
  timing: AnswerTiming;
}

export interface ConversationTurn {
  role: "interviewer" | "candidate";
  text: string;
  hintLevel?: HintLevel;
  answerSeconds?: number; // candidate turns: time from question to send
  hintReason?: HintReason; // interviewer turns given outside a normal reply
}

export interface Session {
  id: string;
  problem: ScrapedProblem;
  history: ConversationTurn[];
  checklistCovered: Set<RubricComponent>;
  hint: HintState;
  createdAt: number;
}
