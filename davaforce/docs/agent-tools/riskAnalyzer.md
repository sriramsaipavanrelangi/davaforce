# riskAnalyzer

Implementation: `backend/src/lib/agent-tools/risk-analyzer.ts`

## Purpose

Evaluate staffing risks after a team option has been built.

## Use when

- The user asks "what are the risks?"
- You need blocked EWA, unfilled FTE, overlap, or partial-capacity warnings.
- You need next actions before final approval output.

## Outputs

- structured risk list with severity
- overall risk score
- overlap candidate summary
- regional impact summary
- next action list

## Typical chain

`teamOptionBuilder()` -> `riskAnalyzer()` -> `ewaRecommendationBuilder()`
