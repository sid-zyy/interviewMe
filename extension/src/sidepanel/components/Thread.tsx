import { useEffect, useRef } from "react";
import { Lightbulb, Volume2, User, CheckCircle2, XCircle, Info, Timer } from "lucide-react";
import type { HintLevel } from "../../lib/types";
import { HINT_NAMES } from "../../lib/types";
import { Logo } from "./Logo";

export type ChatMessage =
  | { id: string; role: "interviewer"; text: string; hintLevel?: HintLevel; auto?: boolean }
  | { id: string; role: "candidate"; text: string; seconds?: number }
  | { id: string; role: "system"; text: string; tone?: "ok" | "bad" | "info" };

export function fmtSecs(s: number) {
  const n = Math.round(s);
  return n < 60 ? `${n}s` : `${Math.floor(n / 60)}m ${String(n % 60).padStart(2, "0")}s`;
}

interface Props {
  messages: ChatMessage[];
  thinking: boolean;
  onReplay: (text: string) => void;
}

export function Thread({ messages, thinking, onReplay }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, thinking]);

  return (
    <div className="thread" role="log" aria-live="polite">
      {messages.map((m) => {
        if (m.role === "system") {
          const Icon = m.tone === "ok" ? CheckCircle2 : m.tone === "bad" ? XCircle : Info;
          return (
            <div key={m.id} className="msg system">
              <span className={`system-note ${m.tone ?? ""}`}>
                <Icon size={12} />
                {m.text}
              </span>
            </div>
          );
        }
        if (m.role === "candidate") {
          return (
            <div key={m.id} className="msg candidate">
              <div className="avatar"><User size={14} /></div>
              <div style={{ maxWidth: "86%" }}>
                <div className="bubble" style={{ maxWidth: "100%" }}>{m.text}</div>
                {m.seconds !== undefined && (
                  <div className="msg-meta" title="Time taken to answer">
                    <Timer size={10} style={{ verticalAlign: -1, marginRight: 3 }} />
                    {fmtSecs(m.seconds)}
                  </div>
                )}
              </div>
            </div>
          );
        }
        const isHint = !!m.hintLevel;
        return (
          <div key={m.id} className={`msg interviewer${isHint ? " hint" : ""}`}>
            <div className="avatar"><Logo size={16} /></div>
            <div style={{ position: "relative", maxWidth: "calc(86% - 30px)" }}>
              <div className="bubble" style={{ maxWidth: "100%" }}>
                {isHint && (
                  <div className="hint-tag">
                    <Lightbulb size={11} />
                    Hint {m.hintLevel}/4 · {HINT_NAMES[m.hintLevel as 1 | 2 | 3 | 4]}
                    {m.auto && <span style={{ opacity: 0.75, fontWeight: 500 }}> · timed</span>}
                  </div>
                )}
                <div>{m.text}</div>
              </div>
              <div className="bubble-actions">
                <button className="icon-btn sm" title="Replay" onClick={() => onReplay(m.text)}>
                  <Volume2 size={13} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
      {thinking && (
        <div className="msg interviewer">
          <div className="avatar"><Logo size={16} /></div>
          <div className="bubble">
            <div className="typing" aria-label="Interviewer is thinking"><span /><span /><span /></div>
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
