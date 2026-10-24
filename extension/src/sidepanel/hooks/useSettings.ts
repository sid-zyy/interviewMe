import { useEffect, useState } from "react";
import { DEFAULT_BASE_URL } from "../../lib/api";

export type SttEngine = "whisper" | "browser";

export interface Settings {
  backendBaseUrl: string;
  sttEngine: SttEngine;
  handsFree: boolean; // start listening as soon as the interviewer stops talking
  autoSend: boolean; // send the turn automatically after a pause
  silenceSeconds: number;
  autoHint: boolean; // give a hint when the answer clock runs out
  autoHintSeconds: number;
  voiceURI: string; // "" = browser default
  speechRate: number;
  autoScoreOnAccepted: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  backendBaseUrl: DEFAULT_BASE_URL,
  sttEngine: "whisper",
  handsFree: false,
  autoSend: false,
  silenceSeconds: 2.5,
  autoHint: true,
  autoHintSeconds: 60,
  voiceURI: "",
  speechRate: 1.05,
  autoScoreOnAccepted: true,
};

// Persisted in chrome.storage.local. backendBaseUrl stays a top-level key
// because lib/api.ts reads it directly.
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(["settings", "backendBaseUrl"]).then((stored) => {
      setSettings({
        ...DEFAULT_SETTINGS,
        ...(stored.settings ?? {}),
        backendBaseUrl: stored.backendBaseUrl || DEFAULT_BASE_URL,
      });
      setLoaded(true);
    });
  }, []);

  function update(patch: Partial<Settings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      const { backendBaseUrl, ...rest } = next;
      chrome.storage.local.set({ settings: rest, backendBaseUrl });
      return next;
    });
  }

  return { settings, update, loaded };
}
