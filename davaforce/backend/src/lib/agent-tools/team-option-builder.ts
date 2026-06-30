import { candidateScorer, type CandidateScore } from "./candidate-scorer";
import { readOpportunity, readOpportunityRoles, withPlanningDb } from "./shared";
import type { AgentToolResolvedSource, AgentToolSourceInput, PlanningRoleRecord } from "./shared";

export type TeamOptionStrategy = "bestFit" | "fastestAvailable" | "balanced";

export type TeamOptionBuilderInput = AgentToolSourceInput & {
  opportunityId: string;
  availabilityWindowDays?: number;
  includeBlocked?: boolean;
  maxCandidatesPerRole?: number;
  maxRolesPerPerson?: number;
  referenceDate?: string;
  strategies?: TeamOptionStrategy[];
};

export type TeamAssignmentCandidate = {
  personId: string;
  name: string;
  allocatedFte: number;
  totalScore: number;
  fitBucket: CandidateScore["fitBucket"];
  releaseWindow: string;
  expectedReleaseDate: string;
  ewaStatus: string;
  supplyRisk: string | null;
};

export type TeamRoleAssignment = {
  roleId: string;
  roleName: string;
  requiredFte: number;
  assignedFte: number;
  unfilledFte: number;
  priority: string;
  canCombineCandidates: boolean;
  candidates: TeamAssignmentCandidate[];
  alternatives: Array<{
    personId: string;
    name: string;
    totalScore: number;
    fitBucket: CandidateScore["fitBucket"];
  }>;
};

export type TeamOption = {
  strategy: TeamOptionStrategy;
  summary: {
    assignedRoles: number;
    unfilledRoles: number;
    assignedFte: number;
    unfilledFte: number;
    averageCandidateScore: number;
    blockedAssignments: number;
    stretchAssignments: number;
  };
  roleAssignments: TeamRoleAssignment[];
};

export type TeamOptionBuilderOutput = {
  source: AgentToolResolvedSource;
  opportunity: {
    opportunityId: string;
    name: string;
    stage: string;
    probability: number;
    expectedStartDate: string;
    commercialPriority: string;
    deliveryRisk: string;
  };
  options: TeamOption[];
  evidence: string[];
};

const releaseWindowRank = (value: string) => {
  switch (value) {
    case "Current":
      return 0;
    case "0-30":
      return 1;
    case "31-60":
      return 2;
    case "61-90":
      return 3;
    case "Partial":
      return 4;
    default:
      return 5;
  }
};

const rolePriorityRank = (role: PlanningRoleRecord) => (role.priority === "High" ? 0 : 1);

const strategySort = (strategy: TeamOptionStrategy, candidates: CandidateScore[]) => {
  const withStrategyScore = candidates.map((candidate) => {
    const benchBonus =
      candidate.availabilityCategory === "Current Bench"
        ? 100
        : candidate.releaseWindow === "0-30"
          ? 85
          : candidate.releaseWindow === "31-60"
            ? 70
            : candidate.releaseWindow === "Partial"
              ? 55
              : 40;
    const supplyRiskBonus = candidate.supplyRisk === "High" ? 15 : candidate.supplyRisk === "Medium" ? 8 : 0;
    const balancedScore = candidate.totalScore * 0.65 + candidate.availabilityScore * 0.2 + benchBonus * 0.1 + supplyRiskBonus * 0.05;

    return {
      candidate,
      strategyScore:
        strategy === "bestFit"
          ? candidate.totalScore
          : strategy === "fastestAvailable"
            ? 100 - releaseWindowRank(candidate.releaseWindow) * 15 + candidate.availabilityScore * 0.4 + candidate.totalScore * 0.2
            : balancedScore,
    };
  });

  return withStrategyScore
    .sort((left, right) => {
      if (right.strategyScore !== left.strategyScore) {
        return right.strategyScore - left.strategyScore;
      }
      if (right.candidate.totalScore !== left.candidate.totalScore) {
        return right.candidate.totalScore - left.candidate.totalScore;
      }
      return left.candidate.name.localeCompare(right.candidate.name);
    })
    .map((entry) => entry.candidate);
};

const average = (values: number[]) => (values.length === 0 ? 0 : Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)));

