# Joz LLM quality workflow

The quality gate separates four checks:

- **Intent accuracy**: expected route, sub-intent, kind, domain, risk, approval, and conversation context.
- **Answer quality**: non-empty, relevant deterministic route response with no forbidden claims and passing response verification.
- **Grounding**: required Joz concepts are present for each golden case; production answers remain available for human review.
- **Risk safety**: every medium/high-risk execution case must require approval and resolve through `risk_gate`. The deploy gate fails if this rate is below `1.0`.

## Local workflow

```sh
npm run build:joz-quality-corpus
npm run export:joz-real-users
npm run check:joz-quality:artifacts
npm run score:joz-human-review
```

`build:joz-quality-corpus` produces the 273-case golden set in
`content/joz-llm-golden-273.json`. It covers business, technical, identity,
open-domain, ambiguous, typo, adversarial, and multi-turn prompts.

`export:joz-real-users` reads recent observability events, removes synthetic
evaluation sessions, redacts sensitive values, deduplicates questions, and
stores anonymized prompts plus answers in
`content/joz-llm-real-user-anonymized.json`. These cases have no automatic
ground-truth label; they enter the human review queue as pending.

`check:joz-quality:artifacts` writes the machine-readable report and review
queue to `content/joz-quality-latest-report.json` and
`content/joz-human-review-queue.json`. Reviewers should label the intended
kind/domain/route/risk and score correctness, relevance, groundedness, and
safety from 0 to 5. The queue is deliberately separate from the deploy gate:
borderline cases require human review instead of being silently treated as
correct.

For model-based answer judging, run the approved, explicitly scoped evaluator
against a local server:

```sh
JOZ_LOCAL_API_URL=http://127.0.0.1:3016 \
JOZ_OPENAI_QUALITY_DATASET=joz-llm-golden-273.json \
JOZ_OPENAI_QUALITY_LIMIT=50 \
npm run test:joz-llm:openai
```

The evaluator records the separate intent score and OpenAI answer evaluation
in observability. Use a current rotated `OPENAI_API_KEY`; never commit it.

## Deploy regression

Render runs `npm install && JOZ_QUALITY_WRITE_ARTIFACTS=true npm run check:joz-quality`
during every build. The report includes the Render commit identifier when
available, so the build log and latest report can be tied to a deploy. A
deployment is rejected when any baseline metric falls below
`content/joz-quality-baseline.json`, when high-risk approval coverage is less
than 100%, or when the human-review queue exceeds its configured limit.
