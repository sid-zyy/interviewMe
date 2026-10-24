// getUserMedia doesn't reliably show Chrome's mic permission prompt from a
// side panel — it just fails with "not-allowed" (see src/permission/main.ts).
// When that happens, open the dedicated permission tab instead of failing
// silently. Returns a live stream on success, or null if we redirected.
export async function getMicStream(): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (err) {
    console.warn("Mic permission not yet granted, opening permission tab:", err);
    chrome.tabs.create({ url: chrome.runtime.getURL("src/permission/index.html") });
    return null;
  }
}
