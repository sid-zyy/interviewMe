import type {
  ScrapedProblem,
  InterviewTurnResponse,
  InterviewScoreResponse,
  HealthResponse,
  HintReason,
} from "./types";

// Point this at your deployed backend (Phase 5). For local dev, run the
// backend on :8787 and leave this as-is, or change it in the settings sheet.
export const DEFAULT_BASE_URL = "http://localhost:8787";

async function getBaseUrl(): Promise<string> {
  const stored = await chrome.storage.local.get("backendBaseUrl");
  return (stored.backendBaseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

async function readError(res: Response): Promise<string> {
  const body = await res.text();
  try {
    return JSON.parse(body).error ?? body;
  } catch {
    return body || res.statusText;
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const baseUrl = await getBaseUrl();
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Backend error ${res.status}: ${await readError(res)}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: async (): Promise<HealthResponse | null> => {
    try {
      const res = await fetch(`${await getBaseUrl()}/health`);
      return res.ok ? ((await res.json()) as HealthResponse) : null;
    } catch {
      return null;
    }
  },

  startInterview: (problem: ScrapedProblem, sessionId: string) =>
    post<InterviewTurnResponse>("/interview/start", { problem, sessionId }),

  sendTurn: (sessionId: string, transcript: string, answerSeconds?: number) =>
    post<InterviewTurnResponse>("/interview/turn", { sessionId, transcript, answerSeconds }),

  requestHint: (sessionId: string, reason: HintReason = "button", idleSeconds?: number) =>
    post<InterviewTurnResponse>("/interview/hint", { sessionId, reason, idleSeconds }),

  scoreInterview: (sessionId: string) =>
    post<InterviewScoreResponse>("/interview/score", { sessionId }),

  transcribe: async (audio: Blob, sessionId?: string): Promise<string> => {
    const qs = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
    const res = await fetch(`${await getBaseUrl()}/interview/transcribe${qs}`, {
      method: "POST",
      headers: { "Content-Type": audio.type || "audio/webm" },
      body: audio,
    });
    if (!res.ok) {
      throw new Error(`Transcription failed (${res.status}): ${await readError(res)}`);
    }
    return ((await res.json()) as { text: string }).text;
  },
};
