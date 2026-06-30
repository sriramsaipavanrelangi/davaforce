import { resolve } from "node:path";
import { createTool } from "@mastra/core/tools";
import { resolveWorkforceDataSource } from "../../lib/workforce-dataset-store";
import { assessOpportunity } from "./opportunity-assessment-tool";
import { findResourceSupply } from "./resource-supply-tool";
import {
  teamBuilderInputSchema,
  teamBuilderOutputSchema,
  type ResourceSupplyOutput,
  type TeamBuilderInput,
  type TeamBuilderOutput,
} from "../schemas/workforce-planning-schemas";

type ResourceCandidate = ResourceSupplyOutput["candidates"][number];
type TeamBuilderCandidate = TeamBuilderOutput["roleWiseCandidates"][number]["candidates"][number];
type TeamAssignment = TeamBuilderOutput["teamOptions"][number]["assignments"][number];

const round2 = (value: number) => Number(value.toFixed(2));

const rolePriorityRank = (priority: string) => {
  const normalized = priority.toLowerCase();
  if (normalized === "high") return 0;
  if (normalized === "medium") return 1;
  return 2;
};

const candidateKey = (roleId: string, personId: string) => `${roleId}:${personId}`;

const feasibilityFor = (
  candidate: ResourceCandidate,
  role: {
    fteRequired: number;
    minimumIndividualFte: number;
  },
) => {
  const available = candidate.availableFteInWindow;
  const ewaStatus = candidate.ewaStatus.toLowerCase();

  if (ewaStatus.includes("blocked")) return "ewa-blocked";
  if (available >= role.fteRequired) return "feasible";
  if (available >= role.minimumIndividualFte) return "partial-capacity";
  if (available > 0) return "below-minimum-capacity";
  return "availability-blocked";
};

const toTeamBuilderCandidate = (
  role: {
    id: string;
    roleName: string;
    fteRequired: number;
    minimumIndividualFte: number;
  },
  candidate: ResourceCandidate,
  source: string,
): TeamBuilderCandidate => {
  const capabilityScore = candidate.overlayScore ?? candidate.skillMatchScore;
  const availabilityScore = Math.round(Math.min(candidate.availableFteInWindow / Math.max(role.fteRequired, 0.1), 1) * 100);
  const assignmentFte = round2(Math.min(candidate.availableFteInWindow, role.fteRequired));
  const fteGap = round2(Math.max(role.fteRequired - assignmentFte, candidate.fteGap ?? 0));
  const overallScore = Math.round(capabilityScore * 0.6 + availabilityScore * 0.4);
  const feasibility = feasibilityFor(candidate, role);

  return {
    roleId: role.id,
    roleName: role.roleName,
    personId: candidate.personId,
    name: candidate.name,
    grade: candidate.grade,
    discipline: candidate.discipline,
    roleArchetype: candidate.roleArchetype,
    city: candidate.city,
    country: candidate.country,
    primaryDomain: candidate.primaryDomain,
    source,
    feasibility,
    availableFteInWindow: candidate.availableFteInWindow,
    assignmentFte,
    fteGap,
    capabilityScore,
    availabilityScore,
    overallScore,
    skillMatchScore: candidate.skillMatchScore,
    overlayScore: candidate.overlayScore,
    overlayRank: candidate.overlayRank,
    fitStatus: candidate.fitStatus,
    ewaStatus: candidate.ewaStatus,
    evidence: [
      ...candidate.evidence,
      `Team Builder feasibility: ${feasibility}; assignment ${assignmentFte}/${role.fteRequired} FTE.`,
    ],
  };
};

const rankCandidates = (strategy: string, candidates: TeamBuilderCandidate[]) =>
  [...candidates].sort((left, right) => {
    if (strategy === "best-fit") {
      return (
        right.capabilityScore - left.capabilityScore ||
        (left.overlayRank ?? 999) - (right.overlayRank ?? 999) ||
        right.overallScore - left.overallScore ||
        right.availabilityScore - left.availabilityScore
      );
    }

    if (strategy === "fastest-available") {
      return (
        right.availableFteInWindow - left.availableFteInWindow ||
        right.availabilityScore - left.availabilityScore ||
        right.overallScore - left.overallScore ||
        right.capabilityScore - left.capabilityScore
      );
    }

    return (
      right.overallScore - left.overallScore ||
      right.capabilityScore - left.capabilityScore ||
      right.availabilityScore - left.availabilityScore
    );
  });

