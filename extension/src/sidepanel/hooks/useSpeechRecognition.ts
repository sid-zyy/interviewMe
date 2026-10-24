import { useEffect, useRef, useState } from "react";
import { getMicStream } from "./micPermission";

// Wraps the browser-native SpeechRecognition API (free, Chrome-only, continuous
// mode). Used as the fallback engine when Whisper isn't configured on the
// backend, or when the user picks it in settings.

interface Options {
  onResult: (finalTranscriptChunk: string) => void;
  onSilence?: () => void; // fired after `silenceSeconds` with no new speech
  silenceSeconds: number;
  autoStopOnSilence: boolean;
}

export function useSpeechRecognition({ onResult, onSilence, silenceSeconds, autoStopOnSilence }: Options) {
  const recognitionRef = useRef<any>(null);
  const silenceTimer = useRef<number>(0);
  const [interim, setInterim] = useState("");
  const [isListening, setIsListening] = useState(false);

  const optsRef = useRef({ onResult, onSilence, silenceSeconds, autoStopOnSilence });
  optsRef.current = { onResult, onSilence, silenceSeconds, autoStopOnSilence };

  const SpeechRecognitionCtor =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const isSupported = !!SpeechRecognitionCtor;

  function armSilenceTimer() {
    window.clearTimeout(silenceTimer.current);
    if (!optsRef.current.autoStopOnSilence) return;
    silenceTimer.current = window.setTimeout(() => {
      stop();
      optsRef.current.onSilence?.();
    }, optsRef.current.silenceSeconds * 1000);
  }

  async function start() {
    if (!isSupported || recognitionRef.current) return;

    const stream = await getMicStream();
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) {
          const text = r[0].transcript.trim();
          if (text) optsRef.current.onResult(text);
        } else {
          interimText += r[0].transcript;
        }
      }
      setInterim(interimText.trim());
      armSilenceTimer();
    };

    recognition.onerror = (event: any) => {
      // Surface errors instead of failing silently — check this console
      // output first when debugging "Start talking does nothing".
      console.error("SpeechRecognition error:", event.error, event);
    };

    recognition.onend = () => {
      window.clearTimeout(silenceTimer.current);
      recognitionRef.current = null;
      setInterim("");
      setIsListening(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }

  function stop() {
    window.clearTimeout(silenceTimer.current);
    recognitionRef.current?.stop();
  }

  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return { start, stop, isSupported, isListening, interim };
}
