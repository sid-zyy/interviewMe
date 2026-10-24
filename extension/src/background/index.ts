// Background service worker (Manifest V3).
// Relays messages, opens the side panel on click, and tracks the scraped
// problem per tab so the side panel follows whichever tab is active.

import type { RuntimeMessage, ScrapedProblem } from "../lib/types";

// Service workers get torn down, so mirror to session storage too.
const problemsByTab = new Map<number, ScrapedProblem>();

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

async function saveProblem(tabId: number, problem: ScrapedProblem) {
  problemsByTab.set(tabId, problem);
  await chrome.storage.session.set({ [`problem:${tabId}`]: problem }).catch(() => {});
}

async function loadProblem(tabId: number): Promise<ScrapedProblem | null> {
  if (problemsByTab.has(tabId)) return problemsByTab.get(tabId)!;
  const key = `problem:${tabId}`;
  const stored = await chrome.storage.session.get(key).catch(() => ({}) as Record<string, unknown>);
  return (stored[key] as ScrapedProblem | undefined) ?? null;
}

async function activeTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.id;
}

async function problemForActiveTab(): Promise<ScrapedProblem | null> {
  const tabId = await activeTabId();
  if (tabId === undefined) return null;
  // Ask the page directly first (freshest), fall back to the cached copy.
  try {
    const live = (await chrome.tabs.sendMessage(tabId, {
      type: "REQUEST_CURRENT_PROBLEM",
    } satisfies RuntimeMessage)) as ScrapedProblem | null;
    if (live) {
      await saveProblem(tabId, live);
      return live;
    }
    // Content script answered "nothing here" — but the statement may just be
    // mid-render, so keep the cached copy only if it's for the same URL.
    const cached = await loadProblem(tabId);
    const tab = await chrome.tabs.get(tabId);
    return cached && tab.url?.startsWith(cached.url ?? "\u0000") ? cached : null;
  } catch {
    // no content script on this tab (unsupported site)
    return null;
  }
}

chrome.tabs.onUpdated.addListener((_tabId, info, tab) => {
  if (info.status === "complete" && tab.active) void broadcastActive();
});

async function broadcastActive() {
  const problem = await problemForActiveTab();
  const msg: RuntimeMessage = { type: "ACTIVE_PROBLEM_CHANGED", payload: problem };
  chrome.runtime.sendMessage(msg).catch(() => {});
}

chrome.tabs.onActivated.addListener(() => void broadcastActive());
chrome.tabs.onRemoved.addListener((tabId) => {
  problemsByTab.delete(tabId);
  chrome.storage.session.remove(`problem:${tabId}`).catch(() => {});
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
  switch (message.type) {
    case "PROBLEM_SCRAPED": {
      const tabId = sender.tab?.id;
      if (tabId === undefined) break;
      void saveProblem(tabId, message.payload).then(async () => {
        // Only surface it if that tab is the one the user is looking at.
        if ((await activeTabId()) === tabId) {
          chrome.runtime.sendMessage(message).catch(() => {});
        }
      });
      break;
    }

    case "SUBMISSION_DETECTED":
      chrome.runtime.sendMessage(message).catch(() => {});
      break;

    case "REQUEST_CURRENT_PROBLEM":
      // Content scripts never send this; it's the side panel asking.
      if (sender.tab) break;
      void problemForActiveTab().then(sendResponse);
      return true; // keep the message channel open for async sendResponse
  }
});
