# skillsMatcher

Implementation: `backend/src/lib/agent-tools/skills-matcher.ts`

## Purpose

Measure required and desired skill coverage against `PersonSkillEvidence`.

## Use when

- The question is about skill fit, missing skills, or required-vs-desired coverage.
- You already have a candidate pool from `availabilitySearch()`.
- You need evidence before scoring or explanation.

## Do not use when

- You only need raw availability.
- You need final ranking. Use `candidateScorer()` after this.

## Outputs

- required skills
- desired skills
- query-derived skills
- per-person matched and missing skills
- strongest supporting skill evidence
