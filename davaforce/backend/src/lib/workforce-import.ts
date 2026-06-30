import { existsSync, mkdirSync, rmSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { WorkforceUploadProgressUpdate } from "./workforce-upload-progress";
import { WORKFORCE_UPLOAD_STEP_LABELS } from "./workforce-upload-progress";
import type { WorkbookRow, WorkbookSheets } from "./workbook-xlsx";
import { readWorkbookSheets } from "./workbook-xlsx";
import {
  DEFAULT_DB_PATH,
  DEFAULT_EXCEL_PATH,
  NATURAL_KEY_COLUMNS,
  asBool,
  asFloat,
  asInt,
  ensureRequiredSheets,
  optionalText,
  parseSemicolonList,
  rowHash,
  rowPayloadJson,
  text,
  utcNowIsoWithOffset,
  workbookVersion,
} from "./workforce-data-utils";

export type WorkforceImportOptions = {
  excelPath?: string;
  dbPath?: string;
  replace?: boolean;
  workbookName?: string;
  onProgress?: (update: WorkforceUploadProgressUpdate) => void | Promise<void>;
};

export type WorkforceImportResult = {
  excelPath: string;
  dbPath: string;
  workbookName: string;
  counts: Record<string, number>;
};

type SqliteValue = string | number | bigint | Uint8Array | null;

const yieldToEventLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const notifyProgress = async (
  onProgress: WorkforceImportOptions["onProgress"],
  update: WorkforceUploadProgressUpdate,
) => {
  await onProgress?.(update);
  await yieldToEventLoop();
};

const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE "ImportBatch" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "workbookName" TEXT NOT NULL,
  "workbookVersion" TEXT,
  "importedAt" TEXT NOT NULL
);

CREATE TABLE "RawSheetRow" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "importBatchId" INTEGER NOT NULL,
  "sheetName" TEXT NOT NULL,
  "sourceRowNumber" INTEGER NOT NULL,
  "naturalKey" TEXT,
  "rowHash" TEXT NOT NULL,
  "payloadJson" TEXT NOT NULL,
  FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "RawSheetRow_importBatch_sheet_row_key"
  ON "RawSheetRow"("importBatchId", "sheetName", "sourceRowNumber");
CREATE INDEX "RawSheetRow_sheetName_idx" ON "RawSheetRow"("sheetName");
CREATE INDEX "RawSheetRow_naturalKey_idx" ON "RawSheetRow"("naturalKey");

CREATE TABLE "Person" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "discipline" TEXT NOT NULL,
  "roleArchetype" TEXT NOT NULL,
  "grade" TEXT NOT NULL,
  "careerLevel" INTEGER NOT NULL,
  "primaryDomain" TEXT NOT NULL,
  "secondaryDomain" TEXT NOT NULL,
  "workMode" TEXT NOT NULL
);

CREATE TABLE "PersonAvailabilitySnapshot" (
  "personId" TEXT NOT NULL PRIMARY KEY,
  "availabilityCategory" TEXT NOT NULL,
  "currentAllocationFte" REAL NOT NULL,
  "availableFteCurrent" REAL NOT NULL,
  "expectedReleaseDate" TEXT NOT NULL,
  "releaseWindow" TEXT NOT NULL,
  "ewaStatus" TEXT NOT NULL,
  "currentAccountId" TEXT,
  "currentProjectId" TEXT,
  "currentRole" TEXT,
  "currentProjectStart" TEXT,
  "currentProjectEnd" TEXT,
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE
);

CREATE INDEX "PersonAvailabilitySnapshot_category_idx"
  ON "PersonAvailabilitySnapshot"("availabilityCategory");
CREATE INDEX "PersonAvailabilitySnapshot_release_idx"
  ON "PersonAvailabilitySnapshot"("expectedReleaseDate");

CREATE TABLE "Profile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "personId" TEXT NOT NULL UNIQUE,
  "profileSummary" TEXT NOT NULL,
  "keyStrengthsText" TEXT NOT NULL,
  "preferredWorkTypes" TEXT NOT NULL,
  "domainExperienceSummary" TEXT NOT NULL,
  "certificationsText" TEXT NOT NULL,
  "recentHighlights" TEXT NOT NULL,
  "mobilityNotes" TEXT NOT NULL,
  "languagesText" TEXT NOT NULL,
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE
);

CREATE TABLE "SkillCatalog" (
  "name" TEXT NOT NULL PRIMARY KEY,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "relevantDepartmentsText" TEXT NOT NULL,
  "suggestedLevelScaleText" TEXT NOT NULL
);

CREATE INDEX "SkillCatalog_category_idx" ON "SkillCatalog"("category");

CREATE TABLE "PersonSkillEvidence" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "personId" TEXT NOT NULL,
  "skillName" TEXT NOT NULL,
  "skillLevel" INTEGER NOT NULL,
  "yearsExperience" REAL NOT NULL,
  "lastUsedDate" TEXT NOT NULL,
  "evidenceSource" TEXT NOT NULL,
  "confidence" TEXT NOT NULL,
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE,
  FOREIGN KEY ("skillName") REFERENCES "SkillCatalog"("name")
);

