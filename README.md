# LLD Practice Platform

Practise low-level design, get feedback grounded in what you actually wrote,
revise it, and see whether the next attempt is genuinely better.

```
choose a problem → write a design → submit → evidence-backed feedback
        ↑                                             ↓
        └──────────── revise ←──── see what moved ────┘
```

---

## Quick start

```bash
npm install
npm run dev
```

Open **http://localhost:5173**. No API key needed — the platform ships with an
offline evaluator and the whole loop works with no network and no cost.

| | |
|---|---|
| Client | http://localhost:5173 |
| API | http://localhost:4000/api |
| Tests | `npm test` — 168 tests, no network |
| Typecheck | `npm run typecheck` |

Node 20+ required.

---

## The problem it solves

You can practise DSA on LeetCode and get an instant verdict. You design a
Parking Lot once and have no idea whether it was any good. Problem statements
are everywhere; **the missing thing is the feedback**.

So the evaluation layer is the product. Three failure modes it guards against:

| Risk | Guard |
|---|---|
| Sycophancy — "great use of encapsulation!" on a God class | Written score bands per problem; a 2/5 is a *described* outcome |
| Genericism — "follow SOLID" | Every finding must quote your own text |
| Hallucination — critiquing a class you never wrote | Evidence verified against the submission |

---

## Architecture

```
client/    React + Vite + TS   api · components · hooks · pages
server/    Express + TS        domain · evaluation · repositories
                               application · api · seed
```

`domain/` imports nothing from the layers outside it. That is what lets a new
evaluator or a real database arrive without touching the model.

### Domain invariants

Enforced in constructors, not documented in comments:

- Rubric weights must sum to 100
- Score bands must cover the whole 0–5 scale
- A change scenario must probe a dimension that exists
- `Attempt` owns its state machine — `COMPLETED` is terminal, `FAILED →
  EVALUATING` is the retry edge
- A `FeedbackItem` without evidence, issue, reason and suggestion cannot be
  constructed — there is nowhere to put "follow SOLID"

Problems are built at startup, so a malformed rubric fails at boot rather than
mid-evaluation.

### The evaluation pipeline

```
submission
   → structural checks        deterministic; signals, never a gate
   → prompt                   rubric bands · requirements · findings
   → evaluator                mock | gemini | openai
   → Zod validation           one repair round, then FAILED
   → evidence verification    drops quotes not found in the submission
   → weighted score           computed, never model-authored
   → improvement delta        computed from stored history
```

The last three are not the model's to decide. **It supplies judgement about the
design; the platform supplies the arithmetic and the guarantees.**

---

## Evaluators

