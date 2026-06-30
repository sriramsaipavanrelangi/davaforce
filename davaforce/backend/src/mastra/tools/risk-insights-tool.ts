import { createTool } from "@mastra/core/tools";
import { buildTeamOptions } from "./team-builder-tool";
import {
  riskInsightsInputSchema,
  riskInsightsOutputSchema,
  type RiskInsightsInput,
  type RiskInsightsOutput,
  type TeamBuilderOutput,
} from "../schemas/workforce-planning-schemas";

type RiskItem = RiskInsightsOutput["availabilityRisks"][number];
type OptionAnalysis = RiskInsightsOutput["optionAnalyses"][number];
type RoleAnalysis = RiskInsightsOutput["roleAnalyses"][number];
type TeamCandidate = TeamBuilderOutput["roleWiseCandidates"][number]["candidates"][number];
type TeamAssignment = TeamBuilderOutput["teamOptions"][number]["assignments"][number];

const round2 = (value: number) => Number(value.toFixed(2));

const riskLevelFor = (riskScore: number) => {
  if (riskScore >= 65) return "High";
  if (riskScore >= 35) return "Medium";
  return "Low";
};

const severityFor = (riskScore: number) => {
  if (riskScore >= 65) return "High";
  if (riskScore >= 35) return "Medium";
  return "Low";
};

const confidenceRank = (confidence: string) => {
  const normalized = confidence.toLowerCase();
  if (normalized === "high") return 0;
  if (normalized === "medium") return 1;
  return 2;
};

const confidenceFromRisk = (riskLevel: string) => {
  if (riskLevel === "Low") return "High";
  if (riskLevel === "Medium") return "Medium";
  return "Low";
};

const candidateKey = (roleId: string, personId: string) => `${roleId}:${personId}`;

const candidateMapFor = (teamBuilderOutput: TeamBuilderOutput) => {
  const map = new Map<string, TeamCandidate>();
  for (const role of teamBuilderOutput.roleWiseCandidates) {
    for (const candidate of role.candidates) {
      map.set(candidateKey(role.roleId, candidate.personId), candidate);
    }
  }
  return map;
};

const riskItem = (
  category: string,
  severity: string,
  scope: string,
  message: string,
  evidence: string[],
): RiskItem => ({
  category,
  severity,
  scope,
  message,
  evidence,
});

const analyzeOption = (
  option: TeamBuilderOutput["teamOptions"][number],
  candidateByRoleAndPerson: Map<string, TeamCandidate>,
): OptionAnalysis => {
  const risks: RiskItem[] = [];

  if (option.remainingFteGap > 0) {
    risks.push(
      riskItem(
        "FTE Gap",
        option.remainingFteGap >= 1 ? "High" : "Medium",
        option.optionType,
        `${option.remainingFteGap} FTE remains unassigned.`,
        option.gaps,
      ),
    );
  }

  for (const assignment of option.assignments) {
    const candidate = candidateByRoleAndPerson.get(candidateKey(assignment.roleId, assignment.personId));
    const evidence = candidate?.evidence ?? assignment.evidence;

    if (assignment.feasibility.includes("blocked")) {
      risks.push(
        riskItem(
          "Availability",
          "High",
          `${assignment.roleName}: ${assignment.name}`,
          `${assignment.name} is ${assignment.feasibility} for ${assignment.roleName}.`,
          evidence,
        ),
      );
    } else if (assignment.feasibility !== "feasible") {
      risks.push(
        riskItem(
          "Availability",
          "Medium",
          `${assignment.roleName}: ${assignment.name}`,
          `${assignment.name} is only ${assignment.feasibility} for ${assignment.roleName}.`,
          evidence,
        ),
      );
    }

    if (candidate && candidate.capabilityScore < 60) {
      risks.push(
        riskItem(
          "Capability",
          candidate.capabilityScore < 45 ? "High" : "Medium",
          `${assignment.roleName}: ${assignment.name}`,
          `${assignment.name} has capability score ${candidate.capabilityScore} for ${assignment.roleName}.`,
          evidence,
        ),
      );
    }

    if (candidate?.source === "near-match") {
      risks.push(
        riskItem(
          "Relaxed Filter",
          "Medium",
          `${assignment.roleName}: ${assignment.name}`,
          `${assignment.name} is a near-match candidate, not a strict filter match.`,
          evidence,
        ),
      );
    }
  }

  const riskScore = Math.min(
    100,
    Math.round(
      option.remainingFteGap * 25 +
        risks.reduce((sum, risk) => sum + (risk.severity === "High" ? 18 : risk.severity === "Medium" ? 10 : 4), 0) +
        (option.confidence === "Low" ? 15 : option.confidence === "Medium" ? 6 : 0),
    ),
  );
  const riskLevel = riskLevelFor(riskScore);
  const recommendedActions = [
    option.remainingFteGap > 0 ? "Resolve remaining FTE gaps before treating this option as ready for approval." : null,
    risks.some((risk) => risk.category === "Availability")
      ? "Review availability blockers, partial capacity, and release timing with delivery owners."
      : null,
    risks.some((risk) => risk.category === "Capability")
      ? "Confirm capability gaps with leads and define upskilling, partner support, or alternate candidates."
      : null,
    risks.some((risk) => risk.category === "Relaxed Filter")
      ? "Validate relaxed-filter candidates against location, domain, grade, and role expectations."
      : null,
  ].filter((action): action is string => action != null);

  return {
    optionType: option.optionType,
    riskLevel,
    riskScore,
    confidence: option.confidence,
    assignedFte: option.assignedFte,
    remainingFteGap: option.remainingFteGap,
    risks,
    recommendedActions,
  };
};

