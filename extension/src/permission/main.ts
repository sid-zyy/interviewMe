// This page exists ONLY because Chrome doesn't reliably show the mic
// permission prompt from a side panel or popup — it silently fails with
// "not-allowed" there. Opening this as a full extension tab makes the
// prompt actually appear. Once granted, the permission is remembered for
// the extension's origin, so the side panel's own getUserMedia/
// SpeechRecognition calls succeed afterwards without needing this page again.

const statusEl = document.getElementById("status")!;

async function requestPermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    statusEl.textContent = "Microphone access granted — you can close this tab.";
    setTimeout(() => window.close(), 1200);
  } catch (err) {
    statusEl.innerHTML = `
      Microphone access was blocked.<br/><br/>
      Click the mic/lock icon in the address bar and allow access,
      then <button id="retry">try again</button>.
    `;
    document.getElementById("retry")?.addEventListener("click", requestPermission);
    console.error("Mic permission error:", err);
  }
}

requestPermission();
