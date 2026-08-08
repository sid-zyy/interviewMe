# AI Interview Practice — Project Skeleton

Matches the phased plan: Chrome-only, LeetCode-only, browser-native TTS/STT,
Gemini free tier. Two packages:

```
extension/   Chrome extension (Manifest V3, Vite + CRXJS, React side panel)
backend/     Express proxy that holds session state and calls Gemini
```

## Quick start

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # then paste in your Gemini API key
npm run dev                # http://localhost:8787
```

Get a free Gemini key at https://aistudio.google.com/.

### 2. Extension

```bash
cd extension
npm install
npm run dev
```

Then in Chrome:
1. Go to `chrome://extensions`, enable Developer Mode.
2. "Load unpacked" → select `extension/dist` (after `npm run build`) or
   follow the CRXJS dev-server instructions for HMR: https://crxjs.dev/vite-plugin/getting-started/react/dev-basic
3. Copy the extension ID Chrome assigns and add it to `backend/.env` as
   `chrome-extension://<id>` in `ALLOWED_ORIGINS`, then restart the backend.
4. Open any `leetcode.com/problems/...` page, click the extension icon to
   open the side panel.

## Where each phase of the plan lives

| Phase | Code |
|---|---|
| 1 — Extension skeleton | `extension/manifest.json`, `src/background`, `src/sidepanel` |
| 2 — DOM scraping | `extension/src/content/index.ts` — **selectors here will need real-world tuning**, they're best guesses |
| 3 — TTS | `extension/src/sidepanel/hooks/useSpeechSynthesis.ts` |
| 4 — STT | `extension/src/sidepanel/hooks/useSpeechRecognition.ts` — silence detection is a TODO |
| 5 — Backend + LLM | `backend/src/lib/gemini.ts`, `backend/src/routes/interview.ts` |
| 6 — Submission detection | `extension/src/content/index.ts` (`submitObserver`) |
| 7 — Hint state machine | `backend/src/lib/gemini.ts` (`SYSTEM_PROMPT` + checklist tracking) — currently a single LLM call per turn, not yet a real escalation ladder |
| 8/9 — Polish/expansion | not started |

## Known gaps to close first (per Phase 0 validation)

- **LeetCode selectors are guesses.** Before writing more code, open a real
  problem page, inspect the DOM, and update `SELECTORS` in
  `extension/src/content/index.ts`.
- **No hint escalation logic yet** — `getNextTurn` asks Gemini fresh each
  turn with the full transcript. That's fine for a first demo, but Phase 7
  wants explicit "vague → specific → near-answer" escalation, which should
  probably be tracked as backend state rather than left to the model.
- **No auth / rate limiting** on the backend — fine for solo local use, not
  for anything public-facing.
