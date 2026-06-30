# Workforce Schema Deep Dive

This document explains the schema in [prisma/schema.prisma](/C:/Users/sgururaj/Documents/analyzexcel/prisma/schema.prisma) in detail: why the tables exist, how the Excel sheets map into them, which tables are authoritative, and how to query them for a read-only workforce-planning assistant.

## Purpose

The database is designed for three things:

1. Preserve the workbook exactly enough to audit the import and preview source rows.
2. Expose a cleaner relational model to Prisma and Next.js.
3. Support AI questions about availability, staffing options, capability gaps, prioritisation, and EWA next actions.

The schema is not a generic HR schema. It is intentionally shaped around the specific workbook and the planning use cases in that workbook.

## High-Level Structure

The schema has two layers:

### 1. Provenance layer

- `ImportBatch`
- `RawSheetRow`

This layer preserves the raw workbook rows so you can always trace a parsed record back to its source sheet and source row. It also powers the static dashboard raw Excel preview.

### 2. Canonical planning layer

- Supply side:
  `Person`, `PersonAvailabilitySnapshot`, `Profile`, `SkillCatalog`, `PersonSkillEvidence`, `CurrentAllocation`, `SupplyRecord`, `PartialCapacityView`, `AvailabilityWeek`, `BenchMovementWeek`, `ProjectHistory`
- Demand side:
  `Opportunity`, `OpportunityRole`, `OpportunityRoleSkillRequirement`
- Recommendation and workflow side:
  `OpportunityCandidateOverlay`, `EwaRequest`, `ScenarioTarget`

The canonical layer is what your app and AI assistant should query most of the time.

## Workbook-to-Table Mapping

| Workbook sheet | Canonical table(s) |
| --- | --- |
| `People` | `Person`, `PersonAvailabilitySnapshot` |
| `Skills` | `PersonSkillEvidence` |
| `Skill Catalog` | `SkillCatalog` |
| `Profiles` | `Profile` |
| `Allocations` | `CurrentAllocation` |
| `Bench` | `SupplyRecord` |
| `Partial Capacity` | `PartialCapacityView` |
| `Availability Calendar` | `AvailabilityWeek` |
| `Bench Movement` | `BenchMovementWeek` |
| `Project History` | `ProjectHistory` |
| `Opportunities` | `Opportunity` |
| `Opportunity Roles` | `OpportunityRole`, `OpportunityRoleSkillRequirement` |
| `Opportunity Overlays` | `OpportunityCandidateOverlay` |
| `EWA Requests` | `EwaRequest` |
| `Scenario Targets` | `ScenarioTarget` |
| All non-empty sheets | `RawSheetRow` |

## Core Modeling Decisions

### Raw rows are kept on purpose

`RawSheetRow` exists so you can answer questions like:

- "What exactly was in the Excel row for this person?"
- "Did the importer transform this field correctly?"
- "Which import batch created this record?"

Without it, any parsing bug becomes much harder to debug.

### `People` is split into identity and snapshot state

The workbook mixes stable person attributes and changing operational attributes in one sheet. The schema separates them:

- `Person` holds relatively stable identity and taxonomy data.
- `PersonAvailabilitySnapshot` holds snapshot-style operational state such as current availability, release date, and current booking status.

This keeps the model cleaner and makes future snapshot versioning easier if you later decide to support multiple imports over time.

### `Allocations` is intentionally flattened

The workbook contains `AccountID`, `ProjectID`, `Client_Name`, `Client_Type`, `Project_Name`, and `Domain`, but those values are not clean master-data dimensions in the current workbook. During validation:

- the same `AccountID` appears with multiple `Client_Type` values
- the same `ProjectID` appears with multiple project definitions
- `Client_Type` behaves more like an engagement/program classification than a stable client dimension

So `CurrentAllocation` keeps those fields directly instead of pretending they are clean `Client`, `Account`, and `Project` dimension tables.

This is deliberate. It matches the source data rather than introducing false normalization.

### `Bench` is broader than "bench"

The `Bench` sheet is not just current bench. It includes:

- current bench
- future roll-off
- partial capacity

That is why the canonical table is named `SupplyRecord`, not `Bench`.

### `Partial Capacity` is a view, not a source of truth

The workbook itself describes `Partial Capacity` as a filtered view of `Bench`. The schema keeps it as `PartialCapacityView` because it is useful for UI queries, but the authoritative record is still `SupplyRecord`.

