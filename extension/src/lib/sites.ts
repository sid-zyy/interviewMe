// One adapter per supported site. Selectors WILL drift as these sites ship
// changes — each list is tried in order, so add the new selector at the front
// and keep the old one as a fallback. Matching URL patterns also need to be
// listed in manifest.json (content_scripts.matches + host_permissions).

import type { Difficulty, ProblemSource } from "./types";

export interface SiteAdapter {
  id: ProblemSource;
  label: string;
  color: string; // brand-ish tint for the site badge
  match: (url: URL) => boolean;
  slug: (url: URL) => string;
  selectors: {
    title: string[];
    description: string[];
    difficulty?: string[];
  };
  parseDifficulty?: (text: string) => Difficulty;
  submission?: {
    selector: string[];
    accepted: RegExp;
    rejected: RegExp;
  };
}

function wordDifficulty(text: string): Difficulty {
  const t = text.toLowerCase();
  if (/\b(easy|basic|school|beginner)\b/.test(t)) return "Easy";
  if (/\bmedium\b/.test(t)) return "Medium";
  if (/\b(hard|expert|advanced)\b/.test(t)) return "Hard";
  return "Unknown";
}

// Codeforces / CodeChef use numeric ratings.
function ratingDifficulty(text: string): Difficulty {
  const n = parseInt(text.replace(/[^\d]/g, ""), 10);
  if (!n) return wordDifficulty(text);
  if (n < 1300) return "Easy";
  if (n < 1900) return "Medium";
  return "Hard";
}

const lastSegmentAfter = (url: URL, marker: string) => {
  const parts = url.pathname.split("/").filter(Boolean);
  const i = parts.indexOf(marker);
  return i >= 0 && parts[i + 1] ? parts[i + 1] : parts.join("-") || "unknown";
};

