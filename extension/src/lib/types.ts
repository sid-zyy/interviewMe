// Shared types between content script, background, and side panel UI.
// Keep this in sync with backend/src/types.ts

export interface ScrapedProblem {
  source: "leetcode";
  slug: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard" | "Unknown";
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

export interface RubricScore {
  component: RubricComponent;
  score: number; // 0-5
  feedback: string;
}

export interface InterviewTurnResponse {
  message: string; // interviewer's spoken reply
  checklistCovered: RubricComponent[];
  stuckSignalDetected: boolean;
}

export interface InterviewScoreResponse {
  scores: RubricScore[];
  overall: number; // 0-100
  summary: string;
}

// Messages passed between content script <-> background <-> side panel
export type RuntimeMessage =
  | { type: "PROBLEM_SCRAPED"; payload: ScrapedProblem }
  | { type: "SUBMISSION_DETECTED"; payload: { slug: string; passed: boolean } }
  | { type: "REQUEST_CURRENT_PROBLEM" };
