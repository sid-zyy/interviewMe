import "dotenv/config";
import express from "express";
import cors from "cors";
import { interviewRouter } from "./routes/interview.js";

const app = express();
const port = process.env.PORT ?? 8787;
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "").split(",").filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true, // permissive for local dev
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/interview", interviewRouter);

app.listen(port, () => {
  console.log(`Interview backend listening on http://localhost:${port}`);
});
