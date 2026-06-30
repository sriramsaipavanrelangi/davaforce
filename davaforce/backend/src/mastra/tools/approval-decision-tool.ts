import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createTool } from "@mastra/core/tools";
import { resolveWorkforceDataSource } from "../../lib/workforce-dataset-store";
import { text } from "../../lib/workforce-data-utils";
import { buildRiskInsights } from "./risk-insights-tool";
import { buildTeamOptions } from "./team-builder-tool";
import {
  approvalDecisionInputSchema,
  approvalDecisionOutputSchema,
  type ApprovalDecisionInput,
  type ApprovalDecisionOutput,
  type RiskInsightsOutput,
  type TeamBuilderOutput,
} from "../schemas/workforce-planning-schemas";

type Row = Record<string, unknown>;
type TeamOption = TeamBuilderOutput["teamOptions"][number];
type OptionAnalysis = RiskInsightsOutput["optionAnalyses"][number];
type EwaRequestSummary = ApprovalDecisionOutput["ewaSummary"]["requestsForSelectedOption"][number];

const makeDb = (dbPath: string) => new DatabaseSync(dbPath, { readOnly: true });

const all = (db: DatabaseSync, sql: string, params: any[] = []) =>
  db.prepare(sql).all(...params) as Row[];

const numberValue = (value: unknown) => Number(value ?? 0);

const boolValue = (value: unknown) => Boolean(Number(value ?? 0));

const assignmentKey = (roleId: string, personId: string) => `${roleId}:${personId}`;

const toEwaRequestSummary = (row: Row): EwaRequestSummary => ({
  roleId: text(row.opportunityRoleId),
  roleName: text(row.roleName),
  personId: text(row.personId),
  personName: text(row.personName),
  requestType: text(row.requestType),
  ewaStatus: text(row.ewaStatus),
  requestedFte: numberValue(row.requestedFte),
  proposedStartDate: text(row.proposedStartDate),
  proposedEndDate: text(row.proposedEndDate),
  approvalRequired: boolValue(row.approvalRequired),
  blockingReason: text(row.blockingReason),
  nextAction: text(row.nextAction),
});

const requestsByStatus = (requests: EwaRequestSummary[]) =>
  requests.reduce<Record<string, number>>((counts, request) => {
    const status = request.ewaStatus || "Unknown";
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});

const queryEwaRequests = (dbPath: string, opportunityId: string | null) => {
  if (!opportunityId) {
    return [];
  }

  const db = makeDb(dbPath);
  try {
    return all(
      db,
      `
      SELECT e.*, r.roleName, p.name AS personName
      FROM "EwaRequest" e
      JOIN "OpportunityRole" r ON r.id = e.opportunityRoleId
      JOIN "Person" p ON p.id = e.personId
      WHERE e.opportunityId = ?
      ORDER BY r.id, p.name
      `,
      [opportunityId],
    ).map(toEwaRequestSummary);
  } finally {
    db.close();
  }
};

const selectOption = (
  teamOptions: TeamOption[],
  optionAnalyses: OptionAnalysis[],
  preferredOptionType?: string,
) => {
  const preferred = preferredOptionType
    ? teamOptions.find((option) => option.optionType.toLowerCase() === preferredOptionType.toLowerCase())
    : null;

  if (preferred) {
    const preferredAnalysis = optionAnalyses.find((analysis) => analysis.optionType === preferred.optionType) ?? null;
    return { option: preferred, analysis: preferredAnalysis };
  }

  const lowestRisk = [...optionAnalyses].sort((left, right) => left.riskScore - right.riskScore)[0] ?? null;
  const option = lowestRisk ? teamOptions.find((item) => item.optionType === lowestRisk.optionType) ?? null : teamOptions[0] ?? null;
  return {
    option,
    analysis: lowestRisk,
  };
};

const statusFor = (passed: boolean, review: boolean) => {
  if (passed) return "Pass";
  if (review) return "Review";
  return "Blocker";
};

