import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type {
  Session,
  HintLevel,
  InterviewTurnResponse,
  InterviewScoreResponse,
  RubricComponent,
  HintReason,
} from "../types.js";
import { RUBRIC_COMPONENTS } from "../types.js";
import { HINT_LADDER, planHint, commitHint, hintPenalty, answerTiming } from "./hints.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

// Phase 7: this is the core "interviewer persona" prompt. Iterate here first
// before touching any code — most quality gains come from prompt tuning.
const SYSTEM_PROMPT = `You are a calm, encouraging technical interviewer running a
mock coding interview. The candidate is explaining their understanding of a
problem OUT LOUD before writing code — you are NOT reviewing code.

Your job each turn:
1. Track which of these checklist items the candidate has clearly addressed:
   inputs_outputs, constraints, edge_cases, approach, complexity.
2. Hints follow a strict escalation ladder controlled by the system. Each turn
   you are told the ONLY hint level you may use. Never give a hint more
   specific than that level, and never reveal the full solution or code.
3. If they're doing fine, ask a short follow-up question that pushes toward
   the next uncovered checklist item, and set hintLevelGiven to 0.
4. The candidate's words come from speech-to-text and may contain
   transcription errors — interpret charitably.
5. CRITICAL: "message" must be ONE or TWO short sentences, 25 words or fewer.
   It is read aloud via TTS — long messages are a hard failure.`;

const turnResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    message: { type: SchemaType.STRING },
    checklistCovered: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING, enum: RUBRIC_COMPONENTS },
    },
    stuckSignalDetected: { type: SchemaType.BOOLEAN },
    hintLevelGiven: { type: SchemaType.INTEGER },
  },
  required: ["message", "checklistCovered", "stuckSignalDetected", "hintLevelGiven"],
};

const scoreResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    scores: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          component: { type: SchemaType.STRING, enum: RUBRIC_COMPONENTS },
          score: { type: SchemaType.NUMBER },
          feedback: { type: SchemaType.STRING },
        },
        required: ["component", "score", "feedback"],
      },
    },
    overall: { type: SchemaType.NUMBER },
    summary: { type: SchemaType.STRING },
    strengths: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    improvements: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ["scores", "overall", "summary", "strengths", "improvements"],
};

interface RawTurn {
  message: string;
  checklistCovered: RubricComponent[];
  stuckSignalDetected: boolean;
  hintLevelGiven: number;
}

function getModel(schema: object) {
  return genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema as any,
    },
  });
}

function transcriptSoFar(session: Session): string {
  return session.history
    .map((t) => {
      const tags = [
        t.hintLevel ? `hint L${t.hintLevel}${t.hintReason === "timeout" ? ", after silence" : ""}` : "",
        t.answerSeconds !== undefined ? `${Math.round(t.answerSeconds)}s` : "",
      ].filter(Boolean);
      return `${t.role}${tags.length ? ` [${tags.join(", ")}]` : ""}: ${t.text}`;
    })
    .join("\n");
}

function problemBlock(session: Session): string {
  const p = session.problem;
  return `Problem: ${p.title} (${p.difficulty}, from ${p.source})
${p.descriptionText.slice(0, 6000)}`;
}

function hintInstructions(
  plan: ReturnType<typeof planHint>,
  forced?: { reason: HintReason; idleSeconds?: number }
): string {
  const rung = HINT_LADDER[plan.level];
  const target = plan.target ?? "overall solution";
  const why = !forced
    ? ""
    : forced.reason === "timeout"
      ? ` (the candidate has been silent for ${Math.round(forced.idleSeconds ?? 0)} seconds — ` +
        `acknowledge it gently, e.g. "Let me give you a nudge", without scolding)`
      : " (the candidate pressed the hint button)";
  if (plan.mustHint) {
    return `HINT REQUIRED this turn${why}.
Give a level ${plan.level} "${rung.name}" hint aimed at: ${target}.
Level ${plan.level} means: ${rung.guide}
Set hintLevelGiven to ${plan.level}.`;
  }
  return `No hint is required. If and only if the candidate is clearly stuck, you
may give a level ${plan.level} "${rung.name}" hint aimed at ${target}
(${rung.guide}) and set hintLevelGiven to ${plan.level}. Otherwise set it to 0.`;
}

async function runTurn(session: Session, prompt: string): Promise<RawTurn> {
  const model = getModel(turnResponseSchema);
  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text()) as RawTurn;
}

