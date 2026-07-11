# Joz Knowledge Workflow

This folder is the working source of truth for new Joz LLM knowledge.

For the full lane cleanup and handoff plan, also read:

- `server/JOZ_LLM_REFACTOR_PLAN.md`
- `server/JOZ_LLM_ARCHITECTURE.md`

## Purpose

Use this workflow when new source material arrives:

- CV fragments
- project descriptions
- presentation text
- hiring notes
- raw pasted evidence
- image notes and captions

The goal is to keep raw source material separate from normalized, verified, model-ready knowledge.

## Folder layout

- `inbox/`
  Raw pasted text or markdown files go here first.
- `templates/`
  Templates for source metadata.
- `ontology/`
  Shared entities and proof objects used to connect the three lanes.
- `normalized/`
  Generated structured records per source item.
- `published/`
  Generated model-ready aggregate outputs.

## How to add new material

1. Create a text or markdown file in `inbox/`.

Example:

- `inbox/2026-07-11-agentic-ai-skills.md`

2. Create a matching sidecar metadata file next to it.

Example:

- `inbox/2026-07-11-agentic-ai-skills.meta.json`

3. Fill in the metadata using `templates/source-record.template.json`.

4. Run:

```bash
cd server
npm run build:joz-knowledge
```

5. Review:

- `data/joz/normalized/*.json`
- `data/joz/published/joz-documents.generated.json`
- `data/joz/published/joz-ontology.generated.json`
- `data/joz/published/joz-knowledge-report.json`

## Verification rule

Nothing should be treated as model-ready unless the sidecar metadata marks it clearly.

Recommended statuses:

- `draft`
- `needs_review`
- `verified`

Only `verified` records should be treated as strong publishable evidence.

## Expected assistant behavior

When new text is pasted:

1. preserve the raw source in `inbox/`
2. normalize it into a structured record
3. verify claims and proof points
4. publish only the verified parts into Joz response logic
