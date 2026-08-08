import { useEffect, useState, type CSSProperties } from "react";
import { Volume2, VolumeX, SkipForward, CheckCircle2, Sparkles } from "lucide-react";
import type {
  ScrapedProblem,
  RuntimeMessage,
  InterviewScoreResponse,
} from "../lib/types";
import { api } from "../lib/api";
import { useSpeechSynthesis } from "./hooks/useSpeechSynthesis";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";
import { Logo } from "./components/Logo";
import { DifficultyBadge } from "./components/DifficultyBadge";
import { MicButton } from "./components/MicButton";
import { ScoreCard } from "./components/ScoreCard";

type Phase = "idle" | "reading" | "listening" | "scored";

export default function App() {
  const [problem, setProblem] = useState<ScrapedProblem | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [phase, setPhase] = useState<Phase>("idle");
  const [transcriptLog, setTranscriptLog] = useState<string[]>([]);
  const [interviewerMessage, setInterviewerMessage] = useState<string>("");
  const [score, setScore] = useState<InterviewScoreResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { speak, cancel: cancelSpeech, skip: skipSpeech, toggleMute, isMuted, isSpeaking } =
    useSpeechSynthesis();
  const { start: startListening, stop: stopListening, isSupported: sttSupported } =
    useSpeechRecognition({
      onResult: (text) => setTranscriptLog((prev) => [...prev, text]),
    });
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    chrome.runtime.sendMessage<RuntimeMessage>(
      { type: "REQUEST_CURRENT_PROBLEM" },
      (response: ScrapedProblem | null) => setProblem(response)
    );

    const listener = (message: RuntimeMessage) => {
      if (message.type === "PROBLEM_SCRAPED") setProblem(message.payload);
      if (message.type === "SUBMISSION_DETECTED" && message.payload.passed) {
        handleScore();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleStart() {
    if (!problem) return;
    setError(null);
    try {
      const res = await api.startInterview(problem, sessionId);
      setInterviewerMessage(res.message);
      setPhase("reading");
      speak(res.message, () => setPhase("listening"));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function handleMicStart() {
    setIsListening(true);
    startListening();
  }

  function handleMicStop() {
    setIsListening(false);
    stopListening();
  }

  async function handleSendTranscript() {
    const combined = transcriptLog.join(" ").trim();
    if (!combined) return;
    setIsListening(false);
    stopListening();
    try {
      const res = await api.sendTurn(sessionId, combined);
      setInterviewerMessage(res.message);
      setTranscriptLog([]);
      setPhase("reading");
      speak(res.message, () => setPhase("listening"));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleScore() {
    cancelSpeech();
    setIsListening(false);
    stopListening();
    try {
      const res = await api.scoreInterview(sessionId);
      setScore(res);
      setPhase("scored");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: "18px 18px 28px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <Logo size={26} />
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15 }}>
          Interview Practice
        </span>
      </div>

      {!problem && (
        <div
          style={{
            color: "var(--text-secondary)",
            fontSize: 13.5,
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: 16,
          }}
        >
          Open a LeetCode problem page to get started.
        </div>
      )}

      {problem && (
        <>
          {/* Problem chip */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 14.5, fontWeight: 600 }}>{problem.title}</span>
            <DifficultyBadge difficulty={problem.difficulty} />
          </div>

          {phase === "idle" && (
            <button
              onClick={handleStart}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                width: "100%",
                padding: "12px 16px",
                borderRadius: "var(--radius-md)",
                border: "none",
                background: "var(--accent-gradient)",
                color: "#131314",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Sparkles size={16} />
              Start interview
            </button>
          )}

          {/* Interviewer message bubble */}
          {interviewerMessage && (
            <div
              style={{
                marginTop: phase === "idle" ? 16 : 0,
                marginBottom: 20,
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-lg)",
                padding: "14px 16px",
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
              }}
            >
              <div style={{ flexShrink: 0, marginTop: 2 }}>
                <Logo size={18} />
              </div>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, flex: 1 }}>
                {interviewerMessage}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                <button
                  onClick={toggleMute}
                  title={isMuted ? "Unmute narration" : "Mute narration"}
                  style={iconButtonStyle}
                >
                  {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>
                {isSpeaking && (
                  <button onClick={skipSpeech} title="Skip narration" style={iconButtonStyle}>
                    <SkipForward size={15} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Mic controls */}
          {phase === "listening" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
              {!sttSupported && (
                <p style={{ color: "var(--danger)", fontSize: 12.5, textAlign: "center" }}>
                  Speech recognition isn't supported here. Chrome only, per MVP scope.
                </p>
              )}

              <MicButton
                isListening={isListening}
                disabled={!sttSupported}
                onStart={handleMicStart}
                onStop={handleMicStop}
              />
              <span style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>
                {isListening ? "Listening…" : "Tap to talk"}
              </span>

              {transcriptLog.length > 0 && (
                <p
                  style={{
                    fontSize: 12.5,
                    color: "var(--text-secondary)",
                    fontStyle: "italic",
                    textAlign: "center",
                    maxWidth: 280,
                  }}
                >
                  {transcriptLog.join(" ")}
                </p>
              )}

              <button
                onClick={handleSendTranscript}
                disabled={transcriptLog.length === 0}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "transparent",
                  border: "1px solid var(--border-strong)",
                  color: transcriptLog.length ? "var(--text-primary)" : "var(--text-tertiary)",
                  borderRadius: "var(--radius-full)",
                  padding: "8px 16px",
                  fontSize: 12.5,
                  cursor: transcriptLog.length ? "pointer" : "not-allowed",
                }}
              >
                <CheckCircle2 size={14} />
                Done explaining
              </button>
            </div>
          )}

          <div style={{ borderTop: "1px solid var(--border-subtle)", margin: "22px 0 16px" }} />

          <button
            onClick={handleScore}
            style={{
              width: "100%",
              padding: "11px 16px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-strong)",
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
              fontSize: 13.5,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Score my explanation
          </button>

          {score && <ScoreCard score={score} />}
        </>
      )}

      {error && (
        <p style={{ color: "var(--danger)", fontSize: 12.5, marginTop: 14 }}>{error}</p>
      )}
    </div>
  );
}

const iconButtonStyle: CSSProperties = {
  width: 26,
  height: 26,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--bg-surface-raised)",
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text-secondary)",
  cursor: "pointer",
};
