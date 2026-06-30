import { buildInClause, withPlanningDb, all } from "./shared";
import { teamOptionBuilder, type TeamOption, type TeamOptionBuilderInput, type TeamOptionStrategy } from "./team-option-builder";
import type { AgentToolResolvedSource, AgentToolSourceInput } from "./shared";

export type EwaRecommendationBuilderInput = AgentToolSourceInput & {
  opportunityId?: string;
  teamOptions?: TeamOption[];
  preferredStrategy?: TeamOptionStrategy;
  availabilityWindowDays?: number;
  referenceDate?: string;
};

export type EwaRecommendation = {
  roleId: string;
  roleName: string;
  personId: string | null;
  personName: string | null;
  allocatedFte: number;
  currentEwaStatus: string;
  recommendedAction:
    | "resolve_staffing_gap"
    | "replace_or_resequence"
    | "submit_draft"
    | "follow_up_pending_approval"
    | "create_ewa_request"
    | "confirm_existing_booking";
  actionReason: string;
  blockingReason: string | null;
  nextAction: string;
  humanDecisionRequired: boolean;
};

export type EwaRecommendationBuilderOutput = {
  source: AgentToolResolvedSource;
  strategy: TeamOptionStrategy;
  summary: {
    resolveStaffingGap: number;
    replaceOrResequence: number;
    submitDraft: number;
    followUpPendingApproval: number;
    createEwaRequest: number;
    confirmExistingBooking: number;
  };
  recommendations: EwaRecommendation[];
  nextActions: string[];
  evidence: string[];
};

