import { buildInClause, withPlanningDb, all, asNumber } from "./shared";
import { teamOptionBuilder, type TeamOption, type TeamOptionBuilderInput, type TeamOptionStrategy } from "./team-option-builder";
import type { AgentToolResolvedSource, AgentToolSourceInput } from "./shared";

export type RiskSeverity = "low" | "medium" | "high";

export type RiskAnalyzerInput = AgentToolSourceInput & {
  opportunityId?: string;
  teamOptions?: TeamOption[];
  preferredStrategy?: TeamOptionStrategy;
  availabilityWindowDays?: number;
  referenceDate?: string;
};

export type RiskItem = {
  code: string;
  severity: RiskSeverity;
  title: string;
  detail: string;
  evidence: string[];
};

export type RiskAnalyzerOutput = {
  source: AgentToolResolvedSource;
  strategy: TeamOptionStrategy;
  summary: {
    highestSeverity: RiskSeverity;
    overallRiskScore: number;
    assignedRoles: number;
    unfilledRoles: number;
    blockedAssignments: number;
    stretchAssignments: number;
    overlapCandidates: number;
    currentBenchAssignedPeople: number;
    partialCapacityAssignedPeople: number;
    highRiskSupplyAssignedPeople: number;
  };
  risks: RiskItem[];
  overlapCandidates: Array<{
    personId: string;
    personName: string;
    opportunityCount: number;
    roleCount: number;
    maxScore: number;
    avgScore: number;
  }>;
  regionalImpact: Array<{
    country: string;
    city: string;
    people: number;
  }>;
  nextActions: string[];
  evidence: string[];
};

const severityRank: Record<RiskSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const maxSeverity = (values: RiskSeverity[]) =>
  values.reduce<RiskSeverity>(
    (current, candidate) => (severityRank[candidate] > severityRank[current] ? candidate : current),
    "low",
  );

