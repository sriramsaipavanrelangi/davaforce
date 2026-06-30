# ewaRecommendationBuilder

Implementation: `backend/src/lib/agent-tools/ewa-recommendation-builder.ts`

## Purpose

Turn team assignments into EWA actions.

## Use when

- The user asks for approval guidance or next steps in the booking flow.
- You need to distinguish blocked, draft, pending, and missing EWA actions.

## Outputs

- action per assigned role/person
- counts by action type
- next action summary for human decision-makers

## Action types

- `resolve_staffing_gap`
- `replace_or_resequence`
- `submit_draft`
- `follow_up_pending_approval`
- `create_ewa_request`
- `confirm_existing_booking`
