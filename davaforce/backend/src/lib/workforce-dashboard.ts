import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { WorkforceDatasetRecord } from "./workforce-dataset-store";

type QueryRow = Record<string, unknown>;
type QueryParam = string | number | bigint | Uint8Array | null;

export type WorkforceDashboardSection = "summary" | "supply" | "demand" | "staffingFit" | "skills" | "ewa";

export type WorkforceDashboardSummary = {
  datasetId: string;
  sourceName: string;
  importedAt: string;
  kpis: {
    people: number;
    opportunities: number;
    roles: number;
    requiredFte: number;
    availableFteCurrent: number;
    currentBenchPeople: number;
    partialCapacityPeople: number;
    highRiskSupplyPeople: number;
    pendingEwaRequests: number;
    feasibleRoles: number;
    totalRoles: number;
    noDirectFitPeople: number;
    noDirectFitFte: number;
  };
};

export type WorkforceDashboardSupply = {
  availabilityByCategory: Array<{ availabilityCategory: string; people: number; availableFte: number }>;
  benchMovement: Array<{
    weekStartDate: string;
    currentBenchHeadcount: number;
    emergingBenchHeadcount: number;
    partialCapacityHeadcount: number;
    availableFte: number;
  }>;
  supplyRiskByCategory: Array<{ availabilityCategory: string; supplyRisk: string; people: number; fte: number }>;
  peopleByDiscipline: Array<{ discipline: string; people: number; availableFte: number }>;
  peopleByLocation: Array<{ country: string; city: string; people: number; availableFte: number }>;
  highRiskPeople: Array<{
    personId: string;
    name: string;
    discipline: string;
    grade: string;
    city: string;
    availabilityCategory: string;
    supplyFte: number;
    timeOnSupplyDays: number;
    suggestedAction: string;
  }>;
};

export type WorkforceDashboardDemand = {
  demandByStage: Array<{
    stage: string;
    opportunities: number;
    roles: number;
    requiredFte: number;
    avgProbability: number;
  }>;
  demandByRole: Array<{ roleName: string; roles: number; requiredFte: number }>;
  deliveryRiskByPriority: Array<{
    deliveryRisk: string;
    commercialPriority: string;
    opportunities: number;
    requiredFte: number;
  }>;
  topOpportunities: Array<{
    opportunityId: string;
    name: string;
    clientName: string;
    stage: string;
    probability: number;
    deliveryRisk: string;
    roles: number;
    requiredFte: number;
    expectedStartDate: string;
  }>;
};

export type WorkforceDashboardStaffingFit = {
  fitDistribution: Array<{ fitStatus: string; candidates: number; avgScore: number; avgFteGap: number }>;
  topCandidatePerRole: Array<{
    opportunityId: string;
    opportunityName: string;
    roleName: string;
    personId: string;
    personName: string;
    fitStatus: string;
    rank: number;
    capabilityFitScore: number;
    availabilityFitScore: number;
    overallStaffingScore: number;
    availableFteAtStart: number;
    fteGap: number;
    ewaStatus: string;
  }>;
  rolesWithoutFeasibleCandidate: Array<{
    opportunityId: string;
    opportunityName: string;
    roleName: string;
    fteRequired: number;
    reason: string;
  }>;
  candidateOverlap: Array<{
    personId: string;
    personName: string;
    opportunityCount: number;
    roleCount: number;
    avgScore: number;
    maxScore: number;
  }>;
};

export type WorkforceDashboardSkills = {
  requiredSkillDemand: Array<{ skillName: string; importance: string; roleCount: number }>;
  skillSupply: Array<{ skillName: string; people: number; avgLevel: number; avgYears: number }>;
  skillGaps: Array<{ skillName: string; requiredRoles: number; people: number; gap: number }>;
};

export type WorkforceDashboardSkillGap = WorkforceDashboardSkills["skillGaps"][number];

export type WorkforceDashboardEwa = {
  ewaByStatus: Array<{ ewaStatus: string; requests: number; requestedFte: number }>;
  ewaQueue: Array<{
    ewaRequestId: string;
    opportunityName: string;
    roleName: string;
    personName: string;
    requestType: string;
    ewaStatus: string;
    requestedFte: number;
    proposedStartDate: string;
    blockingReason: string | null;
    nextAction: string;
  }>;
  actionRequired: Array<{
    personId: string;
    personName: string;
    supplyRisk: string;
    suggestedAction: string;
    ewaActionRequired: string;
  }>;
};