CREATE UNIQUE INDEX "PersonSkillEvidence_person_skill_key"
  ON "PersonSkillEvidence"("personId", "skillName");
CREATE INDEX "PersonSkillEvidence_skill_idx" ON "PersonSkillEvidence"("skillName");
CREATE INDEX "PersonSkillEvidence_confidence_idx" ON "PersonSkillEvidence"("confidence");

CREATE TABLE "CurrentAllocation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "personId" TEXT NOT NULL UNIQUE,
  "accountId" TEXT NOT NULL,
  "clientName" TEXT NOT NULL,
  "clientType" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "projectName" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "roleOnProject" TEXT NOT NULL,
  "allocationFte" REAL NOT NULL,
  "startDate" TEXT NOT NULL,
  "plannedEndDate" TEXT NOT NULL,
  "allocationStatus" TEXT NOT NULL,
  "ewaStatus" TEXT NOT NULL,
  "lastUpdated" TEXT NOT NULL,
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE
);

CREATE INDEX "CurrentAllocation_account_idx" ON "CurrentAllocation"("accountId");
CREATE INDEX "CurrentAllocation_project_idx" ON "CurrentAllocation"("projectId");
CREATE INDEX "CurrentAllocation_end_date_idx" ON "CurrentAllocation"("plannedEndDate");
CREATE INDEX "CurrentAllocation_status_idx" ON "CurrentAllocation"("allocationStatus");

CREATE TABLE "SupplyRecord" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "personId" TEXT NOT NULL UNIQUE,
  "supplyType" TEXT NOT NULL,
  "availabilityCategory" TEXT NOT NULL,
  "availableFrom" TEXT NOT NULL,
  "supplyFte" REAL NOT NULL,
  "supplyPercent" REAL NOT NULL,
  "primaryDomain" TEXT NOT NULL,
  "topSkillsText" TEXT NOT NULL,
  "supplyRisk" TEXT NOT NULL,
  "timeOnSupplyDays" INTEGER NOT NULL,
  "suggestedAction" TEXT NOT NULL,
  "targetRoleFit" TEXT NOT NULL,
  "ewaActionRequired" TEXT NOT NULL,
  "isAlsoInPartialCapacityView" INTEGER NOT NULL,
  "recordUsage" TEXT NOT NULL,
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE
);

CREATE INDEX "SupplyRecord_type_idx" ON "SupplyRecord"("supplyType");
CREATE INDEX "SupplyRecord_category_idx" ON "SupplyRecord"("availabilityCategory");
CREATE INDEX "SupplyRecord_available_from_idx" ON "SupplyRecord"("availableFrom");
`;

const EXTRA_SCHEMA_SQL = `
CREATE TABLE "PartialCapacityView" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "personId" TEXT NOT NULL UNIQUE,
  "sourceBenchRecordId" TEXT NOT NULL,
  "benchType" TEXT NOT NULL,
  "availabilityCategory" TEXT NOT NULL,
  "availableFrom" TEXT NOT NULL,
  "benchFte" REAL NOT NULL,
  "benchPercent" REAL NOT NULL,
  "primaryDomain" TEXT NOT NULL,
  "topSkillsText" TEXT NOT NULL,
  "benchRisk" TEXT NOT NULL,
  "timeOnBenchDays" INTEGER NOT NULL,
  "suggestedAction" TEXT NOT NULL,
  "targetRoleFit" TEXT NOT NULL,
  "ewaActionRequired" TEXT NOT NULL,
  "viewType" TEXT NOT NULL,
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE,
  FOREIGN KEY ("sourceBenchRecordId") REFERENCES "SupplyRecord"("id")
);

CREATE INDEX "PartialCapacityView_source_idx"
  ON "PartialCapacityView"("sourceBenchRecordId");

CREATE TABLE "AvailabilityWeek" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "personId" TEXT NOT NULL,
  "weekStartDate" TEXT NOT NULL,
  "availableFte" REAL NOT NULL,
  "availabilityType" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "confidence" TEXT NOT NULL,
  "ewaStatus" TEXT NOT NULL,
  "notes" TEXT NOT NULL,
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "AvailabilityWeek_person_week_key"
  ON "AvailabilityWeek"("personId", "weekStartDate");
CREATE INDEX "AvailabilityWeek_week_idx" ON "AvailabilityWeek"("weekStartDate");
CREATE INDEX "AvailabilityWeek_type_idx" ON "AvailabilityWeek"("availabilityType");

CREATE TABLE "BenchMovementWeek" (
  "weekStartDate" TEXT NOT NULL PRIMARY KEY,
  "currentBenchHeadcount" INTEGER NOT NULL,
  "emergingBenchHeadcount" INTEGER NOT NULL,
  "partialCapacityHeadcount" INTEGER NOT NULL,
  "availableFte" REAL NOT NULL,
  "notes" TEXT NOT NULL
);

