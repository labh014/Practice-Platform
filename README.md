# LLD Practice Platform

An LLD practice loop that helps learners understand exactly why their design can
improve, revise it, and see whether the next attempt is actually better.

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

Then open **http://localhost:5173**.

**No API key is required.** The platform ships with an offline evaluator and the
complete loop — submit, evaluate, revise, compare — works with no network access
and no cost. See [Evaluators](#evaluators) to plug in a real model.

| | |
|---|---|
| Client | http://localhost:5173 |
| API | http://localhost:4000/api |
| Tests | `npm test` (160 tests) |
| Typecheck | `npm run typecheck` |

Requires Node 20+ (developed on 22).

---

## What the product is trying to do

Engineers preparing for LLD interviews have no equivalent of LeetCode. They can
practise binary search a hundred times with an instant verdict; they design a
Parking Lot once and have no idea whether what they produced was any good. The
usual fallback — watch someone else's solution and pattern-match — teaches
imitation rather than judgement.

**The missing piece is the feedback signal, not the problem statements.** LLD
problems are freely available everywhere. What does not exist is *"here is what
is specifically wrong with the design you wrote, and why."* So the evaluation
layer is not a feature of this product; it is the product, and everything else is
scaffolding around it.

Three failure modes make that hard, and the design pushes back against each:

| Failure mode | What it looks like | Defence |
|---|---|---|
| **Sycophancy** | "Great use of encapsulation!" on a God class | Written score bands per problem; a 2/5 is a *described* outcome |
| **Genericism** | "Follow SOLID." | Every finding must quote the learner's own text |
| **Hallucination** | Critiquing a `BookingService` they never wrote | Evidence verified against the submission after validation |

---

## Architecture

```
client/                         React + Vite + TypeScript
  api/          typed client over the six endpoints
  components/   workspace (left pane, editors) + feedback (scorecard, cards, delta)
  hooks/        useAsync · useAttemptPolling · useDraft
  pages/        ProblemList · Workspace

server/                         Express + TypeScript
  domain/       problem · submission · attempt · evaluation
  evaluation/   evaluators · prompt · llm · schema · orchestrator
  repositories/ interfaces + in-memory implementations
  application/  AttemptService · ProblemService
  api/          routes · DTOs · validation · error middleware
  seed/         Parking Lot · Vending Machine
```

The dependency arrow points inward. `domain/` imports nothing from
`evaluation/`, `repositories/` or `api/` — verified by the module layout and
kept that way deliberately, because it is what lets a second evaluator or a real
database arrive without touching the model.

### The domain

Invariants are enforced in constructors rather than documented in comments:

- `EvaluationRubric` rejects dimension weights that do not sum to 100
- `EvaluationDimension` rejects score bands that leave a gap in the 0–5 scale —
  a hole means a score the platform cannot describe back to the learner
- `Problem` rejects a change scenario probing a dimension the rubric lacks
- `Attempt` owns its state machine: `COMPLETED` is terminal, `FAILED →
  EVALUATING` is the retry edge, and an illegal transition throws
- `DimensionScore` rejects an unexplained score
- `FeedbackItem` rejects a missing `evidence`, `issue`, `whyItMatters` or
  `suggestion` — there is structurally nowhere to put "follow SOLID"

Because problems are constructed at startup, a malformed rubric fails at boot
with a clear message rather than midway through someone's evaluation.

### The evaluation pipeline

```
  submission
      │
      ▼
  StructuralEvaluator ──── deterministic signals (never a gate, PRD 4.1)
      │
      ▼
  EvaluationPromptBuilder ─ rubric bands · requirements · findings · change scenario
      │
      ▼
  LlmEvaluator ─── LLM call ─── Zod parse ──(fail)──► one repair round ──(fail)──► FAILED
      │
      ▼
  EvidenceVerifier ─────── discards findings quoting text the learner never wrote
      │
      ▼
  WeightedScoreCalculator ─ overall score, computed from dimension scores × weights
      │
      ▼
  ComparisonReportBuilder ─ improvement delta, computed from stored history
      │
      ▼
  EvaluationResult
```

The last three steps are not the model's to decide. **It supplies judgement about
the design; the platform supplies the arithmetic and the guarantees.**

`IEvaluator` is the Strategy seam. Adding a UML or static-analysis evaluator
later means writing one class and registering it in `container.ts` — no change to
the domain, the repositories or the API.

---

## Evaluators

All three sit behind the same `LlmClient` interface, so switching is one
environment variable and changes nothing about how a submission is judged.

| `LLM_PROVIDER` | Cost | Key needed |
|---|---|---|
| `mock` *(default)* | free | none |
| `gemini` | free tier | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — no card |
| `openai` | paid | `OPENAI_API_KEY` |

Copy `server/.env.example` to `server/.env` to configure. If a provider is
selected but its key is missing, the server logs a warning and falls back to the
mock rather than refusing to boot — a platform that cannot start on a fresh
clone is unusable exactly when it most needs to work.

### About the mock

`MockLlmClient` is **not** a canned response. It reads the submission back out of
the prompt and applies rules over what the learner actually wrote, quoting real
lines as evidence. A God class and a well-separated design produce visibly
different reviews.

That matters for two reasons: it is the only evaluator the test suite ever uses
(PRD 7.5), and a static mock would let every downstream assertion pass while
proving nothing. Its own evidence is run through `EvidenceVerifier` in a test —
if it ever invented a snippet, its feedback would be silently discarded by the
platform's own defences and nothing else would notice.

**Its limits, stated plainly:** these are pattern rules, not comprehension. They
recognise the failure modes the two seeded problems are built around and will
miss a novel design's subtler mistakes. That is the honest trade for an evaluator
that always works, and it is why its scores are deliberately conservative — base
3, no free 5s. Grade inflation from the offline evaluator would be the worst
available outcome, because it is what most people will see.

---

## Design decisions

Each of these was a judgement call, raised before implementation and carried
through the build.

### A1 — The change scenario probes one dimension; it is not a sixth requirement

The PRD introduces a change scenario after attempt 1 (*"add EV charging"*) and
also requires attempt 2 to report what improved. **These fight each other.** If
EV charging became a sixth requirement graded under Requirement Completeness,
attempt 2 would be scored against a larger brief than attempt 1 — a learner could
genuinely improve and score *lower*, and the delta would report a regression that
never happened.

Resolution: `ChangeScenario` carries a `probesDimensionId`. It enters the prompt
as an extensibility probe — *"would this design absorb EV charging without
editing existing classes?"* — and is explicitly excluded from every other
dimension. The delta then marks that dimension **bar raised** and leaves it out
of the regression count, so the UI never shows a red arrow for a goalpost the
learner did not move.

### A2 / A3 — The overall score and the delta are computed, never generated

`LlmEvaluationPayloadSchema` is `.strict()` and simply *does not contain*
`overallScore` or `comparison`. A model returning either is rejected. Both are
enforced by tests.

A model left to author its own headline number will eventually return 78
alongside dimension scores of 2, 2, 3, 3, and the learner is left with two
numbers and no way to know which is real. A model asked to narrate its own
improvement will find some — and whether the learner actually got better is the
one claim this product cannot afford to get wrong.

### A4 — Evidence is verified, not requested

The PRD says the model "must not invent classes or methods". That is a request,
not a guarantee. `EvidenceVerifier` checks every snippet against the submission
after validation and discards what it cannot locate.

The bias is deliberately toward discarding. Dropping a real criticism costs the
learner one piece of advice; showing them a critique of a class they never wrote
costs the platform its credibility, and after that they have no reason to believe
the findings that were correct.

### A5 — One schema-repair round, then fail

Models miss schema on trivia far more often than meaningfully — a stray key, a
dimension scored twice. Handing the validation error back once recovers most of
those. Retrying further burns time on a model that has misunderstood the task,
and the learner is better served by a `FAILED` attempt they can retry
deliberately.

### A6 — Two endpoints the contract was missing

- `POST /api/attempts/:id/retry` — `FAILED` was otherwise a state with no exit.
  Retry re-evaluates the **stored** submission; nothing is retyped.
- `GET /api/problems/:id` — the workspace has to survive a page refresh.

### A10 — Structural findings live on the `Attempt`, not the result

So they survive a failed evaluation. When the LLM step falls over, the learner
still sees the objective observations about their submission instead of a blank
screen.

### A12 — Empty submissions are accepted and evaluated

PRD 7.1 requires an empty submission to produce structural signals; PRD 4.1
forbids those signals from short-circuiting the evaluator. Taken together,
emptiness is something the platform reports on rather than refuses at the door. A
scored explanation of why nothing scores nothing teaches more than a 400 does.

---

## Deviations from the specification

Three, each with reasoning:

**`IEvaluator` returns `EvaluationOutput`, not `EvaluationFinding[]`.** The
specified signature carries the structural evaluator's output but not the
semantic one's — dimension scores, strengths, feedback and trade-offs have
nowhere to go. Widening it to an object whose every field is an array (empty when
an evaluator has no opinion) keeps the Strategy pattern and lets the orchestrator
merge N evaluators with no per-evaluator branching.

**The improvement delta renders after the scorecard, not last.** The PRD lists it
fourth among things to display. *"Did I get better"* is the question a returning
learner opens the page to answer, and it reads as one thought with the scores it
compares.

**A `GeminiLlmClient` sits alongside the specified OpenAI client.** OpenAI is the
project's only paid dependency, and a learner platform whose evaluation cannot be
demonstrated without a credit card cannot be demonstrated.

---

## API

| Method | Route | |
|---|---|---|
| `GET` | `/api/problems?userId=` | Catalogue with the learner's progress |
| `GET` | `/api/problems/:id?userId=` | Problem detail *(A6)* |
| `GET` | `/api/problems/:id/attempts?userId=` | Attempt history |
| `POST` | `/api/attempts` | Submit → `202 {attemptId, status}` |
| `GET` | `/api/attempts/:id` | Poll for the result |
| `POST` | `/api/attempts/:id/retry` | Re-evaluate a failed attempt *(A6)* |

`POST /api/attempts` returns **202** as soon as the submission is stored, with
evaluation scheduled on the event loop. The learner's work being *safe* and the
learner's work being *graded* are different guarantees, and only the first should
make them wait.

The change scenario is **withheld server-side** until unlocked, not merely hidden
by the UI. It is the extensibility question; a learner reading the network tab
before their first attempt would be handed the answer to what it measures.

---

## Testing

```bash
npm test          # 160 tests
```

No test touches the network — `MockLlmClient` and stub clients throughout
(PRD 7.5). Coverage of the behaviour that matters:

| Area | What is pinned |
|---|---|
| Domain | rubric weights, band coverage, attempt state machine, unexplained scores |
| Structural | empty and thin submissions, type detection across notations |
| Schema | `overallScore` and `comparison` rejected; fenced JSON tolerated |
| Orchestrator | repair round, fabricated evidence discarded, weighted arithmetic |
| Comparison | per-dimension deltas, `scopeChanged`, resolved vs persisting |
| Repository | round-trip, attempt numbering, failed attempts skipped |
| API | 28 tests driving the real routes through the real stack via supertest |
| Seed | both problems construct; band text is problem-specific |

---

## Known limitations

**Storage is process-scoped.** Attempts survive a failed evaluation and a retry,
which is what the learner-facing guarantee requires, but not a server restart.
In scope per PRD 2.1 — noted so a demo is not run across a dev-server restart.

**Scoring can drift between runs.** Identical submissions may score slightly
differently. Fixed band descriptors and temperature 0 mitigate most of it; some
residual is inherent to LLM evaluation.

**The mock is rule-based.** See [About the mock](#about-the-mock).

**Client API types are hand-mirrored** from the server DTOs rather than shared
through a third package — real build complexity for ~100 lines of types on a
two-day build. Both copies are kept structurally identical so a diff reads
cleanly.

---

## Not built

Authentication · databases · message queues · visual UML editors · admin tooling ·
analytics dashboards · social features · payments · certifications · multiple
submission formats · response streaming.

All out of scope per PRD 2.2, and none of it would have made the practice loop
better.