export type WorkforceDashboardBundle = {
  summary: WorkforceDashboardSummary;
  supply: WorkforceDashboardSupply;
  demand: WorkforceDashboardDemand;
  staffingFit: WorkforceDashboardStaffingFit;
  skills: WorkforceDashboardSkills;
  ewa: WorkforceDashboardEwa;
};

type DashboardDatasetMetadata = {
  datasetId: string;
  sourceName: string;
  importedAt: string;
};

const availabilityCategoryOrder = (expr: string) => `
  CASE ${expr}
    WHEN 'Current Bench' THEN 0
    WHEN 'Partial Capacity' THEN 1
    WHEN 'Rolling Off 0-30' THEN 2
    WHEN 'Rolling Off 31-60' THEN 3
    WHEN 'Rolling Off 61-90' THEN 4
    WHEN 'Allocated >90' THEN 5
    ELSE 6
  END
`;

const supplyRiskOrder = (expr: string) => `
  CASE ${expr}
    WHEN 'High' THEN 0
    WHEN 'Medium' THEN 1
    WHEN 'Low' THEN 2
    ELSE 3
  END
`;

const stageOrder = (expr: string) => `
  CASE ${expr}
    WHEN 'Discovery' THEN 0
    WHEN 'Qualified' THEN 1
    WHEN 'Proposal' THEN 2
    WHEN 'Shortlisted' THEN 3
    WHEN 'Committed' THEN 4
    ELSE 5
  END
`;

const priorityOrder = (expr: string) => `
  CASE ${expr}
    WHEN 'High' THEN 0
    WHEN 'Medium' THEN 1
    WHEN 'Low' THEN 2
    ELSE 3
  END
`;

const makeDb = (dbPath: string) => new DatabaseSync(dbPath, { readOnly: true });

const all = <T extends QueryRow>(db: DatabaseSync, sql: string, params: QueryParam[] = []) =>
  db.prepare(sql).all(...params) as T[];

const get = <T extends QueryRow>(db: DatabaseSync, sql: string, params: QueryParam[] = []) =>
  ((db.prepare(sql).get(...params) as T | undefined) ?? null) as T | null;

const asNumber = (value: unknown) => {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number") return value;
  if (value == null || value === "") return 0;
  return Number(value);
};

const asString = (value: unknown) => {
  if (value == null) return "";
  return String(value);
};

const asNullableString = (value: unknown) => {
  const cleaned = asString(value).trim();
  return cleaned || null;
};

const withDashboardDb = <T>(
  dataset: WorkforceDatasetRecord,
  fn: (db: DatabaseSync, metadata: DashboardDatasetMetadata) => T,
) => {
  if (!existsSync(dataset.dbPath)) {
    throw new Error(`SQLite database not found for dataset ${dataset.datasetId}: ${dataset.dbPath}`);
  }

  const db = makeDb(dataset.dbPath);

  try {
    const importBatch = get<{ workbookName: string; importedAt: string }>(
      db,
      `
        SELECT workbookName, importedAt
        FROM "ImportBatch"
        ORDER BY id DESC
        LIMIT 1
      `,
    );

    return fn(db, {
      datasetId: dataset.datasetId,
      sourceName: asNullableString(importBatch?.workbookName) ?? dataset.originalFileName,
      importedAt: asNullableString(importBatch?.importedAt) ?? dataset.createdAt,
    });
  } finally {
    db.close();
  }
};

