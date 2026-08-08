// Runs on https://leetcode.com/problems/*
// Responsibilities (Phase 2 + Phase 6):
//   1. Scrape the problem statement into clean text
//   2. Re-scrape on SPA navigation (LeetCode never hard-reloads)
//   3. Watch for a real submission result and notify the background worker

import TurndownService from "turndown";
import type { ScrapedProblem, RuntimeMessage } from "../lib/types";

const turndown = new TurndownService();

// NOTE: these selectors WILL drift as LeetCode ships changes.
// Centralizing them here makes it a one-place fix.
const SELECTORS = {
  title: '[data-cy="question-title"], div.text-title-large',
  description: '[data-track-load="description_content"]',
  difficulty: 'div[class*="text-difficulty"]',
  submitResult: '[data-e2e-locator="submission-result"]',
};

function slugFromUrl(): string {
  const match = window.location.pathname.match(/\/problems\/([^/]+)/);
  return match ? match[1] : "unknown";
}

function scrapeProblem(): ScrapedProblem | null {
  const descriptionEl = document.querySelector(SELECTORS.description);
  const titleEl = document.querySelector(SELECTORS.title);
  if (!descriptionEl || !titleEl) return null;

  const html = descriptionEl.innerHTML;
  const markdown = turndown.turndown(html);

  // Very rough constraint/example splitting — refine once you see real DOM output.
  const constraints = markdown
    .split("\n")
    .filter((line) => line.trim().startsWith("*") && /\d/.test(line))
    .map((line) => line.replace(/^\*+\s*/, "").trim());

  const examples = Array.from(markdown.matchAll(/Example \d+:[\s\S]*?(?=\n\n|$)/g)).map(
    (m) => m[0].trim()
  );

  const difficultyText = document.querySelector(SELECTORS.difficulty)?.textContent?.trim();
  const difficulty =
    difficultyText === "Easy" || difficultyText === "Medium" || difficultyText === "Hard"
      ? difficultyText
      : "Unknown";

  return {
    source: "leetcode",
    slug: slugFromUrl(),
    title: titleEl.textContent?.trim() ?? "Untitled",
    difficulty,
    descriptionText: markdown,
    constraints,
    examples,
  };
}

function reportProblem() {
  const problem = scrapeProblem();
  if (!problem) return; // page not fully loaded yet — MutationObserver will retry
  const msg: RuntimeMessage = { type: "PROBLEM_SCRAPED", payload: problem };
  chrome.runtime.sendMessage(msg);
}

// --- SPA navigation handling -------------------------------------------------
// LeetCode is a client-rendered React app; the URL changes without a reload.
let lastSlug = slugFromUrl();
const navObserver = new MutationObserver(() => {
  const currentSlug = slugFromUrl();
  if (currentSlug !== lastSlug) {
    lastSlug = currentSlug;
    setTimeout(reportProblem, 500); // give the new page time to render
  }
});
navObserver.observe(document.body, { childList: true, subtree: true });

// --- Submission detection (Phase 6) -----------------------------------------
const submitObserver = new MutationObserver(() => {
  const resultEl = document.querySelector(SELECTORS.submitResult);
  if (!resultEl) return;
  const text = resultEl.textContent?.toLowerCase() ?? "";
  if (text.includes("accepted") || text.includes("wrong answer") || text.includes("error")) {
    const msg: RuntimeMessage = {
      type: "SUBMISSION_DETECTED",
      payload: { slug: slugFromUrl(), passed: text.includes("accepted") },
    };
    chrome.runtime.sendMessage(msg);
  }
});
submitObserver.observe(document.body, { childList: true, subtree: true });

// --- Respond to side panel asking "what's the current problem?" -------------
chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === "REQUEST_CURRENT_PROBLEM") {
    sendResponse(scrapeProblem());
  }
});

// Initial load
reportProblem();
