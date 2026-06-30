import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { WorkbookRow, WorkbookSheets } from "./workbook-xlsx";
import { readWorkbookSheets } from "./workbook-xlsx";
import { DEFAULT_DB_PATH, DEFAULT_EXCEL_PATH, addUtcDays, asBool, asFloat, asUtcDate, text, utcWeekday } from "./workforce-data-utils";

export type WorkforceVerifyOptions = {
  excelPath?: string;
  dbPath?: string;
};

export type WorkforceVerificationResult = {
  passed: boolean;
  name: string;
  detail: string;
};

export type WorkforceVerificationSummary = {
  excelPath: string;
  dbPath: string;
  results: WorkforceVerificationResult[];
  passed: number;
  failed: number;
};

const sheetValues = (sheets: WorkbookSheets, sheetName: string) => sheets[sheetName]?.rows.map((row) => row.values) ?? [];

const sqliteCount = (db: DatabaseSync, tableName: string) =>
  Number((db.prepare(`SELECT COUNT(*) AS count FROM "${tableName}"`).get() as { count: number }).count);

const addResult = (
  results: WorkforceVerificationResult[],
  passed: boolean,
  name: string,
  detail: string,
) => {
  results.push({ passed, name, detail });
};

const compareScalar = (expected: unknown, actual: unknown) => {
  if (typeof expected === "number" || typeof actual === "number") {
    const left = Number(expected);
    const right = Number(actual);
    return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= 1e-9;
  }
  return text(expected) === text(actual);
};

const firstFullWeekOnOrAfter = (releaseDate: Date) =>
  addUtcDays(releaseDate, (7 - utcWeekday(releaseDate)) % 7);

const verifyCounts = (workbookRows: Record<string, WorkbookRow[]>, db: DatabaseSync) => {
  const results: WorkforceVerificationResult[] = [];

  const tableExpectations: [string, number][] = [
    ["Person", workbookRows.People.length],
    ["PersonAvailabilitySnapshot", workbookRows.People.length],
    ["Profile", workbookRows.Profiles.length],
    ["SkillCatalog", workbookRows["Skill Catalog"].length],
    ["PersonSkillEvidence", workbookRows.Skills.length],
    ["CurrentAllocation", workbookRows.Allocations.length],
    ["SupplyRecord", workbookRows.Bench.length],
    ["PartialCapacityView", workbookRows["Partial Capacity"].length],
    ["AvailabilityWeek", workbookRows["Availability Calendar"].length],
    ["BenchMovementWeek", workbookRows["Bench Movement"].length],
    ["ProjectHistory", workbookRows["Project History"].length],
    ["Opportunity", workbookRows.Opportunities.length],
    ["OpportunityRole", workbookRows["Opportunity Roles"].length],
    ["OpportunityCandidateOverlay", workbookRows["Opportunity Overlays"].length],
    ["EwaRequest", workbookRows["EWA Requests"].length],
    ["ScenarioTarget", workbookRows["Scenario Targets"].length],
  ];

  let roleSkillCount = 0;
  for (const row of workbookRows["Opportunity Roles"]) {
    roleSkillCount += text(row.RequiredSkills)
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean).length;
    roleSkillCount += text(row.DesiredSkills)
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean).length;
  }
  tableExpectations.push(["OpportunityRoleSkillRequirement", roleSkillCount]);

  const rawRowCount = Object.values(workbookRows).reduce((total, rows) => total + rows.length, 0);
  tableExpectations.push(["RawSheetRow", rawRowCount]);

  for (const [tableName, expectedCount] of tableExpectations) {
    const actualCount = sqliteCount(db, tableName);
    addResult(
      results,
      actualCount === expectedCount,
      `count:${tableName}`,
      `expected=${expectedCount} actual=${actualCount}`,
    );
  }

  return results;
};

