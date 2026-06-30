# Static Dashboard API Requirements

This document defines the backend API endpoints needed by the frontend static dashboard at `/dashboard`.

The dashboard should summarize the latest uploaded workforce dataset for the signed-in user. The generated SQLite DB remains the source for the initial dashboard build and legacy backfills under:

```text
data/workforce-datasets/<userId>/<datasetId>/<datasetId>.db
```

## Frontend Flow

1. Frontend reads `workforceUser` and `workforceDatasetId` from local storage.
2. Frontend calls dashboard endpoints with `userId` and `datasetId`.
3. Backend validates dataset ownership.
4. On the first verified upload, backend queries the dataset SQLite DB, builds the static dashboard once, and stores it under `data/workforce-datasets/<userId>/<datasetId>/dataset.json`.
5. Later dashboard requests read the stored snapshot from `dataset.json`; older datasets without a snapshot may be backfilled from the SQLite DB once.
6. Frontend renders static dashboard cards, charts, and tables.
7. Frontend can also open a raw workbook preview backed by `RawSheetRow` or download the original `.xlsx` workbook after the same ownership check.

## Required Endpoints

### 1. Dashboard Summary

```http
GET /api/workforce-datasets/dashboard/summary?userId=<userId>&datasetId=<datasetId>
```

Purpose:

Return top-level KPI cards and dataset metadata.

DB tables:

- `Person`
- `Opportunity`
- `OpportunityRole`
- `PersonAvailabilitySnapshot`
- `SupplyRecord`
- `EwaRequest`
- `OpportunityCandidateOverlay`
- `ImportBatch`

Response shape:

```json
{
  "status": "success",
  "datasetId": "wf_...",
  "sourceName": "InSync_Hackathon_APAC_India_MENA_WFP_Dataset_500.xlsx",
  "importedAt": "2026-06-27T13:32:24+05:30",
  "kpis": {
    "people": 500,
    "opportunities": 15,
    "roles": 60,
    "requiredFte": 53.4,
    "availableFteCurrent": 44.0,
    "currentBenchPeople": 30,
    "partialCapacityPeople": 40,
    "highRiskSupplyPeople": 24,
    "pendingEwaRequests": 34,
    "feasibleRoles": 35,
    "totalRoles": 60,
    "noDirectFitPeople": 23,
    "noDirectFitFte": 20.0
  }
}
```

Suggested SQL metrics:

- total people: `COUNT(*) FROM Person`
- opportunities: `COUNT(*) FROM Opportunity`
- roles: `COUNT(*) FROM OpportunityRole`
- required FTE: `SUM(OpportunityRole.fteRequired)`
- current available FTE: `SUM(PersonAvailabilitySnapshot.availableFteCurrent)`
- high-risk supply: `COUNT(*) FROM SupplyRecord WHERE supplyRisk = 'High'`
- pending EWA: `COUNT(*) FROM EwaRequest WHERE ewaStatus = 'Pending Approval'`

### 2. Supply Overview

```http
GET /api/workforce-datasets/dashboard/supply?userId=<userId>&datasetId=<datasetId>
```

Purpose:

Show available workforce, bench, rolling-off, location, discipline, and supply risk.

DB tables:

- `Person`
- `PersonAvailabilitySnapshot`
- `SupplyRecord`
- `BenchMovementWeek`
- `AvailabilityWeek`

Response shape:

```json
{
  "status": "success",
  "availabilityByCategory": [
    {
      "availabilityCategory": "Current Bench",
      "people": 30,
      "availableFte": 30.0
    }
  ],
  "benchMovement": [
    {
      "weekStartDate": "2026-06-22",
      "currentBenchHeadcount": 30,
      "emergingBenchHeadcount": 0,
      "partialCapacityHeadcount": 40,
      "availableFte": 44.0
    }
  ],
  "supplyRiskByCategory": [
    {
      "availabilityCategory": "Current Bench",
      "supplyRisk": "High",
      "people": 11,
      "fte": 11.0
    }
  ],
  "peopleByDiscipline": [
    {
      "discipline": "Frontend Engineering",
      "people": 30,
      "availableFte": 6.2
    }
  ],
  "peopleByLocation": [
    {
      "country": "India",
      "city": "Bengaluru",
      "people": 27,
      "availableFte": 4.5
    }
  ],
  "highRiskPeople": [
    {
      "personId": "P-001",
      "name": "Example Person",
      "discipline": "Frontend Engineering",
      "grade": "Senior Consultant",
      "city": "Bengaluru",
      "availabilityCategory": "Current Bench",
      "supplyFte": 1.0,
      "timeOnSupplyDays": 14,
      "suggestedAction": "Review against pipeline demand"
    }
  ]
}
```