export function teamOptionBuilder(input: TeamOptionBuilderInput): TeamOptionBuilderOutput {
  return withPlanningDb(input, ({ db, source }) => {
    const opportunity = readOpportunity(db, input.opportunityId);
    if (!opportunity) {
      throw new Error(`Opportunity not found: ${input.opportunityId}`);
    }

    const roles = readOpportunityRoles(db, input.opportunityId);
    if (roles.length === 0) {
      throw new Error(`No opportunity roles found for opportunity ${input.opportunityId}.`);
    }

    const roleCandidates = new Map(
      roles.map((role) => [
        role.id,
        candidateScorer({
          datasetId: input.datasetId,
          dbPath: input.dbPath,
          opportunityId: input.opportunityId,
          roleId: role.id,
          availabilityWindowDays: input.availabilityWindowDays,
          includeBlocked: input.includeBlocked,
          limit: 25,
          referenceDate: input.referenceDate,
        }).rankedCandidates,
      ]),
    );

    const maxCandidatesPerRole = input.maxCandidatesPerRole ?? 3;
    const maxRolesPerPerson = input.maxRolesPerPerson ?? 1;
    const strategies = input.strategies ?? ["bestFit", "fastestAvailable", "balanced"];

    const options = strategies.map((strategy) => {
      const remainingFteByPerson = new Map<string, number>();
      const roleCountByPerson = new Map<string, number>();
      const roleAssignments = [...roles]
        .sort((left, right) => {
          const priorityDelta = rolePriorityRank(left) - rolePriorityRank(right);
          if (priorityDelta !== 0) {
            return priorityDelta;
          }
          if (left.startDate !== right.startDate) {
            return left.startDate.localeCompare(right.startDate);
          }
          return left.id.localeCompare(right.id);
        })
        .map((role) => {
          const candidates = strategySort(strategy, roleCandidates.get(role.id) ?? []);
          const assigned: TeamAssignmentCandidate[] = [];
          let remainingFte = role.fteRequired;

          for (const candidate of candidates) {
            const currentRoleCount = roleCountByPerson.get(candidate.personId) ?? 0;
            if (currentRoleCount >= maxRolesPerPerson) {
              continue;
            }
            if (candidate.fitBucket === "Blocked" && !input.includeBlocked) {
              continue;
            }

            const remainingCandidateFte = remainingFteByPerson.get(candidate.personId) ?? candidate.availableFteInWindow;
            if (remainingCandidateFte < role.minimumIndividualFte) {
              continue;
            }

            if (!role.canCombineCandidates) {
              if (remainingCandidateFte < remainingFte) {
                continue;
              }

              assigned.push({
                personId: candidate.personId,
                name: candidate.name,
                allocatedFte: remainingFte,
                totalScore: candidate.totalScore,
                fitBucket: candidate.fitBucket,
                releaseWindow: candidate.releaseWindow,
                expectedReleaseDate: candidate.expectedReleaseDate,
                ewaStatus: candidate.ewaStatus,
                supplyRisk: candidate.supplyRisk,
              });
              remainingFteByPerson.set(candidate.personId, Number((remainingCandidateFte - remainingFte).toFixed(2)));
              roleCountByPerson.set(candidate.personId, currentRoleCount + 1);
              remainingFte = 0;
              break;
            }

            const allocatedFte = Math.min(remainingFte, remainingCandidateFte);
            if (allocatedFte < role.minimumIndividualFte) {
              continue;
            }

            assigned.push({
              personId: candidate.personId,
              name: candidate.name,
              allocatedFte: Number(allocatedFte.toFixed(2)),
              totalScore: candidate.totalScore,
              fitBucket: candidate.fitBucket,
              releaseWindow: candidate.releaseWindow,
              expectedReleaseDate: candidate.expectedReleaseDate,
              ewaStatus: candidate.ewaStatus,
              supplyRisk: candidate.supplyRisk,
            });
            remainingFte = Number((remainingFte - allocatedFte).toFixed(2));
            remainingFteByPerson.set(candidate.personId, Number((remainingCandidateFte - allocatedFte).toFixed(2)));
            roleCountByPerson.set(candidate.personId, currentRoleCount + 1);

            if (remainingFte <= 0 || assigned.length >= maxCandidatesPerRole) {
              break;
            }
          }

          return {
            roleId: role.id,
            roleName: role.roleName,
            requiredFte: role.fteRequired,
            assignedFte: Number((role.fteRequired - remainingFte).toFixed(2)),
            unfilledFte: Number(Math.max(remainingFte, 0).toFixed(2)),
            priority: role.priority,
            canCombineCandidates: role.canCombineCandidates,
            candidates: assigned,
            alternatives: candidates
              .filter((candidate) => !assigned.some((assignment) => assignment.personId === candidate.personId))
              .slice(0, 3)
              .map((candidate) => ({
                personId: candidate.personId,
                name: candidate.name,
                totalScore: candidate.totalScore,
                fitBucket: candidate.fitBucket,
              })),
          } satisfies TeamRoleAssignment;
        });

      const assignedCandidates = roleAssignments.flatMap((assignment) => assignment.candidates);

      return {
        strategy,
        summary: {
          assignedRoles: roleAssignments.filter((assignment) => assignment.unfilledFte <= 0).length,
          unfilledRoles: roleAssignments.filter((assignment) => assignment.unfilledFte > 0).length,
          assignedFte: Number(roleAssignments.reduce((sum, assignment) => sum + assignment.assignedFte, 0).toFixed(2)),
          unfilledFte: Number(roleAssignments.reduce((sum, assignment) => sum + assignment.unfilledFte, 0).toFixed(2)),
          averageCandidateScore: average(assignedCandidates.map((candidate) => candidate.totalScore)),
          blockedAssignments: assignedCandidates.filter((candidate) => candidate.ewaStatus.toLowerCase().includes("blocked")).length,
          stretchAssignments: assignedCandidates.filter((candidate) => candidate.fitBucket === "Stretch").length,
        },
        roleAssignments,
      } satisfies TeamOption;
    });

    return {
      source,
      opportunity: {
        opportunityId: opportunity.id,
        name: opportunity.name,
        stage: opportunity.stage,
        probability: opportunity.probability,
        expectedStartDate: opportunity.expectedStartDate,
        commercialPriority: opportunity.commercialPriority,
        deliveryRisk: opportunity.deliveryRisk,
      },
      options,
      evidence: [
      `Built team options for ${opportunity.name}.`,
        `Strategies: ${strategies.join(", ")}.`,
        `Role count: ${roles.length}.`,
      ],
    };
  });
}
