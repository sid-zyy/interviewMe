import { Router } from "express";
import type { ScrapedProblem } from "../types.js";
import { createSession, requireSession } from "../lib/sessions.js";
import { getOpeningMessage, getNextTurn, getScore } from "../lib/gemini.js";

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

// POST /interview/turn — { sessionId, transcript } -> next hint/response
interviewRouter.post("/turn", async (req, res) => {
  try {
    const { sessionId, transcript } = req.body as {
      sessionId: string;
      transcript: string;
    };
    if (!sessionId || !transcript) {
      return res.status(400).json({ error: "sessionId and transcript are required" });
    }
    const session = requireSession(sessionId);
    const turn = await getNextTurn(session, transcript);
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