const buildSummary = (db: DatabaseSync, metadata: DashboardDatasetMetadata): WorkforceDashboardSummary => {
  const row =
    get<{
      people: number | bigint;
      opportunities: number | bigint;
      roles: number | bigint;
      requiredFte: number;
      availableFteCurrent: number;
      currentBenchPeople: number | bigint;
      partialCapacityPeople: number | bigint;
      highRiskSupplyPeople: number | bigint;
      pendingEwaRequests: number | bigint;
      feasibleRoles: number | bigint;
      totalRoles: number | bigint;
      noDirectFitPeople: number | bigint;
      noDirectFitFte: number;
    }>(
      db,
      `
        WITH feasible_roles AS (
          SELECT COUNT(DISTINCT opportunityRoleId) AS feasibleRoles
          FROM "OpportunityCandidateOverlay"
          WHERE fteGap <= 0
            AND (fitStatus LIKE 'Recommended%' OR fitStatus LIKE 'Backup%')
        ),
        no_direct_fit AS (
          SELECT
            COUNT(*) AS noDirectFitPeople,
            ROUND(COALESCE(SUM(supplyFte), 0), 1) AS noDirectFitFte
          FROM "SupplyRecord"
          WHERE LOWER(TRIM(targetRoleFit)) LIKE 'no direct fit%'
        )
        SELECT
          (SELECT COUNT(*) FROM "Person") AS people,
          (SELECT COUNT(*) FROM "Opportunity") AS opportunities,
          (SELECT COUNT(*) FROM "OpportunityRole") AS roles,
          (SELECT ROUND(COALESCE(SUM(fteRequired), 0), 1) FROM "OpportunityRole") AS requiredFte,
          (SELECT ROUND(COALESCE(SUM(availableFteCurrent), 0), 1) FROM "PersonAvailabilitySnapshot") AS availableFteCurrent,
          (SELECT COUNT(*) FROM "PersonAvailabilitySnapshot" WHERE availabilityCategory = 'Current Bench') AS currentBenchPeople,
          (SELECT COUNT(*) FROM "PersonAvailabilitySnapshot" WHERE availabilityCategory = 'Partial Capacity') AS partialCapacityPeople,
          (SELECT COUNT(*) FROM "SupplyRecord" WHERE supplyRisk = 'High') AS highRiskSupplyPeople,
          (SELECT COUNT(*) FROM "EwaRequest" WHERE ewaStatus = 'Pending Approval') AS pendingEwaRequests,
          COALESCE((SELECT feasibleRoles FROM feasible_roles), 0) AS feasibleRoles,
          (SELECT COUNT(*) FROM "OpportunityRole") AS totalRoles,
          COALESCE((SELECT noDirectFitPeople FROM no_direct_fit), 0) AS noDirectFitPeople,
          COALESCE((SELECT noDirectFitFte FROM no_direct_fit), 0) AS noDirectFitFte
      `,
    ) ?? {
      people: 0,
      opportunities: 0,
      roles: 0,
      requiredFte: 0,
      availableFteCurrent: 0,
      currentBenchPeople: 0,
      partialCapacityPeople: 0,
      highRiskSupplyPeople: 0,
      pendingEwaRequests: 0,
      feasibleRoles: 0,
      totalRoles: 0,
      noDirectFitPeople: 0,
      noDirectFitFte: 0,
    };

  return {
    datasetId: metadata.datasetId,
    sourceName: metadata.sourceName,
    importedAt: metadata.importedAt,
    kpis: {
      people: asNumber(row.people),
      opportunities: asNumber(row.opportunities),
      roles: asNumber(row.roles),
      requiredFte: asNumber(row.requiredFte),
      availableFteCurrent: asNumber(row.availableFteCurrent),
      currentBenchPeople: asNumber(row.currentBenchPeople),
      partialCapacityPeople: asNumber(row.partialCapacityPeople),
      highRiskSupplyPeople: asNumber(row.highRiskSupplyPeople),
      pendingEwaRequests: asNumber(row.pendingEwaRequests),
      feasibleRoles: asNumber(row.feasibleRoles),
      totalRoles: asNumber(row.totalRoles),
      noDirectFitPeople: asNumber(row.noDirectFitPeople),
      noDirectFitFte: asNumber(row.noDirectFitFte),
    },
  };
};