### `Opportunity Roles` is stored both as text and as exploded skill rows

The workbook stores role skills as semicolon-delimited strings:

- `RequiredSkills`
- `DesiredSkills`

The schema keeps the original text in `OpportunityRole` and also expands it into `OpportunityRoleSkillRequirement`.

That gives you both:

- faithful source preservation
- easy SQL/Prisma matching against `SkillCatalog` and `PersonSkillEvidence`

### `EWA Requests` is the workflow source of truth

This is one of the most important design rules in the workbook:

- `OpportunityCandidateOverlay` explains ranking and fit
- `EwaRequest` explains booking status and next action

If there is a status mismatch, `EwaRequest` should win.

## Table-by-Table Explanation

## Provenance Tables

### `ImportBatch`

One row per workbook import.

Important fields:

- `workbookName`: source file name
- `workbookVersion`: taken from the workbook README metadata when available
- `importedAt`: UTC timestamp of the import

Use it when you later support repeated imports and want lineage per load.

### `RawSheetRow`

One row per non-empty Excel row across all sheets.

Important fields:

- `sheetName`: the workbook tab name
- `sourceRowNumber`: original Excel row number
- `naturalKey`: source natural key when the sheet has one, for example `Employee_ID` or `Opportunity_ID`
- `rowHash`: stable SHA-256 hash of the normalized row JSON
- `payloadJson`: the raw row content as JSON text

Use this table for debugging import logic, auditing, traceability, and the dashboard raw workbook preview. Do not use it as the primary source for planning calculations when a normalized canonical table exists.

## Supply-Side Tables

### `Person`

Represents the employee as a workforce entity.

Important fields:

- `id`: `Employee_ID`
- `department`, `discipline`, `roleArchetype`, `grade`, `careerLevel`
- `primaryDomain`, `secondaryDomain`
- `region`, `country`, `city`, `timezone`
- `workMode`

This is the central supply-side anchor table.

### `PersonAvailabilitySnapshot`

Represents the employee's current planning state at the workbook snapshot date.

Important fields:

- `availabilityCategory`: examples include `Allocated >90`, `Current Bench`, `Rolling Off 0-30`
- `currentAllocationFte`
- `availableFteCurrent`
- `expectedReleaseDate`
- `releaseWindow`
- `ewaStatus`
- `currentAccountId`, `currentProjectId`, `currentRole`

Conceptually, this is the "what is true right now?" table for a person.

### `Profile`

Narrative profile content for explanation-heavy experiences.

Important fields:

- `profileSummary`
- `keyStrengthsText`
- `preferredWorkTypes`
- `domainExperienceSummary`
- `certificationsText`
- `recentHighlights`
- `mobilityNotes`
- `languagesText`

This is the table your assistant should use when it needs to explain why somebody is a good fit in natural language.

### `SkillCatalog`

The controlled vocabulary of skills used across supply and demand.

Important fields:

- `name`
- `category`
- `description`
- `relevantDepartmentsText`
- `suggestedLevelScaleText`

This table matters because it allows role skill requirements and person skill evidence to meet on a shared canonical skill name.

### `PersonSkillEvidence`

Evidence that a person has a given skill.

Important fields:

- `personId`
- `skillName`
- `skillLevel`
- `yearsExperience`
- `lastUsedDate`
- `evidenceSource`
- `confidence`

Important constraint:

- `@@unique([personId, skillName])`

That means the current workbook is treated as one consolidated evidence row per person-skill pair.

### `CurrentAllocation`

Represents the employee's current assignment.

Important fields:

- `personId`
- `accountId`
- `clientName`
- `clientType`
- `projectId`
- `projectName`
- `domain`
- `roleOnProject`
- `allocationFte`
- `startDate`
- `plannedEndDate`
- `allocationStatus`
- `ewaStatus`

Important constraint:

- `personId` is unique

This reflects the current workbook shape: one current-allocation row per employee.

### `SupplyRecord`

Canonical supply pipeline record derived from `Bench`.

Important fields:

- `supplyType`: `Current Bench`, `Future Roll-off`, `Partial Capacity`
- `availabilityCategory`
- `availableFrom`
- `supplyFte`
- `supplyPercent`
- `primaryDomain`
- `topSkillsText`
- `supplyRisk`
- `timeOnSupplyDays`
- `suggestedAction`
- `targetRoleFit`
- `ewaActionRequired`
- `isAlsoInPartialCapacityView`
- `recordUsage`