CREATE TABLE "ProjectHistory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "personId" TEXT NOT NULL,
  "clientName" TEXT NOT NULL,
  "clientType" TEXT NOT NULL,
  "projectName" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "startDate" TEXT NOT NULL,
  "endDate" TEXT NOT NULL,
  "keyTechnologiesOrMethods" TEXT NOT NULL,
  "responsibilities" TEXT NOT NULL,
  "outcomeEvidence" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "teamSize" INTEGER NOT NULL,
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE
);

CREATE INDEX "ProjectHistory_person_idx" ON "ProjectHistory"("personId");
CREATE INDEX "ProjectHistory_domain_idx" ON "ProjectHistory"("domain");
CREATE INDEX "ProjectHistory_end_date_idx" ON "ProjectHistory"("endDate");

CREATE TABLE "Opportunity" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clientName" TEXT NOT NULL,
  "clientType" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "region" TEXT NOT NULL,
  "country" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "probability" REAL NOT NULL,
  "expectedStartDate" TEXT NOT NULL,
  "durationWeeks" INTEGER NOT NULL,
  "commercialPriority" TEXT NOT NULL,
  "deliveryRisk" TEXT NOT NULL,
  "opportunityBrief" TEXT NOT NULL,
  "timezonePreference" TEXT NOT NULL
);

CREATE INDEX "Opportunity_client_idx" ON "Opportunity"("clientName");
CREATE INDEX "Opportunity_stage_idx" ON "Opportunity"("stage");
CREATE INDEX "Opportunity_start_idx" ON "Opportunity"("expectedStartDate");

CREATE TABLE "OpportunityRole" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "opportunityId" TEXT NOT NULL,
  "roleName" TEXT NOT NULL,
  "disciplineOrDepartment" TEXT NOT NULL,
  "gradePreference" TEXT NOT NULL,
  "requiredSkillsText" TEXT NOT NULL,
  "desiredSkillsText" TEXT NOT NULL,
  "domainExperienceRequired" TEXT NOT NULL,
  "locationPreference" TEXT NOT NULL,
  "startDate" TEXT NOT NULL,
  "durationWeeks" INTEGER NOT NULL,
  "fteRequired" REAL NOT NULL,
  "priority" TEXT NOT NULL,
  "flexibilityNotes" TEXT NOT NULL,
  "minimumIndividualFte" REAL NOT NULL,
  "canCombineCandidates" INTEGER NOT NULL,
  FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE
);

CREATE INDEX "OpportunityRole_opp_idx" ON "OpportunityRole"("opportunityId");
CREATE INDEX "OpportunityRole_start_idx" ON "OpportunityRole"("startDate");
CREATE INDEX "OpportunityRole_priority_idx" ON "OpportunityRole"("priority");

CREATE TABLE "OpportunityRoleSkillRequirement" (
  "opportunityRoleId" TEXT NOT NULL,
  "skillName" TEXT NOT NULL,
  "importance" TEXT NOT NULL,
  PRIMARY KEY ("opportunityRoleId", "skillName", "importance"),
  FOREIGN KEY ("opportunityRoleId") REFERENCES "OpportunityRole"("id") ON DELETE CASCADE,
  FOREIGN KEY ("skillName") REFERENCES "SkillCatalog"("name")
);

CREATE INDEX "OpportunityRoleSkillRequirement_skill_idx"
  ON "OpportunityRoleSkillRequirement"("skillName");
CREATE INDEX "OpportunityRoleSkillRequirement_importance_idx"
  ON "OpportunityRoleSkillRequirement"("importance");
`;

const FINAL_SCHEMA_SQL = `
CREATE TABLE "OpportunityCandidateOverlay" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "opportunityId" TEXT NOT NULL,
  "opportunityRoleId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "fitStatus" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "matchScore" REAL NOT NULL,
  "rationale" TEXT NOT NULL,
  "constraint" TEXT NOT NULL,
  "ewaStatus" TEXT NOT NULL,
  "plannerNotes" TEXT NOT NULL,
  "capabilityFitScore" REAL NOT NULL,
  "availabilityFitScore" REAL NOT NULL,
  "overallStaffingScore" REAL NOT NULL,
  "availableFteAtStart" REAL NOT NULL,
  "fteGap" REAL NOT NULL,
  "earliestFullAvailabilityDate" TEXT NOT NULL,
  "requiredSkillsMatched" INTEGER NOT NULL,
  "requiredSkillsTotal" INTEGER NOT NULL,
  "desiredSkillsMatched" INTEGER NOT NULL,
  "desiredSkillsTotal" INTEGER NOT NULL,
  FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE,
  FOREIGN KEY ("opportunityRoleId") REFERENCES "OpportunityRole"("id") ON DELETE CASCADE,
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "OpportunityCandidateOverlay_role_person_key"
  ON "OpportunityCandidateOverlay"("opportunityRoleId", "personId");
CREATE INDEX "OpportunityCandidateOverlay_opp_idx"
  ON "OpportunityCandidateOverlay"("opportunityId");
CREATE INDEX "OpportunityCandidateOverlay_person_idx"
  ON "OpportunityCandidateOverlay"("personId");
CREATE INDEX "OpportunityCandidateOverlay_rank_idx"
  ON "OpportunityCandidateOverlay"("rank");

