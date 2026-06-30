import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { addUtcDays, asUtcDate, parseSemicolonList, text } from "../workforce-data-utils";
import { resolveWorkforceDataSource, type WorkforceDatasetRecord } from "../workforce-dataset-store";

type Row = Record<string, unknown>;
type QueryParam = string | number | bigint | Uint8Array | null;

export type AgentToolSourceInput = {
  datasetId?: string;
  dbPath?: string;
};

export type AgentToolResolvedSource = {
  datasetId: string | null;
  dbPath: string;
  dataset: WorkforceDatasetRecord | null;
  retrievedAtIso: string;
};

export type PlanningQuerySignals = {
  skills: string[];
  locations: string[];
  availabilityWindowDays: number | null;
  roleHints: string[];
};

export type SkillEvidenceRecord = {
  skillName: string;
  skillLevel: number;
  yearsExperience: number;
  confidence: string;
};

export type OpportunityRecord = {
  id: string;
  name: string;
  clientName: string;
  stage: string;
  probability: number;
  commercialPriority: string;
  deliveryRisk: string;
  expectedStartDate: string;
  durationWeeks: number;
  domain: string;
  city: string;
  country: string;
  region: string;
};

export type PlanningRoleRecord = {
  id: string;
  opportunityId: string;
  opportunityName: string;
  roleName: string;
  disciplineOrDepartment: string;
  gradePreference: string;
  locationPreference: string;
  domainExperienceRequired: string;
  startDate: string;
  durationWeeks: number;
  fteRequired: number;
  priority: string;
  minimumIndividualFte: number;
  canCombineCandidates: boolean;
  requiredSkills: string[];
  desiredSkills: string[];
};

export type PlanningRoleContext = {
  opportunityId: string | null;
  opportunityName: string | null;
  roleId: string | null;
  roleName: string | null;
  discipline: string | null;
  grade: string | null;
  location: string | null;
  domain: string | null;
  minFte: number;
  roleFteRequired: number | null;
  requiredSkills: string[];
  desiredSkills: string[];
};

export type AvailabilityAtTarget = {
  weekStartDate: string;
  availableFte: number;
  confidence: string;
  ewaStatus: string;
};

const makeDb = (dbPath: string) => new DatabaseSync(dbPath, { readOnly: true });

export const all = <T extends Row = Row>(db: DatabaseSync, sql: string, params: QueryParam[] = []) =>
  db.prepare(sql).all(...params) as T[];

export const get = <T extends Row = Row>(db: DatabaseSync, sql: string, params: QueryParam[] = []) =>
  (db.prepare(sql).get(...params) as T | undefined) ?? null;

export const asNumber = (value: unknown) => Number(value ?? 0);

export const asNullableString = (value: unknown) => {
  const normalized = text(value);
  return normalized || null;
};

export const splitList = (value: unknown) => parseSemicolonList(value);

export const unique = (values: string[]) =>
  [...new Set(values.map((value) => text(value)).filter(Boolean))];

export const normalizeText = (value: unknown) => text(value).toLowerCase();

export const sameText = (left: unknown, right: unknown) => normalizeText(left) === normalizeText(right);

export const matchExpected = (candidateValue: unknown, expected?: string | null) => {
  const normalizedExpected = unique(splitList(expected).length > 0 ? splitList(expected) : [text(expected)]);
  if (normalizedExpected.length === 0) {
    return true;
  }

  const candidate = normalizeText(candidateValue);
  return normalizedExpected.some((value) => candidate.includes(value.toLowerCase()));
};

export const buildReferenceDate = (referenceDate?: string) => {
  if (referenceDate) {
    return asUtcDate(referenceDate);
  }
  return asUtcDate(new Date().toISOString().slice(0, 10));
};

export const buildTargetDate = (days: number, referenceDate?: string) =>
  addUtcDays(buildReferenceDate(referenceDate), days).toISOString().slice(0, 10);

