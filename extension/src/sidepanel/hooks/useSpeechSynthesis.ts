import { useEffect, useRef, useState } from "react";

// Wraps the browser-native SpeechSynthesis API (free, built into Chrome).
// Swap this out for an ElevenLabs-backed hook later (Phase 3 "later upgrade")
// without touching any calling code — same interface.

interface Options {
  voiceURI: string;
  rate: number;
}

export function useSpeechSynthesis({ voiceURI, rate }: Options) {
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const isMutedRef = useRef(isMuted); // avoid stale closures inside utterance callbacks
  isMutedRef.current = isMuted;
  const optsRef = useRef({ voiceURI, rate });
  optsRef.current = { voiceURI, rate };

  useEffect(() => {
    const load = () =>
      setVoices(window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en")));
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  function speak(text: string, onEnd?: () => void) {
    window.speechSynthesis.cancel(); // stop anything currently playing

    if (isMutedRef.current) {
      // Muted: skip audio entirely but still advance the conversation flow.
      onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = optsRef.current.rate;
    const voice = window.speechSynthesis
      .getVoices()
      .find((v) => v.voiceURI === optsRef.current.voiceURI);
    if (voice) utterance.voice = voice;

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      setIsSpeaking(false);
      onEnd?.();
    };
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.speak(utterance);
  }

  function skip() {
    // Cancelling mid-utterance still fires the 'end' event in Chrome, which
    // triggers the onEnd callback above and advances the flow normally.
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }

  function cancel() {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }

  function toggleMute() {
    setIsMuted((prev) => {
      const next = !prev;
      if (next) window.speechSynthesis.cancel(); // stop immediately when muting mid-speech
      return next;
    });
  }

  return { speak, cancel, skip, toggleMute, isMuted, isSpeaking, voices };
}
