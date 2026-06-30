# teamOptionBuilder

Implementation: `backend/src/lib/agent-tools/team-option-builder.ts`

## Purpose

Build team options for an opportunity from ranked role candidates.

## Use when

- The user asks to build a team for an opportunity.
- You need role-wise assignments and alternatives.
- You want tool-based strategies instead of freeform LLM team assembly.

## Strategies

- `bestFit`: maximize total fit score
- `fastestAvailable`: prioritize earliest feasible supply
- `balanced`: balance fit, speed, and bench relief

## Outputs

- role assignments
- assigned and unfilled FTE
- alternatives per role
- per-strategy summaries

## Notes

- Honors `minimumIndividualFte`
- Honors `canCombineCandidates`
- Limits reuse of the same person across roles with `maxRolesPerPerson`