const confidenceFor = (remainingFteGap: number, totalFteRequired: number, assignments: TeamAssignment[]) => {
  const hasBlockedAssignment = assignments.some((assignment) => assignment.feasibility.includes("blocked"));
  if (remainingFteGap === 0 && !hasBlockedAssignment) return "High";
  if (remainingFteGap <= totalFteRequired * 0.25) return "Medium";
  return "Low";
};

const buildTeamOption = (
  optionType: string,
  strategy: string,
  roleWiseCandidates: TeamBuilderOutput["roleWiseCandidates"],
) => {
  const assignments: TeamAssignment[] = [];
  const gaps: string[] = [];
  const usedPeople = new Set<string>();
  const roles = roleWiseCandidates;

  for (const role of roles) {
    const ranked = rankCandidates(strategy, role.candidates);
    let remainingRoleFte = role.fteRequired;

    if (role.canCombineCandidates) {
      for (const candidate of ranked) {
        if (usedPeople.has(candidate.personId) || remainingRoleFte <= 0) {
          continue;
        }

        const assignmentFte = round2(Math.min(candidate.availableFteInWindow, remainingRoleFte));
        if (assignmentFte < role.minimumIndividualFte) {
          continue;
        }

        assignments.push({
          roleId: role.roleId,
          roleName: role.roleName,
          personId: candidate.personId,
          name: candidate.name,
          assignmentFte,
          feasibility: candidate.feasibility,
          overallScore: candidate.overallScore,
          evidence: candidate.evidence,
        });
        usedPeople.add(candidate.personId);
        remainingRoleFte = round2(remainingRoleFte - assignmentFte);
      }

      if (remainingRoleFte > 0) {
        gaps.push(`${role.roleName}: ${remainingRoleFte} FTE remains after split-capacity assignment.`);
      }
      continue;
    }

    const selected = ranked.find((candidate) => !usedPeople.has(candidate.personId));
    if (!selected) {
      gaps.push(`${role.roleName}: no unused candidate available.`);
      continue;
    }

    assignments.push({
      roleId: role.roleId,
      roleName: role.roleName,
      personId: selected.personId,
      name: selected.name,
      assignmentFte: selected.assignmentFte,
      feasibility: selected.feasibility,
      overallScore: selected.overallScore,
      evidence: selected.evidence,
    });
    usedPeople.add(selected.personId);

    if (selected.assignmentFte < role.fteRequired) {
      gaps.push(`${role.roleName}: ${round2(role.fteRequired - selected.assignmentFte)} FTE gap for ${selected.name}.`);
    }
  }

  const totalFteRequired = round2(roleWiseCandidates.reduce((sum, role) => sum + role.fteRequired, 0));
  const assignedFte = round2(assignments.reduce((sum, assignment) => sum + assignment.assignmentFte, 0));
  const remainingFteGap = round2(Math.max(totalFteRequired - assignedFte, 0));
  const averageOverallScore = assignments.length
    ? Math.round(assignments.reduce((sum, assignment) => sum + assignment.overallScore, 0) / assignments.length)
    : 0;

  return {
    optionType,
    summary: `${optionType}: ${assignedFte}/${totalFteRequired} FTE assigned with ${remainingFteGap} FTE remaining gap.`,
    totalFteRequired,
    assignedFte,
    remainingFteGap,
    averageOverallScore,
    confidence: confidenceFor(remainingFteGap, totalFteRequired, assignments),
    assignments,
    gaps,
    evidence: [
      `Built using ${strategy} candidate ranking.`,
      `${assignments.length} assignment(s) selected across ${roleWiseCandidates.length} role(s).`,
    ],
  };
};

