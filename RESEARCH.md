# Research

About three hours spent looking at how LLD practice actually works today, before
settling the MVP scope. Notes below are what changed my mind, not a survey.

---

## What I looked at

| | What it is |
|---|---|
| [CodeZym](https://codezym.com/about) | LLD practice with an online judge — submit code, run against test cases |
| [LLD Problems](https://www.lldproblems.com/) | 100+ problems with reference solutions, class diagrams, chat-based simulation |
| [awesome-low-level-design](https://github.com/ashishps1/awesome-low-level-design) | Curated problems by difficulty, with reference solutions |
| [kumaransg/LLD](https://github.com/kumaransg/LLD) | Company-tagged machine-coding questions, 90-minute format |
| [interviewing.io](https://interviewing.io) | Human expert feedback, ~$179/session |
| [Exponent / Aced](https://www.tryexponent.com/practice/ai-mock-interviews) | Peer sessions plus an AI rubric-scoring layer |
| [Rubric Is All You Need (ICER 2025)](https://arxiv.org/abs/2503.23989) | LLM code evaluation with question-specific rubrics |

---

## The four questions

### Practice workflow

Two shapes, and neither closes the loop.

**Read-and-compare** (awesome-low-level-design, kumaransg/LLD, most of LLD
Problems). Read a problem, write a design somewhere else, read the reference
solution, decide for yourself how you did. There is no submit step at all.

**Timed machine coding** (CodeZym, the 90-minute format). Closer to the real
interview, but the workflow ends at the verdict.

Neither has a **revise** step. You attempt a problem once and move on. Nothing
carries from attempt 1 into attempt 2.

### Submission format

Code, almost everywhere. Reference material adds UML class diagrams, but as
*output* to read, not something you submit.

Nobody I found asks for the **reasoning**. Yet the reasoning is what an
interviewer actually probes — "why did you split it there?" — and it is the part
a reference solution cannot teach you, because reading someone else's answer
tells you what they chose, not whether your reason was sound.

### Feedback

Four models, with a clear gap between them:

| Model | Where | What it measures |
|---|---|---|
| Test cases | CodeZym | Behaviour |
| Reference solution | GitHub repos, LLD Problems | Whatever you notice yourself |
| Human expert | interviewing.io | Design quality — but $179 and not repeatable |
| AI + rubric | Exponent/Aced | Communication, structure — for *behavioural* and system design |

**The important finding is CodeZym.** It states plainly that a submission is
"tested against all test cases, just like LeetCode or any other online judge."

That is a real gap, not a small one. **A God class passes every test case.** So
does a design with no abstraction anywhere, hard-coded pricing, and four
responsibilities in one type. Test cases verify that the code *works*; the LLD
interview is about whether the design is *good*. The one automated,
zero-cost, repeatable feedback mechanism in this space measures the wrong thing.

The only thing measuring the right thing is a human, at $179 a session.

### Learning loop

Essentially absent. LLD Problems has "gamified progression" unlocking levels by
performance, which is the closest anything comes. Nothing I found tracks
recurring weakness — that you have now been told about coupling on three
different problems.

That is the real product opportunity, and the cheapest to build, because it is
arithmetic over stored results rather than any kind of intelligence.

---

## What the research changed

**Three-field text, not code, and not diagrams.**
I had assumed code. But code is what everyone already collects, and it is
precisely what a test-case judge already handles better than we could. The
un-served part is the reasoning. So the submission is design skeleton +
decisions + assumptions: enough structure to anchor evidence against, and it
captures the half nobody asks for. Diagrams were rejected on cost — a drag-drop
editor is most of a two-day budget and adds no evidence text-based classes don't.

**Rubric per problem, not shared.**
I had planned one shared rubric. The ICER paper reports that question-specific
rubrics outperform question-agnostic ones for logical assessment, because generic
criteria miss the nuances of a specific problem. That is why each seeded problem
carries its own written band text — "ParkingLot coordinates allocation and
pricing rather than implementing them" is a standard; "well separated" is not.

**Guard against leniency explicitly.**
The same paper introduces a metric called *Leniency* — how much more generous a
model is than an expert. Other work notes LLM judges carry verbosity and
self-preference biases and vary between runs on the same input. Knowing this had
a name changed the design: written 0–5 bands so a 2 is a described outcome,
temperature 0, and evidence verified against the submission afterward rather than
merely requested in the prompt.

**No reference solutions.**
Every repo leads with them. They teach imitation — you compare your answer to
one good answer and conclude you should have written that. Two very different
designs can both be excellent, so feedback is graded against a rubric instead.

---

## What I would change about what exists

1. **Judge the design, not the behaviour.** Test cases cannot see a God class.
2. **Ask for the reasoning.** It is the half the interview is actually about.
3. **Make the second attempt the point.** Every tool treats a problem as
   something you do once.
4. **Say what the evaluator can and cannot judge.** Nothing I looked at
   distinguishes a confident assessment from a guess.

The first three are the MVP. The fourth became the abstention behaviour.

---

## Honest limitations

Three hours, US-facing English sources, and the paid tiers of LLD Problems and
Exponent were not purchased — their feedback quality is inferred from marketing
copy, which overstates. Weakest claim here is that nothing tracks recurring
weakness; a paid tier may well do so.

## Sources

- [CodeZym — About](https://codezym.com/about)
- [LLD Problems](https://www.lldproblems.com/)
- [awesome-low-level-design](https://github.com/ashishps1/awesome-low-level-design)
- [kumaransg/LLD](https://github.com/kumaransg/LLD)
- [Exponent / Aced — AI mock interviews](https://www.tryexponent.com/practice/ai-mock-interviews)
- [Best AI mock interview platforms (2026)](https://spacecomplexity.ai/blog/best-ai-mock-interview-platforms)
- [Rubric Is All You Need (arXiv 2503.23989)](https://arxiv.org/abs/2503.23989)
- [How to write reliable rubrics for LLM-as-a-judge](https://dev.to/googleai/how-to-write-reliable-rubrics-for-llm-as-a-judge-ndp)
- [Rubric-based evals and LLM-as-a-judge](https://medium.com/@adnanmasood/rubric-based-evals-llm-as-a-judge-methodologies-and-empirical-validation-in-domain-context-71936b989e80)