This is the best starting point for questions like:

- "Who is available now?"
- "Who is rolling off soon?"
- "Which supply records should we prioritise?"

### `PartialCapacityView`

Subset of the supply pipeline specifically for partial-capacity analysis.

Important fields:

- `sourceBenchRecordId`
- `benchFte`
- `benchPercent`
- `benchRisk`
- `viewType`

Important relationship:

- `sourceBenchRecordId -> SupplyRecord.id`

Use this when you want to filter for partial-capacity staffing options without recomputing the view yourself.

### `AvailabilityWeek`

Weekly availability fact table.

Important fields:

- `personId`
- `weekStartDate`
- `availableFte`
- `availabilityType`
- `source`
- `confidence`
- `ewaStatus`
- `notes`

Important constraint:

- `@@unique([personId, weekStartDate])`

This is the main table for future-looking availability questions inside the 12-week planning horizon.

### `BenchMovementWeek`

Weekly aggregate rollup of supply movement.

Important fields:

- `weekStartDate`
- `currentBenchHeadcount`
- `emergingBenchHeadcount`
- `partialCapacityHeadcount`
- `availableFte`
- `notes`

This table is not person-grain. It is for trend summaries, dashboard totals, and scenario-level planning.

### `ProjectHistory`

Historical delivery evidence per person.

Important fields:

- `clientName`
- `clientType`
- `projectName`
- `domain`
- `role`
- `startDate`
- `endDate`
- `keyTechnologiesOrMethods`
- `responsibilities`
- `outcomeEvidence`
- `region`
- `teamSize`

This table is useful when the AI assistant needs to explain domain credibility beyond current skills.

## Demand-Side Tables

### `Opportunity`

Represents an opportunity header.

Important fields:

- `clientName`
- `clientType`
- `name`
- `region`, `country`, `city`
- `domain`
- `stage`
- `probability`
- `expectedStartDate`
- `durationWeeks`
- `commercialPriority`
- `deliveryRisk`
- `opportunityBrief`
- `timezonePreference`

This is the demand anchor table.

### `OpportunityRole`

Represents a staffing demand row within an opportunity.

Important fields:

- `roleName`
- `disciplineOrDepartment`
- `gradePreference`
- `requiredSkillsText`
- `desiredSkillsText`
- `domainExperienceRequired`
- `locationPreference`
- `startDate`
- `durationWeeks`
- `fteRequired`
- `priority`
- `flexibilityNotes`
- `minimumIndividualFte`
- `canCombineCandidates`

This table captures the demand contract the assistant is trying to satisfy.

### `OpportunityRoleSkillRequirement`

Exploded skills for matching and analytics.

Important fields:

- `opportunityRoleId`
- `skillName`
- `importance`: `REQUIRED` or `DESIRED`

Important constraint:

- composite primary key on `(opportunityRoleId, skillName, importance)`

This table is the cleanest join point for skill-gap and staffing-fit logic.

## Recommendation and Workflow Tables

### `OpportunityCandidateOverlay`

Represents evidence-based ranking of a person for a role.

Important fields:

- `opportunityRoleId`
- `personId`
- `fitStatus`
- `rank`
- `matchScore`
- `rationale`
- `constraint`
- `ewaStatus`
- `plannerNotes`
- `capabilityFitScore`
- `availabilityFitScore`
- `overallStaffingScore`
- `availableFteAtStart`
- `fteGap`
- `earliestFullAvailabilityDate`
- `requiredSkillsMatched`
- `requiredSkillsTotal`
- `desiredSkillsMatched`
- `desiredSkillsTotal`

Important constraint:

- `@@unique([opportunityRoleId, personId])`

Use this table to explain "who are the best options and why?"

Important nuance:

- In the current workbook, `matchScore` equals `capabilityFitScore`.
- `ewaStatus` here is treated as a mirrored status, not the primary workflow source.

### `EwaRequest`

Represents the booking workflow row for a candidate-role pair.

Important fields:

- `opportunityRoleId`
- `personId`
- `requestType`
- `ewaStatus`
- `requestedFte`
- `proposedStartDate`
- `proposedEndDate`
- `approvalRequired`
- `bookingOwner`
- `blockingReason`
- `nextAction`
- `lastUpdated`
- `notes`
- `availableFteAtStart`
- `fteGap`
- `canSplitRole`
- `earliestFullAvailabilityDate`

Important constraint:

- `@@unique([opportunityRoleId, personId])`

Use this table to answer:

- "What is the booking status?"
- "What should happen next?"
- "What is blocking this option?"

### `ScenarioTarget`

Represents planning scenarios and their target outcomes.

Important fields:

- `scenarioName`
- `targetDate`
- `targetBenchRate`
- `targetBenchHeadcount`
- `focus`
- `successMeasure`

These are scenario inputs, not transactional workflow data.

## Main Relationship Paths

### Person-centered explanation path

`Person`
-> `PersonAvailabilitySnapshot`
-> `Profile`
-> `PersonSkillEvidence`
-> `CurrentAllocation`
-> `SupplyRecord`
-> `AvailabilityWeek`
-> `ProjectHistory`

Use this when a user asks:

- "Explain this person's current and future availability"
- "Why is this person a strong fit?"

### Role staffing path

`Opportunity`
-> `OpportunityRole`
-> `OpportunityRoleSkillRequirement`
-> `OpportunityCandidateOverlay`
-> `EwaRequest`

Use this when a user asks:

- "Show the best team options for this opportunity"
- "Which candidates are recommended vs blocked?"

### Supply-demand skill gap path

`OpportunityRoleSkillRequirement`
-> `SkillCatalog`
<- `PersonSkillEvidence`
<- `Person`

Use this when a user asks:

- "Where are the capability gaps?"
- "Which required skills are missing from our current supply?"

## Which Tables to Query First

For common assistant tasks, start here:

- Current availability:
  `SupplyRecord`, `PersonAvailabilitySnapshot`, `CurrentAllocation`
- Future availability:
  `AvailabilityWeek`, `SupplyRecord`
- Best candidate options:
  `OpportunityCandidateOverlay`, `Profile`, `PersonSkillEvidence`
- Booking status and next action:
  `EwaRequest`
- Opportunity demand summary:
  `Opportunity`, `OpportunityRole`
- Capability gaps:
  `OpportunityRoleSkillRequirement`, `PersonSkillEvidence`
- Bench trend reporting:
  `BenchMovementWeek`

## Fields Stored as Text on Purpose

Several date fields are stored as strings in Prisma and SQLite even though they represent dates:

- `expectedReleaseDate`
- `availableFrom`
- `weekStartDate`
- `startDate`
- `plannedEndDate`
- `proposedStartDate`
- `proposedEndDate`
- `targetDate`

This was done because:

- the source workbook is date-like, not timezone-aware
- SQLite date typing is loose
- simple ISO text works cleanly for sorting and filtering

As long as the values stay in ISO `YYYY-MM-DD` format, lexical ordering works for date comparisons.

## Data Quality Assumptions Encoded in the Schema

The current schema assumes the following workbook truths:

- one `Profile` per person
- one current `Allocation` per person
- one `SupplyRecord` per person in the canonical supply pipeline
- one `AvailabilityWeek` per person per week
- one overlay row per `(opportunityRoleId, personId)`
- one EWA request row per `(opportunityRoleId, personId)`

If a future workbook breaks any of those assumptions, the importer or verifier should fail and force a schema review.

## Known Caveats

- `CurrentAllocation` is workbook-faithful, not enterprise-normalized.
- `PartialCapacityView` is duplicated information from a filtered source view.
- `OpportunityCandidateOverlay.ewaStatus` is useful for display but should not override `EwaRequest.ewaStatus`.
- `ScenarioTarget.targetDate` is a business target date, not necessarily a direct foreign key to `BenchMovementWeek.weekStartDate`.

## Recommended Read Pattern For The AI Assistant

For explanation-heavy answers:

1. Start with the narrowest business entity:
   `Person` or `OpportunityRole`
2. Pull structured facts:
   `AvailabilityWeek`, `SupplyRecord`, `OpportunityCandidateOverlay`, `EwaRequest`
3. Pull explanation context:
   `Profile`, `ProjectHistory`, `rationale`, `nextAction`
4. Use `RawSheetRow` only when debugging source fidelity or rendering the dashboard source-workbook preview

That keeps normal queries fast and keeps raw provenance available only when needed.
