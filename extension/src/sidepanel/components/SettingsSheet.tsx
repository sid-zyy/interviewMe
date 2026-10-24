import { useEffect } from "react";
import { AudioLines, Chrome, X } from "lucide-react";
import type { HealthResponse } from "../../lib/types";
import type { Settings } from "../hooks/useSettings";

interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  voices: SpeechSynthesisVoice[];
  health: HealthResponse | null;
  onClose: () => void;
  onTestVoice: () => void;
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`switch${on ? " on" : ""}`}
      onClick={() => onChange(!on)}
    />
  );
}

export function SettingsSheet({ settings, update, voices, health, onClose, onTestVoice }: Props) {
  const whisperReady = !!health?.whisper.configured;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Settings">
        <div className="sheet-grip" />
        <h3>
          Settings
          <button className="icon-btn" onClick={onClose} aria-label="Close settings"><X size={16} /></button>
        </h3>

        <div className="field">
          <span className="label">Speech-to-text engine</span>
          <div className="segmented">
            <button className={settings.sttEngine === "whisper" ? "on" : ""} onClick={() => update({ sttEngine: "whisper" })}>
              <AudioLines size={13} /> Whisper
            </button>
            <button className={settings.sttEngine === "browser" ? "on" : ""} onClick={() => update({ sttEngine: "browser" })}>
              <Chrome size={13} /> Browser
            </button>
          </div>
          <span className="help">
            {settings.sttEngine === "whisper"
              ? whisperReady
                ? `Using ${health!.whisper.provider} · ${health!.whisper.model}. Far more accurate on technical terms.`
                : "Whisper isn't configured on the backend — add GROQ_API_KEY (free) or OPENAI_API_KEY to backend/.env. Falling back to browser speech."
              : "Chrome's built-in recognizer. Free and live, but weaker on jargon like “O(n log n)”."}
          </span>
        </div>

        <div className="field">
          <div className="field-row">
            <label>Hands-free mode</label>
            <Toggle label="Hands-free mode" on={settings.handsFree} onChange={(v) => update({ handsFree: v })} />
          </div>
          <span className="help">Start listening automatically after the interviewer finishes speaking.</span>
        </div>

        <div className="field">
          <div className="field-row">
            <label>Timed hints</label>
            <Toggle label="Timed hints" on={settings.autoHint} onChange={(v) => update({ autoHint: v })} />
          </div>
          {settings.autoHint && (
            <input
              type="range"
              min={20}
              max={180}
              step={10}
              value={settings.autoHintSeconds}
              onChange={(e) => update({ autoHintSeconds: Number(e.target.value) })}
              aria-label="Seconds before a timed hint"
            />
          )}
          <span className="help">
            {settings.autoHint
              ? `If ${settings.autoHintSeconds}s pass with no answer in progress, the interviewer climbs one hint level. Typing or talking resets the countdown.`
              : "The answer clock still runs, but hints only come when you ask."}
          </span>
        </div>

        <div className="field">
          <div className="field-row">
            <label>Auto-send after a pause</label>
            <Toggle label="Auto-send after a pause" on={settings.autoSend} onChange={(v) => update({ autoSend: v })} />
          </div>
          {settings.autoSend && (
            <>
              <input
                type="range"
                min={1.5}
                max={6}
                step={0.5}
                value={settings.silenceSeconds}
                onChange={(e) => update({ silenceSeconds: Number(e.target.value) })}
                aria-label="Pause length"
              />
              <span className="help">Send after {settings.silenceSeconds}s of silence.</span>
            </>
          )}
        </div>

        <div className="field">
          <span className="label">Interviewer voice</span>
          <div style={{ display: "flex", gap: 6 }}>
            <select className="select" value={settings.voiceURI} onChange={(e) => update({ voiceURI: e.target.value })}>
              <option value="">System default</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>
              ))}
            </select>
            <button className="btn" onClick={onTestVoice}>Test</button>
          </div>
          <input
            type="range"
            min={0.8}
            max={1.4}
            step={0.05}
            value={settings.speechRate}
            onChange={(e) => update({ speechRate: Number(e.target.value) })}
            aria-label="Speaking rate"
          />
          <span className="help">Speaking rate {settings.speechRate.toFixed(2)}×</span>
        </div>

        <div className="field">
          <div className="field-row">
            <label>Score automatically on “Accepted”</label>
            <Toggle
              label="Score automatically on Accepted"
              on={settings.autoScoreOnAccepted}
              onChange={(v) => update({ autoScoreOnAccepted: v })}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="backend-url">Backend URL</label>
          <input
            id="backend-url"
            className="input"
            value={settings.backendBaseUrl}
            onChange={(e) => update({ backendBaseUrl: e.target.value })}
            spellCheck={false}
          />
          <span className="help">
            {health ? (health.gemini ? "Connected." : "Connected, but GEMINI_API_KEY is missing.") : "Can't reach the backend at this URL."}
          </span>
        </div>
      </div>
    </>
  );
}