export const buildInClause = (column: string, values: string[]) => {
  const normalizedValues = unique(values);
  if (normalizedValues.length === 0) {
    return {
      sql: "1 = 1",
      params: [] as QueryParam[],
    };
  }

  const placeholders = normalizedValues.map(() => "?").join(", ");
  return {
    sql: `${column} IN (${placeholders})`,
    params: normalizedValues as QueryParam[],
  };
};

export const withPlanningDb = <T>(
  input: AgentToolSourceInput,
  work: (context: {
    db: DatabaseSync;
    source: AgentToolResolvedSource;
  }) => T,
) => {
  const resolved = resolveWorkforceDataSource({
    datasetId: input.datasetId,
    dbPath: input.dbPath ?? "workforce.db",
  });
  const dbPath = resolve(resolved.dbPath);
  const db = makeDb(dbPath);

  try {
    return work({
      db,
      source: {
        datasetId: resolved.datasetId,
        dbPath,
        dataset: resolved.dataset,
        retrievedAtIso: new Date().toISOString(),
      },
    });
  } finally {
    db.close();
  }
};

export const readPlanningQuerySignals = (db: DatabaseSync, query?: string): PlanningQuerySignals => {
  const normalizedQuery = ` ${text(query).toLowerCase()} `;
  const skills = all<{ name: string }>(db, `SELECT name FROM "SkillCatalog" ORDER BY length(name) DESC`).filter(
    (row) => normalizedQuery.includes(normalizeText(row.name)),
  );
  const locations = all<{ location: string }>(
    db,
    `
      SELECT DISTINCT city AS location FROM "Person"
      UNION
      SELECT DISTINCT country AS location FROM "Person"
      UNION
      SELECT DISTINCT region AS location FROM "Person"
      ORDER BY location
    `,
  ).filter((row) => normalizedQuery.includes(normalizeText(row.location)));
  const roleHints = all<{ roleHint: string }>(
    db,
    `
      SELECT DISTINCT roleName AS roleHint FROM "OpportunityRole"
      UNION
      SELECT DISTINCT roleArchetype AS roleHint FROM "Person"
      UNION
      SELECT DISTINCT discipline AS roleHint FROM "Person"
      ORDER BY roleHint
    `,
  ).filter((row) => normalizedQuery.includes(normalizeText(row.roleHint)));
  const windowMatch = /(?:in|within|next)\s+(\d{1,3})\s*(?:day|days)/i.exec(text(query));

  return {
    skills: unique(skills.map((row) => text(row.name))),
    locations: unique(locations.map((row) => text(row.location))),
    availabilityWindowDays: windowMatch ? Number(windowMatch[1]) : null,
    roleHints: unique(roleHints.map((row) => text(row.roleHint))),
  };
};

export const readOpportunity = (db: DatabaseSync, opportunityId: string): OpportunityRecord | null => {
  const row = get<{
    id: string;
    name: string;
    clientName: string;
    stage: string;
    probability: number;
    commercialPriority: string;
    deliveryRisk: string;
    expectedStartDate: string;
    durationWeeks: number;
    domain: string;
    city: string;
    country: string;
    region: string;
  }>(
    db,
    `
      SELECT
        id,
        name,
        clientName,
        stage,
        probability,
        commercialPriority,
        deliveryRisk,
        expectedStartDate,
        durationWeeks,
        domain,
        city,
        country,
        region
      FROM "Opportunity"
      WHERE id = ?
    `,
    [opportunityId],
  );

  if (!row) {
    return null;
  }

  return {
    id: text(row.id),
    name: text(row.name),
    clientName: text(row.clientName),
    stage: text(row.stage),
    probability: asNumber(row.probability),
    commercialPriority: text(row.commercialPriority),
    deliveryRisk: text(row.deliveryRisk),
    expectedStartDate: text(row.expectedStartDate),
    durationWeeks: asNumber(row.durationWeeks),
    domain: text(row.domain),
    city: text(row.city),
    country: text(row.country),
    region: text(row.region),
  };
};

