import { useEffect, useRef, type KeyboardEvent } from "react";
import { ArrowUp, Lightbulb, Loader2, Mic, SkipForward, Square } from "lucide-react";

export type MicMode = "idle" | "recording" | "transcribing" | "speaking" | "thinking";

interface Props {
  draft: string;
  interim: string;
  onDraftChange: (v: string) => void;
  onSend: () => void;
  onHint: () => void;
  nextHintName: string;
  hintDisabled: boolean;
  mode: MicMode;
  level: number;
  elapsedMs: number;
  onMicToggle: () => void;
  onSkipSpeech: () => void;
  micDisabled: boolean;
  engineLabel: string;
  autoSend: boolean;
  silenceSeconds: number;
  answerMs: number | null; // null = clock not running (interviewer's turn)
  hintInMs: number | null; // null = no auto-hint pending
  autoHintSeconds: number;
}

const WARN_MS = 15_000;

// Answer clock: elapsed time on this answer, with a ring that fills up
// toward the auto-hint deadline and turns amber in the last 15 seconds.
function AnswerClock({ answerMs, hintInMs, autoHintSeconds }: Pick<Props, "answerMs" | "hintInMs" | "autoHintSeconds">) {
  if (answerMs === null) return null;
  const total = autoHintSeconds * 1000;
  const remaining = hintInMs === null ? null : Math.max(0, hintInMs);
  const pct = remaining === null ? 0 : 1 - remaining / total;
  const warn = remaining !== null && remaining <= WARN_MS;
  const r = 8;
  const c = 2 * Math.PI * r;

  return (
    <div
      className={`answer-clock${warn ? " warn" : ""}`}
      title={
        remaining === null
          ? "Time on this answer"
          : `Time on this answer · a hint arrives after ${autoHintSeconds}s without progress`
      }
      aria-label={`Answer time ${fmt(answerMs)}`}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
        <circle cx="10" cy="10" r={r} fill="none" stroke="var(--bg-surface-raised)" strokeWidth="2.5" />
        {remaining !== null && (
          <circle
            cx="10"
            cy="10"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - Math.min(1, pct))}
            transform="rotate(-90 10 10)"
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        )}
      </svg>
      <div className="answer-clock-text">
        <strong>{fmt(answerMs)}</strong>
        {warn && <span>hint in {Math.ceil(remaining! / 1000)}s</span>}
      </div>
    </div>
  );
}

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const BAR_SHAPE = [0.45, 0.8, 1, 0.7, 0.9, 0.55, 0.75];

export function Dock(p: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the textarea with its content.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(120, ta.scrollHeight)}px`;
  }, [p.draft, p.interim]);

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (p.draft.trim() && p.mode !== "thinking") p.onSend();
    }
  }

  const recording = p.mode === "recording";
  const busy = p.mode === "transcribing" || p.mode === "thinking";
  const canSend = !!p.draft.trim() && !busy;

  let status: React.ReactNode;
  if (recording) {
    status = (
      <>
        <span className="wave" aria-hidden>
          {BAR_SHAPE.map((s, i) => (
            <span key={i} style={{ height: `${3 + Math.min(1, p.level * 1.6) * 11 * s}px` }} />
          ))}
        </span>
        <span className="live">Listening{p.elapsedMs > 0 ? ` ${fmt(p.elapsedMs)}` : "…"}</span>
        <span>· {p.autoSend ? `sends after ${p.silenceSeconds}s pause` : "tap to stop"}</span>
      </>
    );
  } else if (p.mode === "transcribing") {
    status = (
      <>
        <Loader2 size={12} className="spin" /> Transcribing with {p.engineLabel}…
      </>
    );
  } else if (p.mode === "thinking") {
    status = "Interviewer is thinking…";
  } else if (p.mode === "speaking") {
    status = (
      <button className="btn ghost" style={{ height: 22, fontSize: 11.5 }} onClick={p.onSkipSpeech}>
        <SkipForward size={12} /> Skip narration
      </button>
    );
  } else {
    status = (
      <>
        Tap the mic or type · <span className="kbd">Enter</span> to send · {p.engineLabel}
      </>
    );
  }

  return (
    <footer className="dock">
      <div className="composer">
        <textarea
          ref={taRef}
          rows={1}
          value={p.interim ? `${p.draft}${p.draft ? " " : ""}${p.interim}` : p.draft}
          readOnly={!!p.interim}
          onChange={(e) => p.onDraftChange(e.target.value)}
          onKeyDown={onKey}
          placeholder={recording ? "Speak — your words will appear here" : "Explain your thinking…"}
          aria-label="Your answer"
          className={p.interim ? "interim" : undefined}
        />
        <button
          className="btn primary send-btn"
          onClick={p.onSend}
          disabled={!canSend}
          title="Send (Enter)"
          aria-label="Send"
        >
          <ArrowUp size={16} />
        </button>
      </div>

      <div className="dock-row">
        <div className="dock-side">
          <button
            className="btn hint"
            onClick={p.onHint}
            disabled={p.hintDisabled}
            title="Each press climbs the hint ladder: Nudge → Direction → Specific → Near-answer"
          >
            <Lightbulb size={14} />
            {p.nextHintName}
          </button>
        </div>

        <div className="mic-wrap">
          {recording && (
            <span className="mic-ring" style={{ transform: `scale(${1 + Math.min(1, p.level * 1.4) * 0.45})` }} />
          )}
          <button
            className={`mic${recording ? " recording" : ""}${busy ? " busy" : ""}`}
            onClick={p.onMicToggle}
            disabled={p.micDisabled || busy}
            aria-label={recording ? "Stop recording" : "Start talking"}
            title={recording ? "Stop (Space)" : "Talk (Space)"}
          >
            {busy ? (
              <Loader2 size={24} className="spin" />
            ) : recording ? (
              <Square size={20} fill="currentColor" />
            ) : (
              <Mic size={24} />
            )}
          </button>
        </div>

        <div className="dock-side right">
          <AnswerClock answerMs={p.answerMs} hintInMs={p.hintInMs} autoHintSeconds={p.autoHintSeconds} />
        </div>
      </div>

      <div className="dock-status">{status}</div>
    </footer>
  );
}
