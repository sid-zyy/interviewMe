# interviewMe — AI Interview Practice

A Chrome side-panel extension that reads the coding problem you're looking at
and runs a spoken mock interview about it. You explain your understanding out
loud, it asks follow-ups, gives escalating hints when you're stuck, and
scores your explanation when your submission is accepted.

```
extension/   Chrome extension (Manifest V3, Vite + CRXJS, React side panel)
backend/     Express proxy: session state, Gemini interviewer, Whisper STT
```

## Supported sites

| Site | Scraping | Auto-score on accepted |
|---|---|---|
| LeetCode (.com / .cn) | ✅ | ✅ |
| NeetCode | ✅ | ✅ |
| HackerRank | ✅ | ✅ |
| GeeksforGeeks | ✅ | ✅ |
| CodeChef | ✅ | ✅ |
| Codeforces | ✅ | manual ("Finish & score") — judged on a separate page |
| AtCoder | ✅ | manual — judged on a separate page |

Each site is a small adapter in `extension/src/lib/sites.ts` (URL matcher,
selector lists tried in order, difficulty parser, verdict regexes). **Selectors
drift** — when a site breaks, add the new selector at the front of its list.
New sites also need their origin in `manifest.json`.

## Quick start

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # then fill in the keys below
npm run dev                # http://localhost:8787
```

- `GEMINI_API_KEY`: free at https://aistudio.google.com/
- `GROQ_API_KEY` (recommended): free Whisper large-v3-turbo at https://console.groq.com/keys.
  Or set `OPENAI_API_KEY` to use OpenAI's `whisper-1`. Without either, the
  extension falls back to Chrome's built-in speech recognition.

### 2. Extension

```bash
cd extension
npm install
npm run build
```

Then in Chrome:
1. Go to `chrome://extensions` and enable Developer Mode.
2. Click "Load unpacked" and select `extension/dist`.
3. Copy the extension ID, add `chrome-extension://<id>` to `ALLOWED_ORIGINS`
   in `backend/.env`, and restart the backend.
4. Open a problem on any supported site and click the toolbar icon.

The first time you tap the mic, a tab opens to grant microphone access (Chrome
won't show that prompt inside a side panel).

## How it works

### Speech: Whisper + browser fallback
- **Whisper** (`useWhisperRecorder`): records with `MediaRecorder` and
  uploads the clip to `POST /interview/transcribe`. The backend forwards it to
  Groq or OpenAI with a prompt that biases recognition toward the problem's
  vocabulary. It's far more accurate than the browser recognizer on terms like
  "O(n log n)" and "hashmap".
- **Browser** (`useSpeechRecognition`): Web Speech API with live interim text.
- Both support **silence detection**: with "Auto-send after a pause" on, the
  turn is sent after N seconds of quiet. With **hands-free mode** on as well,
  the mic re-opens as soon as the interviewer finishes speaking, so you never
  touch the panel.
- The transcript lands in an editable composer, so you can fix a misheard
  word or just type instead of speaking.

### Hint escalation (backend state, not left to the model)
`backend/src/lib/hints.ts` owns a 4-rung ladder per checklist item:

| Level | Name | What the interviewer may say |
|---|---|---|
| 1 | Nudge | A Socratic question pointing at the area |
| 2 | Direction | The general concept or category |
| 3 | Specific | The technique or data structure |
| 4 | Near-answer | The key step, short of the full solution |

- The backend decides whether a hint is **required** this turn: when the
  candidate pressed **Hint**, said something like "I'm stuck" or "no idea"
  (regex pre-check), or was flagged stuck by the model on the previous turn.
  It tells the model the **only** level it may use. The model's reported
  level is clamped, so it can't skip rungs.
- Staying stuck climbs one rung per turn. Covering the target checklist item
  resets the ladder for the next one.
- Each hint costs points at scoring time (2 / 4 / 7 / 11 by level). The score
  screen shows how many hints you used and what they cost.

### Answer clock & timed hints
- Each answer is timed, starting when the interviewer finishes asking and
  ending when you send. The clock sits next to the mic, and every answer in
  the thread shows how long it took.
- **Timed hints** (on by default, 60s, adjustable from 20 to 180s in
  settings): if the countdown runs out with no answer in progress, the panel
  calls `/interview/hint` with `reason: "timeout"`. That climbs the same
  ladder as the Hint button. Typing, recording or transcribing resets the
  countdown, so it never interrupts you mid-answer. The clock turns amber
  with "hint in Ns" for the last 15 seconds. Once the ladder reaches
  Near-answer, timed hints stop.
- Answer times go to the backend (`answerSeconds` on `/turn`), so the
  interviewer and the scorer can see your pacing. The score screen shows your
  average and longest answer and how many hints were timed.

### Side panel UI
- Chat thread with distinct hint bubbles (level and name tagged), plus a
  replay button for each interviewer message.
- Live checklist chips and a hint-ladder meter.
- Mic dock with an input-level ring and waveform, status line, Space to
  toggle the mic, Enter to send.
- Timer, backend and STT status pill, mute.
- Settings sheet: STT engine, hands-free, timed hints and their delay,
  auto-send pause length, voice and rate, auto-score on accepted, backend URL.
- Follows the active tab: switching to another problem mid-interview offers
  to restart on it.
- Score screen: overall ring with verdict, rubric bars, strengths, things to
  work on.
- Dark and light themes that follow the OS.

## API

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/health` | — | `{ ok, gemini, whisper: { provider, model, configured } }` |
| POST | `/interview/start` | `{ problem, sessionId }` | turn |
| POST | `/interview/turn` | `{ sessionId, transcript, answerSeconds? }` | turn |
| POST | `/interview/hint` | `{ sessionId, reason?: "button" \| "timeout", idleSeconds? }` | turn (next rung) |
| POST | `/interview/transcribe?sessionId=` | raw audio (`audio/webm`) | `{ text }` |
| POST | `/interview/score` | `{ sessionId }` | rubric + strengths/improvements + hint penalty |

A turn is `{ message, checklistCovered, stuckSignalDetected, hintLevel, hint }`.

## Known gaps
- Site selectors are best-effort and need checking against the live DOM of
  each site.
- Sessions are in-memory, with a 6-hour TTL.
- No auth or rate limiting on the backend. That's fine for local use but not
  for anything public.