const readRoleSkillRequirements = (db: DatabaseSync, roleId: string, fallbackRequired: string, fallbackDesired: string) => {
  const rows = all<{ skillName: string; importance: string }>(
    db,
    `
      SELECT skillName, importance
      FROM "OpportunityRoleSkillRequirement"
      WHERE opportunityRoleId = ?
      ORDER BY CASE importance WHEN 'REQUIRED' THEN 0 ELSE 1 END, skillName ASC
    `,
    [roleId],
  );

  if (rows.length === 0) {
    return {
      requiredSkills: unique(splitList(fallbackRequired)),
      desiredSkills: unique(splitList(fallbackDesired)),
    };
  }

  return {
    requiredSkills: unique(rows.filter((row) => sameText(row.importance, "REQUIRED")).map((row) => text(row.skillName))),
    desiredSkills: unique(rows.filter((row) => !sameText(row.importance, "REQUIRED")).map((row) => text(row.skillName))),
  };
};

export const readRole = (db: DatabaseSync, roleId: string): PlanningRoleRecord | null => {
  const row = get<{
    id: string;
    opportunityId: string;
    opportunityName: string;
    roleName: string;
    disciplineOrDepartment: string;
    gradePreference: string;
    locationPreference: string;
    domainExperienceRequired: string;
    startDate: string;
    durationWeeks: number;
    fteRequired: number;
    priority: string;
    minimumIndividualFte: number;
    canCombineCandidates: number;
    requiredSkillsText: string;
    desiredSkillsText: string;
  }>(
    db,
    `
      SELECT
        r.id,
        r.opportunityId,
        o.name AS opportunityName,
        r.roleName,
        r.disciplineOrDepartment,
        r.gradePreference,
        r.locationPreference,
        r.domainExperienceRequired,
        r.startDate,
        r.durationWeeks,
        r.fteRequired,
        r.priority,
        r.minimumIndividualFte,
        r.canCombineCandidates,
        r.requiredSkillsText,
        r.desiredSkillsText
      FROM "OpportunityRole" r
      JOIN "Opportunity" o ON o.id = r.opportunityId
      WHERE r.id = ?
    `,
    [roleId],
  );

  if (!row) {
    return null;
  }

  const skills = readRoleSkillRequirements(db, roleId, text(row.requiredSkillsText), text(row.desiredSkillsText));

  return {
    id: text(row.id),
    opportunityId: text(row.opportunityId),
    opportunityName: text(row.opportunityName),
    roleName: text(row.roleName),
    disciplineOrDepartment: text(row.disciplineOrDepartment),
    gradePreference: text(row.gradePreference),
    locationPreference: text(row.locationPreference),
    domainExperienceRequired: text(row.domainExperienceRequired),
    startDate: text(row.startDate),
    durationWeeks: asNumber(row.durationWeeks),
    fteRequired: asNumber(row.fteRequired),
    priority: text(row.priority),
    minimumIndividualFte: asNumber(row.minimumIndividualFte),
    canCombineCandidates: Boolean(asNumber(row.canCombineCandidates)),
    requiredSkills: skills.requiredSkills,
    desiredSkills: skills.desiredSkills,
  };
};

export const readOpportunityRoles = (db: DatabaseSync, opportunityId: string) =>
  all<{ id: string }>(
    db,
    `
      SELECT id
      FROM "OpportunityRole"
      WHERE opportunityId = ?
      ORDER BY CASE priority WHEN 'High' THEN 0 ELSE 1 END, startDate ASC, id ASC
    `,
    [opportunityId],
  )
    .map((row) => readRole(db, text(row.id)))
    .filter((row): row is PlanningRoleRecord => row != null);