const verifyIntegrity = (db: DatabaseSync) => {
  const results: WorkforceVerificationResult[] = [];
  const queries: Record<string, string> = {
    profiles_without_person: `
      SELECT COUNT(*) AS count FROM "Profile" p
      LEFT JOIN "Person" x ON x.id = p.personId
      WHERE x.id IS NULL
    `,
    skills_without_person: `
      SELECT COUNT(*) AS count FROM "PersonSkillEvidence" s
      LEFT JOIN "Person" p ON p.id = s.personId
      WHERE p.id IS NULL
    `,
    skills_without_catalog: `
      SELECT COUNT(*) AS count FROM "PersonSkillEvidence" s
      LEFT JOIN "SkillCatalog" c ON c.name = s.skillName
      WHERE c.name IS NULL
    `,
    allocations_without_person: `
      SELECT COUNT(*) AS count FROM "CurrentAllocation" a
      LEFT JOIN "Person" p ON p.id = a.personId
      WHERE p.id IS NULL
    `,
    supply_without_person: `
      SELECT COUNT(*) AS count FROM "SupplyRecord" s
      LEFT JOIN "Person" p ON p.id = s.personId
      WHERE p.id IS NULL
    `,
    partial_capacity_without_person: `
      SELECT COUNT(*) AS count FROM "PartialCapacityView" v
      LEFT JOIN "Person" p ON p.id = v.personId
      WHERE p.id IS NULL
    `,
    partial_capacity_missing_source: `
      SELECT COUNT(*) AS count FROM "PartialCapacityView" v
      LEFT JOIN "SupplyRecord" s ON s.id = v.sourceBenchRecordId
      WHERE s.id IS NULL
    `,
    availability_without_person: `
      SELECT COUNT(*) AS count FROM "AvailabilityWeek" a
      LEFT JOIN "Person" p ON p.id = a.personId
      WHERE p.id IS NULL
    `,
    history_without_person: `
      SELECT COUNT(*) AS count FROM "ProjectHistory" h
      LEFT JOIN "Person" p ON p.id = h.personId
      WHERE p.id IS NULL
    `,
    roles_without_opportunity: `
      SELECT COUNT(*) AS count FROM "OpportunityRole" r
      LEFT JOIN "Opportunity" o ON o.id = r.opportunityId
      WHERE o.id IS NULL
    `,
    role_skills_without_role: `
      SELECT COUNT(*) AS count FROM "OpportunityRoleSkillRequirement" rs
      LEFT JOIN "OpportunityRole" r ON r.id = rs.opportunityRoleId
      WHERE r.id IS NULL
    `,
    role_skills_without_catalog: `
      SELECT COUNT(*) AS count FROM "OpportunityRoleSkillRequirement" rs
      LEFT JOIN "SkillCatalog" s ON s.name = rs.skillName
      WHERE s.name IS NULL
    `,
    overlays_without_opportunity: `
      SELECT COUNT(*) AS count FROM "OpportunityCandidateOverlay" o
      LEFT JOIN "Opportunity" p ON p.id = o.opportunityId
      WHERE p.id IS NULL
    `,
    overlays_without_role: `
      SELECT COUNT(*) AS count FROM "OpportunityCandidateOverlay" o
      LEFT JOIN "OpportunityRole" r ON r.id = o.opportunityRoleId
      WHERE r.id IS NULL
    `,
    overlays_without_person: `
      SELECT COUNT(*) AS count FROM "OpportunityCandidateOverlay" o
      LEFT JOIN "Person" p ON p.id = o.personId
      WHERE p.id IS NULL
    `,
    ewa_without_opportunity: `
      SELECT COUNT(*) AS count FROM "EwaRequest" e
      LEFT JOIN "Opportunity" o ON o.id = e.opportunityId
      WHERE o.id IS NULL
    `,
    ewa_without_role: `
      SELECT COUNT(*) AS count FROM "EwaRequest" e
      LEFT JOIN "OpportunityRole" r ON r.id = e.opportunityRoleId
      WHERE r.id IS NULL
    `,
    ewa_without_person: `
      SELECT COUNT(*) AS count FROM "EwaRequest" e
      LEFT JOIN "Person" p ON p.id = e.personId
      WHERE p.id IS NULL
    `,
    duplicate_person_skill: `
      SELECT COUNT(*) AS count FROM (
        SELECT personId, skillName, COUNT(*) c
        FROM "PersonSkillEvidence"
        GROUP BY personId, skillName
        HAVING c > 1
      )
    `,
    duplicate_availability_week: `
      SELECT COUNT(*) AS count FROM (
        SELECT personId, weekStartDate, COUNT(*) c
        FROM "AvailabilityWeek"
        GROUP BY personId, weekStartDate
        HAVING c > 1
      )
    `,
    duplicate_overlay_role_person: `
      SELECT COUNT(*) AS count FROM (
        SELECT opportunityRoleId, personId, COUNT(*) c
        FROM "OpportunityCandidateOverlay"
        GROUP BY opportunityRoleId, personId
        HAVING c > 1
      )
    `,
    duplicate_ewa_role_person: `
      SELECT COUNT(*) AS count FROM (
        SELECT opportunityRoleId, personId, COUNT(*) c
        FROM "EwaRequest"
        GROUP BY opportunityRoleId, personId
        HAVING c > 1
      )
    `,
    overlay_ewa_status_mismatch: `
      SELECT COUNT(*) AS count FROM "OpportunityCandidateOverlay" o
      JOIN "EwaRequest" e
        ON e.opportunityRoleId = o.opportunityRoleId
       AND e.personId = o.personId
      WHERE o.ewaStatus <> e.ewaStatus
    `,
    overlay_matchscore_mismatch: `
      SELECT COUNT(*) AS count FROM "OpportunityCandidateOverlay"
      WHERE ABS(matchScore - capabilityFitScore) > 1e-9
    `,
  };

  for (const [name, sql] of Object.entries(queries)) {
    const actual = Number((db.prepare(sql).get() as { count: number }).count);
    addResult(results, actual === 0, `integrity:${name}`, `actual=${actual}`);
  }

  return results;
};

