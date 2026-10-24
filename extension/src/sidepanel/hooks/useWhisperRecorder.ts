import { useEffect, useRef, useState } from "react";
import { getMicStream } from "./micPermission";

// Records mic audio with MediaRecorder and hands the finished blob to the
// caller (which ships it to the backend's Whisper endpoint). Also exposes a
// live input level for the waveform and does silence detection — the
// Phase 4 TODO — by auto-stopping after `silenceSeconds` of quiet once the
// candidate has actually started talking.

interface Options {
  silenceSeconds: number;
  autoStopOnSilence: boolean;
  onAudio: (blob: Blob) => void;
}

const SILENCE_RMS = 0.018; // tuned for typical laptop mics with noise suppression
const MIN_SPEECH_MS = 400; // don't upload taps/clicks

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export function useWhisperRecorder({ silenceSeconds, autoStopOnSilence, onAudio }: Options) {
  const [isRecording, setIsRecording] = useState(false);
  const [level, setLevel] = useState(0); // 0..1, smoothed
  const [elapsedMs, setElapsedMs] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const chunksRef = useRef<Blob[]>([]);
  const speechMsRef = useRef(0);
  const discardRef = useRef(false);

  // Keep the latest options without restarting the recorder.
  const optsRef = useRef({ silenceSeconds, autoStopOnSilence, onAudio });
  optsRef.current = { silenceSeconds, autoStopOnSilence, onAudio };

  const isSupported = typeof window !== "undefined" && "MediaRecorder" in window;

  function teardown() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    ctxRef.current?.close().catch(() => {});
    streamRef.current = null;
    ctxRef.current = null;
    recorderRef.current = null;
    setLevel(0);
  }

  async function start() {
    if (!isSupported || recorderRef.current) return;
    const stream = await getMicStream();
    if (!stream) return;

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    speechMsRef.current = 0;
    discardRef.current = false;

    recorder.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      const hadSpeech = speechMsRef.current >= MIN_SPEECH_MS;
      teardown();
      setIsRecording(false);
      if (!discardRef.current && hadSpeech && blob.size > 0) optsRef.current.onAudio(blob);
    };

    // Level metering + silence detection
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);

    const startedAt = performance.now();
    let last = startedAt;
    let quietSince = startedAt;
    let smoothed = 0;
    let lastPaint = 0;

    const loop = (now: number) => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      smoothed = smoothed * 0.75 + Math.min(1, rms * 8) * 0.25;
      // ~15 fps of React updates is plenty for the meter.
      if (now - lastPaint > 66) {
        lastPaint = now;
        setLevel(smoothed);
        setElapsedMs(now - startedAt);
      }

      const dt = now - last;
      last = now;
      if (rms > SILENCE_RMS) {
        speechMsRef.current += dt;
        quietSince = now;
      } else {
        const { autoStopOnSilence: auto, silenceSeconds: secs } = optsRef.current;
        if (auto && speechMsRef.current >= MIN_SPEECH_MS && now - quietSince > secs * 1000) {
          stop();
          return;
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    streamRef.current = stream;
    ctxRef.current = ctx;
    recorderRef.current = recorder;
    recorder.start(250);
    setElapsedMs(0);
    setIsRecording(true);
    rafRef.current = requestAnimationFrame(loop);
  }

  function stop() {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  }

  // Stop without uploading (e.g. interview ended mid-recording).
  function cancel() {
    discardRef.current = true;
    stop();
  }

  useEffect(() => () => cancel(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return { start, stop, cancel, isRecording, level, elapsedMs, isSupported };
}