const analyzeRole = (role: TeamBuilderOutput["roleWiseCandidates"][number]): RoleAnalysis => {
  const bestCandidate = [...role.candidates].sort((left, right) => right.overallScore - left.overallScore)[0] ?? null;
  const feasibleCandidates = role.candidates.filter((candidate) => candidate.feasibility === "feasible");
  const blockedCandidates = role.candidates
    .filter((candidate) => candidate.feasibility.includes("blocked"))
    .map((candidate) => candidate.name);
  const bestCapability = Math.max(0, ...role.candidates.map((candidate) => candidate.capabilityScore));
  const bestAvailability = Math.max(0, ...role.candidates.map((candidate) => candidate.availabilityScore));
  const hasNearMatchesOnly = role.candidates.length > 0 && role.candidates.every((candidate) => candidate.source === "near-match");

  const riskScore =
    (feasibleCandidates.length === 0 ? 35 : 0) +
    (bestCapability < 60 ? 25 : 0) +
    (bestAvailability < 100 ? 15 : 0) +
    (blockedCandidates.length > 0 ? 10 : 0) +
    (hasNearMatchesOnly ? 8 : 0);
  const riskLevel = riskLevelFor(riskScore);

  const nextActions = [
    feasibleCandidates.length === 0 ? "Find a feasible candidate or adjust role timing/capacity expectations." : null,
    bestCapability < 60 ? "Validate capability gap and consider upskilling, partner support, or alternate sourcing." : null,
    bestAvailability < 100 ? "Confirm release timing and partial-capacity feasibility." : null,
    blockedCandidates.length > 0 ? "Resolve availability or booking blockers before approval." : null,
    hasNearMatchesOnly ? "Review relaxed filters because candidates are near matches rather than strict matches." : null,
  ].filter((action): action is string => action != null);

  return {
    roleId: role.roleId,
    roleName: role.roleName,
    riskLevel,
    capabilityGapSummary:
      bestCapability >= 60
        ? `Best capability score is ${bestCapability}.`
        : `Best capability score is ${bestCapability}; capability validation is required.`,
    availabilityRiskSummary:
      feasibleCandidates.length > 0
        ? `${feasibleCandidates.length} feasible candidate(s) available.`
        : "No fully feasible candidate found.",
    bestCandidate: bestCandidate?.name ?? null,
    blockedCandidates,
    nextActions,
  };
};

const aggregateRegionalImpact = (
  assignments: TeamAssignment[],
  candidateByRoleAndPerson: Map<string, TeamCandidate>,
) => {
  const byCountry = new Map<string, { assignedFte: number; people: Set<string>; notes: string[] }>();
  for (const assignment of assignments) {
    const candidate = candidateByRoleAndPerson.get(candidateKey(assignment.roleId, assignment.personId));
    const country = candidate?.country ?? "Unknown";
    const bucket = byCountry.get(country) ?? { assignedFte: 0, people: new Set<string>(), notes: [] };
    bucket.assignedFte = round2(bucket.assignedFte + assignment.assignmentFte);
    bucket.people.add(assignment.personId);
    if (candidate?.source === "near-match") {
      bucket.notes.push(`${assignment.name} is a near-match for ${assignment.roleName}.`);
    }
    byCountry.set(country, bucket);
  }

  return [...byCountry.entries()].map(([label, value]) => ({
    label,
    assignedFte: value.assignedFte,
    people: value.people.size,
    notes: [...new Set(value.notes)],
  }));
};

