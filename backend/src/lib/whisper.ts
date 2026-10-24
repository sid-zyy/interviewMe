// Whisper speech-to-text. Both providers speak the same OpenAI-compatible
// /audio/transcriptions API, so switching is just a base URL + model swap.
//   groq   — free tier, whisper-large-v3-turbo, very fast (default)
//   openai — whisper-1 (paid)

type Provider = "groq" | "openai";

const PROVIDERS: Record<Provider, { baseUrl: string; model: string; keyEnv: string }> = {
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    model: "whisper-large-v3-turbo",
    keyEnv: "GROQ_API_KEY",
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "whisper-1",
    keyEnv: "OPENAI_API_KEY",
  },
};

function resolveProvider(): Provider {
  const explicit = process.env.WHISPER_PROVIDER as Provider | undefined;
  if (explicit && explicit in PROVIDERS) return explicit;
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "groq";
}

export function whisperStatus() {
  const provider = resolveProvider();
  const cfg = PROVIDERS[provider];
  return {
    provider,
    model: process.env.WHISPER_MODEL || cfg.model,
    configured: !!process.env[cfg.keyEnv],
  };
}

const EXT_BY_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

export async function transcribe(
  audio: Buffer,
  mimeType: string,
  opts: { prompt?: string; language?: string } = {}
): Promise<{ text: string }> {
  const provider = resolveProvider();
  const cfg = PROVIDERS[provider];
  const apiKey = process.env[cfg.keyEnv];
  if (!apiKey) {
    throw new Error(
      `Whisper is not configured: set ${cfg.keyEnv} in backend/.env (provider "${provider}").`
    );
  }

  const baseMime = mimeType.split(";")[0].trim();
  const ext = EXT_BY_MIME[baseMime] ?? "webm";

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: baseMime }), `speech.${ext}`);
  form.append("model", process.env.WHISPER_MODEL || cfg.model);
  form.append("response_format", "json");
  form.append("temperature", "0");
  if (opts.language) form.append("language", opts.language);
  // The prompt biases Whisper toward the problem's vocabulary
  // ("hashmap", "O of n log n", variable names…), which helps a lot.
  if (opts.prompt) form.append("prompt", opts.prompt.slice(0, 800));

  const res = await fetch(`${cfg.baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Whisper (${provider}) error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { text?: string };
  return { text: (data.text ?? "").trim() };
}