CREATE TABLE "EwaRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "opportunityId" TEXT NOT NULL,
  "opportunityRoleId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "requestType" TEXT NOT NULL,
  "ewaStatus" TEXT NOT NULL,
  "requestedFte" REAL NOT NULL,
  "proposedStartDate" TEXT NOT NULL,
  "proposedEndDate" TEXT NOT NULL,
  "approvalRequired" INTEGER NOT NULL,
  "bookingOwner" TEXT NOT NULL,
  "blockingReason" TEXT NOT NULL,
  "nextAction" TEXT NOT NULL,
  "lastUpdated" TEXT NOT NULL,
  "notes" TEXT NOT NULL,
  "availableFteAtStart" REAL NOT NULL,
  "fteGap" REAL NOT NULL,
  "canSplitRole" INTEGER NOT NULL,
  "earliestFullAvailabilityDate" TEXT NOT NULL,
  FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE,
  FOREIGN KEY ("opportunityRoleId") REFERENCES "OpportunityRole"("id") ON DELETE CASCADE,
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "EwaRequest_role_person_key"
  ON "EwaRequest"("opportunityRoleId", "personId");
CREATE INDEX "EwaRequest_opp_idx" ON "EwaRequest"("opportunityId");
CREATE INDEX "EwaRequest_person_idx" ON "EwaRequest"("personId");
CREATE INDEX "EwaRequest_status_idx" ON "EwaRequest"("ewaStatus");

CREATE TABLE "ScenarioTarget" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "scenarioName" TEXT NOT NULL,
  "targetDate" TEXT NOT NULL,
  "targetBenchRate" REAL NOT NULL,
  "targetBenchHeadcount" INTEGER NOT NULL,
  "focus" TEXT NOT NULL,
  "successMeasure" TEXT NOT NULL
);

CREATE INDEX "ScenarioTarget_date_idx" ON "ScenarioTarget"("targetDate");
`;

const createDatabase = (dbPath: string, replace: boolean) => {
  mkdirSync(dirname(dbPath), { recursive: true });
  if (existsSync(dbPath)) {
    if (!replace) {
      throw new Error(`${dbPath} already exists. Re-run with --replace to rebuild it.`);
    }
    rmSync(dbPath);
  }

  const db = new DatabaseSync(dbPath);
  db.exec(SCHEMA_SQL);
  db.exec(EXTRA_SCHEMA_SQL);
  db.exec(FINAL_SCHEMA_SQL);
  return db;
};

const runMany = (db: DatabaseSync, sql: string, rows: SqliteValue[][]) => {
  const statement = db.prepare(sql);
  for (const row of rows) {
    statement.run(...row);
  }
};

const sheetValues = (sheets: WorkbookSheets, sheetName: string) => sheets[sheetName].rows.map((row) => row.values);

const insertImportBatch = (db: DatabaseSync, workbookName: string, version: string | null) => {
  const result = db
    .prepare(
      `
        INSERT INTO "ImportBatch" ("workbookName", "workbookVersion", "importedAt")
        VALUES (?, ?, ?)
      `,
    )
    .run(workbookName, version, utcNowIsoWithOffset());
  return Number(result.lastInsertRowid);
};

const loadRawSheetRows = (db: DatabaseSync, importBatchId: number, sheets: WorkbookSheets) => {
  const rowsToInsert: SqliteValue[][] = [];
  for (const [sheetName, sheetData] of Object.entries(sheets)) {
    const naturalKeyColumn = NATURAL_KEY_COLUMNS[sheetName];
    for (const row of sheetData.rows) {
      const payloadJson = rowPayloadJson(row.values);
      const naturalKey = naturalKeyColumn ? optionalText(row.values[naturalKeyColumn]) : null;
      rowsToInsert.push([
        importBatchId,
        sheetName,
        row.rowNumber,
        naturalKey,
        rowHash(payloadJson),
        payloadJson,
      ]);
    }
  }

  runMany(
    db,
    `
      INSERT INTO "RawSheetRow"
        ("importBatchId", "sheetName", "sourceRowNumber", "naturalKey", "rowHash", "payloadJson")
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    rowsToInsert,
  );
  return rowsToInsert.length;
};