const verifySpotChecks = (workbookRows: Record<string, WorkbookRow[]>, db: DatabaseSync) => {
  const results: WorkforceVerificationResult[] = [];

  const peopleRow = workbookRows.People[0];
  const person = db
    .prepare(
      `
        SELECT p.name, s.availabilityCategory, s.availableFteCurrent, s.expectedReleaseDate
        FROM "Person" p
        JOIN "PersonAvailabilitySnapshot" s ON s.personId = p.id
        WHERE p.id = ?
      `,
    )
    .get(text(peopleRow.Employee_ID)) as
    | { name: string; availabilityCategory: string; availableFteCurrent: number; expectedReleaseDate: string }
    | undefined;
  addResult(
    results,
    person != null &&
      compareScalar(peopleRow.Employee_Name, person.name) &&
      compareScalar(peopleRow.AvailabilityCategory, person.availabilityCategory) &&
      compareScalar(peopleRow.AvailableFTECurrent, person.availableFteCurrent) &&
      compareScalar(peopleRow.ExpectedReleaseDate, person.expectedReleaseDate),
    "spot:people_first_row",
    `employee_id=${text(peopleRow.Employee_ID)}`,
  );

  const skillRow = workbookRows.Skills[0];
  const skill = db
    .prepare(
      `
        SELECT skillName, skillLevel, yearsExperience, confidence
        FROM "PersonSkillEvidence"
        WHERE id = ?
      `,
    )
    .get(text(skillRow.Skill_Row_ID)) as
    | { skillName: string; skillLevel: number; yearsExperience: number; confidence: string }
    | undefined;
  addResult(
    results,
    skill != null &&
      compareScalar(skillRow.SkillName, skill.skillName) &&
      compareScalar(skillRow.SkillLevel, skill.skillLevel) &&
      compareScalar(skillRow.YearsExperience, skill.yearsExperience) &&
      compareScalar(skillRow.Confidence, skill.confidence),
    "spot:skills_first_row",
    `skill_row_id=${text(skillRow.Skill_Row_ID)}`,
  );

  const allocationRow = workbookRows.Allocations[0];
  const allocation = db
    .prepare(
      `
        SELECT accountId, clientName, clientType, projectId, projectName, domain, allocationFte
        FROM "CurrentAllocation"
        WHERE id = ?
      `,
    )
    .get(text(allocationRow.Allocation_ID)) as
    | {
        accountId: string;
        clientName: string;
        clientType: string;
        projectId: string;
        projectName: string;
        domain: string;
        allocationFte: number;
      }
    | undefined;
  addResult(
    results,
    allocation != null &&
      compareScalar(allocationRow.AccountID, allocation.accountId) &&
      compareScalar(allocationRow.Client_Name, allocation.clientName) &&
      compareScalar(allocationRow.Client_Type, allocation.clientType) &&
      compareScalar(allocationRow.ProjectID, allocation.projectId) &&
      compareScalar(allocationRow.Project_Name, allocation.projectName) &&
      compareScalar(allocationRow.Domain, allocation.domain) &&
      compareScalar(allocationRow.AllocationFTE, allocation.allocationFte),
    "spot:allocations_first_row",
    `allocation_id=${text(allocationRow.Allocation_ID)}`,
  );

  const roleRow = workbookRows["Opportunity Roles"][0];
  const role = db
    .prepare(
      `
        SELECT requiredSkillsText, desiredSkillsText, fteRequired, canCombineCandidates
        FROM "OpportunityRole"
        WHERE id = ?
      `,
    )
    .get(text(roleRow.Opportunity_Role_ID)) as
    | { requiredSkillsText: string; desiredSkillsText: string; fteRequired: number; canCombineCandidates: number }
    | undefined;
  addResult(
    results,
    role != null &&
      compareScalar(roleRow.RequiredSkills, role.requiredSkillsText) &&
      compareScalar(roleRow.DesiredSkills, role.desiredSkillsText) &&
      compareScalar(roleRow.FTERequired, role.fteRequired) &&
      compareScalar(text(roleRow.CanCombineCandidates).toLowerCase() === "yes" ? 1 : 0, role.canCombineCandidates),
    "spot:opportunity_role_first_row",
    `opportunity_role_id=${text(roleRow.Opportunity_Role_ID)}`,
  );

  const overlayRow = workbookRows["Opportunity Overlays"][0];
  const overlay = db
    .prepare(
      `
        SELECT fitStatus, rank, matchScore, ewaStatus
        FROM "OpportunityCandidateOverlay"
        WHERE id = ?
      `,
    )
    .get(text(overlayRow.Overlay_ID)) as
    | { fitStatus: string; rank: number; matchScore: number; ewaStatus: string }
    | undefined;
  addResult(
    results,
    overlay != null &&
      compareScalar(overlayRow.FitStatus, overlay.fitStatus) &&
      compareScalar(overlayRow.Rank, overlay.rank) &&
      compareScalar(overlayRow.MatchScore, overlay.matchScore) &&
      compareScalar(overlayRow.EWAStatus, overlay.ewaStatus),
    "spot:overlay_first_row",
    `overlay_id=${text(overlayRow.Overlay_ID)}`,
  );

  const ewaRow = workbookRows["EWA Requests"][0];
  const ewa = db
    .prepare(
      `
        SELECT requestType, ewaStatus, requestedFte, nextAction
        FROM "EwaRequest"
        WHERE id = ?
      `,
    )
    .get(text(ewaRow.EWA_Request_ID)) as
    | { requestType: string; ewaStatus: string; requestedFte: number; nextAction: string }
    | undefined;
  addResult(
    results,
    ewa != null &&
      compareScalar(ewaRow.RequestType, ewa.requestType) &&
      compareScalar(ewaRow.EWAStatus, ewa.ewaStatus) &&
      compareScalar(ewaRow.RequestedFTE, ewa.requestedFte) &&
      compareScalar(ewaRow.NextAction, ewa.nextAction),
    "spot:ewa_first_row",
    `ewa_request_id=${text(ewaRow.EWA_Request_ID)}`,
  );

  const scenarioRow = workbookRows["Scenario Targets"][0];
  const scenario = db
    .prepare(
      `
        SELECT scenarioName, targetDate, targetBenchRate, targetBenchHeadcount
        FROM "ScenarioTarget"
        WHERE id = ?
      `,
    )
    .get(text(scenarioRow.Scenario_ID)) as
    | { scenarioName: string; targetDate: string; targetBenchRate: number; targetBenchHeadcount: number }
    | undefined;
  addResult(
    results,
    scenario != null &&
      compareScalar(scenarioRow.ScenarioName, scenario.scenarioName) &&
      compareScalar(scenarioRow.TargetDate, scenario.targetDate) &&
      compareScalar(scenarioRow.TargetBenchRate, scenario.targetBenchRate) &&
      compareScalar(scenarioRow.TargetBenchHeadcount, scenario.targetBenchHeadcount),
    "spot:scenario_first_row",
    `scenario_id=${text(scenarioRow.Scenario_ID)}`,
  );

  return results;
};

