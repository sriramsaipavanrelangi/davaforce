# capacityCalculator30_60_90

Implementation: `backend/src/lib/agent-tools/capacity-calculator-30-60-90.ts`

## Purpose

Calculate 0, 30, 60, and 90 day capacity snapshots, bench movement trend rows, and scenario target status.

## Use when

- The user asks about near-term capacity by horizon.
- You need a tool-based answer for "what changes over time?" or "are we on target?" without generating a team.

## Do not use when

- The user needs named candidates. Use `availabilitySearch()`.
- The user needs role-by-role staffing. Use `teamOptionBuilder()`.

## Outputs

- per-window people and FTE
- current bench and partial-capacity counts per window
- blocked headcount in result population
- bench movement timeline
- scenario targets with nearest bench-movement evidence and target status
