# LLD Practice Platform — Implementation Plan

> This plan **sequences and extends** the provided execution plan; it does not replace it.
> Execution-plan Steps 1–4 map to Phases 1–5 below. Frontend, seed content, and test
> layers are added where the original plan stopped.
>
> **Source of truth:** the PRD and execution plan. This document is the build order.

---

## 0. Carried-forward assumptions

These are the defaults the build proceeds under. Each traces back to a contradiction or
gap raised in the implementation-readiness review.

| # | Assumption | Rationale |
|---|---|---|
| A1 | `ChangeScenario` (CS-1) feeds the **Extensibility & Trade-offs** dimension as a probe, **not** a 6th `Requirement` | If CS-1 became a new requirement, attempt 2 would be graded against a larger set than attempt 1 — a learner could improve and score lower, corrupting the Improvement Delta |
| A2 | `overallScore` is **computed** by the orchestrator from `DimensionScore[]` × weights, never authored by the LLM | An LLM-authored overall can contradict its own dimension scores; computing it makes the number auditable |
| A3 | `ComparisonReport` is **computed** deterministically, outside the LLM Zod schema | A hallucinated delta would corrupt the product's central claim about improvement |
| A4 | Every `evidence` snippet is **verified** against the submission text after Zod validation | Turns "the LLM must not invent classes" from a prompt request into an enforced invariant |
| A5 | One **schema-repair retry** (re-prompt with the Zod error) before marking `FAILED` | LLMs miss schema on trivialities; one bounded retry, no queue or backoff machinery |
| A6 | Two endpoints added: `POST /api/attempts/:attemptId/retry`, `GET /api/problems/:problemId` | `FAILED` is otherwise a terminal state with no exit; problem detail is needed for refresh/deep-link |
| A7 | `OpenAiLlmClient` as specified. Missing `OPENAI_API_KEY` → auto-fallback to `MockLlmClient` with a startup log | Whole flow must demo offline |
| A8 | Scales: dimension scores **0–5**, overall **0–100** via percentage weights | PRD §6.2 shows "Coupling 4/5"; weights sum to 100 |
| A9 | Severity enum: `CRITICAL` / `MAJOR` / `MINOR`. `tradeOffs` shape: `{ decision, upside, downside }[]` | Unspecified in PRD; structured over prose blobs |
| A10 | Structural findings feed the prompt **and** are retained on the result for transparency; learner-facing cards come from the LLM | PRD §4.1 — signals, not gatekeepers |
| A11 | `userId` hardcoded `learner_1`, passed explicitly in body/query per the API contract | Auth out of scope |
| A12 | Empty submissions are **accepted**, generate structural signals, and still reach the LLM | PRD §7.1 requires signals; §4.1 forbids skipping the LLM |

---

## 1. Repository layout

```
E:\Assignment
├── server/
│   └── src/
│       ├── domain/
│       │   ├── problem/       Problem, Requirement, EvaluationRubric,
│       │   │                  EvaluationDimension, ChangeScenario, Importance
│       │   ├── submission/    Submission
│       │   ├── attempt/       Attempt, AttemptStatus
│       │   ├── evaluation/    EvaluationResult, DimensionScore, FeedbackItem,
│       │   │                  EvaluationFinding, TradeOff, ComparisonReport, Severity
│       │   └── shared/        value objects, domain errors
│       ├── evaluation/
│       │   ├── evaluators/    IEvaluator, StructuralEvaluator, LlmEvaluator
│       │   ├── prompt/        EvaluationPromptBuilder
│       │   ├── llm/           LlmClient, OpenAiLlmClient, MockLlmClient
│       │   ├── schema/        LlmEvaluationPayloadSchema (Zod)
│       │   └── orchestrator/  EvaluationOrchestrator, EvidenceVerifier,
│       │                      WeightedScoreCalculator, ComparisonReportBuilder
│       ├── repositories/      IAttemptRepository, InMemoryAttemptRepository,
│       │                      IProblemRepository, InMemoryProblemRepository
│       ├── application/       AttemptService, ProblemService
│       ├── api/               routes, request validation, error middleware
│       ├── seed/              parkingLot.ts, vendingMachine.ts
│       └── __tests__/
├── client/
│   └── src/
│       ├── api/               typed API client
│       ├── components/        workspace, feedback, history
│       ├── pages/             ProblemList, Workspace
│       ├── hooks/             usePolling, useAttempt
│       └── types/             shared DTOs
├── IMPLEMENTATION_PLAN.md
└── README.md
```

---

## 2. Phases

### Phase 0 — Scaffold  `[XS]`