function finalizeTurn(
  session: Session,
  raw: RawTurn,
  plan: ReturnType<typeof planHint>,
  hintReason?: HintReason
): InterviewTurnResponse {
  const newlyCovered = (raw.checklistCovered ?? []).filter((c) =>
    RUBRIC_COMPONENTS.includes(c)
  );
  newlyCovered.forEach((c) => session.checklistCovered.add(c));

  const requested = Math.max(0, Math.round(raw.hintLevelGiven || 0)) as HintLevel;
  const given = commitHint(session, {
    stuck: !!raw.stuckSignalDetected,
    hintLevelGiven: plan.mustHint ? plan.level : requested,
    allowedLevel: plan.level,
  });

  if (given && hintReason === "timeout") session.hint.autoHints += 1;
  session.history.push({
    role: "interviewer",
    text: raw.message,
    hintLevel: given || undefined,
    hintReason: given ? hintReason : undefined,
  });
  return {
    message: raw.message,
    checklistCovered: [...session.checklistCovered],
    stuckSignalDetected: !!raw.stuckSignalDetected,
    hintLevel: given,
    hint: { ...session.hint },
  };
}

export async function getOpeningMessage(session: Session): Promise<InterviewTurnResponse> {
  const model = getModel(turnResponseSchema);
  const prompt = `${problemBlock(session)}

Greet the candidate briefly, then ask them to explain their understanding of
the problem in their own words. One or two short sentences. hintLevelGiven = 0.`;

  const result = await model.generateContent(prompt);
  const raw = JSON.parse(result.response.text()) as RawTurn;
  session.history.push({ role: "interviewer", text: raw.message });
  return {
    message: raw.message,
    checklistCovered: [],
    stuckSignalDetected: false,
    hintLevel: 0,
    hint: { ...session.hint },
  };
}

export async function getNextTurn(
  session: Session,
  candidateText: string,
  answerSeconds?: number
): Promise<InterviewTurnResponse> {
  session.history.push({ role: "candidate", text: candidateText, answerSeconds });
  const plan = planHint(session, candidateText, false);

  const prompt = `${problemBlock(session)}

Checklist already covered: ${[...session.checklistCovered].join(", ") || "none"}
Next uncovered item: ${plan.target ?? "none — all covered, probe deeper or wrap up"}

${hintInstructions(plan)}

Conversation so far:
${transcriptSoFar(session)}

Respond as the interviewer for the next turn.`;

  const raw = await runTurn(session, prompt);
  return finalizeTurn(session, raw, plan);
}

// Hint outside a normal turn — the hint button, or the answer clock running
// out with no answer. Either way it climbs exactly one rung.
export async function getHint(
  session: Session,
  reason: HintReason = "button",
  idleSeconds?: number
): Promise<InterviewTurnResponse> {
  const plan = planHint(session, null, true);
  const prompt = `${problemBlock(session)}

Checklist already covered: ${[...session.checklistCovered].join(", ") || "none"}

${hintInstructions(plan, { reason, idleSeconds })}

Conversation so far:
${transcriptSoFar(session)}

Give the hint now as the interviewer. Set stuckSignalDetected to false.`;

  const raw = await runTurn(session, prompt);
  // A button-press hint shouldn't also count as a stuck streak for next turn.
  raw.stuckSignalDetected = false;
  return finalizeTurn(session, raw, plan, reason);
}

export async function getScore(session: Session): Promise<InterviewScoreResponse> {
  const model = getModel(scoreResponseSchema);
  const timing = answerTiming(session);
  const prompt = `${problemBlock(session)}

Full conversation (hint levels marked, 1 = vague nudge … 4 = near-answer;
candidate turns show how many seconds they took to answer):
${transcriptSoFar(session)}

Answer pacing: average ${timing.avgAnswerSeconds}s, longest ${timing.longestAnswerSeconds}s,
${timing.autoHints} hint(s) triggered automatically by long silences.

Score the candidate's explanation (not their code) on each checklist
component from 0-5, plus an overall 0-100 score, a short summary, 1-3
strengths and 1-3 concrete improvements. Judge the explanation itself; hint
usage is penalized separately, so don't double-count it. If pacing was a
notable problem (long silences) or a strength (quick, clear answers), you may
mention it in strengths/improvements.`;

  const result = await model.generateContent(prompt);
  const raw = JSON.parse(result.response.text()) as Omit<
    InterviewScoreResponse,
    "hintsUsed" | "hintPenalty" | "timing"
  >;
  const penalty = hintPenalty(session);
  return {
    ...raw,
    overall: Math.max(0, Math.round(raw.overall - penalty)),
    hintsUsed: session.hint.totalHints,
    hintPenalty: penalty,
    timing,
  };
}
