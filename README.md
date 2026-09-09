# LLD Practice Platform

Practise low-level design, get feedback grounded in what you actually wrote,
revise it, and see whether the next attempt is genuinely better.

```
choose a problem → write a design → submit → evidence-backed feedback
        ↑                                             ↓
        └──────────── revise ←──── see what moved ────┘
```

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

No API key needed — an offline evaluator ships with it, so the whole loop works
with no network and no cost. `npm test` · `npm run typecheck`. Node 20+.

---

## Why

You can practise DSA on LeetCode and get an instant verdict. You design a
Parking Lot once and have no idea whether it was good.

Problem statements are everywhere. **The missing thing is feedback.** Existing
tools judge LLD with test cases — but a God class passes every test case. The
only thing measuring design quality is a human at ~$179 a session. See
[RESEARCH.md](RESEARCH.md).

So the evaluation layer *is* the product. It guards three failure modes:

| Risk | Guard |
|---|---|
| Sycophancy | Written 0–5 bands per problem, so a 2 is a *described* outcome |
| Genericism | Every finding must quote your own text |
| Hallucination | Evidence verified against the submission, or discarded |

---

## Architecture

```
client/   React + Vite + TS    api · components · hooks · pages
server/   Express + TS         domain · evaluation · repositories
                               application · api · seed
```

`domain/` imports nothing from the layers outside it.

**Invariants live in constructors, not comments.** Rubric weights must sum to
100. Bands must cover 0–5. `Attempt` owns its state machine — `COMPLETED` is
terminal, `FAILED → EVALUATING` is the retry edge. A `FeedbackItem` without
evidence, issue, reason and suggestion cannot be constructed, so there is
nowhere to put "follow SOLID".

### Pipeline

```
submission
  → structural checks       deterministic; signals, never a gate
  → prompt                  rubric bands · requirements · findings
  → evaluator               mock | gemini | openai
  → Zod validation          one repair round, then FAILED
  → evidence verification   drops quotes not in the submission
  → weighted score          computed, never model-authored
  → improvement delta       computed from stored history
```

The last three are not the model's to decide. **It supplies judgement about the
design; the platform supplies the arithmetic and the guarantees.**

---

## Key decisions

**Change scenario probes one dimension, not a sixth requirement.** The PRD
reveals "add EV charging" after attempt 1 *and* asks attempt 2 what improved.
Those conflict — graded as a new requirement, you could improve and score
*lower*. It feeds Extensibility only, marked **bar raised** and excluded from
the regression count.

**Score and delta are computed, never generated.** The Zod schema has no
`overallScore` field, so a model returning one is rejected. A model left to
author its own total will return 78 alongside scores of 2, 2, 3, 3. A model
asked whether you improved will say yes.

**Evidence is verified, not requested.** Dropping a real criticism costs one
piece of advice; critiquing a class you never wrote costs all credibility.

**Duplicate requests return the in-flight attempt.** A double-click would
otherwise leave a phantom entry in a history meant to record how your thinking
changed.

**Empty submissions are evaluated, not rejected.** A scored explanation of why
nothing scores nothing teaches more than a 400.

Numbered A1–A12 in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md), which the
code comments cite.

---

## Evaluators

| `LLM_PROVIDER` | Cost | Key |
|---|---|---|
| `mock` *(default)* | free | none |
| `gemini` | free tier | [aistudio.google.com/apikey](https://aistudio.google.com/apikey), no card |
| `openai` | paid | `OPENAI_API_KEY` |

Copy `server/.env.example` → `server/.env`. A missing key falls back to the mock
rather than refusing to boot.

> Model names change. On HTTP 404 the error body names the current one —
> `gemini-2.0-flash` and `2.5-flash` are already retired.

**The offline evaluator** applies rules and quotes real lines, so a God class and
a separated design get different reviews. But its rules only cover Parking Lot
and Vending Machine. Two things follow:

1. **It says so** — a banner while active, and a badge on every attempt it judged.
2. **It declines rather than guesses.** No basis on a dimension → *not assessed*,
   and no overall score.

The second point matters. A wrong score is worse than none: you cannot tell it
from a real one, and it contaminates every comparison built on it. The platform
already deletes feedback it cannot ground — a number it cannot justify gets the
same treatment. Abstention is per-dimension, because the rules genuinely know
some axes and not others.

---

## API

| | | |
|---|---|---|
| `GET` | `/api/health` | Status and which evaluator is running |
| `GET` | `/api/problems` | Catalogue with progress |
| `GET` | `/api/problems/:id` | Problem detail |
| `GET` | `/api/problems/:id/attempts` | History |
| `POST` | `/api/attempts` | Submit → `202 {attemptId, status}` |
| `GET` | `/api/attempts/:id` | Poll |
| `POST` | `/api/attempts/:id/retry` | Re-evaluate a failed attempt |

`POST` returns 202 as soon as the submission is stored. Your work being *safe*
and your work being *graded* are different guarantees; only the first should
make you wait.

The change scenario is withheld **server-side** until unlocked — reading it in
the network tab before attempt 1 would hand you the answer to what it measures.

---

## If it grew

**Separate the evaluation worker first.** It is the only part that is slow,
fails for external reasons, and scales on a different axis. The seam exists:
swapping `setImmediate` for a queue touches one method, the attempt states are
already the contract a worker reports against, and the client polls rather than
holding a connection open.

Nothing else is close. A real database would come before a second service.

---

## Tests

`npm test` — **207 tests, no network.** Domain invariants, structural checks,
schema rejection of `overallScore`, the repair round, fabricated evidence being
discarded, weighted arithmetic, abstention, comparison deltas, duplicate
submissions, and 33 API tests through the real stack.

## Limitations

- **Storage is process-scoped.** Attempts survive a failed evaluation and a
  retry, but not a server restart. In scope per the PRD.
- **Scoring can drift between runs.** Fixed bands and temperature 0 mitigate
  most of it; some residual is inherent to LLM evaluation.
- **The submission format is not polymorphic.** Adding an evaluator is one class
  and one line. Adding a *diagram* format would also touch the structural
  evaluator and prompt builder. The evaluation side has the seam; the submission
  side does not.
- **No confidence score.** Abstention does that job better — `null` says there
  was no basis, where `confidence: 0.4` still shows a number read as a judgement.
- **Client API types are hand-mirrored** from the server DTOs.

## Not built

Auth · databases · queues · UML editors · admin · analytics · payments ·
multiple submission formats · streaming. Out of scope per the PRD.