export function ewaRecommendationBuilder(input: EwaRecommendationBuilderInput): EwaRecommendationBuilderOutput {
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
    throw new Error("ewaRecommendationBuilder requires teamOptions or an opportunityId that can produce them.");
  }

  const strategy = input.preferredStrategy ?? generatedOptions[0].strategy;
  const teamOption = generatedOptions.find((option) => option.strategy === strategy) ?? generatedOptions[0];

  return withPlanningDb(input, ({ db, source }) => {
    const assignedPairs = teamOption.roleAssignments.flatMap((assignment) =>
      assignment.candidates.map((candidate) => ({
        roleId: assignment.roleId,
        roleName: assignment.roleName,
        personId: candidate.personId,
        personName: candidate.name,
        allocatedFte: candidate.allocatedFte,
        candidateEwaStatus: candidate.ewaStatus,
      })),
    );
    const personClause = buildInClause("personId", assignedPairs.map((pair) => pair.personId));
    const ewaRows =
      assignedPairs.length === 0
        ? []
        : all<{
            roleId: string;
            personId: string;
            ewaStatus: string;
            blockingReason: string;
            nextAction: string;
          }>(
            db,
            `
              SELECT opportunityRoleId AS roleId, personId, ewaStatus, blockingReason, nextAction
              FROM "EwaRequest"
              WHERE ${personClause.sql}
            `,
            personClause.params,
          );
    const ewaByRolePerson = new Map(ewaRows.map((row) => [`${row.roleId}::${row.personId}`, row]));

    const recommendations: EwaRecommendation[] = [];

    for (const assignment of teamOption.roleAssignments) {
      if (assignment.candidates.length === 0) {
        recommendations.push({
          roleId: assignment.roleId,
          roleName: assignment.roleName,
          personId: null,
          personName: null,
          allocatedFte: 0,
          currentEwaStatus: "Unassigned",
          recommendedAction: "resolve_staffing_gap",
          actionReason: "The role is still unfilled, so EWA should not proceed until staffing is resolved.",
          blockingReason: null,
          nextAction: "Review alternatives or revise timing before opening approval workflow.",
          humanDecisionRequired: true,
        });
        continue;
      }

      for (const candidate of assignment.candidates) {
        const current = ewaByRolePerson.get(`${assignment.roleId}::${candidate.personId}`);
        const currentStatus = current?.ewaStatus ?? candidate.ewaStatus ?? "Not Requested";
        const lowered = currentStatus.toLowerCase();

        if (lowered.includes("blocked")) {
          recommendations.push({
            roleId: assignment.roleId,
            roleName: assignment.roleName,
            personId: candidate.personId,
            personName: candidate.name,
            allocatedFte: candidate.allocatedFte,
            currentEwaStatus: currentStatus,
            recommendedAction: "replace_or_resequence",
            actionReason: "Blocked EWA assignments should be replaced or moved in time before approval continues.",
            blockingReason: current?.blockingReason || null,
            nextAction: current?.nextAction || "Replace the candidate or revise dates and FTE assumptions.",
            humanDecisionRequired: true,
          });
          continue;
        }

        if (lowered.includes("pending")) {
          recommendations.push({
            roleId: assignment.roleId,
            roleName: assignment.roleName,
            personId: candidate.personId,
            personName: candidate.name,
            allocatedFte: candidate.allocatedFte,
            currentEwaStatus: currentStatus,
            recommendedAction: "follow_up_pending_approval",
            actionReason: "The assignment is already in approval flow and needs human follow-up rather than a new request.",
            blockingReason: current?.blockingReason || null,
            nextAction: current?.nextAction || "Follow up with booking owner and approver.",
            humanDecisionRequired: true,
          });
          continue;
        }

        if (lowered.includes("draft")) {
          recommendations.push({
            roleId: assignment.roleId,
            roleName: assignment.roleName,
            personId: candidate.personId,
            personName: candidate.name,
            allocatedFte: candidate.allocatedFte,
            currentEwaStatus: currentStatus,
            recommendedAction: "submit_draft",
            actionReason: "Draft requests exist and should be promoted only after planner review.",
            blockingReason: current?.blockingReason || null,
            nextAction: current?.nextAction || "Validate dates and submit the draft request.",
            humanDecisionRequired: true,
          });
          continue;
        }

        if (lowered.includes("approved") || lowered.includes("confirmed")) {
          recommendations.push({
            roleId: assignment.roleId,
            roleName: assignment.roleName,
            personId: candidate.personId,
            personName: candidate.name,
            allocatedFte: candidate.allocatedFte,
            currentEwaStatus: currentStatus,
            recommendedAction: "confirm_existing_booking",
            actionReason: "Existing approved or confirmed booking should be preserved and monitored, not recreated.",
            blockingReason: current?.blockingReason || null,
            nextAction: current?.nextAction || "Confirm booking details and monitor delivery readiness.",
            humanDecisionRequired: true,
          });
          continue;
        }

        recommendations.push({
          roleId: assignment.roleId,
          roleName: assignment.roleName,
          personId: candidate.personId,
          personName: candidate.name,
          allocatedFte: candidate.allocatedFte,
          currentEwaStatus: currentStatus,
          recommendedAction: "create_ewa_request",
          actionReason: "The staffing choice is assigned but does not yet have an actionable EWA request.",
          blockingReason: current?.blockingReason || null,
          nextAction: current?.nextAction || "Create a new EWA request with the assigned dates and FTE.",
          humanDecisionRequired: true,
        });
      }
    }

    return {
      source,
      strategy,
      summary: {
        resolveStaffingGap: recommendations.filter((item) => item.recommendedAction === "resolve_staffing_gap").length,
        replaceOrResequence: recommendations.filter((item) => item.recommendedAction === "replace_or_resequence").length,
        submitDraft: recommendations.filter((item) => item.recommendedAction === "submit_draft").length,
        followUpPendingApproval: recommendations.filter((item) => item.recommendedAction === "follow_up_pending_approval").length,
        createEwaRequest: recommendations.filter((item) => item.recommendedAction === "create_ewa_request").length,
        confirmExistingBooking: recommendations.filter((item) => item.recommendedAction === "confirm_existing_booking").length,
      },
      recommendations,
      nextActions: [
        recommendations.some((item) => item.recommendedAction === "resolve_staffing_gap")
          ? "Resolve unfilled roles before starting approval workflow."
          : null,
        recommendations.some((item) => item.recommendedAction === "replace_or_resequence")
          ? "Escalate blocked assignments for replacement or date changes."
          : null,
        recommendations.some((item) => item.recommendedAction === "create_ewa_request")
          ? "Create EWA requests for newly assigned candidates."
          : null,
      ].filter((value): value is string => value != null),
      evidence: [
      `Generated EWA recommendations for the ${strategy} team option.`,
        `Recommendation count: ${recommendations.length}.`,
      ],
    };
  });
}
