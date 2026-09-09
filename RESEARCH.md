# Research

Three hours on how LLD practice works today, before settling the MVP scope.
What changed my mind, not a survey.

## What I looked at

| | |
|---|---|
| [CodeZym](https://codezym.com/about) | Online judge — submit code, run against test cases |
| [LLD Problems](https://www.lldproblems.com/) | 100+ problems with reference solutions and diagrams |
| [awesome-low-level-design](https://github.com/ashishps1/awesome-low-level-design) | Curated problems by difficulty, with solutions |
| [kumaransg/LLD](https://github.com/kumaransg/LLD) | Company-tagged questions, 90-minute format |
| [interviewing.io](https://interviewing.io) | Human expert feedback, ~$179/session |
| [Exponent / Aced](https://www.tryexponent.com/practice/ai-mock-interviews) | Peer sessions plus an AI rubric layer |
| [Rubric Is All You Need (ICER 2025)](https://arxiv.org/abs/2503.23989) | LLM code evaluation with question-specific rubrics |

---

## What I found

**Workflow.** Two shapes, neither closes the loop. *Read-and-compare* — read a
problem, write a design elsewhere, read the reference solution, judge yourself;
there is no submit step at all. Or *timed machine coding*, which ends at the
verdict. Neither has a **revise** step. Nothing carries from attempt 1 into
attempt 2.

**Submission.** Code, almost everywhere. Diagrams appear as material to read,
not to submit. Nobody asks for the **reasoning** — yet that is what an
interviewer probes, and the part a reference solution cannot teach, because
reading someone else's answer tells you what they chose, not whether your reason
was sound.

**Feedback.** Four models, with a clear hole:

| Model | Where | Measures |
|---|---|---|
| Test cases | CodeZym | Behaviour |
| Reference solution | GitHub repos | Whatever you notice yourself |
| Human expert | interviewing.io | Design quality — $179, not repeatable |
| AI + rubric | Exponent/Aced | Communication — for *behavioural* interviews |

**The finding that mattered:** CodeZym states that submissions are "tested
against all test cases, just like LeetCode or any other online judge."

**A God class passes every test case.** So does a design with no abstraction,
hard-coded pricing, and four responsibilities in one type. Test cases verify the
code *works*; the interview is about whether the design is *good*. The one
automated, zero-cost, repeatable mechanism in this space measures the wrong
thing — and the only thing measuring the right thing costs $179 a session.

**Learning loop.** Essentially absent. Nothing tracks that you have now been
told about coupling on three different problems. That is the cheapest thing to
build here, because it is arithmetic over stored results.

---

## What it changed

**Three-field text, not code, not diagrams.** I had assumed code — but code is
what everyone already collects, and a test-case judge handles it better than we
could. The un-served part is the reasoning. Diagrams were rejected on cost: a
drag-drop editor is most of a two-day budget and adds no evidence that named
classes don't.

**Rubric per problem, not shared.** I had planned one shared rubric. The ICER
paper found question-specific rubrics outperform question-agnostic ones, because
generic criteria miss a problem's nuances. Hence per-problem band text —
"ParkingLot coordinates allocation and pricing rather than implementing them" is
a standard; "well separated" is not.

**Guard leniency explicitly.** The same paper introduces *Leniency* — how much
more generous a model is than an expert. Other work notes LLM judges carry
verbosity and self-preference bias and vary between runs. Knowing it had a name
shaped the design: written 0–5 bands, temperature 0, and evidence verified
afterward rather than merely requested.

**No reference solutions.** Every repo leads with them, and they teach
imitation. Two very different designs can both be excellent, so feedback is
graded against a rubric instead.

---

## What I would change about what exists

1. Judge the design, not the behaviour — test cases cannot see a God class.
2. Ask for the reasoning; it is what the interview is about.
3. Make the second attempt the point.
4. Say what the evaluator can and cannot judge.

The first three became the MVP. The fourth became abstention.

**Limitations.** Three hours, English sources, and the paid tiers of LLD
Problems and Exponent were not purchased — their feedback quality is inferred
from marketing copy, which overstates. Weakest claim is that nothing tracks
recurring weakness; a paid tier may well do so.
