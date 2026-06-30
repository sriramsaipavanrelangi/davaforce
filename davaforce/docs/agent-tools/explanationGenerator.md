# explanationGenerator

Implementation: `backend/src/lib/agent-tools/explanation-generator.ts`

## Purpose

Generate template-based summaries from agent-tool outputs.

## Use when

- You want compact text for an agent response without asking the model to restate the raw data from scratch.
- You need a human-readable layer on top of agent-tool results.

## Do not use when

- You still need retrieval, scoring, or team construction.

## Outputs

- summary line
- highlights
- risks
- next actions
- evidence lines
- markdown block