const verifyValidationSummaryCriteria = (workbookRows: Record<string, WorkbookRow[]>, db: DatabaseSync) => {
  const results: WorkforceVerificationResult[] = [];

  const people = workbookRows.People;
  const skills = workbookRows.Skills;
  const bench = workbookRows.Bench;
  const partial = workbookRows["Partial Capacity"];
  const availability = workbookRows["Availability Calendar"];
  const history = workbookRows["Project History"];
  const opportunities = workbookRows.Opportunities;
  const roles = workbookRows["Opportunity Roles"];
  const overlays = workbookRows["Opportunity Overlays"];
  const ewaRequests = workbookRows["EWA Requests"];

  const peopleById = Object.fromEntries(people.map((row) => [text(row.Employee_ID), row]));
  const roleById = Object.fromEntries(roles.map((row) => [text(row.Opportunity_Role_ID), row]));
  const personGrades = new Set(people.map((row) => text(row.Grade)));

  const skillPeopleByName = new Map<string, Set<string>>();
  for (const row of skills) {
    const skillName = text(row.SkillName);
    const current = skillPeopleByName.get(skillName) ?? new Set<string>();
    current.add(text(row.Employee_ID));
    skillPeopleByName.set(skillName, current);
  }

  const availabilityByPerson = new Map<string, WorkbookRow[]>();
  for (const row of availability) {
    const personId = text(row.Employee_ID);
    const current = availabilityByPerson.get(personId) ?? [];
    current.push(row);
    availabilityByPerson.set(personId, current);
  }
  for (const rows of availabilityByPerson.values()) {
    rows.sort((left, right) => text(left.WeekStartDate).localeCompare(text(right.WeekStartDate)));
  }

  const roleRanks = new Map<string, Set<number>>();
  for (const row of overlays) {
    const roleId = text(row.Opportunity_Role_ID);
    const current = roleRanks.get(roleId) ?? new Set<number>();
    current.add(Math.trunc(asFloat(row.Rank)));
    roleRanks.set(roleId, current);
  }

  const validationRows = Object.fromEntries(
    (workbookRows["Validation Summary"] ?? []).map((row) => [text(row.Check_ID), row]),
  );

  const record = (checkId: string, computed: unknown, passed: boolean, detail: string) => {
    const workbookActual = validationRows[checkId] ? text(validationRows[checkId].Actual) : "n/a";
    addResult(
      results,
      passed,
      `validation:${checkId}`,
      `computed=${computed} workbook_actual=${workbookActual}; ${detail}`,
    );
  };

  const val001 = sqliteCount(db, "Person");
  record("VAL-001", val001, val001 === people.length, "employee count");

  const val002 = Number(
    (db
      .prepare(`SELECT COUNT(*) AS count FROM "SupplyRecord" WHERE supplyType = ?`)
      .get("Current Bench") as { count: number }).count,
  );
  const expected002 = bench.filter((row) => text(row.BenchType) === "Current Bench").length;
  record("VAL-002", val002, val002 === expected002, "current bench count");

  const val003 = Number(
    (db
      .prepare(`SELECT COUNT(*) AS count FROM "SupplyRecord" WHERE supplyType = ?`)
      .get("Partial Capacity") as { count: number }).count,
  );
  const expected003 = bench.filter((row) => text(row.BenchType) === "Partial Capacity").length;
  record("VAL-003", val003, val003 === expected003, "partial-capacity count");

  const val004 = Number(
    (db
      .prepare(`SELECT COUNT(*) AS count FROM "SupplyRecord" WHERE supplyType = ?`)
      .get("Future Roll-off") as { count: number }).count,
  );
  const expected004 = bench.filter((row) => text(row.BenchType) === "Future Roll-off").length;
  record("VAL-004", val004, val004 === expected004, "future roll-off count");

  const val005 = sqliteCount(db, "Opportunity");
  record("VAL-005", val005, val005 === opportunities.length, "opportunity count");

  const val006 = sqliteCount(db, "OpportunityRole");
  record("VAL-006", val006, val006 === roles.length, "opportunity-role count");

  const val007 = sqliteCount(db, "AvailabilityWeek");
  const expected007 = people.length * 12;
  record("VAL-007", val007, val007 === expected007, "availability rows");

  const primaryKeyColumns: Record<string, string> = {
    People: "Employee_ID",
    Skills: "Skill_Row_ID",
    Profiles: "Profile_ID",
    Allocations: "Allocation_ID",
    Bench: "Bench_Record_ID",
    "Partial Capacity": "Bench_Record_ID",
    "Availability Calendar": "Availability_ID",
    "Bench Movement": "WeekStartDate",
    "Project History": "History_ID",
    Opportunities: "Opportunity_ID",
    "Opportunity Roles": "Opportunity_Role_ID",
    "Opportunity Overlays": "Overlay_ID",
    "EWA Requests": "EWA_Request_ID",
    "Scenario Targets": "Scenario_ID",
  };
  let duplicatePrimaryIds = 0;
  for (const [sheetName, keyColumn] of Object.entries(primaryKeyColumns)) {
    const values = workbookRows[sheetName].map((row) => text(row[keyColumn]));
    duplicatePrimaryIds += values.length - new Set(values).size;
  }
  record("VAL-008", duplicatePrimaryIds, duplicatePrimaryIds === 0, "duplicate primary IDs");

  const foreignKeyErrors = [
    `
      SELECT COUNT(*) AS count FROM "Profile" p
      LEFT JOIN "Person" x ON x.id = p.personId
      WHERE x.id IS NULL
    `,
    `
      SELECT COUNT(*) AS count FROM "PersonSkillEvidence" s
      LEFT JOIN "Person" p ON p.id = s.personId
      WHERE p.id IS NULL
    `,
    `
      SELECT COUNT(*) AS count FROM "PersonSkillEvidence" s
      LEFT JOIN "SkillCatalog" c ON c.name = s.skillName
      WHERE c.name IS NULL
    `,
    `
      SELECT COUNT(*) AS count FROM "CurrentAllocation" a
      LEFT JOIN "Person" p ON p.id = a.personId
      WHERE p.id IS NULL
    `,
    `
      SELECT COUNT(*) AS count FROM "SupplyRecord" s
      LEFT JOIN "Person" p ON p.id = s.personId
      WHERE p.id IS NULL
    `,
    `
      SELECT COUNT(*) AS count FROM "PartialCapacityView" v
      LEFT JOIN "Person" p ON p.id = v.personId
      WHERE p.id IS NULL
    `,
    `
      SELECT COUNT(*) AS count FROM "PartialCapacityView" v
      LEFT JOIN "SupplyRecord" s ON s.id = v.sourceBenchRecordId
      WHERE s.id IS NULL
    `,
    `
      SELECT COUNT(*) AS count FROM "AvailabilityWeek" a
      LEFT JOIN "Person" p ON p.id = a.personId
      WHERE p.id IS NULL
    `,
    `
      SELECT COUNT(*) AS count FROM "ProjectHistory" h
      LEFT JOIN "Person" p ON p.id = h.personId
      WHERE p.id IS NULL
    `,
    `
      SELECT COUNT(*) AS count FROM "OpportunityRole" r
      LEFT JOIN "Opportunity" o ON o.id = r.opportunityId
      WHERE o.id IS NULL
    `,
    `
      SELECT COUNT(*) AS count FROM "OpportunityRoleSkillRequirement" rs
      LEFT JOIN "OpportunityRole" r ON r.id = rs.opportunityRoleId
      WHERE r.id IS NULL
    `,
    `
      SELECT COUNT(*) AS count FROM "OpportunityRoleSkillRequirement" rs
      LEFT JOIN "SkillCatalog" s ON s.name = rs.skillName
      WHERE s.name IS NULL
    `,
    `
      SELECT COUNT(*) AS count FROM "OpportunityCandidateOverlay" o
      LEFT JOIN "Opportunity" p ON p.id = o.opportunityId
      WHERE p.id IS NULL
    `,
    `
      SELECT COUNT(*) AS count FROM "OpportunityCandidateOverlay" o
      LEFT JOIN "OpportunityRole" r ON r.id = o.opportunityRoleId
      WHERE r.id IS NULL
    `,
    `
      SELECT COUNT(*) AS count FROM "OpportunityCandidateOverlay" o
      LEFT JOIN "Person" p ON p.id = o.personId
      WHERE p.id IS NULL
    `,
    `
      SELECT COUNT(*) AS count FROM "EwaRequest" e
      LEFT JOIN "Opportunity" o ON o.id = e.opportunityId
      WHERE o.id IS NULL
    `,
    `
      SELECT COUNT(*) AS count FROM "EwaRequest" e
      LEFT JOIN "OpportunityRole" r ON r.id = e.opportunityRoleId
      WHERE r.id IS NULL
    `,
    `
      SELECT COUNT(*) AS count FROM "EwaRequest" e
      LEFT JOIN "Person" p ON p.id = e.personId
      WHERE p.id IS NULL
    `,
  ].reduce(
    (total, sql) => total + Number((db.prepare(sql).get() as { count: number }).count),
    0,
  );
  record("VAL-009", foreignKeyErrors, foreignKeyErrors === 0, "foreign-key errors");

  let nameMismatchCount = 0;
  for (const sheetName of [
    "Skills",
    "Profiles",
    "Allocations",
    "Bench",
    "Partial Capacity",
    "Availability Calendar",
    "Project History",
    "Opportunity Overlays",
    "EWA Requests",
  ]) {
    for (const row of workbookRows[sheetName]) {
      const employeeId = text(row.Employee_ID);
      if (text(row.Employee_Name) !== text(peopleById[employeeId].Employee_Name)) {
        nameMismatchCount += 1;
      }
    }
  }
  record("VAL-010", nameMismatchCount, nameMismatchCount === 0, "employee-name mismatches");

  const val011 = Number(
    (db
      .prepare(
        `
          SELECT COUNT(*) AS count FROM "OpportunityCandidateOverlay" o
          JOIN "EwaRequest" e
            ON e.opportunityRoleId = o.opportunityRoleId
           AND e.personId = o.personId
          WHERE o.ewaStatus <> e.ewaStatus
        `,
      )
      .get() as { count: number }).count,
  );
  record("VAL-011", val011, val011 === 0, "overlay/EWA status mismatches");

  const val012 = Number(
    (db
      .prepare(
        `
          SELECT COUNT(*) AS count FROM "EwaRequest"
          WHERE fteGap > 0
            AND TRIM(COALESCE(blockingReason, '')) IN ('', 'None')
        `,
      )
      .get() as { count: number }).count,
  );
  record("VAL-012", val012, val012 === 0, "FTE gaps without blocking reason");

  const val013 = Number(
    (db
      .prepare(
        `
          SELECT COUNT(*) AS count FROM "OpportunityCandidateOverlay" o
          LEFT JOIN "ProjectHistory" h ON h.personId = o.personId
          WHERE h.personId IS NULL
        `,
      )
      .get() as { count: number }).count,
  );
  record("VAL-013", val013, val013 === 0, "overlay candidates without project history");

  const val014 = roles.filter((row) => !personGrades.has(text(row.GradePreference))).length;
  record("VAL-014", val014, val014 === 0, "invalid grade preferences");

  const domainLabels = new Set<string>([
    ...people.map((row) => text(row.PrimaryDomain)),
    ...people.map((row) => text(row.SecondaryDomain)),
    ...opportunities.map((row) => text(row.Domain)),
  ]);
  let val015 = 0;
  for (const row of roles) {
    for (const skill of text(row.DesiredSkills)
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)) {
      if (domainLabels.has(skill)) {
        val015 += 1;
      }
    }
  }
  record("VAL-015", val015, val015 === 0, "domain labels left in DesiredSkills");

  const unsupportedRequiredSkills = [...new Set(
    roles.flatMap((row) =>
      text(row.RequiredSkills)
        .split(";")
        .map((item) => item.trim())
        .filter((skill) => skill && (skillPeopleByName.get(skill)?.size ?? 0) === 0),
    ),
  )].sort((left, right) => left.localeCompare(right));
  const val016 = unsupportedRequiredSkills.length;
  record(
    "VAL-016",
    val016,
    val016 === 3,
    `unsupported required skills=${unsupportedRequiredSkills.join(", ")}`,
  );

  let val017 = 0;
  for (const row of bench) {
    if (text(row.BenchType) !== "Future Roll-off") {
      continue;
    }
    const employeeId = text(row.Employee_ID);
    const releaseDate = asUtcDate(peopleById[employeeId].ExpectedReleaseDate);
    const thresholdWeek = firstFullWeekOnOrAfter(releaseDate);
    const firstPositiveWeek = (availabilityByPerson.get(employeeId) ?? [])
      .filter((week) => asFloat(week.AvailableFTE) > 0)
      .map((week) => asUtcDate(week.WeekStartDate))[0];
    if (firstPositiveWeek && firstPositiveWeek.getTime() < thresholdWeek.getTime()) {
      val017 += 1;
    }
  }
  record(
    "VAL-017",
    val017,
    val017 === 0,
    "future roll-offs available before first full planning week",
  );

  let val018 = 0;
  for (const row of people) {
    if (text(row.AvailabilityCategory) !== "Partial Capacity") {
      continue;
    }
    const employeeId = text(row.Employee_ID);
    const currentFte = asFloat(row.AvailableFTECurrent);
    const releaseDate = asUtcDate(row.ExpectedReleaseDate);
    const transitionWeek = firstFullWeekOnOrAfter(releaseDate);
    for (const week of availabilityByPerson.get(employeeId) ?? []) {
      const weekStart = asUtcDate(week.WeekStartDate);
      const expectedFte = weekStart.getTime() >= transitionWeek.getTime() ? 1.0 : currentFte;
      if (Math.abs(asFloat(week.AvailableFTE) - expectedFte) > 1e-9) {
        val018 += 1;
        break;
      }
    }
  }
  record("VAL-018", val018, val018 === 0, "partial-capacity weekly transition errors");

  const availabilityCounts = new Map<string, number>();
  for (const row of availability) {
    const personId = text(row.Employee_ID);
    availabilityCounts.set(personId, (availabilityCounts.get(personId) ?? 0) + 1);
  }
  const val019 = [...availabilityCounts.values()].filter((count) => count !== 12).length;
  record("VAL-019", val019, val019 === 0, "employees without exactly 12 calendar rows");

  let val020 = 0;
  const overlayByPair = new Map<string, WorkbookRow>(
    overlays.map((row) => [`${text(row.Opportunity_Role_ID)}|${text(row.Employee_ID)}`, row]),
  );
  for (const row of ewaRequests) {
    const role = roleById[text(row.Opportunity_Role_ID)];
    const overlay = overlayByPair.get(`${text(row.Opportunity_Role_ID)}|${text(row.Employee_ID)}`);

    if (text(row.Opportunity_ID) !== text(role.Opportunity_ID)) {
      val020 += 1;
      continue;
    }
    if (asUtcDate(row.ProposedStartDate).getTime() !== asUtcDate(role.StartDate).getTime()) {
      val020 += 1;
      continue;
    }
    const expectedEndDate = addUtcDays(asUtcDate(role.StartDate), Math.trunc(asFloat(role.DurationWeeks)) * 7);
    if (asUtcDate(row.ProposedEndDate).getTime() !== expectedEndDate.getTime()) {
      val020 += 1;
      continue;
    }
    if (asFloat(row.RequestedFTE) <= 0 || asFloat(row.RequestedFTE) > asFloat(role.FTERequired)) {
      val020 += 1;
      continue;
    }
    if (asFloat(row.RequestedFTE) < asFloat(role.MinimumIndividualFTE)) {
      val020 += 1;
      continue;
    }
    if (asBool(row.CanSplitRole) !== asBool(role.CanCombineCandidates)) {
      val020 += 1;
      continue;
    }
    if (!asBool(role.CanCombineCandidates) && Math.abs(asFloat(row.RequestedFTE) - asFloat(role.FTERequired)) > 1e-9) {
      val020 += 1;
      continue;
    }
    if (overlay) {
      if (Math.abs(asFloat(row.AvailableFTEAtStart) - asFloat(overlay.AvailableFTEAtStart)) > 1e-9) {
        val020 += 1;
        continue;
      }
      if (Math.abs(asFloat(row.FTEGap) - asFloat(overlay.FTEGap)) > 1e-9) {
        val020 += 1;
        continue;
      }
      if (asUtcDate(row.EarliestFullAvailabilityDate).getTime() !== asUtcDate(overlay.EarliestFullAvailabilityDate).getTime()) {
        val020 += 1;
      }
    }
  }
  record("VAL-020", val020, val020 === 0, "EWA role/date/FTE structural errors");

  const partialPeople = new Set(partial.map((row) => text(row.Employee_ID)));
  let val021 = 0;
  for (const row of bench) {
    const expectedFlag = partialPeople.has(text(row.Employee_ID));
    if (asBool(row.IsAlsoInPartialCapacityView) !== expectedFlag) {
      val021 += 1;
    }
  }
  record("VAL-021", val021, val021 === 0, "bench/partial-capacity duplicate flags incorrect");

  const val022 = Number(
    (db
      .prepare(
        `
          SELECT COUNT(*) AS count FROM "OpportunityCandidateOverlay"
          WHERE matchScore < 0 OR matchScore > 100
             OR capabilityFitScore < 0 OR capabilityFitScore > 100
             OR availabilityFitScore < 0 OR availabilityFitScore > 100
             OR overallStaffingScore < 0 OR overallStaffingScore > 100
        `,
      )
      .get() as { count: number }).count,
  );
  record("VAL-022", val022, val022 === 0, "out-of-range match scores");

  let val023 = 0;
  for (const row of roles) {
    const ranks = roleRanks.get(text(row.Opportunity_Role_ID)) ?? new Set<number>();
    if (ranks.size !== 3 || !ranks.has(1) || !ranks.has(2) || !ranks.has(3)) {
      val023 += 1;
    }
  }
  record("VAL-023", val023, val023 === 0, "roles without ranks 1,2,3");

  const intentionalGapSkillNames = new Set(unsupportedRequiredSkills);
  const intentionalGapRoles = new Set(
    roles
      .filter((row) =>
        text(row.RequiredSkills)
          .split(";")
          .map((item) => item.trim())
          .some((skill) => skill && intentionalGapSkillNames.has(skill)),
      )
      .map((row) => text(row.Opportunity_Role_ID)),
  );
  let val025 = 0;
  for (const row of ewaRequests) {
    if (!intentionalGapRoles.has(text(row.Opportunity_Role_ID))) {
      continue;
    }
    if (text(row.EWAStatus) !== "Blocked") {
      val025 += 1;
      continue;
    }
    if (text(row.BlockingReason) === "" || text(row.BlockingReason) === "None") {
      val025 += 1;
    }
  }
  record("VAL-025", val025, val025 === 0, "EWA requests for intentional-gap roles not blocked");

  return results;
};

export function verifyImportedDatabase(options: WorkforceVerifyOptions = {}): WorkforceVerificationSummary {
  const excelPath = resolve(options.excelPath ?? DEFAULT_EXCEL_PATH);
  const dbPath = resolve(options.dbPath ?? DEFAULT_DB_PATH);

  if (!existsSync(excelPath)) {
    throw new Error(`Excel file not found: ${excelPath}`);
  }
  if (!existsSync(dbPath)) {
    throw new Error(`SQLite database not found: ${dbPath}`);
  }

  const { sheets } = readWorkbookSheets(excelPath);
  const workbookRows = Object.fromEntries(
    Object.keys(sheets).map((sheetName) => [sheetName, sheetValues(sheets, sheetName)]),
  ) as Record<string, WorkbookRow[]>;

  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const results = [
      ...verifyCounts(workbookRows, db),
      ...verifyIntegrity(db),
      ...verifySpotChecks(workbookRows, db),
      ...verifyValidationSummaryCriteria(workbookRows, db),
    ];
    const passed = results.filter((result) => result.passed).length;
    const failed = results.length - passed;

    return {
      excelPath,
      dbPath,
      results,
      passed,
      failed,
    };
  } finally {
    db.close();
  }
}