export function buildApprovalDecision(input: ApprovalDecisionInput): ApprovalDecisionOutput {
  const source = resolveWorkforceDataSource({
    datasetId: input.datasetId,
    dbPath: input.dbPath ?? "workforce.db",
  });
  const dbPath = resolve(source.dbPath);
  const teamBuilderOutput = buildTeamOptions({
    ...input,
    datasetId: source.datasetId ?? undefined,
    dbPath,
  });
  const riskInsightsOutput = buildRiskInsights({
    ...input,
    datasetId: source.datasetId ?? undefined,
    dbPath,
  });
  const opportunityId = teamBuilderOutput.opportunity?.id ?? input.opportunityId ?? null;
  const { option: selectedOption, analysis: selectedAnalysis } = selectOption(
    teamBuilderOutput.teamOptions,
    riskInsightsOutput.optionAnalyses,
    input.preferredOptionType,
  );
  const ewaRequests = queryEwaRequests(dbPath, opportunityId);
  const selectedAssignmentKeys = new Set(
    selectedOption?.assignments.map((assignment) => assignmentKey(assignment.roleId, assignment.personId)) ?? [],
  );
  const requestsForSelectedOption = ewaRequests.filter((request) =>
    selectedAssignmentKeys.has(assignmentKey(request.roleId, request.personId)),
  );
  const blockers = requestsForSelectedOption.filter(
    (request) =>
      request.ewaStatus.toLowerCase().includes("blocked") ||
      request.blockingReason.length > 0 ||
      request.approvalRequired,
  );
  const missingEwaAssignments =
    selectedOption?.assignments.filter(
      (assignment) => !requestsForSelectedOption.some((request) => request.roleId === assignment.roleId && request.personId === assignment.personId),
    ) ?? [];
  const selectedOptionHasGap = (selectedOption?.remainingFteGap ?? 0) > 0;
  const selectedOptionHighRisk = selectedAnalysis?.riskLevel === "High";
  const readyForApproval =
    Boolean(selectedOption) &&
    !selectedOptionHasGap &&
    blockers.length === 0 &&
    !selectedOptionHighRisk &&
    missingEwaAssignments.length === 0;
  const decisionState = !selectedOption
    ? "No Recommendation Available"
    : readyForApproval
      ? "Ready for Human Approval Review"
      : "Needs Planner Review Before Approval";

  const approvalChecklist = [
    {
      item: "Opportunity selected",
      status: statusFor(Boolean(teamBuilderOutput.opportunity), false),
      notes: teamBuilderOutput.opportunity
        ? [`${teamBuilderOutput.opportunity.id}: ${teamBuilderOutput.opportunity.name}`]
        : ["No opportunity was selected."],
    },
    {
      item: "Team option selected",
      status: statusFor(Boolean(selectedOption), false),
      notes: selectedOption ? [selectedOption.summary] : ["No team option was available."],
    },
    {
      item: "FTE coverage",
      status: statusFor(!selectedOptionHasGap, selectedOptionHasGap),
      notes: selectedOption
        ? [`${selectedOption.assignedFte}/${selectedOption.totalFteRequired} FTE assigned; ${selectedOption.remainingFteGap} FTE gap.`]
        : ["No selected option to assess."],
    },
    {
      item: "Risk level",
      status: statusFor(!selectedOptionHighRisk, selectedOptionHighRisk),
      notes: selectedAnalysis
        ? [`${selectedAnalysis.optionType}: ${selectedAnalysis.riskLevel} risk, score ${selectedAnalysis.riskScore}.`]
        : ["No risk analysis found for selected option."],
    },
    {
      item: "EWA readiness",
      status: statusFor(blockers.length === 0 && missingEwaAssignments.length === 0, blockers.length > 0 || missingEwaAssignments.length > 0),
      notes: [
        `${requestsForSelectedOption.length} EWA request(s) matched selected assignments.`,
        blockers.length > 0 ? `${blockers.length} EWA blocker(s) or approval-required item(s).` : "No selected-assignment EWA blockers found.",
        missingEwaAssignments.length > 0
          ? `${missingEwaAssignments.length} selected assignment(s) do not yet have EWA request records.`
          : "Every selected assignment has an EWA request record.",
      ],
    },
  ];

  const conditions = [
    selectedOptionHasGap ? "Close remaining FTE gaps or explicitly accept phased staffing." : null,
    selectedOptionHighRisk ? "Review high-risk option analysis before approval." : null,
    blockers.length > 0 ? "Resolve EWA blockers or approval-required records before booking." : null,
    missingEwaAssignments.length > 0 ? "Create or confirm EWA request records for selected assignments." : null,
  ].filter((condition): condition is string => condition != null);
  const recommendedDecision = readyForApproval ? "Proceed to human approval review." : "Hold for planner review and remediation.";
  const nextActions = [
    ...conditions,
    ...(selectedAnalysis?.recommendedActions ?? []),
    ...riskInsightsOutput.nextActions.slice(0, 5),
  ];

  return {
    source: teamBuilderOutput.source,
    asOfDate: teamBuilderOutput.asOfDate,
    opportunity: teamBuilderOutput.opportunity,
    selectedOptionType: selectedOption?.optionType ?? null,
    decisionState,
    readyForApproval,
    humanApprovalRequired: true,
    recommendationSummary: selectedOption
      ? `${selectedOption.optionType} is selected for approval packaging: ${selectedOption.summary}`
      : "No staffing option is available for approval packaging.",
    selectedOption,
    riskSummary: {
      overallRiskLevel: riskInsightsOutput.overallRiskLevel,
      overallConfidence: riskInsightsOutput.overallConfidence,
      optionRiskLevel: selectedAnalysis?.riskLevel ?? null,
      optionRiskScore: selectedAnalysis?.riskScore ?? null,
      keyRisks: selectedAnalysis?.risks.slice(0, 8) ?? [],
    },
    approvalChecklist,
    ewaSummary: {
      totalRequests: ewaRequests.length,
      requestsByStatus: requestsByStatus(ewaRequests),
      blockers,
      requestsForSelectedOption,
    },
    approvalPackage: {
      approverAudience: ["Workforce Planner", "Delivery Manager", "Regional Planner"],
      decisionPrompt: "Review the selected staffing option, risks, EWA status, and conditions before any booking action.",
      recommendedDecision,
      conditions,
    },
    nextActions: [...new Set(nextActions)].slice(0, 12),
    evidence: [
      ...riskInsightsOutput.evidence,
      `Approval & Decision selected ${selectedOption?.optionType ?? "no option"} for packaging.`,
      `EWA Requests queried for opportunity ${opportunityId ?? "unknown"}; ${ewaRequests.length} request(s) found.`,
      "Human approval remains required; no booking or EWA approval was executed.",
    ],
  };
}

export const approvalDecisionTool = createTool({
  id: "approval-decision",
  description:
    "Prepare a human approval package from staffing options, risk insights, and EWA request status without auto-approving bookings.",
  inputSchema: approvalDecisionInputSchema,
  outputSchema: approvalDecisionOutputSchema,
  execute: async (input) => buildApprovalDecision(input),
});