export function riskAnalyzer(input: RiskAnalyzerInput): RiskAnalyzerOutput {
  const generatedOptions =
    input.teamOptions ??
    (input.opportunityId
      ? teamOptionBuilder({
          datasetId: input.datasetId,
          dbPath: input.dbPath,
          opportunityId: input.opportunityId,
          availabilityWindowDays: input.availabilityWindowDays,
          referenceDate: input.referenceDate,
        } satisfies TeamOptionBuilderInput).options
      : null);

  if (!generatedOptions || generatedOptions.length === 0) {
    throw new Error("riskAnalyzer requires teamOptions or an opportunityId that can produce them.");
  }

  const strategy = input.preferredStrategy ?? generatedOptions[0].strategy;
  const teamOption = generatedOptions.find((option) => option.strategy === strategy) ?? generatedOptions[0];
  const assignedCandidates = teamOption.roleAssignments.flatMap((assignment) =>
    assignment.candidates.map((candidate) => ({
      roleId: assignment.roleId,
      roleName: assignment.roleName,
      ...candidate,
    })),
  );

  return withPlanningDb(input, ({ db, source }) => {
    const assignedPersonIds = assignedCandidates.map((candidate) => candidate.personId);
    const personClause = buildInClause("co.personId", assignedPersonIds);
    const overlapCandidates =
      assignedPersonIds.length === 0
        ? []
        : all<{
            personId: string;
            personName: string;
            opportunityCount: number | bigint;
            roleCount: number | bigint;
            maxScore: number;
            avgScore: number;
          }>(
            db,
            `
              SELECT
                p.id AS personId,
                p.name AS personName,
                COUNT(DISTINCT co.opportunityId) AS opportunityCount,
                COUNT(DISTINCT co.opportunityRoleId) AS roleCount,
                ROUND(MAX(co.overallStaffingScore), 1) AS maxScore,
                ROUND(AVG(co.overallStaffingScore), 1) AS avgScore
              FROM "OpportunityCandidateOverlay" co
              JOIN "Person" p ON p.id = co.personId
              WHERE ${personClause.sql}
              GROUP BY p.id, p.name
              HAVING COUNT(DISTINCT co.opportunityRoleId) > 1
              ORDER BY roleCount DESC, maxScore DESC, avgScore DESC, personName ASC
            `,
            personClause.params,
          ).map((row) => ({
            personId: String(row.personId),
            personName: String(row.personName),
            opportunityCount: asNumber(row.opportunityCount),
            roleCount: asNumber(row.roleCount),
            maxScore: asNumber(row.maxScore),
            avgScore: asNumber(row.avgScore),
          }));

    const supplyClause = buildInClause("s.personId", assignedPersonIds);
    const benchImpactRows =
      assignedPersonIds.length === 0
        ? []
        : all<{
            availabilityCategory: string;
            supplyRisk: string;
            personId: string;
          }>(
            db,
            `
              SELECT s.availabilityCategory, s.supplyRisk, s.personId
              FROM "SupplyRecord" s
              WHERE ${supplyClause.sql}
            `,
            supplyClause.params,
          );
    const regionalClause = buildInClause("p.id", assignedPersonIds);
    const regionalImpact =
      assignedPersonIds.length === 0
        ? []
        : all<{
            country: string;
            city: string;
            people: number | bigint;
          }>(
            db,
            `
              SELECT p.country, p.city, COUNT(*) AS people
              FROM "Person" p
              WHERE ${regionalClause.sql}
              GROUP BY p.country, p.city
              ORDER BY people DESC, p.country ASC, p.city ASC
            `,
            regionalClause.params,
          ).map((row) => ({
            country: String(row.country),
            city: String(row.city),
            people: asNumber(row.people),
          }));

    const currentBenchAssignedPeople = benchImpactRows.filter((row) => row.availabilityCategory === "Current Bench").length;
    const partialCapacityAssignedPeople = benchImpactRows.filter((row) => row.availabilityCategory === "Partial Capacity").length;
    const highRiskSupplyAssignedPeople = benchImpactRows.filter((row) => row.supplyRisk === "High").length;
    const blockedAssignments = assignedCandidates.filter((candidate) => candidate.ewaStatus.toLowerCase().includes("blocked")).length;
    const stretchAssignments = assignedCandidates.filter((candidate) => candidate.fitBucket === "Stretch").length;
    const risks: RiskItem[] = [];

    if (teamOption.summary.unfilledRoles > 0 || teamOption.summary.unfilledFte > 0) {
      risks.push({
        code: "unfilled_fte",
        severity: "high",
        title: "Unfilled staffing gap",
        detail: `${teamOption.summary.unfilledRoles} role(s) still have unfilled FTE.`,
        evidence: [`Unfilled FTE ${teamOption.summary.unfilledFte}.`],
      });
    }
    if (blockedAssignments > 0) {
      risks.push({
        code: "blocked_ewa",
        severity: "high",
        title: "Blocked EWA assignments",
        detail: `${blockedAssignments} assigned candidate(s) have blocked EWA status.`,
        evidence: assignedCandidates
          .filter((candidate) => candidate.ewaStatus.toLowerCase().includes("blocked"))
          .slice(0, 5)
          .map((candidate) => `${candidate.name} for ${candidate.roleName} is blocked.`),
      });
    }
    if (stretchAssignments > 0) {
      risks.push({
        code: "stretch_fit",
        severity: "medium",
        title: "Stretch assignments present",
        detail: `${stretchAssignments} assignment(s) depend on stretch-fit candidates.`,
        evidence: assignedCandidates
          .filter((candidate) => candidate.fitBucket === "Stretch")
          .slice(0, 5)
          .map((candidate) => `${candidate.name} is stretch fit for ${candidate.roleName}.`),
      });
    }
    if (overlapCandidates.length > 0) {
      risks.push({
        code: "candidate_overlap",
        severity: "medium",
        title: "Cross-opportunity candidate overlap",
        detail: `${overlapCandidates.length} assigned candidate(s) also appear in multiple opportunity-role overlays.`,
        evidence: overlapCandidates
          .slice(0, 5)
          .map((candidate) => `${candidate.personName} appears in ${candidate.roleCount} role overlays.`),
      });
    }
    if (partialCapacityAssignedPeople > 0) {
      risks.push({
        code: "partial_capacity",
        severity: "medium",
        title: "Partial capacity dependence",
        detail: `${partialCapacityAssignedPeople} assigned candidate(s) come from partial capacity supply.`,
        evidence: [`Partial capacity assigned people: ${partialCapacityAssignedPeople}.`],
      });
    }

    const overallRiskScore = Math.min(
      100,
      teamOption.summary.unfilledRoles * 20 +
        blockedAssignments * 15 +
        stretchAssignments * 8 +
        overlapCandidates.length * 5 +
        partialCapacityAssignedPeople * 4,
    );
    const highestSeverity = maxSeverity(risks.map((risk) => risk.severity));
    const nextActions = [
      teamOption.summary.unfilledRoles > 0 ? "Review role alternatives for unfilled roles first." : null,
      blockedAssignments > 0 ? "Resolve blocked EWA assignments or replace those candidates." : null,
      overlapCandidates.length > 0 ? "Confirm whether overlapping candidates should be reserved for higher-priority work." : null,
      partialCapacityAssignedPeople > 0 ? "Validate split allocation assumptions with delivery owners." : null,
    ].filter((value): value is string => value != null);

    return {
      source,
      strategy,
      summary: {
        highestSeverity,
        overallRiskScore,
        assignedRoles: teamOption.summary.assignedRoles,
        unfilledRoles: teamOption.summary.unfilledRoles,
        blockedAssignments,
        stretchAssignments,
        overlapCandidates: overlapCandidates.length,
        currentBenchAssignedPeople,
        partialCapacityAssignedPeople,
        highRiskSupplyAssignedPeople,
      },
      risks,
      overlapCandidates,
      regionalImpact,
      nextActions,
      evidence: [
        `Risk analysis evaluated the ${strategy} team option.`,
        `Assigned people: ${assignedCandidates.length}.`,
      ],
    };
  });
}
