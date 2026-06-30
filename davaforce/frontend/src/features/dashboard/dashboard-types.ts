export type DashboardSummary = {
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

export type DashboardSupply = {
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

export type DashboardDemand = {
  demandByStage: Array<{ stage: string; opportunities: number; roles: number; requiredFte: number; avgProbability: number }>;
  demandByRole: Array<{ roleName: string; roles: number; requiredFte: number }>;
  deliveryRiskByPriority: Array<{ deliveryRisk: string; commercialPriority: string; opportunities: number; requiredFte: number }>;
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

export type DashboardStaffingFit = {
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
  candidateOverlap: Array<{ personId: string; personName: string; opportunityCount: number; roleCount: number; avgScore: number; maxScore: number }>;
};

export type DashboardSkills = {
  requiredSkillDemand: Array<{ skillName: string; importance: string; roleCount: number }>;
  skillSupply: Array<{ skillName: string; people: number; avgLevel: number; avgYears: number }>;
  skillGaps: Array<{ skillName: string; requiredRoles: number; people: number; gap: number }>;
};

export type DashboardEwa = {
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
  actionRequired: Array<{ personId: string; personName: string; supplyRisk: string; suggestedAction: string; ewaActionRequired: string }>;
};

export type DashboardPayload = {
  status: "success";
  summary: DashboardSummary;
  supply: DashboardSupply;
  demand: DashboardDemand;
  staffingFit: DashboardStaffingFit;
  skills: DashboardSkills;
  ewa: DashboardEwa;
};

export type DashboardFailure = {
  status: "failure";
  error: string;
};