const buildSupply = (db: DatabaseSync): WorkforceDashboardSupply => ({
  availabilityByCategory: all<{
    availabilityCategory: string;
    people: number | bigint;
    availableFte: number;
  }>(
    db,
    `
      SELECT availabilityCategory, COUNT(*) AS people, ROUND(COALESCE(SUM(supplyFte), 0), 1) AS availableFte
      FROM "SupplyRecord"
      GROUP BY availabilityCategory
      ORDER BY ${availabilityCategoryOrder("availabilityCategory")}
    `,
  ).map((row) => ({
    availabilityCategory: asString(row.availabilityCategory),
    people: asNumber(row.people),
    availableFte: asNumber(row.availableFte),
  })),
  benchMovement: all<{
    weekStartDate: string;
    currentBenchHeadcount: number | bigint;
    emergingBenchHeadcount: number | bigint;
    partialCapacityHeadcount: number | bigint;
    availableFte: number;
  }>(
    db,
    `
      SELECT weekStartDate, currentBenchHeadcount, emergingBenchHeadcount, partialCapacityHeadcount, ROUND(COALESCE(availableFte, 0), 1) AS availableFte
      FROM "BenchMovementWeek"
      ORDER BY weekStartDate
    `,
  ).map((row) => ({
    weekStartDate: asString(row.weekStartDate),
    currentBenchHeadcount: asNumber(row.currentBenchHeadcount),
    emergingBenchHeadcount: asNumber(row.emergingBenchHeadcount),
    partialCapacityHeadcount: asNumber(row.partialCapacityHeadcount),
    availableFte: asNumber(row.availableFte),
  })),
  supplyRiskByCategory: all<{
    availabilityCategory: string;
    supplyRisk: string;
    people: number | bigint;
    fte: number;
  }>(
    db,
    `
      SELECT availabilityCategory, supplyRisk, COUNT(*) AS people, ROUND(COALESCE(SUM(supplyFte), 0), 1) AS fte
      FROM "SupplyRecord"
      GROUP BY availabilityCategory, supplyRisk
      ORDER BY ${availabilityCategoryOrder("availabilityCategory")}, ${supplyRiskOrder("supplyRisk")}
    `,
  ).map((row) => ({
    availabilityCategory: asString(row.availabilityCategory),
    supplyRisk: asString(row.supplyRisk),
    people: asNumber(row.people),
    fte: asNumber(row.fte),
  })),
  peopleByDiscipline: all<{
    discipline: string;
    people: number | bigint;
    availableFte: number;
  }>(
    db,
    `
      SELECT COALESCE(NULLIF(TRIM(p.discipline), ''), 'Unknown') AS discipline, COUNT(*) AS people, ROUND(COALESCE(SUM(pas.availableFteCurrent), 0), 1) AS availableFte
      FROM "Person" p
      JOIN "PersonAvailabilitySnapshot" pas ON pas.personId = p.id
      GROUP BY COALESCE(NULLIF(TRIM(p.discipline), ''), 'Unknown')
      ORDER BY availableFte DESC, people DESC, discipline ASC
    `,
  ).map((row) => ({
    discipline: asString(row.discipline),
    people: asNumber(row.people),
    availableFte: asNumber(row.availableFte),
  })),
  peopleByLocation: all<{
    country: string;
    city: string;
    people: number | bigint;
    availableFte: number;
  }>(
    db,
    `
      SELECT
        COALESCE(NULLIF(TRIM(p.country), ''), 'Unknown') AS country,
        COALESCE(NULLIF(TRIM(p.city), ''), 'Unknown') AS city,
        COUNT(*) AS people,
        ROUND(COALESCE(SUM(pas.availableFteCurrent), 0), 1) AS availableFte
      FROM "Person" p
      JOIN "PersonAvailabilitySnapshot" pas ON pas.personId = p.id
      GROUP BY COALESCE(NULLIF(TRIM(p.country), ''), 'Unknown'), COALESCE(NULLIF(TRIM(p.city), ''), 'Unknown')
      ORDER BY availableFte DESC, people DESC, country ASC, city ASC
    `,
  ).map((row) => ({
    country: asString(row.country),
    city: asString(row.city),
    people: asNumber(row.people),
    availableFte: asNumber(row.availableFte),
  })),
  highRiskPeople: all<{
    personId: string;
    name: string;
    discipline: string;
    grade: string;
    city: string;
    availabilityCategory: string;
    supplyFte: number;
    timeOnSupplyDays: number | bigint;
    suggestedAction: string;
  }>(
    db,
    `
      SELECT
        p.id AS personId,
        p.name,
        p.discipline,
        p.grade,
        p.city,
        s.availabilityCategory,
        ROUND(COALESCE(s.supplyFte, 0), 1) AS supplyFte,
        s.timeOnSupplyDays,
        s.suggestedAction
      FROM "SupplyRecord" s
      JOIN "Person" p ON p.id = s.personId
      WHERE s.supplyRisk = 'High'
      ORDER BY ${availabilityCategoryOrder("s.availabilityCategory")}, s.timeOnSupplyDays DESC, p.name ASC
      LIMIT 30
    `,
  ).map((row) => ({
    personId: asString(row.personId),
    name: asString(row.name),
    discipline: asString(row.discipline),
    grade: asString(row.grade),
    city: asString(row.city),
    availabilityCategory: asString(row.availabilityCategory),
    supplyFte: asNumber(row.supplyFte),
    timeOnSupplyDays: asNumber(row.timeOnSupplyDays),
    suggestedAction: asString(row.suggestedAction),
  })),
});