Two packages (`server`, `client`). TypeScript `strict: true` throughout. Root scripts for
concurrent dev. Vite + React + TS on the client; Express + tsx on the server.

**Exit criteria:** `npm run dev` boots both; `GET /api/health` returns 200.

---

### Phase 1 — Domain Layer  `[M]`   *(execution plan Step 1)*

Classes, not loose objects. Invariants enforced in constructors.

| Module | Contents |
|---|---|
| `domain/problem` | `Problem`, `Requirement`, `Importance`, `EvaluationRubric`, `EvaluationDimension`, `ChangeScenario` |
| `domain/submission` | `Submission` — `designSkeleton`, `designDecisions`, `assumptions` |
| `domain/attempt` | `Attempt`, `AttemptStatus` |
| `domain/evaluation` | `EvaluationResult`, `DimensionScore`, `FeedbackItem`, `EvaluationFinding`, `TradeOff`, `ComparisonReport`, `Severity` |

Two invariants enforced here — cheap, and exactly what a reviewer looks for:

- `EvaluationRubric` rejects dimension weights that do not sum to 100.
- `Attempt` enforces its own state machine. `complete()` on a `FAILED` attempt throws
  rather than silently mutating.

`FeedbackItem` carries a `dimensionId`, linking every criticism to the rubric dimension it
cost points on — closing the loop between "2/5 on Coupling" and the reason why.

**Exit criteria:** compiles clean; `domain/` has zero imports from `evaluation/`, `api/`,
or `repositories/`.

---

### Phase 2 — Evaluation Contracts, Structural Evaluator, Prompt  `[M]`   *(Step 2)*

- **`LlmEvaluationPayloadSchema` (Zod)** — deliberately narrower than the domain
  `EvaluationResult`. It omits `overallScore` and `comparisonReport` because the LLM does
  not author those (A2, A3). Naming it distinctly prevents the schema drifting into
  "whatever the LLM felt like returning."
- **`IEvaluator`** + `EvaluationContext` (problem, submission, prior attempt, active
  change scenario).
- **`StructuralEvaluator`** — deterministic checks, each emitting a coded
  `EvaluationFinding`:
  - empty design skeleton
  - skeleton below length floor
  - no class/interface declaration detected
  - no methods detected
  - thin design decisions
  - thin assumptions
  - single-class design (God-object signal)
- **`EvaluationPromptBuilder`** — injects requirements, rubric criteria **with 0–5 band
  descriptors**, structural findings, the change scenario when active, and the evidence
  contract.

**Exit criteria:** structural evaluator unit-tested; built prompt readable end to end.

---

### Phase 3 — LLM Client & Orchestrator  `[L]`   *(Step 3)*

- **`LlmClient`** interface.
- **`MockLlmClient`** — **input-reactive, not static.** It inspects the submission and
  emits findings that genuinely correspond to it (e.g. payment logic detected inside
  `ParkingLot` → the cohesion finding, with a real snippet as evidence). A static mock
  makes the offline demo feel fake and makes tests prove nothing.
- **`OpenAiLlmClient`** — JSON mode, temperature 0.
- **`EvaluationOrchestrator`** — pipeline:

  ```
  structural findings
        → prompt
        → LLM call
        → Zod parse  ──(fail)──> one repair retry ──(fail)──> FAILED
        → evidence verification
        → assemble EvaluationResult
        → compute weighted overall score
        → build ComparisonReport vs. previous COMPLETED attempt
  ```

Three collaborators kept separate and independently testable rather than buried inside the
orchestrator: `EvidenceVerifier`, `WeightedScoreCalculator`, `ComparisonReportBuilder`.

**Exit criteria:** orchestrator produces a valid `EvaluationResult` against
`MockLlmClient` with zero network access.

---

### Phase 4 — Repositories & Seed Content  `[M]`   *(Step 4, part 1)*

`IAttemptRepository` / `InMemoryAttemptRepository` over a `Map`, plus the problem
repository.

Seed authoring is real work, not filler. The rubric **band descriptors are the primary
anti-sycophancy mechanism** — they make a 2/5 a defined outcome rather than a reluctant
one.

- **Parking Lot** — R1–R5 and the 4 × 25% rubric exactly as the execution plan specifies.
  CS-1: EV charging spots; fee = duration + electricity consumed.
- **Vending Machine** — authored to match. CS-1 analogue: *"Support cashless payment (UPI
  and card) alongside coins and notes"* — probes payment abstraction the way EV charging
  probes pricing.

**Exit criteria:** both problems fully populated with 0–5 criteria per dimension.

---

### Phase 5 — Application Service & REST API  `[M]`   *(Step 4, part 2)*

