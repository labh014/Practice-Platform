# AI usage

Five decisions where AI assistance materially changed the build. Written from my
side: what was suggested, what I did with it, and why.

---

## 1. The change scenario contradiction — accepted

**Suggested:** Before implementation, the AI flagged a conflict in the PRD. The
change scenario ("add EV charging") unlocks after attempt 1, and attempt 2 must
report what improved. If the scenario became a sixth requirement, attempt 2
would be graded against a wider brief than attempt 1 — so a learner could
genuinely improve and score *lower*, and the delta would report a regression
that never happened. It proposed routing the scenario to the Extensibility
dimension only.

**Accepted.** I had not spotted the conflict. The resolution keeps the other
three dimensions measured against identical goalposts, which is the only reason
the improvement delta means anything. It shows in the UI as a **bar raised**
label, excluded from the regression count.

---

## 2. Making the schema unable to express a score — accepted

**Suggested:** Rather than instructing the model not to return an overall score,
leave the field out of the Zod schema entirely and mark it `.strict()`, so a
response containing one is rejected outright.

**Accepted.** The difference matters. A prompt instruction is a request; a
schema is a guarantee. A model left to author its own headline number will
eventually return 78 alongside dimension scores of 2, 2, 3, 3, and the learner
has no way to know which to believe. Same reasoning applied to the improvement
comparison — a model asked whether you improved will say yes.

---

## 3. The offline evaluator's scoring — rejected, then rebuilt

**Suggested:** The AI built the offline evaluator as a set of rules that start
from a competent baseline and subtract for problems they recognise.

**Rejected after testing it myself.** I submitted random characters and got
60/100 with "no specific issues were raised" — while the structural checks had
already reported no classes, no methods, and a skeleton too short to describe a
design. The rules only ever subtract, so a submission they recognise nothing in
lands on the baseline untouched. The output also contradicted itself:
*"responsibilities are not separated at all. Scored 3/5."*

The AI's first fix handled only the "no design at all" case. I pushed back that
the same hole remained for syntactically valid but meaningless classes, which
led to decision 4.

---

## 4. Abstention over a wrong score — my call, AI initially disagreed

**Suggested:** The AI defended always producing a score, on the grounds that the
offline evaluator has to work on a fresh clone with no key.

**Rejected.** My position was that no result is better than a wrong result. The
AI's own design already agreed in one place — it *deletes* feedback whose
evidence it cannot find in the submission — while allowing scores it could not
justify. That is not a defensible line.

It then argued one thing I did accept: "nothing" is the wrong shape, because it
looks like a bug. The right output is **abstention** — *not assessed*, with a
reason. And it should be per-dimension, since the rules genuinely know some axes
and not others on the same submission.

Result: `overallScore` and dimension scores are nullable end to end. Two
meaningless classes now return *Not scored*, with Coupling 2/5 — the one axis
the rules can actually read — and the rest marked *not assessed*.

---

## 5. The recommended Gemini model — accepted, then wrong

**Suggested:** `gemini-2.0-flash` as the default, with the caveat that model
names change and to verify against the current list.

**Accepted, and it broke.** Both `2.0-flash` and `2.5-flash` are retired for new
keys; the API returned 404. The error body named the current model, and the
default is now `gemini-3.6-flash`, verified against the live API.

Worth recording because the failure path behaved correctly throughout: a
sanitised message naming no configuration detail, `FAILED` status, submission
retained, retry available. The bug was in a recommendation, not in the system's
handling of it.

---

## How I worked with it

The pattern that produced the most value was **adversarial testing, not
review**. The AI's code passed its own tests and read well; the two real defects
both surfaced from me submitting deliberately bad input and asking why the
result looked wrong. Reading the code would not have caught either.
