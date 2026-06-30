# candidateScorer

Implementation: `backend/src/lib/agent-tools/candidate-scorer.ts`

## Purpose

Create a ranking using availability, skill coverage, context fit, and overlay scores.

## Use when

- The user asks for "best", "top", "ranked", or "recommended" candidates.
- You need a shortlist before building a team.

## Do not use when

- The user only needs a raw candidate pool.
- The user needs a full team across multiple roles. Use `teamOptionBuilder()`.

## Outputs

- ranked candidate list
- capability, availability, context, and overlay score components
- fit bucket: `Recommended`, `Backup`, `Stretch`, `Unavailable`, `Blocked`, `Low Fit`
- evidence lines for each candidate

## Typical chain

`availabilitySearch()` -> `skillsMatcher()` -> `candidateScorer()`
