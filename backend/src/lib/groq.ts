// Groq chat completions, used as a fallback when Gemini fails (quota, outage,
// bad key…). Groq speaks the OpenAI-compatible API, and JSON mode doesn't
// enforce a schema, so the expected shape is spelled out in the system prompt.

const BASE_URL = "https://api.groq.com/openai/v1";
const MODEL = process.env.GROQ_CHAT_MODEL || "openai/gpt-oss-120b";

export function groqChatAvailable(): boolean {
  return !!process.env.GROQ_API_KEY;
}

export async function groqJson<T>(systemPrompt: string, prompt: string, shape: string): Promise<T> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set.");

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.4,
      // gpt-oss models reason before answering; keep it short for a live conversation.
      ...(MODEL.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${systemPrompt}\n\nRespond with a single JSON object and nothing else, matching this shape:\n${shape}`,
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Groq chat (${MODEL}) error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Groq chat returned an empty response.");
  return JSON.parse(content) as T;
}