const buildDemand = (db: DatabaseSync): WorkforceDashboardDemand => ({
  demandByStage: all<{
    stage: string;
    opportunities: number | bigint;
    roles: number | bigint;
    requiredFte: number;
    avgProbability: number;
  }>(
    db,
    `
      SELECT
        o.stage,
        COUNT(DISTINCT o.id) AS opportunities,
        COUNT(r.id) AS roles,
        ROUND(COALESCE(SUM(r.fteRequired), 0), 1) AS requiredFte,
        ROUND(AVG(o.probability), 2) AS avgProbability
      FROM "Opportunity" o
      LEFT JOIN "OpportunityRole" r ON r.opportunityId = o.id
      GROUP BY o.stage
      ORDER BY ${stageOrder("o.stage")}, o.stage ASC
    `,
  ).map((row) => ({
    stage: asString(row.stage),
    opportunities: asNumber(row.opportunities),
    roles: asNumber(row.roles),
    requiredFte: asNumber(row.requiredFte),
    avgProbability: asNumber(row.avgProbability),
  })),
  demandByRole: all<{ roleName: string; roles: number | bigint; requiredFte: number }>(
    db,
    `
      SELECT roleName, COUNT(*) AS roles, ROUND(COALESCE(SUM(fteRequired), 0), 1) AS requiredFte
      FROM "OpportunityRole"
      GROUP BY roleName
      ORDER BY requiredFte DESC, roles DESC, roleName ASC
    `,
  ).map((row) => ({
    roleName: asString(row.roleName),
    roles: asNumber(row.roles),
    requiredFte: asNumber(row.requiredFte),
  })),
  deliveryRiskByPriority: all<{
    deliveryRisk: string;
    commercialPriority: string;
    opportunities: number | bigint;
    requiredFte: number;
  }>(
    db,
    `
      SELECT
        o.deliveryRisk,
        o.commercialPriority,
        COUNT(DISTINCT o.id) AS opportunities,
        ROUND(COALESCE(SUM(r.fteRequired), 0), 1) AS requiredFte
      FROM "Opportunity" o
      JOIN "OpportunityRole" r ON r.opportunityId = o.id
      GROUP BY o.deliveryRisk, o.commercialPriority
      ORDER BY ${supplyRiskOrder("o.deliveryRisk")}, ${priorityOrder("o.commercialPriority")}
    `,
  ).map((row) => ({
    deliveryRisk: asString(row.deliveryRisk),
    commercialPriority: asString(row.commercialPriority),
    opportunities: asNumber(row.opportunities),
    requiredFte: asNumber(row.requiredFte),
  })),
  topOpportunities: all<{
    opportunityId: string;
    name: string;
    clientName: string;
    stage: string;
    probability: number;
    deliveryRisk: string;
    roles: number | bigint;
    requiredFte: number;
    expectedStartDate: string;
  }>(
    db,
    `
      WITH opportunity_role_stats AS (
        SELECT opportunityId, COUNT(*) AS roles, ROUND(COALESCE(SUM(fteRequired), 0), 1) AS requiredFte
        FROM "OpportunityRole"
        GROUP BY opportunityId
      )
      SELECT
        o.id AS opportunityId,
        o.name,
        o.clientName,
        o.stage,
        o.probability,
        o.deliveryRisk,
        COALESCE(ors.roles, 0) AS roles,
        COALESCE(ors.requiredFte, 0) AS requiredFte,
        o.expectedStartDate
      FROM "Opportunity" o
      LEFT JOIN opportunity_role_stats ors ON ors.opportunityId = o.id
      ORDER BY ${priorityOrder("o.commercialPriority")}, o.probability DESC, o.expectedStartDate ASC, o.name ASC
      LIMIT 10
    `,
  ).map((row) => ({
    opportunityId: asString(row.opportunityId),
    name: asString(row.name),
    clientName: asString(row.clientName),
    stage: asString(row.stage),
    probability: asNumber(row.probability),
    deliveryRisk: asString(row.deliveryRisk),
    roles: asNumber(row.roles),
    requiredFte: asNumber(row.requiredFte),
    expectedStartDate: asString(row.expectedStartDate),
  })),
});