`AttemptService` — `submit`, `getById`, `listForProblem`, `retry`.
Express routes, Zod request validation, error middleware, and the `setImmediate` dispatch
so `POST /api/attempts` returns `EVALUATING` without blocking.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/problems` | List problems |
| GET | `/api/problems/:problemId` | Problem detail *(A6)* |
| GET | `/api/problems/:problemId/attempts?userId=` | Attempt history |
| POST | `/api/attempts` | Submit — returns `{ attemptId, status: "EVALUATING" }` |
| GET | `/api/attempts/:attemptId` | Poll for result |
| POST | `/api/attempts/:attemptId/retry` | Re-evaluate stored submission *(A6)* |

**Exit criteria:** full loop drivable from curl — submit, poll, receive feedback, retry.

---

### Phase 6 — Backend Tests  `[S]`

| # | Test | Source |
|---|---|---|
| 1 | Empty/short submission produces correct structural signals | PRD §7.1 |
| 2 | `InMemoryAttemptRepository` save/retrieve round-trip | PRD §7.2 |
| 3 | Valid LLM output passes Zod → attempt `COMPLETED` | PRD §7.3 |
| 4 | Malformed LLM output → `FAILED`, submission retained | PRD §7.4 |
| 5 | `MockLlmClient` used throughout; no network calls | PRD §7.5 |
| 6 | Weighted overall score arithmetic | A2 |
| 7 | Fabricated evidence is caught and dropped | A4 |
| 8 | `ComparisonReport` computes correct per-dimension delta | A3 |
| 9 | `Attempt` rejects illegal state transitions | Phase 1 invariant |
| 10 | `EvaluationRubric` rejects weights ≠ 100 | Phase 1 invariant |
| 11 | Retry on `FAILED` re-evaluates the stored submission | A6 |
| 12 | CS-1 enters evaluation context only from attempt 2 | A1 |

Twelve rather than the PRD's 7–10; the extra three pin invariants introduced by A2–A4.

---

### Phase 7 — Client Foundation  `[S]`

Typed API client, DTOs shared with the server, routing, and a problem list showing attempt
count and best score per problem.

---

### Phase 8 — Dual-Pane Workspace  `[M]`   *(PRD §6.1)*

- **Left pane:** requirements with importance badges, change scenario once unlocked,
  attempt history rail.
- **Right pane (pre-submit):** the three editors — Design Skeleton, Design Decisions,
  Assumptions — with guidance placeholders.
- Submit transitions to `EVALUATING`.

---

### Phase 9 — Evaluation & Feedback Rendering  `[L]`   *(PRD §6.2)*

Polling with a visible in-progress state. The learner's design stays pinned at the top;
feedback renders below it.

Renders: overall score, dimension scores, strengths, feedback cards
(**severity, category, evidence snippet, issue, why it matters, suggestion**), and
trade-offs. A `FAILED` attempt renders a retry affordance and never loses the submission.

---

### Phase 10 — History, Delta & Retry  `[M]`

Attempt list with per-dimension score trend, the Improvement Delta on attempts > 1, and a
review view for any past attempt.

This phase is what makes the product *about improvement* rather than about scoring. It
gets real attention, not a table dump. Where CS-1 has shifted the extensibility goalposts,
the delta labels that dimension as scope-changed rather than reporting a false regression
(A1).

---

### Phase 11 — Polish & Documentation  `[S]`

Empty / loading / error states, `README.md` covering architecture rationale and the design
decisions in §0, `.env.example`.

---

## 3. Effort weighting

| Area | Share |
|---|---|
| Backend (Phases 1–6) | 45% |
| Frontend (Phases 7–10) | 35% |
| Seed content (Phase 4) | 10% |
| Tests (Phase 6) | 10% |

Heaviest single phases: **3** (orchestrator) and **9–10** (feedback + delta) — correctly,
since those *are* the product.

---

## 4. Explicitly out of scope

Authentication · real databases · message queues · visual UML editors · admin tooling ·
analytics dashboards · social features · payments · multiple submission formats ·
response streaming · retry/backoff machinery beyond the single schema repair (A5).

---

## 5. Working cadence

Implementation stops for confirmation at the end of each phase, per the execution plan's
instruction to wait between steps. No code is truncated.

---

## 6. Known limitations

- **In-memory storage is process-scoped.** Submissions survive evaluation failure and
  retry within a running process, but not a server restart. Explicitly in scope per PRD
  §2.1 — noted so the demo is not run across a dev-server restart.
- **Scoring drift.** Identical submissions may score slightly differently across runs.
  Fixed band descriptors plus temperature 0 mitigate most of this; some residual remains
  and is inherent to LLM evaluation.
