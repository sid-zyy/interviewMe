import { SITES } from "../../lib/sites";

const SITE_HOME: Record<string, string> = {
  leetcode: "https://leetcode.com/problemset/",
  neetcode: "https://neetcode.io/practice",
  hackerrank: "https://www.hackerrank.com/domains/algorithms",
  codeforces: "https://codeforces.com/problemset",
  geeksforgeeks: "https://www.geeksforgeeks.org/explore",
  codechef: "https://www.codechef.com/practice",
  atcoder: "https://atcoder.jp/contests/",
};

export function EmptyState() {
  return (
    <section className="card hero">
      <h2>Open a coding problem to start a mock interview</h2>
      <p>interviewMe reads the problem on the page and interviews you about it — out loud.</p>
      <div className="site-grid">
        {SITES.map((s) => (
          <a key={s.id} className="site-link" href={SITE_HOME[s.id]} target="_blank" rel="noreferrer">
            <i style={{ background: s.color }} />
            {s.label}
          </a>
        ))}
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <ol className="steps">
      <li><span><b>Explain before you code.</b> Walk through inputs, constraints and edge cases out loud.</span></li>
      <li><span><b>Get stuck? Ask for a hint.</b> Hints escalate from a nudge to a near-answer — each one costs points.</span></li>
      <li><span><b>Submit your solution.</b> You're scored on your explanation when the judge accepts it.</span></li>
    </ol>
  );
}