const buildStaffingFit = (db: DatabaseSync): WorkforceDashboardStaffingFit => ({
  fitDistribution: all<{
    fitStatus: string;
    candidates: number | bigint;
    avgScore: number;
    avgFteGap: number;
  }>(
    db,
    `
      SELECT fitStatus, COUNT(*) AS candidates, ROUND(AVG(overallStaffingScore), 1) AS avgScore, ROUND(AVG(fteGap), 1) AS avgFteGap
      FROM "OpportunityCandidateOverlay"
      GROUP BY fitStatus
      ORDER BY candidates DESC, avgScore DESC, fitStatus ASC
    `,
  ).map((row) => ({
    fitStatus: asString(row.fitStatus),
    candidates: asNumber(row.candidates),
    avgScore: asNumber(row.avgScore),
    avgFteGap: asNumber(row.avgFteGap),
  })),
  topCandidatePerRole: all<{
    opportunityId: string;
    opportunityName: string;
    roleName: string;
    personId: string;
    personName: string;
    fitStatus: string;
    rank: number | bigint;
    capabilityFitScore: number;
    availabilityFitScore: number;
    overallStaffingScore: number;
    availableFteAtStart: number;
    fteGap: number;
    ewaStatus: string;
  }>(
    db,
    `
      SELECT
        o.id AS opportunityId,
        o.name AS opportunityName,
        r.roleName,
        p.id AS personId,
        p.name AS personName,
        co.fitStatus,
        co.rank,
        ROUND(co.capabilityFitScore, 1) AS capabilityFitScore,
        ROUND(co.availabilityFitScore, 1) AS availabilityFitScore,
        ROUND(co.overallStaffingScore, 1) AS overallStaffingScore,
        ROUND(co.availableFteAtStart, 1) AS availableFteAtStart,
        ROUND(co.fteGap, 1) AS fteGap,
        COALESCE(NULLIF(TRIM(er.ewaStatus), ''), co.ewaStatus) AS ewaStatus
      FROM "OpportunityCandidateOverlay" co
      JOIN "Opportunity" o ON o.id = co.opportunityId
      JOIN "OpportunityRole" r ON r.id = co.opportunityRoleId
      JOIN "Person" p ON p.id = co.personId
      LEFT JOIN "EwaRequest" er
        ON er.opportunityRoleId = co.opportunityRoleId
       AND er.personId = co.personId
      WHERE co.rank = 1
      ORDER BY ${priorityOrder("o.commercialPriority")}, o.probability DESC, r.startDate ASC, o.name ASC, r.roleName ASC
    `,
  ).map((row) => ({
    opportunityId: asString(row.opportunityId),
    opportunityName: asString(row.opportunityName),
    roleName: asString(row.roleName),
    personId: asString(row.personId),
    personName: asString(row.personName),
    fitStatus: asString(row.fitStatus),
    rank: asNumber(row.rank),
    capabilityFitScore: asNumber(row.capabilityFitScore),
    availabilityFitScore: asNumber(row.availabilityFitScore),
    overallStaffingScore: asNumber(row.overallStaffingScore),
    availableFteAtStart: asNumber(row.availableFteAtStart),
    fteGap: asNumber(row.fteGap),
    ewaStatus: asString(row.ewaStatus),
  })),
  rolesWithoutFeasibleCandidate: all<{
    opportunityId: string;
    opportunityName: string;
    roleName: string;
    fteRequired: number;
    reason: string;
  }>(
    db,
    `
      SELECT
        o.id AS opportunityId,
        o.name AS opportunityName,
        r.roleName,
        ROUND(r.fteRequired, 1) AS fteRequired,
        CASE
          WHEN EXISTS (SELECT 1 FROM "OpportunityCandidateOverlay" co_any WHERE co_any.opportunityRoleId = r.id)
            THEN 'Availability or capability gap'
          ELSE 'No candidate overlay available'
        END AS reason
      FROM "OpportunityRole" r
      JOIN "Opportunity" o ON o.id = r.opportunityId
      WHERE NOT EXISTS (
        SELECT 1
        FROM "OpportunityCandidateOverlay" co
        WHERE co.opportunityRoleId = r.id
          AND co.fteGap <= 0
          AND (co.fitStatus LIKE 'Recommended%' OR co.fitStatus LIKE 'Backup%')
      )
      ORDER BY ${priorityOrder("o.commercialPriority")}, o.probability DESC, r.startDate ASC, o.name ASC, r.roleName ASC
    `,
  ).map((row) => ({
    opportunityId: asString(row.opportunityId),
    opportunityName: asString(row.opportunityName),
    roleName: asString(row.roleName),
    fteRequired: asNumber(row.fteRequired),
    reason: asString(row.reason),
  })),
  candidateOverlap: all<{
    personId: string;
    personName: string;
    opportunityCount: number | bigint;
    roleCount: number | bigint;
    avgScore: number;
    maxScore: number;
  }>(
    db,
    `
      SELECT
        p.id AS personId,
        p.name AS personName,
        COUNT(DISTINCT co.opportunityId) AS opportunityCount,
        COUNT(DISTINCT co.opportunityRoleId) AS roleCount,
        ROUND(AVG(co.overallStaffingScore), 1) AS avgScore,
        ROUND(MAX(co.overallStaffingScore), 1) AS maxScore
      FROM "OpportunityCandidateOverlay" co
      JOIN "Person" p ON p.id = co.personId
      GROUP BY p.id, p.name
      HAVING COUNT(DISTINCT co.opportunityRoleId) > 1
      ORDER BY roleCount DESC, maxScore DESC, avgScore DESC, personName ASC
      LIMIT 25
    `,
  ).map((row) => ({
    personId: asString(row.personId),
    personName: asString(row.personName),
    opportunityCount: asNumber(row.opportunityCount),
    roleCount: asNumber(row.roleCount),
    avgScore: asNumber(row.avgScore),
    maxScore: asNumber(row.maxScore),
  })),
});