Frontend widgets:

- availability breakdown card/chart
- bench movement line chart
- supply risk stacked table
- people by discipline table
- people by location table
- high-risk people table

### 3. Demand Pipeline

```http
GET /api/workforce-datasets/dashboard/demand?userId=<userId>&datasetId=<datasetId>
```

Purpose:

Show opportunity demand by stage, role, priority, FTE, and risk.

DB tables:

- `Opportunity`
- `OpportunityRole`

Response shape:

```json
{
  "status": "success",
  "demandByStage": [
    {
      "stage": "Qualified",
      "opportunities": 5,
      "roles": 20,
      "requiredFte": 19.5,
      "avgProbability": 0.54
    }
  ],
  "demandByRole": [
    {
      "roleName": "Business Analyst",
      "roles": 6,
      "requiredFte": 6.0
    }
  ],
  "deliveryRiskByPriority": [
    {
      "deliveryRisk": "High",
      "commercialPriority": "High",
      "opportunities": 4,
      "requiredFte": 13.5
    }
  ],
  "topOpportunities": [
    {
      "opportunityId": "OPP-001",
      "name": "Digital Banking Onboarding Modernisation",
      "clientName": "Harbourline Bank",
      "stage": "Proposal",
      "probability": 0.82,
      "deliveryRisk": "Medium",
      "roles": 4,
      "requiredFte": 3.5,
      "expectedStartDate": "2026-07-01"
    }
  ]
}
```

Frontend widgets:

- demand by stage chart
- required FTE by role chart
- delivery risk / commercial priority matrix
- top opportunities table

### 4. Staffing Fit

```http
GET /api/workforce-datasets/dashboard/staffing-fit?userId=<userId>&datasetId=<datasetId>
```

Purpose:

Show how well current supply can cover opportunity roles.

DB tables:

- `OpportunityCandidateOverlay`
- `OpportunityRole`
- `Opportunity`
- `Person`

Response shape:

```json
{
  "status": "success",
  "fitDistribution": [
    {
      "fitStatus": "Recommended",
      "candidates": 34,
      "avgScore": 75.8,
      "avgFteGap": 0.0
    }
  ],
  "topCandidatePerRole": [
    {
      "opportunityId": "OPP-001",
      "opportunityName": "Digital Banking Onboarding Modernisation",
      "roleName": "Backend Engineer",
      "personId": "P-001",
      "personName": "Example Person",
      "fitStatus": "Recommended",
      "rank": 1,
      "capabilityFitScore": 70,
      "availabilityFitScore": 100,
      "overallStaffingScore": 79,
      "availableFteAtStart": 1.0,
      "fteGap": 0.0,
      "ewaStatus": "Pending Approval"
    }
  ],
  "rolesWithoutFeasibleCandidate": [
    {
      "opportunityId": "OPP-002",
      "opportunityName": "Agentic Commerce Checkout Accelerator",
      "roleName": "AI Engineer",
      "fteRequired": 1.0,
      "reason": "Availability or capability gap"
    }
  ],
  "candidateOverlap": [
    {
      "personId": "P-001",
      "personName": "Example Person",
      "opportunityCount": 3,
      "roleCount": 4,
      "avgScore": 82.5,
      "maxScore": 91.0
    }
  ]
}
```

Frontend widgets:

- fit distribution chart
- top candidate per role table
- roles without feasible candidate table
- candidate overlap table

### 5. Skill Intelligence

```http
GET /api/workforce-datasets/dashboard/skills?userId=<userId>&datasetId=<datasetId>
```

Optional gaps-only endpoint for lighter refreshes:

```http
GET /api/workforce-datasets/dashboard/skills/gaps?userId=<userId>&datasetId=<datasetId>
```

Purpose:

Show skill supply, role skill demand, and gaps.

DB tables:

- `PersonSkillEvidence`
- `OpportunityRoleSkillRequirement`
- `SkillCatalog`

Response shape:

```json
{
  "status": "success",
  "requiredSkillDemand": [
    {
      "skillName": "React",
      "importance": "REQUIRED",
      "roleCount": 8
    }
  ],
  "skillSupply": [
    {
      "skillName": "AWS",
      "people": 48,
      "avgLevel": 3.0,
      "avgYears": 4.7
    }
  ],
  "skillGaps": [
    {
      "skillName": "Accessibility",
      "requiredRoles": 8,
      "people": 0,
      "gap": 8
    }
  ]
}
```

Frontend widgets:

- top required skills
- top supplied skills
- skill gap table
- skill gap severity chart

### 6. EWA and Actions

```http
GET /api/workforce-datasets/dashboard/ewa?userId=<userId>&datasetId=<datasetId>
```

