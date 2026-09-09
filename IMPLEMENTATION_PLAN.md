# Decisions

The assumptions this build was made under, settled before implementation from
gaps and contradictions in the PRD. Code comments cite these by number.

The build followed the provided execution plan's Steps 1–4, extended with the
frontend, seed content and test layers it did not cover.

---

| # | Assumption | Why |
|---|---|---|
| **A1** | The change scenario feeds the **Extensibility** dimension; it is not a sixth requirement | Otherwise attempt 2 is graded against a wider brief than attempt 1, so a learner could improve and score *lower* — and the improvement delta would report a regression that never happened |
| **A2** | `overallScore` is **computed** from dimension scores × weights, never authored by the evaluator | A model-authored total can contradict its own dimension scores; computing it makes the number auditable |
| **A3** | The comparison report is **computed** from stored history, outside the LLM schema | A model asked to narrate its own improvement will find some |
| **A4** | Evidence snippets are **verified** against the submission after validation | Turns "do not invent classes" from a prompt request into an enforced invariant |
| **A5** | One **schema-repair retry** before `FAILED` | Models miss schema on trivia; one nudge recovers most, more burns time on a model that misunderstood the task |
| **A6** | Two endpoints added: `POST /attempts/:id/retry`, `GET /problems/:id` | `FAILED` was otherwise terminal with no exit; the workspace must survive a refresh |
| **A7** | Missing API key → fall back to the offline evaluator with a startup notice | A platform that cannot boot on a fresh clone is unusable exactly when it matters |
| **A8** | Dimensions scored **0–5**, overall **0–100** via percentage weights | PRD §6.2 shows "Coupling 4/5"; weights sum to 100 |
| **A9** | Severity `CRITICAL`/`MAJOR`/`MINOR`; trade-offs as `{decision, upside, downside}` | Unspecified in the PRD; structured beats prose |
| **A10** | Structural findings live on the `Attempt`, not only the result | So they survive a failed evaluation and the learner still sees something |
| **A11** | `userId` hardcoded `learner_1`, passed explicitly per the contract | Auth out of scope |
| **A12** | Empty submissions are **accepted and evaluated** | PRD §7.1 requires structural signals; §4.1 forbids gating on them |

---

## Deviations from the specification

**`IEvaluator` returns `EvaluationOutput`, not `EvaluationFinding[]`.** The
specified signature carries the structural evaluator's output but not the
semantic one's — dimension scores, strengths, feedback and trade-offs have
nowhere to go. Every field is an array, empty when an evaluator has no opinion,
so the orchestrator merges N evaluators with no branching.

**The improvement delta renders after the scorecard, not last.** "Did I get
better" is the question a returning learner opens the page to answer.

**A Gemini client sits alongside the specified OpenAI one.** OpenAI is the only
paid dependency, and evaluation that cannot be shown without a credit card
cannot be shown.

---

## Added after the build

Two changes came from testing rather than planning, both recorded in
[AI_USAGE.md](AI_USAGE.md):

- **Abstention.** Dimension scores and the overall score are nullable. When the
  offline evaluator has no basis to judge a dimension it returns *not assessed*
  rather than a baseline number.
- **In-flight deduplication.** A resubmitted identical request returns the
  attempt already pending instead of creating a second one.