const buildSkillGaps = (db: DatabaseSync): WorkforceDashboardSkillGap[] =>
  all<{
    skillName: string;
    requiredRoles: number | bigint;
    people: number | bigint;
    gap: number | bigint;
  }>(
    db,
    `
      WITH demand AS (
        SELECT skillName, COUNT(DISTINCT opportunityRoleId) AS requiredRoles
        FROM "OpportunityRoleSkillRequirement"
        WHERE importance = 'REQUIRED'
        GROUP BY skillName
      ),
      supply AS (
        SELECT skillName, COUNT(DISTINCT personId) AS people
        FROM "PersonSkillEvidence"
        GROUP BY skillName
      )
      SELECT d.skillName, d.requiredRoles, COALESCE(s.people, 0) AS people, MAX(d.requiredRoles - COALESCE(s.people, 0), 0) AS gap
      FROM demand d
      LEFT JOIN supply s ON s.skillName = d.skillName
      WHERE d.requiredRoles > COALESCE(s.people, 0)
      ORDER BY gap DESC, d.requiredRoles DESC, d.skillName ASC
    `,
  ).map((row) => ({
    skillName: asString(row.skillName),
    requiredRoles: asNumber(row.requiredRoles),
    people: asNumber(row.people),
    gap: asNumber(row.gap),
  }));

const buildSkills = (db: DatabaseSync): WorkforceDashboardSkills => ({
  requiredSkillDemand: all<{
    skillName: string;
    importance: string;
    roleCount: number | bigint;
  }>(
    db,
    `
      SELECT skillName, importance, COUNT(DISTINCT opportunityRoleId) AS roleCount
      FROM "OpportunityRoleSkillRequirement"
      GROUP BY skillName, importance
      ORDER BY CASE importance WHEN 'REQUIRED' THEN 0 ELSE 1 END, roleCount DESC, skillName ASC
    `,
  ).map((row) => ({
    skillName: asString(row.skillName),
    importance: asString(row.importance),
    roleCount: asNumber(row.roleCount),
  })),
  skillSupply: all<{
    skillName: string;
    people: number | bigint;
    avgLevel: number;
    avgYears: number;
  }>(
    db,
    `
      SELECT skillName, COUNT(DISTINCT personId) AS people, ROUND(AVG(skillLevel), 1) AS avgLevel, ROUND(AVG(yearsExperience), 1) AS avgYears
      FROM "PersonSkillEvidence"
      GROUP BY skillName
      ORDER BY people DESC, avgLevel DESC, avgYears DESC, skillName ASC
    `,
  ).map((row) => ({
    skillName: asString(row.skillName),
    people: asNumber(row.people),
    avgLevel: asNumber(row.avgLevel),
    avgYears: asNumber(row.avgYears),
  })),
  skillGaps: buildSkillGaps(db),
});

