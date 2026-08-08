import type {
  ScrapedProblem,
  InterviewTurnResponse,
  InterviewScoreResponse,
} from "./types";

// Point this at your deployed backend (Phase 5). For local dev, run the
// backend on :8787 and leave this as-is, or override via chrome.storage.
const DEFAULT_BASE_URL = "http://localhost:8787";

async function getBaseUrl(): Promise<string> {
  const stored = await chrome.storage.local.get("backendBaseUrl");
  return stored.backendBaseUrl || DEFAULT_BASE_URL;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const baseUrl = await getBaseUrl();
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Backend error ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  startInterview: (problem: ScrapedProblem, sessionId: string) =>
    post<InterviewTurnResponse>("/interview/start", { problem, sessionId }),

  sendTurn: (sessionId: string, transcript: string) =>
    post<InterviewTurnResponse>("/interview/turn", { sessionId, transcript }),

  scoreInterview: (sessionId: string) =>
    post<InterviewScoreResponse>("/interview/score", { sessionId }),
};
