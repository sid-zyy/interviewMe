import "dotenv/config";
import express from "express";
import cors from "cors";
import { interviewRouter } from "./routes/interview.js";
import { whisperStatus } from "./lib/whisper.js";

const app = express();
const port = process.env.PORT ?? 8787;
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "").split(",").filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true, // permissive for local dev
  })
);
app.use(express.json({ limit: "1mb" }));

// The side panel pings this to show connection + which STT engines are usable.
app.get("/health", (_req, res) =>
  res.json({
    ok: true,
    gemini: !!process.env.GEMINI_API_KEY,
    whisper: whisperStatus(),
  })
);
app.use("/interview", interviewRouter);

app.listen(port, () => {
  console.log(`Interview backend listening on http://localhost:${port}`);
  const w = whisperStatus();
  console.log(
    `  Whisper: ${w.configured ? `${w.provider} (${w.model})` : "not configured — browser STT only"}`
  );
});
