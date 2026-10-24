// Runs on every supported problem site (see lib/sites.ts + manifest.json).
// Responsibilities (Phase 2 + Phase 6):
//   1. Scrape the problem statement into clean text via the site's adapter
//   2. Re-scrape on SPA navigation (most of these sites never hard-reload)
//   3. Watch for a real submission result and notify the background worker

import TurndownService from "turndown";
import type { ScrapedProblem, RuntimeMessage, Difficulty } from "../lib/types";
import { findSite, type SiteAdapter } from "../lib/sites";

const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
turndown.remove(["script", "style", "button", "svg"] as TurndownService.Filter);

function first(selectors: string[] | undefined): Element | null {
  for (const sel of selectors ?? []) {
    const el = document.querySelector(sel);
    if (el && el.textContent?.trim()) return el;
  }
  return null;
}

function cleanTitle(raw: string): string {
  // "1. Two Sum" -> "Two Sum"; also collapses whitespace.
  return raw.replace(/\s+/g, " ").replace(/^\s*[A-Z]?\d+[A-Z]?\.\s+/, "").trim();
}

function extractConstraints(markdown: string): string[] {
  const lines = markdown.split("\n");
  const start = lines.findIndex((l) => /constraints?/i.test(l) && l.length < 40);
  const pool = start >= 0 ? lines.slice(start + 1, start + 20) : lines;
  return pool
    .filter((l) => /^\s*[*-]/.test(l) && /\d|<=|≤|10\^/.test(l))
    .map((l) => l.replace(/^\s*[*-]+\s*/, "").replace(/`/g, "").trim())
    .slice(0, 12);
}

function extractExamples(markdown: string): string[] {
  return Array.from(markdown.matchAll(/(?:\*\*)?Example\s*\d*:?(?:\*\*)?[\s\S]*?(?=\n\s*\n(?:\*\*)?(?:Example|Constraints)|$)/gi))
    .map((m) => m[0].trim())
    .filter((s) => s.length > 10)
    .slice(0, 4);
}

function scrapeWith(site: SiteAdapter): ScrapedProblem | null {
  const url = new URL(window.location.href);
  const descriptionEl = first(site.selectors.description);
  const titleEl = first(site.selectors.title);
  if (!descriptionEl) return null;

  const markdown = turndown
    .turndown(descriptionEl.innerHTML)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (markdown.length < 40) return null; // still rendering

  const diffText = first(site.selectors.difficulty)?.textContent ?? "";
  const difficulty: Difficulty = site.parseDifficulty?.(diffText) ?? "Unknown";

  return {
    source: site.id,
    slug: site.slug(url),
    url: url.origin + url.pathname,
    title: cleanTitle(titleEl?.textContent ?? document.title.split(/[-|]/)[0]),
    difficulty,
    descriptionText: markdown,
    constraints: extractConstraints(markdown),
    examples: extractExamples(markdown),
  };
}

function currentSite() {
  return findSite(window.location.href);
}

function scrapeProblem(): ScrapedProblem | null {
  const site = currentSite();
  return site ? scrapeWith(site) : null;
}

let lastReportedKey = "";
function reportProblem(force = false) {
  const problem = scrapeProblem();
  if (!problem) return false;
  const key = `${problem.source}:${problem.slug}:${problem.descriptionText.length}`;
  if (!force && key === lastReportedKey) return true;
  lastReportedKey = key;
  const msg: RuntimeMessage = { type: "PROBLEM_SCRAPED", payload: problem };
  chrome.runtime.sendMessage(msg).catch(() => {});
  return true;
}

// Retry for a few seconds — SPAs render the statement well after document_idle.
function reportWithRetry() {
  let attempts = 0;
  const tick = () => {
    if (reportProblem() || ++attempts > 20) return;
    setTimeout(tick, 400);
  };
  tick();
}

// --- SPA navigation + submission detection ----------------------------------
// One debounced observer instead of two firing on every DOM mutation.
let lastHref = window.location.href;
let lastResultText = "";
let pending = false;

function resultSignature(site: SiteAdapter): string {
  const sub = site.submission;
  if (!sub) return "";
  const el = first(sub.selector);
  const text = (el?.textContent ?? "").replace(/\s+/g, " ").trim();
  // Only the verdict-ish part matters — avoids re-firing on unrelated re-renders.
  const verdict = text.match(sub.accepted)?.[0] ?? text.match(sub.rejected)?.[0] ?? "";
  return verdict ? `${verdict}|${text.slice(0, 160)}` : "";
}

function onDomChange() {
  pending = false;
  if (window.location.href !== lastHref) {
    lastHref = window.location.href;
    lastResultText = "";
    lastReportedKey = "";
    setTimeout(reportWithRetry, 300);
    return;
  }

  const site = currentSite();
  if (!site?.submission) return;
  const sig = resultSignature(site);
  if (!sig || sig === lastResultText) return;
  lastResultText = sig;

  const passed = site.submission.accepted.test(sig);
  const msg: RuntimeMessage = {
    type: "SUBMISSION_DETECTED",
    payload: { slug: site.slug(new URL(window.location.href)), passed },
  };
  chrome.runtime.sendMessage(msg).catch(() => {});
}

const observer = new MutationObserver(() => {
  if (pending) return;
  pending = true;
  setTimeout(onDomChange, 250);
});
observer.observe(document.body, { childList: true, subtree: true, characterData: true });

// --- Respond to side panel/background asking "what's the current problem?" --
chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === "REQUEST_CURRENT_PROBLEM") {
    sendResponse(scrapeProblem());
  }
});

// Baseline any verdict already on screen (e.g. a previous "Accepted") so it
// doesn't trigger scoring the moment the page loads.
{
  const site = currentSite();
  if (site) lastResultText = resultSignature(site);
}
reportWithRetry();
