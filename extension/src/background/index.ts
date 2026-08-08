// Background service worker (Manifest V3).
// Keeps things minimal for MVP: relay messages, open the side panel on click,
// and hold the last-scraped problem so the side panel can grab it on open.

import type { RuntimeMessage, ScrapedProblem } from "../lib/types";

let lastProblem: ScrapedProblem | null = null;

chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId !== undefined) {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  switch (message.type) {
    case "PROBLEM_SCRAPED":
      lastProblem = message.payload;
      // Forward to side panel if it's open and listening
      chrome.runtime.sendMessage(message).catch(() => {
        // no listener open — that's fine, side panel will pull on open
      });
      break;

    case "SUBMISSION_DETECTED":
      chrome.runtime.sendMessage(message).catch(() => {});
      break;

    case "REQUEST_CURRENT_PROBLEM":
      sendResponse(lastProblem);
      return true; // keep the message channel open for async sendResponse
  }
});
