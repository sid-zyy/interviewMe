// Mirrors extension/src/lib/types.ts. Kept as a plain duplicate for MVP
// simplicity — consider a shared workspace package once this stabilizes.

export interface ScrapedProblem {
  source: "leetcode";
  slug: string;
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

export interface RubricScore {
  component: RubricComponent;
  score: number;
  feedback: string;
}

export interface InterviewTurnResponse {
  message: string;
  checklistCovered: RubricComponent[];
  stuckSignalDetected: boolean;
}

export interface InterviewScoreResponse {
  scores: RubricScore[];
  overall: number;
  summary: string;
}

export interface ConversationTurn {
  role: "interviewer" | "candidate";
  text: string;
}

export interface Session {
  id: string;
  problem: ScrapedProblem;
  history: ConversationTurn[];
  checklistCovered: Set<RubricComponent>;
}