export const SITES: SiteAdapter[] = [
  {
    id: "leetcode",
    label: "LeetCode",
    color: "#FFA116",
    match: (u) => /(^|\.)leetcode\.(com|cn)$/.test(u.hostname) && u.pathname.startsWith("/problems/"),
    slug: (u) => lastSegmentAfter(u, "problems"),
    selectors: {
      title: ['div.text-title-large a', "div.text-title-large", '[data-cy="question-title"]'],
      description: ['[data-track-load="description_content"]', '[class*="question-content"]'],
      difficulty: ['div[class*="text-difficulty-"]', 'div[class*="text-difficulty"]', '[diff]'],
    },
    parseDifficulty: wordDifficulty,
    submission: {
      selector: ['[data-e2e-locator="submission-result"]'],
      accepted: /\baccepted\b/i,
      rejected: /wrong answer|runtime error|time limit|memory limit|compile error|output limit/i,
    },
  },
  {
    id: "neetcode",
    label: "NeetCode",
    color: "#22C55E",
    match: (u) => u.hostname.endsWith("neetcode.io") && u.pathname.startsWith("/problems/"),
    slug: (u) => lastSegmentAfter(u, "problems"),
    selectors: {
      title: ["app-article h1", ".my-article-component-container h1", "h1"],
      description: [".my-article-component-container", "app-article", "article"],
      difficulty: [".difficulty-btn", '[class*="difficulty"]'],
    },
    parseDifficulty: wordDifficulty,
    submission: {
      selector: [".result-container", '[class*="submission-result"]', '[class*="test-result"]'],
      accepted: /\baccepted\b/i,
      rejected: /wrong answer|runtime error|time limit|compile error/i,
    },
  },
  {
    id: "hackerrank",
    label: "HackerRank",
    color: "#2EC866",
    match: (u) => u.hostname.endsWith("hackerrank.com") && /\/challenges\/[^/]+/.test(u.pathname),
    slug: (u) => lastSegmentAfter(u, "challenges"),
    selectors: {
      title: [".challenge-page-label-wrapper h1", "h1.page-label", ".ui-icon-label.page-label", "h1"],
      description: [".challenge-body-html", ".problem-statement", ".challenge-problem-statement"],
      difficulty: [".difficulty-label", '[class*="difficulty"]'],
    },
    parseDifficulty: wordDifficulty,
    submission: {
      selector: [".congrats-wrapper", ".compile-message", ".submission-result-wrapper", ".result-message"],
      accepted: /congratulations|you solved|all test cases passed/i,
      rejected: /wrong answer|terminated due to timeout|runtime error|compilation error/i,
    },
  },
  {
    id: "codeforces",
    label: "Codeforces",
    color: "#1F8ACB",
    match: (u) =>
      u.hostname.endsWith("codeforces.com") &&
      /\/(problemset\/problem|contest\/\d+\/problem|gym\/\d+\/problem)\//.test(u.pathname),
    slug: (u) => u.pathname.split("/").filter(Boolean).slice(-2).join("-"),
    selectors: {
      title: [".problem-statement .header .title"],
      description: [".problem-statement"],
      difficulty: ['.tag-box[title="Difficulty"]'],
    },
    parseDifficulty: ratingDifficulty,
    // Codeforces judges on a separate status page — score manually.
  },
  {
    id: "geeksforgeeks",
    label: "GeeksforGeeks",
    color: "#2F8D46",
    match: (u) => u.hostname.endsWith("geeksforgeeks.org") && u.pathname.startsWith("/problems/"),
    slug: (u) => lastSegmentAfter(u, "problems"),
    selectors: {
      title: ['[class*="problems_header_content__title"] h3', '[class*="problems_header_content__title"]', "h3"],
      description: ['[class*="problems_problem_content"]', ".problem-statement"],
      difficulty: ['[class*="problems_header_description"]'],
    },
    parseDifficulty: wordDifficulty,
    submission: {
      selector: ['[class*="problems_content"]', '[class*="problems_problem_solved"]', '[class*="result"]'],
      accepted: /problem solved successfully/i,
      rejected: /wrong answer|compilation error|runtime error|time limit exceeded/i,
    },
  },
  {
    id: "codechef",
    label: "CodeChef",
    color: "#B07F5B",
    match: (u) =>
      u.hostname.endsWith("codechef.com") &&
      /\/(problems|practice\/course\/[^/]+\/[^/]+\/problems)\//.test(u.pathname),
    slug: (u) => lastSegmentAfter(u, "problems"),
    selectors: {
      title: ['[class*="_problemName"]', '[class*="problem-name"]', "h1"],
      description: ['[class*="_problem-statement"]', "#problem-statement", '[class*="problemBody"]'],
      difficulty: ['[class*="_difficulty"]', '[class*="difficulty-rating"]'],
    },
    parseDifficulty: ratingDifficulty,
    submission: {
      selector: ['[class*="_status_"]', '[class*="submission-result"]', '[class*="_verdict"]'],
      accepted: /correct answer|\baccepted\b/i,
      rejected: /wrong answer|time limit|runtime error|compilation error/i,
    },
  },
  {
    id: "atcoder",
    label: "AtCoder",
    color: "#9CA3AF",
    match: (u) => u.hostname.endsWith("atcoder.jp") && /\/contests\/[^/]+\/tasks\//.test(u.pathname),
    slug: (u) => lastSegmentAfter(u, "tasks"),
    selectors: {
      title: ["span.h2", "h2"],
      description: ["#task-statement .lang-en", "#task-statement"],
    },
    // Submissions are judged on a separate page — score manually.
  },
];

export function findSite(url: string | URL): SiteAdapter | null {
  try {
    const u = typeof url === "string" ? new URL(url) : url;
    return SITES.find((s) => s.match(u)) ?? null;
  } catch {
    return null;
  }
}

export function siteMeta(id: ProblemSource): { label: string; color: string } {
  const s = SITES.find((x) => x.id === id);
  return s ? { label: s.label, color: s.color } : { label: "Web", color: "#9CA3AF" };
}