const insertPeople = (db: DatabaseSync, rows: WorkbookRow[]) => {
  const payload = rows.map((row) => [
    text(row.Employee_ID),
    text(row.Employee_Name),
    text(row.Region),
    text(row.Country),
    text(row.City),
    text(row.Timezone),
    text(row.Department),
    text(row.Discipline),
    text(row.RoleArchetype),
    text(row.Grade),
    asInt(row.CareerLevel),
    text(row.PrimaryDomain),
    text(row.SecondaryDomain),
    text(row.WorkMode),
  ]);

  runMany(
    db,
    `
      INSERT INTO "Person"
        ("id", "name", "region", "country", "city", "timezone", "department",
         "discipline", "roleArchetype", "grade", "careerLevel", "primaryDomain",
         "secondaryDomain", "workMode")
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    payload,
  );
  return payload.length;
};

const insertPersonSnapshots = (db: DatabaseSync, rows: WorkbookRow[]) => {
  const payload = rows.map((row) => [
    text(row.Employee_ID),
    text(row.AvailabilityCategory),
    asFloat(row.CurrentAllocationFTE),
    asFloat(row.AvailableFTECurrent),
    text(row.ExpectedReleaseDate),
    text(row.ReleaseWindow),
    text(row.EWAStatus),
    optionalText(row.CurrentAccountID),
    optionalText(row.CurrentProjectID),
    optionalText(row.CurrentRole),
    optionalText(row.CurrentProjectStart),
    optionalText(row.CurrentProjectEnd),
  ]);

  runMany(
    db,
    `
      INSERT INTO "PersonAvailabilitySnapshot"
        ("personId", "availabilityCategory", "currentAllocationFte", "availableFteCurrent",
         "expectedReleaseDate", "releaseWindow", "ewaStatus", "currentAccountId",
         "currentProjectId", "currentRole", "currentProjectStart", "currentProjectEnd")
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    payload,
  );
  return payload.length;
};

const insertProfiles = (db: DatabaseSync, rows: WorkbookRow[]) => {
  const payload = rows.map((row) => [
    text(row.Profile_ID),
    text(row.Employee_ID),
    text(row.ProfileSummary),
    text(row.KeyStrengths),
    text(row.PreferredWorkTypes),
    text(row.DomainExperienceSummary),
    text(row.Certifications),
    text(row.RecentHighlights),
    text(row.MobilityNotes),
    text(row.Languages),
  ]);

  runMany(
    db,
    `
      INSERT INTO "Profile"
        ("id", "personId", "profileSummary", "keyStrengthsText", "preferredWorkTypes",
         "domainExperienceSummary", "certificationsText", "recentHighlights",
         "mobilityNotes", "languagesText")
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    payload,
  );
  return payload.length;
};

const insertSkillCatalog = (db: DatabaseSync, rows: WorkbookRow[]) => {
  const payload = rows.map((row) => [
    text(row.SkillName),
    text(row.SkillCategory),
    text(row.Description),
    text(row.RelevantDepartments),
    text(row.SuggestedLevelScale),
  ]);

  runMany(
    db,
    `
      INSERT INTO "SkillCatalog"
        ("name", "category", "description", "relevantDepartmentsText", "suggestedLevelScaleText")
      VALUES (?, ?, ?, ?, ?)
    `,
    payload,
  );
  return payload.length;
};

const insertPersonSkills = (db: DatabaseSync, rows: WorkbookRow[]) => {
  const payload = rows.map((row) => [
    text(row.Skill_Row_ID),
    text(row.Employee_ID),
    text(row.SkillName),
    asInt(row.SkillLevel),
    asFloat(row.YearsExperience),
    text(row.LastUsedDate),
    text(row.EvidenceSource),
    text(row.Confidence),
  ]);

  runMany(
    db,
    `
      INSERT INTO "PersonSkillEvidence"
        ("id", "personId", "skillName", "skillLevel", "yearsExperience",
         "lastUsedDate", "evidenceSource", "confidence")
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    payload,
  );
  return payload.length;
};

const insertCurrentAllocations = (db: DatabaseSync, rows: WorkbookRow[]) => {
  const payload = rows.map((row) => [
    text(row.Allocation_ID),
    text(row.Employee_ID),
    text(row.AccountID),
    text(row.Client_Name),
    text(row.Client_Type),
    text(row.ProjectID),
    text(row.Project_Name),
    text(row.Domain),
    text(row.RoleOnProject),
    asFloat(row.AllocationFTE),
    text(row.StartDate),
    text(row.PlannedEndDate),
    text(row.AllocationStatus),
    text(row.EWAStatus),
    text(row.LastUpdated),
  ]);

  runMany(
    db,
    `
      INSERT INTO "CurrentAllocation"
        ("id", "personId", "accountId", "clientName", "clientType", "projectId",
         "projectName", "domain", "roleOnProject", "allocationFte", "startDate",
         "plannedEndDate", "allocationStatus", "ewaStatus", "lastUpdated")
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    payload,
  );
  return payload.length;
};

const insertSupplyRecords = (db: DatabaseSync, rows: WorkbookRow[]) => {
  const payload = rows.map((row) => [
    text(row.Bench_Record_ID),
    text(row.Employee_ID),
    text(row.BenchType),
    text(row.AvailabilityCategory),
    text(row.AvailableFrom),
    asFloat(row.BenchFTE),
    asFloat(row.BenchPercent),
    text(row.PrimaryDomain),
    text(row.TopSkills),
    text(row.BenchRisk),
    asInt(row.TimeOnBenchDays),
    text(row.SuggestedAction),
    text(row.TargetRoleFit),
    text(row.EWAActionRequired),
    asBool(row.IsAlsoInPartialCapacityView) ? 1 : 0,
    text(row.RecordUsage),
  ]);

  runMany(
    db,
    `
      INSERT INTO "SupplyRecord"
        ("id", "personId", "supplyType", "availabilityCategory", "availableFrom",
         "supplyFte", "supplyPercent", "primaryDomain", "topSkillsText", "supplyRisk",
         "timeOnSupplyDays", "suggestedAction", "targetRoleFit", "ewaActionRequired",
         "isAlsoInPartialCapacityView", "recordUsage")
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    payload,
  );
  return payload.length;
};