const aggregateUtilizationImpact = (
  assignments: TeamAssignment[],
  candidateByRoleAndPerson: Map<string, TeamCandidate>,
) => {
  const byFeasibility = new Map<string, { assignedFte: number; people: Set<string>; notes: string[] }>();
  for (const assignment of assignments) {
    const candidate = candidateByRoleAndPerson.get(candidateKey(assignment.roleId, assignment.personId));
    const bucket = byFeasibility.get(assignment.feasibility) ?? { assignedFte: 0, people: new Set<string>(), notes: [] };
    bucket.assignedFte = round2(bucket.assignedFte + assignment.assignmentFte);
    bucket.people.add(assignment.personId);
    if (candidate?.availableFteInWindow != null) {
      bucket.notes.push(`${assignment.name}: ${assignment.assignmentFte}/${candidate.availableFteInWindow} FTE used.`);
    }
    byFeasibility.set(assignment.feasibility, bucket);
  }

  return [...byFeasibility.entries()].map(([label, value]) => ({
    label,
    assignedFte: value.assignedFte,
    people: value.people.size,
    notes: [...new Set(value.notes)],
  }));
};

export function buildRiskInsights(input: RiskInsightsInput): RiskInsightsOutput {
  const teamBuilderOutput = buildTeamOptions(input);
  const candidateByRoleAndPerson = candidateMapFor(teamBuilderOutput);
  const optionAnalyses = teamBuilderOutput.teamOptions.map((option) => analyzeOption(option, candidateByRoleAndPerson));
  const roleAnalyses = teamBuilderOutput.roleWiseCandidates.map(analyzeRole);
  const capabilityGaps = optionAnalyses.flatMap((option) =>
    option.risks.filter((risk) => risk.category === "Capability"),
  );
  const availabilityRisks = optionAnalyses.flatMap((option) =>
    option.risks.filter((risk) => risk.category === "Availability" || risk.category === "FTE Gap"),
  );
  const recommendedOption =
    [...optionAnalyses].sort((left, right) => left.riskScore - right.riskScore || confidenceRank(left.confidence) - confidenceRank(right.confidence))[0] ??
    null;
  const recommendedTeamOption = recommendedOption
    ? teamBuilderOutput.teamOptions.find((option) => option.optionType === recommendedOption.optionType)
    : null;
  const overallRiskLevel = recommendedOption?.riskLevel ?? "High";
  const nextActions = [
    recommendedOption ? `Use ${recommendedOption.optionType} as the lowest-risk baseline for planner review.` : null,
    ...optionAnalyses.flatMap((option) => option.recommendedActions.map((action) => `${option.optionType}: ${action}`)),
    ...roleAnalyses.flatMap((role) => role.nextActions.map((action) => `${role.roleName}: ${action}`)),
  ].filter((action): action is string => action != null);

  return {
    source: teamBuilderOutput.source,
    asOfDate: teamBuilderOutput.asOfDate,
    opportunity: teamBuilderOutput.opportunity,
    overallRiskLevel,
    overallConfidence: confidenceFromRisk(overallRiskLevel),
    summary: recommendedOption
      ? `${recommendedOption.optionType} has the lowest risk (${recommendedOption.riskLevel}, score ${recommendedOption.riskScore}).`
      : "No team options were available to evaluate.",
    optionAnalyses,
    roleAnalyses,
    capabilityGaps,
    availabilityRisks,
    regionalCapacityImpact: recommendedTeamOption
      ? aggregateRegionalImpact(recommendedTeamOption.assignments, candidateByRoleAndPerson)
      : [],
    utilizationImpact: recommendedTeamOption
      ? aggregateUtilizationImpact(recommendedTeamOption.assignments, candidateByRoleAndPerson)
      : [],
    nextActions: [...new Set(nextActions)].slice(0, 12),
    evidence: [
      ...teamBuilderOutput.evidence,
      `Risk & Insights evaluated ${optionAnalyses.length} team option(s) and ${roleAnalyses.length} role(s).`,
      "Capability and availability risks were evaluated separately.",
    ],
  };
}

export const riskInsightsTool = createTool({
  id: "risk-insights",
  description:
    "Evaluate Team Builder staffing options for capability gaps, availability risks, FTE gaps, confidence, and planner next actions.",
  inputSchema: riskInsightsInputSchema,
  outputSchema: riskInsightsOutputSchema,
  execute: async (input) => buildRiskInsights(input),
});