const buildEwa = (db: DatabaseSync): WorkforceDashboardEwa => ({
  ewaByStatus: all<{ ewaStatus: string; requests: number | bigint; requestedFte: number }>(
    db,
    `
      SELECT ewaStatus, COUNT(*) AS requests, ROUND(COALESCE(SUM(requestedFte), 0), 1) AS requestedFte
      FROM "EwaRequest"
      GROUP BY ewaStatus
      ORDER BY CASE ewaStatus WHEN 'Blocked' THEN 0 WHEN 'Pending Approval' THEN 1 WHEN 'Draft' THEN 2 ELSE 3 END, ewaStatus ASC
    `,
  ).map((row) => ({
    ewaStatus: asString(row.ewaStatus),
    requests: asNumber(row.requests),
    requestedFte: asNumber(row.requestedFte),
  })),
  ewaQueue: all<{
    ewaRequestId: string;
    opportunityName: string;
    roleName: string;
    personName: string;
    requestType: string;
    ewaStatus: string;
    requestedFte: number;
    proposedStartDate: string;
    blockingReason: string | null;
    nextAction: string | null;
  }>(
    db,
    `
      SELECT
        er.id AS ewaRequestId,
        o.name AS opportunityName,
        r.roleName,
        p.name AS personName,
        er.requestType,
        er.ewaStatus,
        ROUND(er.requestedFte, 1) AS requestedFte,
        er.proposedStartDate,
        NULLIF(TRIM(er.blockingReason), '') AS blockingReason,
        NULLIF(TRIM(er.nextAction), '') AS nextAction
      FROM "EwaRequest" er
      JOIN "Opportunity" o ON o.id = er.opportunityId
      JOIN "OpportunityRole" r ON r.id = er.opportunityRoleId
      JOIN "Person" p ON p.id = er.personId
      ORDER BY
        CASE er.ewaStatus WHEN 'Blocked' THEN 0 WHEN 'Pending Approval' THEN 1 WHEN 'Draft' THEN 2 ELSE 3 END,
        er.lastUpdated DESC,
        er.proposedStartDate ASC,
        o.name ASC,
        r.roleName ASC
      LIMIT 50
    `,
  ).map((row) => ({
    ewaRequestId: asString(row.ewaRequestId),
    opportunityName: asString(row.opportunityName),
    roleName: asString(row.roleName),
    personName: asString(row.personName),
    requestType: asString(row.requestType),
    ewaStatus: asString(row.ewaStatus),
    requestedFte: asNumber(row.requestedFte),
    proposedStartDate: asString(row.proposedStartDate),
    blockingReason: asNullableString(row.blockingReason),
    nextAction: asNullableString(row.nextAction) ?? "",
  })),
  actionRequired: all<{
    personId: string;
    personName: string;
    supplyRisk: string;
    suggestedAction: string;
    ewaActionRequired: string;
  }>(
    db,
    `
      SELECT p.id AS personId, p.name AS personName, s.supplyRisk, s.suggestedAction, s.ewaActionRequired
      FROM "SupplyRecord" s
      JOIN "Person" p ON p.id = s.personId
      WHERE s.supplyRisk = 'High' OR LOWER(TRIM(s.ewaActionRequired)) = 'yes'
      ORDER BY ${supplyRiskOrder("s.supplyRisk")}, s.timeOnSupplyDays DESC, p.name ASC
      LIMIT 30
    `,
  ).map((row) => ({
    personId: asString(row.personId),
    personName: asString(row.personName),
    supplyRisk: asString(row.supplyRisk),
    suggestedAction: asString(row.suggestedAction),
    ewaActionRequired: asString(row.ewaActionRequired),
  })),
});

export const buildWorkforceDashboard = (dataset: WorkforceDatasetRecord): WorkforceDashboardBundle =>
  withDashboardDb(dataset, (db, metadata) => ({
    summary: buildSummary(db, metadata),
    supply: buildSupply(db),
    demand: buildDemand(db),
    staffingFit: buildStaffingFit(db),
    skills: buildSkills(db),
    ewa: buildEwa(db),
  }));

export const buildWorkforceDashboardSection = <T extends WorkforceDashboardSection>(
  dataset: WorkforceDatasetRecord,
  section: T,
): WorkforceDashboardBundle[T] =>
  withDashboardDb(dataset, (db, metadata) => {
    switch (section) {
      case "summary":
        return buildSummary(db, metadata) as WorkforceDashboardBundle[T];
      case "supply":
        return buildSupply(db) as WorkforceDashboardBundle[T];
      case "demand":
        return buildDemand(db) as WorkforceDashboardBundle[T];
      case "staffingFit":
        return buildStaffingFit(db) as WorkforceDashboardBundle[T];
      case "skills":
        return buildSkills(db) as WorkforceDashboardBundle[T];
      case "ewa":
        return buildEwa(db) as WorkforceDashboardBundle[T];
      default: {
        const exhaustiveCheck: never = section;
        throw new Error(`Unsupported dashboard section: ${String(exhaustiveCheck)}`);
      }
    }
  });

export const buildWorkforceDashboardSkillGaps = (dataset: WorkforceDatasetRecord): WorkforceDashboardSkillGap[] =>
  withDashboardDb(dataset, (db) => buildSkillGaps(db));
