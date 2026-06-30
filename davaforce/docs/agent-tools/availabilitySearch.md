# availabilitySearch

Implementation: `backend/src/lib/agent-tools/availability-search.ts`

## Purpose

Find people who can supply capacity in a target window using structured availability filters.

## Use when

- The question is primarily about availability, bench, partial capacity, location, grade, or domain.
- You need the candidate pool before matching skills or building a team.

## Do not use when

- You need ranking by skill fit. Use `candidateScorer()` after this.
- You need 30/60/90 trend output. Use `capacityCalculator30_60_90()`.

## Inputs

- `datasetId` or `dbPath`
- optional `opportunityId` or `roleId`
- optional explicit filters: `discipline`, `grade`, `location`, `domain`
- optional `availabilityWindowDays`, `minFte`, `candidateIds`

## Outputs

- filtered candidate list
- current vs in-window FTE
- bench and partial-capacity counts
- target date and evidence lines

## Typical chain

`availabilitySearch()` -> `skillsMatcher()` -> `candidateScorer()`