const insertPartialCapacityView = (db: DatabaseSync, rows: WorkbookRow[]) => {
  const payload = rows.map((row) => [
    text(row.Bench_Record_ID),
    text(row.Employee_ID),
    text(row.SourceBenchRecordID),
    text(row.BenchType),
    text(row.AvailabilityCategory),
    text(row.AvailableFrom),
    asFloat(row.BenchFTE),
    asFloat(row.BenchPercent),
    text(row.PrimaryDomain),
    text(row.TopSkills),
    text(row.BenchRisk),
    asInt(row.TimeOnBenchDays),
    text(row.SuggestedAction),
    text(row.TargetRoleFit),
    text(row.EWAActionRequired),
    text(row.ViewType),
  ]);

  runMany(
    db,
    `
      INSERT INTO "PartialCapacityView"
        ("id", "personId", "sourceBenchRecordId", "benchType", "availabilityCategory",
         "availableFrom", "benchFte", "benchPercent", "primaryDomain", "topSkillsText",
         "benchRisk", "timeOnBenchDays", "suggestedAction", "targetRoleFit",
         "ewaActionRequired", "viewType")
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    payload,
  );
  return payload.length;
};

const insertAvailabilityWeeks = (db: DatabaseSync, rows: WorkbookRow[]) => {
  const payload = rows.map((row) => [
    text(row.Availability_ID),
    text(row.Employee_ID),
    text(row.WeekStartDate),
    asFloat(row.AvailableFTE),
    text(row.AvailabilityType),
    text(row.Source),
    text(row.Confidence),
    text(row.EWAStatus),
    text(row.Notes),
  ]);

  runMany(
    db,
    `
      INSERT INTO "AvailabilityWeek"
        ("id", "personId", "weekStartDate", "availableFte", "availabilityType",
         "source", "confidence", "ewaStatus", "notes")
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    payload,
  );
  return payload.length;
};

const insertBenchMovement = (db: DatabaseSync, rows: WorkbookRow[]) => {
  const payload = rows.map((row) => [
    text(row.WeekStartDate),
    asInt(row.CurrentBenchHeadcount),
    asInt(row.EmergingBenchHeadcount),
    asInt(row.PartialCapacityHeadcount),
    asFloat(row.AvailableFTE),
    text(row.Notes),
  ]);

  runMany(
    db,
    `
      INSERT INTO "BenchMovementWeek"
        ("weekStartDate", "currentBenchHeadcount", "emergingBenchHeadcount",
         "partialCapacityHeadcount", "availableFte", "notes")
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    payload,
  );
  return payload.length;
};

const insertProjectHistory = (db: DatabaseSync, rows: WorkbookRow[]) => {
  const payload = rows.map((row) => [
    text(row.History_ID),
    text(row.Employee_ID),
    text(row.Client_Name),
    text(row.Client_Type),
    text(row.Project_Name),
    text(row.Domain),
    text(row.Role),
    text(row.StartDate),
    text(row.EndDate),
    text(row.KeyTechnologiesOrMethods),
    text(row.Responsibilities),
    text(row.OutcomeEvidence),
    text(row.Region),
    asInt(row.TeamSize),
  ]);

  runMany(
    db,
    `
      INSERT INTO "ProjectHistory"
        ("id", "personId", "clientName", "clientType", "projectName", "domain", "role",
         "startDate", "endDate", "keyTechnologiesOrMethods", "responsibilities",
         "outcomeEvidence", "region", "teamSize")
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    payload,
  );
  return payload.length;
};