export const resolveRoleContext = (
  db: DatabaseSync,
  input: {
    opportunityId?: string;
    roleId?: string;
  },
): PlanningRoleContext | null => {
  if (input.roleId) {
    const role = readRole(db, input.roleId);
    if (!role) {
      return null;
    }

    return {
      opportunityId: role.opportunityId,
      opportunityName: role.opportunityName,
      roleId: role.id,
      roleName: role.roleName,
      discipline: role.disciplineOrDepartment || null,
      grade: role.gradePreference || null,
      location: role.locationPreference || null,
      domain: role.domainExperienceRequired || null,
      minFte: role.minimumIndividualFte || role.fteRequired || 0.1,
      roleFteRequired: role.fteRequired,
      requiredSkills: role.requiredSkills,
      desiredSkills: role.desiredSkills,
    };
  }

  if (input.opportunityId) {
    const roles = readOpportunityRoles(db, input.opportunityId);
    const opportunity = readOpportunity(db, input.opportunityId);

    return {
      opportunityId: input.opportunityId,
      opportunityName: opportunity?.name ?? null,
      roleId: null,
      roleName: unique(roles.map((role) => role.roleName)).join("; ") || null,
      discipline: unique(roles.map((role) => role.disciplineOrDepartment)).join("; ") || null,
      grade: unique(roles.map((role) => role.gradePreference)).join("; ") || null,
      location:
        unique(roles.map((role) => role.locationPreference).concat([opportunity?.city ?? "", opportunity?.country ?? ""])).join("; ") ||
        null,
      domain: opportunity?.domain ?? null,
      minFte: 0.1,
      roleFteRequired: null,
      requiredSkills: unique(roles.flatMap((role) => role.requiredSkills)),
      desiredSkills: unique(roles.flatMap((role) => role.desiredSkills)),
    };
  }

  return null;
};

export const latestAvailabilityByPerson = (db: DatabaseSync, targetDate: string, candidateIds: string[] = []) => {
  const candidateClause = buildInClause("aw.personId", candidateIds);
  const rows = all<{
    personId: string;
    weekStartDate: string;
    availableFte: number;
    confidence: string;
    ewaStatus: string;
  }>(
    db,
    `
      SELECT
        aw.personId,
        aw.weekStartDate,
        ROUND(aw.availableFte, 2) AS availableFte,
        aw.confidence,
        aw.ewaStatus
      FROM "AvailabilityWeek" aw
      JOIN (
        SELECT personId, MAX(weekStartDate) AS weekStartDate
        FROM "AvailabilityWeek"
        WHERE weekStartDate <= ?
        GROUP BY personId
      ) latest
        ON latest.personId = aw.personId
       AND latest.weekStartDate = aw.weekStartDate
      WHERE ${candidateClause.sql}
    `,
    [targetDate, ...candidateClause.params],
  );

  return new Map(
    rows.map((row) => [
      text(row.personId),
      {
        weekStartDate: text(row.weekStartDate),
        availableFte: asNumber(row.availableFte),
        confidence: text(row.confidence),
        ewaStatus: text(row.ewaStatus),
      } satisfies AvailabilityAtTarget,
    ]),
  );
};

export const readPersonSkills = (db: DatabaseSync, candidateIds: string[] = []) => {
  const candidateClause = buildInClause("personId", candidateIds);
  const rows = all<{
    personId: string;
    skillName: string;
    skillLevel: number;
    yearsExperience: number;
    confidence: string;
  }>(
    db,
    `
      SELECT personId, skillName, skillLevel, yearsExperience, confidence
      FROM "PersonSkillEvidence"
      WHERE ${candidateClause.sql}
      ORDER BY personId ASC, skillLevel DESC, yearsExperience DESC, skillName ASC
    `,
    candidateClause.params,
  );

  const byPerson = new Map<string, SkillEvidenceRecord[]>();
  for (const row of rows) {
    const personId = text(row.personId);
    const bucket = byPerson.get(personId) ?? [];
    bucket.push({
      skillName: text(row.skillName),
      skillLevel: asNumber(row.skillLevel),
      yearsExperience: asNumber(row.yearsExperience),
      confidence: text(row.confidence),
    });
    byPerson.set(personId, bucket);
  }
  return byPerson;
};
