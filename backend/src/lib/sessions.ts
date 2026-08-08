import type { Session, ScrapedProblem } from "../types.js";

// In-memory map keyed by session ID — fine for MVP, swap for Redis/Postgres
// (Phase 9) once you need persistence across server restarts or multiple
// backend instances.
const sessions = new Map<string, Session>();

export function createSession(id: string, problem: ScrapedProblem): Session {
  const session: Session = {
    id,
    problem,
    history: [],
    checklistCovered: new Set(),
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function requireSession(id: string): Session {
  const session = sessions.get(id);
  if (!session) {
    throw new Error(`No session found for id "${id}". Call /interview/start first.`);
  }
  return session;
}
