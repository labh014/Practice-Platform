# AI usage

Five decisions where AI assistance changed the build — what was suggested, what
I did with it, and why.

---

**1. The change-scenario contradiction — accepted**

The AI flagged a conflict in the PRD before implementation: the change scenario
unlocks after attempt 1, and attempt 2 must report what improved. Graded as a
sixth requirement, a learner could improve and score *lower*. It proposed
routing the scenario to the Extensibility dimension only.

I had not spotted it. Taking it kept the other three dimensions comparable
across attempts, which is the only reason the improvement delta means anything.

---

**2. Making the schema unable to hold a score — accepted**

Rather than *instructing* the model not to return an overall score, leave the
field out of the Zod schema and mark it `.strict()`.

A prompt instruction is a request; a schema is a guarantee. A model left to
author its own total will eventually return 78 alongside dimension scores of
2, 2, 3, 3, and the learner cannot tell which to believe.

---

**3. The offline evaluator's scoring — rejected after testing it**

The AI built rules that start from a competent baseline and subtract for
problems they recognise.

I submitted random characters and got **60/100** with "no specific issues were
raised" — while the structural checks had already reported no classes and no
methods. The rules only subtract, so anything unrecognised lands on the baseline
untouched. The output also contradicted itself: *"responsibilities are not
separated at all. Scored 3/5."*

Its first fix only handled the "no design at all" case. I pushed back that the
same hole remained for valid-but-meaningless classes, which led to 4.

---

**4. Abstention over a wrong score — my call, AI initially disagreed**

The AI defended always producing a score, since the offline evaluator has to
work on a fresh clone with no key.

I rejected that: no result is better than a wrong result. Its own design already
agreed in one place — it *deletes* feedback whose evidence it cannot find —
while allowing scores it could not justify.

It then argued one thing I accepted: "nothing" looks like a bug, so the right
output is **abstention** — *not assessed*, with a reason — and it should be
per-dimension, since the rules know some axes and not others.

Two meaningless classes now return *Not scored*, with Coupling 2/5 (the one axis
the rules can read) and the rest unassessed.

---

**5. The recommended Gemini model — accepted, then wrong**

`gemini-2.0-flash`, with a caveat that model names change. Both it and
`2.5-flash` turned out to be retired; the API returned 404. Now
`gemini-3.6-flash`, verified live.

Worth recording because the failure path behaved correctly throughout —
sanitised message, `FAILED` status, submission retained, retry available. The
bug was in a recommendation, not in the handling of it.

---

**How I worked with it.** The pattern that found the most was **adversarial
testing, not review**. The code passed its own tests and read well; both real
defects surfaced from submitting deliberately bad input and asking why the
result looked wrong.