const insertOpportunities = (db: DatabaseSync, rows: WorkbookRow[]) => {
  const payload = rows.map((row) => [
    text(row.Opportunity_ID),
    text(row.Client_Name),
    text(row.Client_Type),
    text(row.Opportunity_Name),
    text(row.Region),
    text(row.Country),
    text(row.City),
    text(row.Domain),
    text(row.Stage),
    asFloat(row.Probability),
    text(row.ExpectedStartDate),
    asInt(row.DurationWeeks),
    text(row.CommercialPriority),
    text(row.DeliveryRisk),
    text(row.OpportunityBrief),
    text(row.TimezonePreference),
  ]);

  runMany(
    db,
    `
      INSERT INTO "Opportunity"
        ("id", "clientName", "clientType", "name", "region", "country", "city", "domain", "stage",
         "probability", "expectedStartDate", "durationWeeks", "commercialPriority",
         "deliveryRisk", "opportunityBrief", "timezonePreference")
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    payload,
  );
  return payload.length;
};

const insertOpportunityRoles = (db: DatabaseSync, rows: WorkbookRow[]) => {
  const rolePayload = rows.map((row) => [
    text(row.Opportunity_Role_ID),
    text(row.Opportunity_ID),
    text(row.RoleName),
    text(row.DisciplineOrDepartment),
    text(row.GradePreference),
    text(row.RequiredSkills),
    text(row.DesiredSkills),
    text(row.DomainExperienceRequired),
    text(row.LocationPreference),
    text(row.StartDate),
    asInt(row.DurationWeeks),
    asFloat(row.FTERequired),
    text(row.Priority),
    text(row.FlexibilityNotes),
    asFloat(row.MinimumIndividualFTE),
    asBool(row.CanCombineCandidates) ? 1 : 0,
  ]);

  runMany(
    db,
    `
      INSERT INTO "OpportunityRole"
        ("id", "opportunityId", "roleName", "disciplineOrDepartment", "gradePreference",
         "requiredSkillsText", "desiredSkillsText", "domainExperienceRequired",
         "locationPreference", "startDate", "durationWeeks", "fteRequired", "priority",
         "flexibilityNotes", "minimumIndividualFte", "canCombineCandidates")
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    rolePayload,
  );

  const requirementPayload: SqliteValue[][] = [];
  for (const row of rows) {
    const roleId = text(row.Opportunity_Role_ID);
    for (const skillName of parseSemicolonList(row.RequiredSkills)) {
      requirementPayload.push([roleId, skillName, "REQUIRED"]);
    }
    for (const skillName of parseSemicolonList(row.DesiredSkills)) {
      requirementPayload.push([roleId, skillName, "DESIRED"]);
    }
  }

  runMany(
    db,
    `
      INSERT INTO "OpportunityRoleSkillRequirement"
        ("opportunityRoleId", "skillName", "importance")
      VALUES (?, ?, ?)
    `,
    requirementPayload,
  );
  return [rolePayload.length, requirementPayload.length] as const;
};

const insertOverlays = (db: DatabaseSync, rows: WorkbookRow[]) => {
  const payload = rows.map((row) => [
    text(row.Overlay_ID),
    text(row.Opportunity_ID),
    text(row.Opportunity_Role_ID),
    text(row.Employee_ID),
    text(row.FitStatus),
    asInt(row.Rank),
    asFloat(row.MatchScore),
    text(row.Rationale),
    text(row.Constraint),
    text(row.EWAStatus),
    text(row.PlannerNotes),
    asFloat(row.CapabilityFitScore),
    asFloat(row.AvailabilityFitScore),
    asFloat(row.OverallStaffingScore),
    asFloat(row.AvailableFTEAtStart),
    asFloat(row.FTEGap),
    text(row.EarliestFullAvailabilityDate),
    asInt(row.RequiredSkillsMatched),
    asInt(row.RequiredSkillsTotal),
    asInt(row.DesiredSkillsMatched),
    asInt(row.DesiredSkillsTotal),
  ]);

  runMany(
    db,
    `
      INSERT INTO "OpportunityCandidateOverlay"
        ("id", "opportunityId", "opportunityRoleId", "personId", "fitStatus", "rank",
         "matchScore", "rationale", "constraint", "ewaStatus", "plannerNotes",
         "capabilityFitScore", "availabilityFitScore", "overallStaffingScore",
         "availableFteAtStart", "fteGap", "earliestFullAvailabilityDate",
         "requiredSkillsMatched", "requiredSkillsTotal", "desiredSkillsMatched",
         "desiredSkillsTotal")
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    payload,
  );
  return payload.length;
};

const insertEwaRequests = (db: DatabaseSync, rows: WorkbookRow[]) => {
  const payload = rows.map((row) => [
    text(row.EWA_Request_ID),
    text(row.Opportunity_ID),
    text(row.Opportunity_Role_ID),
    text(row.Employee_ID),
    text(row.RequestType),
    text(row.EWAStatus),
    asFloat(row.RequestedFTE),
    text(row.ProposedStartDate),
    text(row.ProposedEndDate),
    asBool(row.ApprovalRequired) ? 1 : 0,
    text(row.BookingOwner),
    text(row.BlockingReason),
    text(row.NextAction),
    text(row.LastUpdated),
    text(row.Notes),
    asFloat(row.AvailableFTEAtStart),
    asFloat(row.FTEGap),
    asBool(row.CanSplitRole) ? 1 : 0,
    text(row.EarliestFullAvailabilityDate),
  ]);

  runMany(
    db,
    `
      INSERT INTO "EwaRequest"
        ("id", "opportunityId", "opportunityRoleId", "personId", "requestType",
         "ewaStatus", "requestedFte", "proposedStartDate", "proposedEndDate",
         "approvalRequired", "bookingOwner", "blockingReason", "nextAction",
         "lastUpdated", "notes", "availableFteAtStart", "fteGap", "canSplitRole",
         "earliestFullAvailabilityDate")
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    payload,
  );
  return payload.length;
};