| `LLM_PROVIDER` | Cost | Key |
|---|---|---|
| `mock` *(default)* | free | none |
| `gemini` | free tier | [aistudio.google.com/apikey](https://aistudio.google.com/apikey), no card |
| `openai` | paid | `OPENAI_API_KEY` |

Copy `server/.env.example` to `server/.env` to configure. A missing key logs a
warning and falls back to the mock rather than refusing to boot.

> Model names change. If you get an HTTP 404, the error body names the current
> model — `gemini-2.0-flash` and `gemini-2.5-flash` are both already retired.

### The offline evaluator

`MockLlmClient` is not a canned response. It reads the submission and applies
rules, quoting real lines as evidence. A God class and a separated design get
visibly different reviews.

**It is pattern rules, not comprehension.** It recognises the mistakes the two
seeded problems are built around and will miss subtler ones. Two things follow:

1. **It says so.** A banner while it is active, and a badge on every attempt it
   judged — because history outlives configuration.
2. **It declines rather than guesses.** When its rules find nothing on a
   dimension, that dimension returns *not assessed* and the overall score
   returns *not scored*.

That second point is the important one. A wrong score is worse than no score:
the learner cannot tell it from a real one, and it contaminates every
improvement comparison built on top of it. The platform already deletes feedback
it cannot ground in the submission — a number it cannot justify gets the same
treatment.

Abstention is per-dimension, because the rules genuinely know some axes and not
others on the same submission. Detecting that no interface exists says something
real about coupling and nothing about cohesion.

---

## Design decisions

**The change scenario probes one dimension; it is not a sixth requirement.**
The PRD reveals "add EV charging" after attempt 1 and also asks attempt 2 to
report what improved. These conflict: graded as a new requirement, a learner
could improve and score *lower*, and the delta would report a regression that
never happened. Instead it feeds Extensibility only, and that dimension is
marked **bar raised** and excluded from the regression count.

**The overall score and the delta are computed, never generated.** The Zod
schema does not contain `overallScore` or `comparison`, so a model returning
either is rejected. A model left to author its own headline number will return
78 alongside scores of 2, 2, 3, 3. A model asked whether you improved will say
yes.

**Evidence is verified, not requested.** Every snippet is checked against the
submission after validation and discarded if absent. Dropping a real criticism
costs one piece of advice; critiquing a class you never wrote costs the platform
its credibility.

**One schema-repair round, then fail.** Models miss schema on trivia. One
corrective nudge recovers most of it; more would burn time on a model that has
misunderstood the task.

**Two endpoints added to the contract.** `POST /api/attempts/:id/retry` —
`FAILED` was otherwise a state with no exit, and retry re-evaluates the *stored*
submission. `GET /api/problems/:id` — the workspace must survive a refresh.

**Empty submissions are accepted and evaluated.** A scored explanation of why
nothing scores nothing teaches more than a 400 does.

---

## Deviations from the spec

**`IEvaluator` returns `EvaluationOutput`, not `EvaluationFinding[]`.** The
specified signature carries the structural evaluator's output but not the
semantic one's. Every field is an array, empty when an evaluator has no opinion.

**The improvement delta renders after the scorecard, not last.** "Did I get
better" is the question a returning learner opens the page to answer.

**A Gemini client sits alongside the specified OpenAI one.** OpenAI is the only
paid dependency, and evaluation that cannot be demonstrated without a credit
card cannot be demonstrated.

---

## API

| Method | Route | |
|---|---|---|
| `GET` | `/api/health` | Status and which evaluator is running |
| `GET` | `/api/problems` | Catalogue with the learner's progress |
| `GET` | `/api/problems/:id` | Problem detail |
| `GET` | `/api/problems/:id/attempts` | Attempt history |
| `POST` | `/api/attempts` | Submit → `202 {attemptId, status}` |
| `GET` | `/api/attempts/:id` | Poll for the result |
| `POST` | `/api/attempts/:id/retry` | Re-evaluate a failed attempt |

`POST /api/attempts` returns **202** as soon as the submission is stored. Your
work being *safe* and your work being *graded* are different guarantees; only
the first should make you wait.

The change scenario is **withheld server-side** until unlocked. It is the
extensibility question — reading it in the network tab before attempt 1 would
hand you the answer to what it measures.

---

## Testing

```bash
npm test      # 168 tests
```

No test touches the network. Coverage sits on the behaviour that matters: domain
invariants, structural checks, schema rejection of `overallScore`, the repair
round, fabricated evidence being discarded, weighted arithmetic, abstention,
comparison deltas, repository round-trips, and 30 API tests driving the real
routes through the real stack.

---

## Known limitations

- **Storage is process-scoped.** Attempts survive a failed evaluation and a
  retry, but not a server restart. In scope per the PRD.
- **Scoring can drift between runs.** Fixed bands and temperature 0 mitigate
  most of it; some residual is inherent to LLM evaluation.
- **The mock is rule-based** — see above. It now abstains rather than guessing,
  but it is still not comprehension.
- **Client API types are hand-mirrored** from the server DTOs rather than shared
  through a third package.

## Not built

Auth · databases · queues · UML editors · admin · analytics · payments ·
multiple submission formats · streaming. All out of scope per the PRD.
