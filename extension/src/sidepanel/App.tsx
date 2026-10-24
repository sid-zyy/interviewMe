import { useCallback, useEffect, useRef, useState } from "react";
import { Settings as SettingsIcon, Sparkles, Volume2, VolumeX, X, RefreshCw } from "lucide-react";
import type {
  ScrapedProblem,
  RuntimeMessage,
  InterviewScoreResponse,
  InterviewTurnResponse,
  HealthResponse,
  HintState,
  HintReason,
  RubricComponent,
} from "../lib/types";
import { HINT_NAMES } from "../lib/types";
import { api } from "../lib/api";
import { useSettings } from "./hooks/useSettings";
import { useSpeechSynthesis } from "./hooks/useSpeechSynthesis";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";
import { useWhisperRecorder } from "./hooks/useWhisperRecorder";
import { Logo } from "./components/Logo";
import { ProblemCard } from "./components/ProblemCard";
import { Progress } from "./components/Progress";
import { Thread, type ChatMessage } from "./components/Thread";
import { Dock, type MicMode } from "./components/Dock";
import { ScoreCard } from "./components/ScoreCard";
import { SettingsSheet } from "./components/SettingsSheet";
import { EmptyState, HowItWorks } from "./components/EmptyState";

type Status = "idle" | "starting" | "active" | "scoring" | "scored";

const EMPTY_HINT: HintState = {
  level: 0,
  target: null,
  stuckStreak: 0,
  totalHints: 0,
  autoHints: 0,
  maxLevelReached: 0,
};
const uid = () => crypto.randomUUID();

function fmtClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function App() {
  const { settings, update: updateSettings } = useSettings();

  const [problem, setProblem] = useState<ScrapedProblem | null>(null);
  const [pendingProblem, setPendingProblem] = useState<ScrapedProblem | null>(null);
  const [sessionId, setSessionId] = useState(uid);
  const [status, setStatus] = useState<Status>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [covered, setCovered] = useState<RubricComponent[]>([]);
  const [hint, setHint] = useState<HintState>(EMPTY_HINT);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [score, setScore] = useState<InterviewScoreResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthChecked, setHealthChecked] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  // Answer clock: starts when the interviewer finishes asking, stops on send.
  const [turnStartedAt, setTurnStartedAt] = useState<number | null>(null);
  // Last sign the candidate is working on an answer (typing, recording…);
  // the auto-hint countdown runs from whichever is later.
  const [lastActivityAt, setLastActivityAt] = useState(0);

  // Refs so async callbacks (speech end, chrome messages) see fresh values.
  const turnStartedRef = useRef(turnStartedAt);
  turnStartedRef.current = turnStartedAt;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const statusRef = useRef(status);
  statusRef.current = status;
  const problemRef = useRef(problem);
  problemRef.current = problem;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const sessionRef = useRef(sessionId);
  sessionRef.current = sessionId;

  const pushMessage = (m: ChatMessage) => setMessages((prev) => [...prev, m]);
  const appendDraft = (text: string) =>
    setDraft((prev) => {
      const next = prev ? `${prev.trimEnd()} ${text}` : text;
      draftRef.current = next;
      return next;
    });

  // --- Speech out ----------------------------------------------------------
  const tts = useSpeechSynthesis({ voiceURI: settings.voiceURI, rate: settings.speechRate });

  // --- Speech in -----------------------------------------------------------
  const whisperAvailable = !!health?.whisper.configured;
  const browserStt = useSpeechRecognition({
    onResult: (text) => appendDraft(text),
    onSilence: () => {
      if (settingsRef.current.autoSend) void sendTurn();
    },
    silenceSeconds: settings.silenceSeconds,
    autoStopOnSilence: settings.autoSend,
  });
  const whisper = useWhisperRecorder({
    silenceSeconds: settings.silenceSeconds,
    autoStopOnSilence: settings.autoSend,
    onAudio: async (blob) => {
      setTranscribing(true);
      try {
        const text = await api.transcribe(blob, sessionRef.current);
        if (text) appendDraft(text);
        if (settingsRef.current.autoSend && draftRef.current.trim()) void sendTurn();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setTranscribing(false);
      }
    },
  });

  const engine: "whisper" | "browser" | "none" =
    settings.sttEngine === "whisper" && whisperAvailable
      ? "whisper"
      : browserStt.isSupported
        ? "browser"
        : whisperAvailable
          ? "whisper"
          : "none";
  const engineLabel = engine === "whisper" ? "Whisper" : engine === "browser" ? "browser speech" : "no speech engine";
  const recording = engine === "whisper" ? whisper.isRecording : browserStt.isListening;

  const startMic = useCallback(() => {
    tts.cancel();
    setError(null);
    if (engine === "whisper") void whisper.start();
    else if (engine === "browser") void browserStt.start();
  }, [engine]); // eslint-disable-line react-hooks/exhaustive-deps

  function stopMic() {
    whisper.stop();
    browserStt.stop();
  }

  function toggleMic() {
    if (recording) stopMic();
    else startMic();
  }

  const afterInterviewerSpoke = () => {
    if (statusRef.current !== "active") return;
    const t = Date.now();
    setTurnStartedAt(t);
    turnStartedRef.current = t;
    if (settingsRef.current.handsFree) startMic();
  };

  // Stops the answer clock and returns how long the answer took, in seconds.
  function stopTurnClock(): number | undefined {
    const started = turnStartedRef.current;
    setTurnStartedAt(null);
    turnStartedRef.current = null;
    return started === null ? undefined : Math.round((Date.now() - started) / 100) / 10;
  }

  // --- Backend health ------------------------------------------------------
  useEffect(() => {
    const t = setTimeout(async () => {
      setHealth(await api.health());
      setHealthChecked(true);
    }, 300);
    return () => clearTimeout(t);
  }, [settings.backendBaseUrl]);

  // --- Problem tracking ----------------------------------------------------
  function receiveProblem(p: ScrapedProblem | null) {
    const current = problemRef.current;
    const inInterview = statusRef.current !== "idle";
    if (!inInterview) {
      setProblem(p);
      setPendingProblem(null);
      return;
    }
    if (p && current && p.slug === current.slug && p.source === current.source) {
      setProblem(p);
      return;
    }
    if (p) setPendingProblem(p);
  }

  useEffect(() => {
    chrome.runtime.sendMessage<RuntimeMessage>({ type: "REQUEST_CURRENT_PROBLEM" }, (response: ScrapedProblem | null) => {
      void chrome.runtime.lastError; // no-op if background is waking up
      receiveProblem(response ?? null);
    });

    const listener = (message: RuntimeMessage) => {
      if (message.type === "PROBLEM_SCRAPED" || message.type === "ACTIVE_PROBLEM_CHANGED") {
        receiveProblem(message.payload);
      }
      if (message.type === "SUBMISSION_DETECTED") {
        const p = problemRef.current;
        if (statusRef.current !== "active" || !p || message.payload.slug !== p.slug) return;
        pushMessage({
          id: uid(),
          role: "system",
          tone: message.payload.passed ? "ok" : "bad",
          text: message.payload.passed ? "Submission accepted" : "Submission didn't pass",
        });
        if (message.payload.passed && settingsRef.current.autoScoreOnAccepted) void finish();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Timer ---------------------------------------------------------------
  useEffect(() => {
    if (status !== "active") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [status]);

  // --- Auto-hint when the answer clock runs out ----------------------------
  // Any sign of work on an answer pushes the countdown back.
  useEffect(() => {
    setLastActivityAt(Date.now());
  }, [draft, recording, transcribing]);

  const autoHintArmed =
    settings.autoHint && status === "active" && turnStartedAt !== null && hint.level < 4;
  const hintDeadline = autoHintArmed
    ? Math.max(turnStartedAt!, lastActivityAt) + settings.autoHintSeconds * 1000
    : null;
  const candidateBusy = recording || transcribing || thinking || tts.isSpeaking || !!draft.trim();

  useEffect(() => {
    if (hintDeadline === null || candidateBusy) return;
    if (now >= hintDeadline) {
      void askHint("timeout", (now - Math.max(turnStartedAt!, lastActivityAt)) / 1000);
    }
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Keyboard: Space toggles the mic when not typing ---------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.code !== "Space" || tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT" || tag === "BUTTON") return;
      if (statusRef.current !== "active") return;
      e.preventDefault();
      toggleMic();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // --- Interview flow ------------------------------------------------------
  function applyTurn(res: InterviewTurnResponse, auto = false) {
    pushMessage({
      id: uid(),
      role: "interviewer",
      text: res.message,
      hintLevel: res.hintLevel || undefined,
      auto: auto && !!res.hintLevel,
    });
    setCovered(res.checklistCovered);
    setHint(res.hint);
    tts.speak(res.message, afterInterviewerSpoke);
  }

  async function start() {
    const p = problemRef.current;
    if (!p) return;
    setError(null);
    setStatus("starting");
    setThinking(true);
    try {
      const res = await api.startInterview(p, sessionRef.current);
      setStatus("active");
      statusRef.current = "active";
      setStartedAt(Date.now());
      setNow(Date.now());
      applyTurn(res);
    } catch (e) {
      setError((e as Error).message);
      setStatus("idle");
    } finally {
      setThinking(false);
    }
  }

  async function sendTurn() {
    const text = draftRef.current.trim();
    if (!text || statusRef.current !== "active") return;
    stopMic();
    const started = turnStartedRef.current;
    const answerSeconds = stopTurnClock();
    setDraft("");
    draftRef.current = "";
    pushMessage({ id: uid(), role: "candidate", text, seconds: answerSeconds });
    setThinking(true);
    setError(null);
    try {
      applyTurn(await api.sendTurn(sessionRef.current, text, answerSeconds));
    } catch (e) {
      setError((e as Error).message);
      setDraft(text); // give their words back so nothing is lost
      setTurnStartedAt(started); // and keep their clock running
    } finally {
      setThinking(false);
    }
  }

  async function askHint(reason: HintReason = "button", idleSeconds?: number) {
    if (statusRef.current !== "active") return;
    // Anything already said/typed goes in first so the hint has context.
    if (draftRef.current.trim()) {
      await sendTurn();
      return;
    }
    stopMic();
    const started = turnStartedRef.current;
    stopTurnClock();
    setThinking(true);
    setError(null);
    try {
      applyTurn(await api.requestHint(sessionRef.current, reason, idleSeconds), reason === "timeout");
    } catch (e) {
      setError((e as Error).message);
      // Restart the clock on failure so a flaky backend isn't retried every second.
      if (started !== null) setTurnStartedAt(Date.now());
    } finally {
      setThinking(false);
    }
  }

  async function finish() {
    if (statusRef.current !== "active") return;
    tts.cancel();
    whisper.cancel();
    browserStt.stop();
    stopTurnClock();
    setStatus("scoring");
    statusRef.current = "scoring";
    setThinking(true);
    try {
      setScore(await api.scoreInterview(sessionRef.current));
      setStatus("scored");
    } catch (e) {
      setError((e as Error).message);
      setStatus("active");
    } finally {
      setThinking(false);
    }
  }

  function restart(nextProblem?: ScrapedProblem | null) {
    tts.cancel();
    whisper.cancel();
    browserStt.stop();
    setSessionId(uid());
    setStatus("idle");
    statusRef.current = "idle";
    setMessages([]);
    setCovered([]);
    setHint(EMPTY_HINT);
    setDraft("");
    setScore(null);
    setError(null);
    setStartedAt(null);
    stopTurnClock();
    if (nextProblem !== undefined) setProblem(nextProblem);
    setPendingProblem(null);
  }

  // --- Derived UI state ----------------------------------------------------
  const micMode: MicMode = transcribing
    ? "transcribing"
    : recording
      ? "recording"
      : thinking
        ? "thinking"
        : tts.isSpeaking
          ? "speaking"
          : "idle";
  const nextHintLevel = Math.min(4, hint.level + 1) as 1 | 2 | 3 | 4;
  const backendDown = healthChecked && !health;

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <Logo size={24} />
          <span className="brand-name">interview<b>Me</b></span>
        </div>
        <div className="header-spacer" />
        {status === "active" && startedAt && <span className="timer" title="Elapsed">{fmtClock(now - startedAt)}</span>}
        <span
          className="status-pill"
          title={health ? `Backend connected · STT: ${engineLabel}` : "Backend not reachable"}
        >
          <span className={`dot ${!healthChecked ? "" : !health ? "bad" : !health.gemini ? "warn" : "ok"}`} />
          {!healthChecked ? "…" : !health ? "Offline" : engine === "whisper" ? "Whisper" : "Browser STT"}
        </span>
        <button className={`icon-btn${tts.isMuted ? " active" : ""}`} onClick={tts.toggleMute} title={tts.isMuted ? "Unmute interviewer" : "Mute interviewer"}>
          {tts.isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <button className="icon-btn" onClick={() => setShowSettings(true)} title="Settings">
          <SettingsIcon size={16} />
        </button>
      </header>

      <main className="main">
        {backendDown && (
          <div className="banner error">
            <span className="grow">
              Can't reach the backend at <code>{settings.backendBaseUrl}</code>. Run <code>npm run dev</code> in <code>backend/</code>.
            </span>
            <button className="icon-btn sm" title="Retry" onClick={async () => setHealth(await api.health())}>
              <RefreshCw size={14} />
            </button>
          </div>
        )}

        {pendingProblem && (
          <div className="banner">
            <span className="grow">
              You switched to <b>{pendingProblem.title}</b>.
            </span>
            <button className="btn" style={{ height: 28 }} onClick={() => restart(pendingProblem)}>Switch</button>
            <button className="icon-btn sm" onClick={() => setPendingProblem(null)} title="Dismiss"><X size={14} /></button>
          </div>
        )}

        {!problem && status === "idle" && <EmptyState />}

        {problem && <ProblemCard problem={problem} compact={status !== "idle"} />}

        {problem && status === "idle" && (
          <section className="card hero">
            <h2>Talk it through like it's the real thing.</h2>
            <HowItWorks />
            <button className="btn primary lg block" onClick={start} disabled={backendDown}>
              <Sparkles size={16} /> Start interview
            </button>
          </section>
        )}

        {(status === "active" || status === "scoring") && (
          <Progress covered={covered} hint={hint} onFinish={finish} finishing={status === "scoring"} />
        )}

        {status !== "idle" && status !== "scored" && (
          <Thread messages={messages} thinking={thinking} onReplay={(t) => tts.speak(t)} />
        )}

        {status === "scored" && score && <ScoreCard score={score} onRestart={() => restart()} />}

        {error && (
          <div className="banner error">
            <span className="grow">{error}</span>
            <button className="icon-btn sm" onClick={() => setError(null)} title="Dismiss"><X size={14} /></button>
          </div>
        )}
      </main>

      {status === "active" && (
        <Dock
          draft={draft}
          interim={browserStt.interim}
          onDraftChange={setDraft}
          onSend={sendTurn}
          onHint={() => askHint()}
          nextHintName={`Hint · ${HINT_NAMES[nextHintLevel]}`}
          hintDisabled={thinking || transcribing}
          mode={micMode}
          level={whisper.level}
          elapsedMs={whisper.elapsedMs}
          onMicToggle={toggleMic}
          onSkipSpeech={tts.skip}
          micDisabled={engine === "none"}
          engineLabel={engineLabel}
          autoSend={settings.autoSend}
          silenceSeconds={settings.silenceSeconds}
          answerMs={turnStartedAt !== null ? now - turnStartedAt : null}
          hintInMs={hintDeadline !== null && !candidateBusy ? hintDeadline - now : null}
          autoHintSeconds={settings.autoHintSeconds}
        />
      )}

      {showSettings && (
        <SettingsSheet
          settings={settings}
          update={updateSettings}
          voices={tts.voices}
          health={health}
          onClose={() => setShowSettings(false)}
          onTestVoice={() => tts.speak("Hi! Walk me through how you'd approach this problem.")}
        />
      )}
    </div>
  );
}
