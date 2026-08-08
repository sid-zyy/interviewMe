import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type {
  Session,
  InterviewTurnResponse,
  InterviewScoreResponse,
} from "../types.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

// Phase 7: this is the core "interviewer persona" prompt. Iterate here first
// before touching any code — most quality gains come from prompt tuning.
const SYSTEM_PROMPT = `You are a calm, encouraging technical interviewer running a
mock coding interview. The candidate is explaining their understanding of a
problem OUT LOUD before writing code — you are NOT reviewing code.

Your job each turn:
1. Track which of these checklist items the candidate has clearly addressed:
   inputs_outputs, constraints, edge_cases, approach, complexity.
2. If they seem stuck (said "I don't know", trailed off, or asked you to just
   tell them), give a Socratic hint — a nudge toward the next checklist item,
   never the answer outright. Escalate specificity only if they stay stuck
   across multiple turns.
3. If they're doing fine, ask a short follow-up question that pushes toward
   the next uncovered checklist item.
4. CRITICAL: "message" must be ONE short sentence, 15 words or fewer. This is
   read aloud via TTS and shown in a compact UI — long messages are a hard
   failure. Cut anything not essential to the single next question or hint.`;

const turnResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    message: { type: SchemaType.STRING },
    checklistCovered: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.STRING,
        enum: ["inputs_outputs", "constraints", "edge_cases", "approach", "complexity"],
      },
    },
    stuckSignalDetected: { type: SchemaType.BOOLEAN },
  },
  required: ["message", "checklistCovered", "stuckSignalDetected"],
};

const scoreResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    scores: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          component: {
            type: SchemaType.STRING,
            enum: ["inputs_outputs", "constraints", "edge_cases", "approach", "complexity"],
          },
          score: { type: SchemaType.NUMBER },
          feedback: { type: SchemaType.STRING },
        },
        required: ["component", "score", "feedback"],
      },
    },
    overall: { type: SchemaType.NUMBER },
    summary: { type: SchemaType.STRING },
  },
  required: ["scores", "overall", "summary"],
};

function getModel(schema: object) {
  return genAI.getGenerativeModel({
    model: "gemini-flash-latest", // alias that always points at the current free-tier-friendly flash model
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema as any,
    },
  });
}

function transcriptSoFar(session: Session): string {
  return session.history.map((t) => `${t.role}: ${t.text}`).join("\n");
}

export async function getOpeningMessage(session: Session): Promise<InterviewTurnResponse> {
  const model = getModel(turnResponseSchema);
  const prompt = `Problem: ${session.problem.title} (${session.problem.difficulty})
${session.problem.descriptionText}

Greet the candidate in under 12 words, then ask them to explain their
understanding of the problem. Total message: one short sentence.`;

  const result = await model.generateContent(prompt);
  const parsed = JSON.parse(result.response.text()) as InterviewTurnResponse;
  session.history.push({ role: "interviewer", text: parsed.message });
  return parsed;
}

export async function getNextTurn(
  session: Session,
  candidateText: string
): Promise<InterviewTurnResponse> {
  session.history.push({ role: "candidate", text: candidateText });

  const model = getModel(turnResponseSchema);
  const prompt = `Problem: ${session.problem.title}
${session.problem.descriptionText}

Checklist already covered: ${[...session.checklistCovered].join(", ") || "none"}

Conversation so far:
${transcriptSoFar(session)}

Respond as the interviewer for the next turn.`;

  const result = await model.generateContent(prompt);
  const parsed = JSON.parse(result.response.text()) as InterviewTurnResponse;

  parsed.checklistCovered.forEach((c) => session.checklistCovered.add(c));
  session.history.push({ role: "interviewer", text: parsed.message });
  return parsed;
}

export async function getScore(session: Session): Promise<InterviewScoreResponse> {
  const model = getModel(scoreResponseSchema);
  const prompt = `Problem: ${session.problem.title}
${session.problem.descriptionText}

Full conversation:
${transcriptSoFar(session)}

Score the candidate's explanation (not their code) on each checklist
component from 0-5, plus an overall 0-100 score and a short summary.`;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text()) as InterviewScoreResponse;
}
