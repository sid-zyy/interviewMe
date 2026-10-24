import { Router } from "express";
import express from "express";
import type { ScrapedProblem } from "../types.js";
import { createSession, getSession, requireSession } from "../lib/sessions.js";
import { getOpeningMessage, getNextTurn, getHint, getScore } from "../lib/gemini.js";
import { transcribe } from "../lib/whisper.js";

export const interviewRouter = Router();

// POST /interview/start — { problem, sessionId } -> opening interviewer message
interviewRouter.post("/start", async (req, res) => {
  try {
    const { problem, sessionId } = req.body as {
      problem: ScrapedProblem;
      sessionId: string;
    };
    if (!problem || !sessionId) {
      return res.status(400).json({ error: "problem and sessionId are required" });
    }
    const session = createSession(sessionId, problem);
    const opening = await getOpeningMessage(session);
    res.json(opening);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Clamp client-reported durations to something sane (0s – 1h).
function seconds(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(3600, Math.max(0, v)) : undefined;
}

// POST /interview/turn — { sessionId, transcript, answerSeconds? } -> next hint/response
interviewRouter.post("/turn", async (req, res) => {
  try {
    const { sessionId, transcript, answerSeconds } = req.body as {
      sessionId: string;
      transcript: string;
      answerSeconds?: number;
    };
    if (!sessionId || !transcript) {
      return res.status(400).json({ error: "sessionId and transcript are required" });
    }
    const session = requireSession(sessionId);
    const turn = await getNextTurn(session, transcript, seconds(answerSeconds));
    res.json(turn);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /interview/hint — { sessionId, reason?, idleSeconds? } -> next rung of the hint ladder
// reason "timeout" = the side panel's answer clock ran out with no answer.
interviewRouter.post("/hint", async (req, res) => {
  try {
    const { sessionId, reason, idleSeconds } = req.body as {
      sessionId: string;
      reason?: string;
      idleSeconds?: number;
    };
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }
    const session = requireSession(sessionId);
    const turn = await getHint(session, reason === "timeout" ? "timeout" : "button", seconds(idleSeconds));
    res.json(turn);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /interview/score — { sessionId } -> structured rubric score
// Only call this after a real submission is detected (see content script /
// Phase 6) so users can't game the score by explaining after seeing pass/fail.
interviewRouter.post("/score", async (req, res) => {
  try {
    const { sessionId } = req.body as { sessionId: string };
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }
    const session = requireSession(sessionId);
    const score = await getScore(session);
    res.json(score);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// POST /interview/transcribe?sessionId=… — raw audio body -> { text }
// Body is the MediaRecorder blob as-is (audio/webm by default in Chrome).
interviewRouter.post(
  "/transcribe",
  express.raw({ type: ["audio/*", "application/octet-stream"], limit: "25mb" }),
  async (req, res) => {
    try {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: "audio body is required" });
      }
      const sessionId = typeof req.query.sessionId === "string" ? req.query.sessionId : "";
      const session = sessionId ? getSession(sessionId) : undefined;
      const prompt = session
        ? `Technical interview about "${session.problem.title}". Terms: array, hashmap, ` +
          `two pointers, binary search, O(n log n), recursion, dynamic programming.`
        : undefined;

      const result = await transcribe(req.body, req.get("content-type") ?? "audio/webm", {
        prompt,
        language: "en",
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
);