Purpose:

Show EWA requests, approvals, blockers, and action-required items.

DB tables:

- `EwaRequest`
- `Opportunity`
- `OpportunityRole`
- `Person`
- `SupplyRecord`

Response shape:

```json
{
  "status": "success",
  "ewaByStatus": [
    {
      "ewaStatus": "Blocked",
      "requests": 70,
      "requestedFte": 59.0
    },
    {
      "ewaStatus": "Pending Approval",
      "requests": 34,
      "requestedFte": 29.5
    }
  ],
  "ewaQueue": [
    {
      "ewaRequestId": "EWA-001",
      "opportunityName": "Digital Banking Onboarding Modernisation",
      "roleName": "Backend Engineer",
      "personName": "Example Person",
      "requestType": "Transfer",
      "ewaStatus": "Pending Approval",
      "requestedFte": 1.0,
      "proposedStartDate": "2026-07-01",
      "blockingReason": null,
      "nextAction": "Manager approval required"
    }
  ],
  "actionRequired": [
    {
      "personId": "P-001",
      "personName": "Example Person",
      "supplyRisk": "High",
      "suggestedAction": "Review against pipeline demand",
      "ewaActionRequired": "Yes"
    }
  ]
}
```

Frontend widgets:

- EWA status cards
- pending/blocker queue
- high-risk action-required items

## Optional Combined Endpoint

For first implementation, backend can expose one combined endpoint instead of six separate calls:

```http
GET /api/workforce-datasets/dashboard?userId=<userId>&datasetId=<datasetId>
```

Response:

```json
{
  "status": "success",
  "summary": {},
  "supply": {},
  "demand": {},
  "staffingFit": {},
  "skills": {},
  "ewa": {}
}
```

Recommendation:

- Use the combined endpoint for the MVP dashboard.
- Persist the combined payload inside `dataset.json` and serve later reads from that stored snapshot.
- Split into granular endpoints later if payload size or refresh behavior becomes a problem.

## Source Workbook Support Endpoints

The dashboard also exposes source-workbook actions so planners can inspect or export the exact upload without leaving the static dashboard.

### Raw Workbook Preview

```http
GET /api/workforce-datasets/raw?userId=<userId>&datasetId=<datasetId>&sheet=<sheetName>&limit=50&offset=0
```

Purpose:

Return a paged preview of raw Excel rows for one sheet in a user-owned dataset.

DB tables:

- `RawSheetRow`

Query parameters:

| Parameter | Required | Description |
| --- | --- | --- |
| `userId` | yes | User identity used for dataset ownership validation |
| `datasetId` | yes | Dataset to query |
| `sheet` | no | Workbook sheet to preview; defaults to the first imported sheet |
| `limit` | no | Rows to return; defaults to `50` and is capped at `200` |
| `offset` | no | Zero-based row offset for pagination |

Response shape:

```json
{
  "status": "success",
  "dataset": {},
  "sheets": [
    {
      "sheetName": "People",
      "rows": 500
    }
  ],
  "selectedSheetName": "People",
  "limit": 50,
  "offset": 0,
  "rows": [
    {
      "sourceRowNumber": 2,
      "naturalKey": "EMP-001",
      "payload": {
        "Employee_ID": "EMP-001",
        "Name": "Example Person"
      }
    }
  ]
}
```

Frontend notes:

- Use this endpoint only for source inspection, not for planning calculations.
- The dashboard preview should default to 50 rows and show a sheet selector from the `sheets` array.
- The preview table can cap visible columns for usability while the download endpoint remains the full source export.

### Download Original Workbook

```http
GET /api/workforce-datasets/download?userId=<userId>&datasetId=<datasetId>
```

Purpose:

Return the original uploaded `.xlsx` workbook for a user-owned dataset.

Response:

- `200 OK`
- `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `Content-Disposition: attachment`

## Error Responses

Missing query parameters:

```json
{
  "status": "failure",
  "error": "userId and datasetId are required."
}
```

Unknown user or dataset:

```json
{
  "status": "failure",
  "error": "Dataset not found."
}
```

Ownership failure:

```json
{
  "status": "failure",
  "error": "Dataset does not belong to user."
}
```

## Frontend Rendering Notes

The static `/dashboard` should render global dataset-level insights and provide source-workbook actions in the top bar:

- `View raw Excel` opens the raw workbook preview panel.
- `Hide raw Excel` closes the preview panel.
- `Download Excel` downloads the original uploaded workbook.

## Contract Alignment

Keep the concrete HTTP behavior aligned with:

```text
docs/contracts/api-contracts.md
```

This file describes the dashboard requirements and response intent. The API contract file documents exact request, response, and status-code behavior.