export function buildTeamOptions(input: TeamBuilderInput): TeamBuilderOutput {
  const source = resolveWorkforceDataSource({
    datasetId: input.datasetId,
    dbPath: input.dbPath ?? "workforce.db",
  });
  const dbPath = resolve(source.dbPath);
  const assessment = assessOpportunity({
    datasetId: source.datasetId ?? undefined,
    dbPath,
    opportunityId: input.opportunityId,
    query: input.query,
    asOfDate: input.asOfDate,
  });
  const opportunityId = assessment.selectedOpportunityId ?? input.opportunityId;
  const asOfDate = input.asOfDate ?? assessment.asOfDate;
  const limitPerRole = input.limitPerRole ?? 5;

  if (!opportunityId) {
    return {
      source: assessment.source,
      asOfDate,
      opportunity: null,
      roleWiseCandidates: [],
      teamOptions: [],
      constraints: ["No opportunity could be selected, so team options were not built."],
      evidence: ["Team Builder requires a selected opportunity before candidate assignment."],
    };
  }

  const roles = [...assessment.roles].sort((left, right) => {
    const priorityDelta = rolePriorityRank(left.priority) - rolePriorityRank(right.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return Number(left.canCombineCandidates) - Number(right.canCombineCandidates) || right.fteRequired - left.fteRequired;
  });

  const roleWiseCandidates = roles.map((role) => {
    const supply = findResourceSupply({
      datasetId: source.datasetId ?? undefined,
      dbPath,
      opportunityId,
      roleId: role.id,
      asOfDate,
      availabilityWindowDays: input.availabilityWindowDays,
      limit: limitPerRole,
    });
    const candidatesByKey = new Map<string, TeamBuilderCandidate>();

    for (const candidate of supply.candidates) {
      candidatesByKey.set(candidateKey(role.id, candidate.personId), toTeamBuilderCandidate(role, candidate, "strict"));
    }
    for (const candidate of supply.nearMatches) {
      const key = candidateKey(role.id, candidate.personId);
      if (!candidatesByKey.has(key)) {
        candidatesByKey.set(key, toTeamBuilderCandidate(role, candidate, "near-match"));
      }
    }

    const candidates = rankCandidates("balanced", [...candidatesByKey.values()]).slice(0, limitPerRole);
    const outcome =
      candidates.length === 0
        ? "No candidate options found."
        : candidates.some((candidate) => candidate.feasibility === "feasible")
          ? "At least one feasible candidate option found."
          : "Only partial, blocked, or relaxed-filter candidates found.";

    return {
      roleId: role.id,
      roleName: role.roleName,
      fteRequired: role.fteRequired,
      minimumIndividualFte: role.minimumIndividualFte,
      canCombineCandidates: role.canCombineCandidates,
      candidates,
      outcome,
    };
  });

  const teamOptions = [
    buildTeamOption("Best Fit Team", "best-fit", roleWiseCandidates),
    buildTeamOption("Fastest Available Team", "fastest-available", roleWiseCandidates),
    buildTeamOption("Balanced Team", "balanced", roleWiseCandidates),
  ];
  const constraints = roleWiseCandidates.flatMap((role) =>
    role.outcome === "At least one feasible candidate option found."
      ? []
      : [`${role.roleName}: ${role.outcome}`],
  );

  return {
    source: assessment.source,
    asOfDate,
    opportunity: assessment.opportunity,
    roleWiseCandidates,
    teamOptions,
    constraints,
    evidence: [
      `Team Builder used opportunity ${opportunityId}.`,
      `Built role-wise candidates from Resource Supply output for ${roleWiseCandidates.length} role(s).`,
      `Generated ${teamOptions.length} team option(s): Best Fit, Fastest Available, Balanced.`,
    ],
  };
}

export const teamBuilderTool = createTool({
  id: "team-builder",
  description:
    "Combine opportunity requirements and resource supply evidence to build role-wise candidates and team-level staffing options.",
  inputSchema: teamBuilderInputSchema,
  outputSchema: teamBuilderOutputSchema,
  execute: async (input) => buildTeamOptions(input),
});
