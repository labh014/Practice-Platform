# LLD Practice Platform

Practise low-level design, get feedback grounded in what you actually wrote,
revise it, and see whether the next attempt is genuinely better.

```
choose a problem → write a design → submit → evidence-backed feedback
        ↑                                             ↓
        └──────────── revise ←──── see what moved ────┘
```

**Live:** https://lld-practice-szip.onrender.com

> Render free tier — it sleeps when idle. The first request takes **30–50s** to
> wake. Not broken, just cold. Waking also clears stored attempts.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

No API key needed. `npm test` (207 tests) · `npm run typecheck`. Node 20+.

---

## Why

You can practise DSA on LeetCode and get an instant verdict. You design a
Parking Lot once and have no idea whether it was good.

Existing tools judge LLD with test cases — but **a God class passes every test
case**. The only thing measuring design quality is a human at ~$179 a session.
See [RESEARCH.md](RESEARCH.md).

So the evaluation layer *is* the product:

| Risk | Guard |
|---|---|
| Sycophancy | Written 0–5 bands per problem — a 2 is a *described* outcome |
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

Invariants live in constructors: rubric weights must sum to 100, bands must
cover 0–5, `COMPLETED` is terminal, and a `FeedbackItem` without evidence and a
suggestion cannot be constructed — so there is nowhere to put "follow SOLID".

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

**The model supplies judgement about the design. The platform supplies the
arithmetic and the guarantees.**

---

## Key decisions

Numbered, because code comments cite them.

| | Decision | Why |
|---|---|---|
| **A1** | The change scenario probes Extensibility only, not a sixth requirement | Otherwise attempt 2 is graded against a wider brief and you could improve but score *lower* |
| **A2/A3** | Score and delta are computed, never generated | The schema has no `overallScore` field. A model asked whether you improved will say yes. |
| **A4** | Evidence is verified, not requested | Critiquing a class you never wrote costs all credibility |
| **A5** | One schema-repair retry, then fail | Models break schema on trivia; more retries waste time |
| **A10** | Structural findings live on the `Attempt` | So they survive a failed evaluation |

Also: duplicate requests return the in-flight attempt, and empty submissions get
evaluated rather than 400'd — a scored explanation teaches more than a rejection.

---

## Evaluators

| `LLM_PROVIDER` | Cost | Key |
|---|---|---|
| `mock` *(default)* | free | none |
| `gemini` | free tier | [aistudio.google.com/apikey](https://aistudio.google.com/apikey), no card |
| `openai` | paid | `OPENAI_API_KEY` |

Copy `server/.env.example` → `server/.env`. A missing key falls back to the mock
rather than refusing to boot.

> Model names change. On HTTP 404 the error names the current one —
> `gemini-2.0-flash` and `2.5-flash` are already retired.

**The offline evaluator** applies rules and quotes real lines, so a God class and
a separated design get different reviews. Its rules cover Parking Lot and Vending
Machine only, so it does two things:

1. **Says so** — a banner while active, a badge on each attempt it judged.
2. **Declines rather than guesses** — no basis on a dimension → *not assessed*,
   and no overall score.

A wrong score is worse than none: you cannot tell it from a real one, and it
contaminates every comparison built on it.

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

`POST` returns 202 once the submission is stored — your work being *safe* and
being *graded* are different guarantees.

The change scenario is withheld **server-side** until unlocked; reading it in the
network tab early would hand you the answer to what it measures.

---

## Limitations

- **Storage is process-scoped** — survives a failed evaluation and a retry, not
  a restart. In scope per the PRD.
- **Scoring drifts slightly between runs.** Fixed bands and temperature 0
  mitigate most of it.
- **The offline evaluator is pattern rules, not comprehension.**
- **The submission format is not polymorphic.** Adding an evaluator is one class
  and one line; adding a *diagram* format would also touch the structural
  evaluator and prompt builder.
- **No confidence score** — abstention does that job better.
- **Client API types are hand-mirrored** from the server DTOs.

**If it grew:** separate the evaluation worker first — the only part that is
slow, fails externally, and scales differently. Swapping `setImmediate` for a
queue touches one method.

**Not built:** auth · databases · queues · UML editors · admin · analytics ·
payments · multiple submission formats · streaming. Out of scope per the PRD.
