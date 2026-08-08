import { useRef } from "react";

// Wraps the browser-native SpeechRecognition API (free, Chrome-only, continuous mode).
// NOTE from the project plan: mic permissions need a persistent context — the
// side panel (unlike the popup) stays open while the user talks, so it's used
// here instead of a dedicated recording tab. Revisit if mic access proves flaky.

interface Options {
  onResult: (finalTranscriptChunk: string) => void;
}

// Minimal ambient typing since @types/chrome doesn't cover the Web Speech API.
type SpeechRecognitionType = typeof window extends { webkitSpeechRecognition: infer T }
  ? T
  : any;

export function useSpeechRecognition({ onResult }: Options) {
  const recognitionRef = useRef<any>(null);
  const SpeechRecognitionCtor =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const isSupported = !!SpeechRecognitionCtor;

  async function start() {
    if (!isSupported) return;

    // getUserMedia doesn't reliably show Chrome's mic permission prompt from
    // a side panel/popup — it just fails with "not-allowed" or "denied"
    // (see src/permission/main.ts for the full explanation). If that
    // happens, open the dedicated permission tab instead of failing silently.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      console.warn("Mic permission not yet granted, opening permission tab:", err);
      chrome.tabs.create({ url: chrome.runtime.getURL("src/permission/index.html") });
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      const chunk = Array.from(event.results as any)
        .slice(event.resultIndex)
        .map((r: any) => r[0].transcript)
        .join(" ");
      if (chunk.trim()) onResult(chunk.trim());
    };

    recognition.onerror = (event: any) => {
      // Surface errors instead of failing silently — check this console
      // output first when debugging "Start talking does nothing".
      console.error("SpeechRecognition error:", event.error, event);
    };

    recognition.onstart = () => console.log("SpeechRecognition: started listening");
    recognition.onend = () => console.log("SpeechRecognition: stopped listening");

    // TODO (Phase 4): basic silence detection — e.g. debounce `onresult` and
    // auto-trigger "done explaining" after N seconds of no new speech.

    recognition.start();
    recognitionRef.current = recognition;
  }

  function stop() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }

  return { start, stop, isSupported };
}
