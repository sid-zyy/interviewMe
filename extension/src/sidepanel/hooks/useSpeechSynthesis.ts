import { useRef, useState } from "react";

// Wraps the browser-native SpeechSynthesis API (free, built into Chrome).
// Swap this out for an ElevenLabs-backed hook later (Phase 3 "later upgrade")
// without touching any calling code — same interface.

export function useSpeechSynthesis() {
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const isMutedRef = useRef(isMuted); // avoid stale closures inside utterance callbacks
  isMutedRef.current = isMuted;

  function speak(text: string, onEnd?: () => void) {
    window.speechSynthesis.cancel(); // stop anything currently playing

    if (isMutedRef.current) {
      // Muted: skip audio entirely but still advance the conversation flow.
      onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      onEnd?.();
    };
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

  return { speak, cancel, skip, toggleMute, isMuted, isSpeaking };
}