const insertScenarioTargets = (db: DatabaseSync, rows: WorkbookRow[]) => {
  const payload = rows.map((row) => [
    text(row.Scenario_ID),
    text(row.ScenarioName),
    text(row.TargetDate),
    asFloat(row.TargetBenchRate),
    asInt(row.TargetBenchHeadcount),
    text(row.Focus),
    text(row.SuccessMeasure),
  ]);

  runMany(
    db,
    `
      INSERT INTO "ScenarioTarget"
        ("id", "scenarioName", "targetDate", "targetBenchRate", "targetBenchHeadcount",
         "focus", "successMeasure")
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    payload,
  );
  return payload.length;
};

export async function importExcelToSqlite(options: WorkforceImportOptions = {}): Promise<WorkforceImportResult> {
  const excelPath = resolve(options.excelPath ?? DEFAULT_EXCEL_PATH);
  const dbPath = resolve(options.dbPath ?? DEFAULT_DB_PATH);
  const replace = options.replace ?? false;
  const workbookName = options.workbookName ?? basename(excelPath);

  if (!existsSync(excelPath)) {
    throw new Error(`Excel file not found: ${excelPath}`);
  }

  await notifyProgress(options.onProgress, {
    status: "processing",
    stage: "reading_workbook",
    stepIndex: 0,
    progress: 25,
    message: WORKFORCE_UPLOAD_STEP_LABELS[0],
    detail: "Reading sheet structure and validating required workbook tabs.",
  });

  const { sheets } = readWorkbookSheets(excelPath);
  ensureRequiredSheets(sheets);

  const db = createDatabase(dbPath, replace);
  const counts: Record<string, number> = {};

  try {
    db.exec("BEGIN");

    const batchId = insertImportBatch(db, workbookName, workbookVersion(sheets));
    counts.ImportBatch = 1;
    counts.RawSheetRow = loadRawSheetRows(db, batchId, sheets);

    await notifyProgress(options.onProgress, {
      status: "processing",
      stage: "normalizing_skills",
      stepIndex: 1,
      progress: 55,
      message: WORKFORCE_UPLOAD_STEP_LABELS[1],
      detail: "Importing people, profiles, availability, and skill evidence into SQLite.",
    });

    const peopleRows = sheetValues(sheets, "People");
    const skillRows = sheetValues(sheets, "Skills");
    const skillCatalogRows = sheetValues(sheets, "Skill Catalog");
    const profileRows = sheetValues(sheets, "Profiles");
    const allocationRows = sheetValues(sheets, "Allocations");
    const benchRows = sheetValues(sheets, "Bench");
    const partialRows = sheetValues(sheets, "Partial Capacity");
    const availabilityRows = sheetValues(sheets, "Availability Calendar");
    const benchMovementRows = sheetValues(sheets, "Bench Movement");
    const historyRows = sheetValues(sheets, "Project History");
    const opportunityRows = sheetValues(sheets, "Opportunities");
    const opportunityRoleRows = sheetValues(sheets, "Opportunity Roles");
    const overlayRows = sheetValues(sheets, "Opportunity Overlays");
    const ewaRows = sheetValues(sheets, "EWA Requests");
    const scenarioRows = sheetValues(sheets, "Scenario Targets");

    counts.Person = insertPeople(db, peopleRows);
    counts.PersonAvailabilitySnapshot = insertPersonSnapshots(db, peopleRows);
    counts.Profile = insertProfiles(db, profileRows);
    counts.SkillCatalog = insertSkillCatalog(db, skillCatalogRows);
    counts.PersonSkillEvidence = insertPersonSkills(db, skillRows);
    counts.CurrentAllocation = insertCurrentAllocations(db, allocationRows);
    counts.SupplyRecord = insertSupplyRecords(db, benchRows);
    counts.PartialCapacityView = insertPartialCapacityView(db, partialRows);
    counts.AvailabilityWeek = insertAvailabilityWeeks(db, availabilityRows);
    counts.BenchMovementWeek = insertBenchMovement(db, benchMovementRows);
    counts.ProjectHistory = insertProjectHistory(db, historyRows);

    await notifyProgress(options.onProgress, {
      status: "processing",
      stage: "building_planning_table",
      stepIndex: 2,
      progress: 82,
      message: WORKFORCE_UPLOAD_STEP_LABELS[2],
      detail: "Importing opportunities, role requirements, overlays, and staffing scenarios.",
    });

    counts.Opportunity = insertOpportunities(db, opportunityRows);

    const [roleCount, requirementCount] = insertOpportunityRoles(db, opportunityRoleRows);
    counts.OpportunityRole = roleCount;
    counts.OpportunityRoleSkillRequirement = requirementCount;
    counts.OpportunityCandidateOverlay = insertOverlays(db, overlayRows);
    counts.EwaRequest = insertEwaRequests(db, ewaRows);
    counts.ScenarioTarget = insertScenarioTargets(db, scenarioRows);

    db.exec("COMMIT");

    await notifyProgress(options.onProgress, {
      status: "processing",
      stage: "verifying_import",
      stepIndex: 2,
      progress: 92,
      message: WORKFORCE_UPLOAD_STEP_LABELS[2],
      detail: "SQLite import completed. Verification is starting.",
    });
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // Ignore rollback failures and surface the original error.
    }
    throw error;
  } finally {
    db.close();
  }

  return {
    excelPath,
    dbPath,
    workbookName,
    counts,
  };
}
