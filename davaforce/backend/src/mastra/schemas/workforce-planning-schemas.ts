import { z } from "zod";

export const planningSourceSchema = z.object({
  datasetId: z.string().nullable(),
  dbPath: z.string(),
  retrievedAtIso: z.string(),
});

export const opportunityAssessmentInputSchema = z.object({
  datasetId: z.string().optional(),
  dbPath: z.string().optional(),
  opportunityId: z.string().optional(),
  query: z.string().optional(),
  asOfDate: z.string().optional(),
});

export const assessedOpportunitySchema = z.object({
  id: z.string(),
  name: z.string(),
  clientName: z.string(),
  clientType: z.string(),
  domain: z.string(),
  region: z.string(),
  country: z.string(),
  city: z.string(),
  stage: z.string(),
  probability: z.number(),
  expectedStartDate: z.string(),
  durationWeeks: z.number(),
  commercialPriority: z.string(),
  deliveryRisk: z.string(),
  opportunityBrief: z.string(),
  timezonePreference: z.string(),
});

export const assessedRoleSchema = z.object({
  id: z.string(),
  opportunityId: z.string(),
  roleName: z.string(),
  disciplineOrDepartment: z.string(),
  gradePreference: z.string(),
  requiredSkills: z.array(z.string()),
  desiredSkills: z.array(z.string()),
  domainExperienceRequired: z.string(),
  locationPreference: z.string(),
  startDate: z.string(),
  durationWeeks: z.number(),
  fteRequired: z.number(),
  priority: z.string(),
  flexibilityNotes: z.string(),
  minimumIndividualFte: z.number(),
  canCombineCandidates: z.boolean(),
});

export const candidateOpportunitySchema = z.object({
  id: z.string(),
  name: z.string(),
  clientName: z.string(),
  domain: z.string(),
  region: z.string(),
  country: z.string(),
  stage: z.string(),
  probability: z.number(),
  expectedStartDate: z.string(),
  durationWeeks: z.number(),
  commercialPriority: z.string(),
  deliveryRisk: z.string(),
  matchedQueryTokens: z.array(z.string()),
  queryTokenHits: z.number(),
  selectionScore: z.number(),
  selectionReason: z.string(),
});

export const rolePrioritizationSchema = z.object({
  priorityOrder: z.number(),
  roleId: z.string(),
  roleName: z.string(),
  fteRequired: z.number(),
  canCombineCandidates: z.boolean(),
  priority: z.string(),
  reason: z.string(),
});

export const opportunityAssessmentOutputSchema = z.object({
  source: planningSourceSchema,
  asOfDate: z.string(),
  selectedOpportunityId: z.string().nullable(),
  selectionReason: z.string(),
  selectionDiagnostics: z.object({
    strategy: z.string(),
    queryTokens: z.array(z.string()),
    candidateOpportunities: z.array(candidateOpportunitySchema),
  }),
  opportunity: assessedOpportunitySchema.nullable(),
  roles: z.array(assessedRoleSchema),
  rolePrioritization: z.array(rolePrioritizationSchema),
  normalizedRequirements: z.object({
    requiredRoles: z.array(z.string()),
    requiredSkills: z.array(z.string()),
    desiredSkills: z.array(z.string()),
    grades: z.array(z.string()),
    locations: z.array(z.string()),
    domain: z.string().nullable(),
    startDate: z.string().nullable(),
    durationWeeks: z.number().nullable(),
    totalFteRequired: z.number(),
  }),
  extractedQuerySignals: z.object({
    skills: z.array(z.string()),
    locations: z.array(z.string()),
    availabilityWindowDays: z.number().nullable(),
    roleHints: z.array(z.string()),
  }),
  missingFields: z.array(z.string()),
  evidence: z.array(z.string()),
});

export const resourceSupplyInputSchema = z.object({
  datasetId: z.string().optional(),
  dbPath: z.string().optional(),
  query: z.string().optional(),
  opportunityId: z.string().optional(),
  roleId: z.string().optional(),
  skills: z.array(z.string()).optional(),
  roleName: z.string().optional(),
  discipline: z.string().optional(),
  grade: z.string().optional(),
  location: z.string().optional(),
  domain: z.string().optional(),
  asOfDate: z.string().optional(),
  availabilityWindowDays: z.number().int().positive().optional(),
  minFte: z.number().positive().optional(),
  limit: z.number().int().positive().max(50).default(20),
});

export const resourceCandidateSchema = z.object({
  personId: z.string(),
  name: z.string(),
  discipline: z.string(),
  roleArchetype: z.string(),
  grade: z.string(),
  city: z.string(),
  country: z.string(),
  primaryDomain: z.string(),
  availabilityCategory: z.string(),
  releaseWindow: z.string(),
  expectedReleaseDate: z.string(),
  availableFrom: z.string().nullable(),
  availableFteCurrent: z.number(),
  supplyFte: z.number().nullable(),
  availableFteInWindow: z.number(),
  currentAllocationFte: z.number(),
  ewaStatus: z.string(),
  benchRisk: z.string().nullable(),
  timeOnBenchDays: z.number().nullable(),
  matchedSkills: z.array(z.string()),
  skillMatchCount: z.number(),
  skillMatchScore: z.number(),
  overlayScore: z.number().nullable(),
  overlayRank: z.number().nullable(),
  fitStatus: z.string().nullable(),
  fteGap: z.number().nullable(),
  evidence: z.array(z.string()),
});

export const benchMovementWeekSchema = z.object({
  weekStartDate: z.string(),
  currentBenchHeadcount: z.number(),
  emergingBenchHeadcount: z.number(),
  partialCapacityHeadcount: z.number(),
  availableFte: z.number(),
  notes: z.string(),
});

export const scenarioTargetStatusSchema = z.object({
  id: z.string(),
  scenarioName: z.string(),
  targetDate: z.string(),
  targetBenchRate: z.number(),
  targetBenchHeadcount: z.number(),
  focus: z.string(),
  successMeasure: z.string(),
  nearestWeekStartDate: z.string().nullable(),
  currentBenchHeadcount: z.number().nullable(),
  currentBenchDelta: z.number().nullable(),
  status: z.string(),
});

export const resourceSupplyOutputSchema = z.object({
  source: planningSourceSchema,
  filters: z.object({
    opportunityId: z.string().nullable(),
    roleId: z.string().nullable(),
    skills: z.array(z.string()),
    roleName: z.string().nullable(),
    discipline: z.string().nullable(),
    grade: z.string().nullable(),
    location: z.string().nullable(),
    domain: z.string().nullable(),
    asOfDate: z.string(),
    availabilityWindowDays: z.number(),
    minFte: z.number(),
    limit: z.number(),
  }),
  summary: z.object({
    totalCandidates: z.number(),
    currentBenchPeople: z.number(),
    partialCapacityPeople: z.number(),
    availableNowFte: z.number(),
    availableInWindowFte: z.number(),
  }),
  capacityByWindow: z.array(
    z.object({
      window: z.string(),
      people: z.number(),
      fte: z.number(),
    }),
  ),
  benchMovement: z.array(benchMovementWeekSchema),
  scenarioTargets: z.array(scenarioTargetStatusSchema),
  candidates: z.array(resourceCandidateSchema),
  nearMatches: z.array(resourceCandidateSchema),
  filterDiagnostics: z.object({
    evaluated: z.number(),
    afterAvailability: z.number(),
    afterSkillsOrOverlay: z.number(),
    afterLocation: z.number(),
    afterDomain: z.number(),
    afterGrade: z.number(),
    afterDiscipline: z.number(),
    strictMatches: z.number(),
  }),
  risks: z.array(z.string()),
  evidence: z.array(z.string()),
});

export const teamBuilderInputSchema = z.object({
  datasetId: z.string().optional(),
  dbPath: z.string().optional(),
  opportunityId: z.string().optional(),
  query: z.string().optional(),
  asOfDate: z.string().optional(),
  availabilityWindowDays: z.number().int().positive().optional(),
  limitPerRole: z.number().int().positive().max(10).default(5),
});

export const teamBuilderCandidateSchema = z.object({
  roleId: z.string(),
  roleName: z.string(),
  personId: z.string(),
  name: z.string(),
  grade: z.string(),
  discipline: z.string(),
  roleArchetype: z.string(),
  city: z.string(),
  country: z.string(),
  primaryDomain: z.string(),
  source: z.string(),
  feasibility: z.string(),
  availableFteInWindow: z.number(),
  assignmentFte: z.number(),
  fteGap: z.number(),
  capabilityScore: z.number(),
  availabilityScore: z.number(),
  overallScore: z.number(),
  skillMatchScore: z.number(),
  overlayScore: z.number().nullable(),
  overlayRank: z.number().nullable(),
  fitStatus: z.string().nullable(),
  ewaStatus: z.string(),
  evidence: z.array(z.string()),
});

export const roleWiseCandidatesSchema = z.object({
  roleId: z.string(),
  roleName: z.string(),
  fteRequired: z.number(),
  minimumIndividualFte: z.number(),
  canCombineCandidates: z.boolean(),
  candidates: z.array(teamBuilderCandidateSchema),
  outcome: z.string(),
});

export const teamAssignmentSchema = z.object({
  roleId: z.string(),
  roleName: z.string(),
  personId: z.string(),
  name: z.string(),
  assignmentFte: z.number(),
  feasibility: z.string(),
  overallScore: z.number(),
  evidence: z.array(z.string()),
});

export const teamOptionSchema = z.object({
  optionType: z.string(),
  summary: z.string(),
  totalFteRequired: z.number(),
  assignedFte: z.number(),
  remainingFteGap: z.number(),
  averageOverallScore: z.number(),
  confidence: z.string(),
  assignments: z.array(teamAssignmentSchema),
  gaps: z.array(z.string()),
  evidence: z.array(z.string()),
});

export const teamBuilderOutputSchema = z.object({
  source: planningSourceSchema,
  asOfDate: z.string(),
  opportunity: assessedOpportunitySchema.nullable(),
  roleWiseCandidates: z.array(roleWiseCandidatesSchema),
  teamOptions: z.array(teamOptionSchema),
  constraints: z.array(z.string()),
  evidence: z.array(z.string()),
});

export const riskInsightsInputSchema = z.object({
  datasetId: z.string().optional(),
  dbPath: z.string().optional(),
  opportunityId: z.string().optional(),
  query: z.string().optional(),
  asOfDate: z.string().optional(),
  availabilityWindowDays: z.number().int().positive().optional(),
  limitPerRole: z.number().int().positive().max(10).default(5),
});

export const riskItemSchema = z.object({
  category: z.string(),
  severity: z.string(),
  scope: z.string(),
  message: z.string(),
  evidence: z.array(z.string()),
});

export const optionRiskAnalysisSchema = z.object({
  optionType: z.string(),
  riskLevel: z.string(),
  riskScore: z.number(),
  confidence: z.string(),
  assignedFte: z.number(),
  remainingFteGap: z.number(),
  risks: z.array(riskItemSchema),
  recommendedActions: z.array(z.string()),
});

export const roleRiskAnalysisSchema = z.object({
  roleId: z.string(),
  roleName: z.string(),
  riskLevel: z.string(),
  capabilityGapSummary: z.string(),
  availabilityRiskSummary: z.string(),
  bestCandidate: z.string().nullable(),
  blockedCandidates: z.array(z.string()),
  nextActions: z.array(z.string()),
});

export const impactMetricSchema = z.object({
  label: z.string(),
  assignedFte: z.number(),
  people: z.number(),
  notes: z.array(z.string()),
});

export const riskInsightsOutputSchema = z.object({
  source: planningSourceSchema,
  asOfDate: z.string(),
  opportunity: assessedOpportunitySchema.nullable(),
  overallRiskLevel: z.string(),
  overallConfidence: z.string(),
  summary: z.string(),
  optionAnalyses: z.array(optionRiskAnalysisSchema),
  roleAnalyses: z.array(roleRiskAnalysisSchema),
  capabilityGaps: z.array(riskItemSchema),
  availabilityRisks: z.array(riskItemSchema),
  regionalCapacityImpact: z.array(impactMetricSchema),
  utilizationImpact: z.array(impactMetricSchema),
  nextActions: z.array(z.string()),
  evidence: z.array(z.string()),
});

export const approvalDecisionInputSchema = z.object({
  datasetId: z.string().optional(),
  dbPath: z.string().optional(),
  opportunityId: z.string().optional(),
  query: z.string().optional(),
  asOfDate: z.string().optional(),
  availabilityWindowDays: z.number().int().positive().optional(),
  limitPerRole: z.number().int().positive().max(10).default(5),
  preferredOptionType: z.string().optional(),
});

export const approvalChecklistItemSchema = z.object({
  item: z.string(),
  status: z.string(),
  notes: z.array(z.string()),
});

export const ewaRequestSummarySchema = z.object({
  roleId: z.string(),
  roleName: z.string(),
  personId: z.string(),
  personName: z.string(),
  requestType: z.string(),
  ewaStatus: z.string(),
  requestedFte: z.number(),
  proposedStartDate: z.string(),
  proposedEndDate: z.string(),
  approvalRequired: z.boolean(),
  blockingReason: z.string(),
  nextAction: z.string(),
});

export const approvalDecisionOutputSchema = z.object({
  source: planningSourceSchema,
  asOfDate: z.string(),
  opportunity: assessedOpportunitySchema.nullable(),
  selectedOptionType: z.string().nullable(),
  decisionState: z.string(),
  readyForApproval: z.boolean(),
  humanApprovalRequired: z.boolean(),
  recommendationSummary: z.string(),
  selectedOption: teamOptionSchema.nullable(),
  riskSummary: z.object({
    overallRiskLevel: z.string(),
    overallConfidence: z.string(),
    optionRiskLevel: z.string().nullable(),
    optionRiskScore: z.number().nullable(),
    keyRisks: z.array(riskItemSchema),
  }),
  approvalChecklist: z.array(approvalChecklistItemSchema),
  ewaSummary: z.object({
    totalRequests: z.number(),
    requestsByStatus: z.record(z.string(), z.number()),
    blockers: z.array(ewaRequestSummarySchema),
    requestsForSelectedOption: z.array(ewaRequestSummarySchema),
  }),
  approvalPackage: z.object({
    approverAudience: z.array(z.string()),
    decisionPrompt: z.string(),
    recommendedDecision: z.string(),
    conditions: z.array(z.string()),
  }),
  nextActions: z.array(z.string()),
  evidence: z.array(z.string()),
});

export const workforceRouterIntentSchema = z.enum([
  "blocked",
  "clarification",
  "general",
  "opportunity_assessment",
  "resource_supply",
  "team_builder",
  "risk_insights",
  "approval_decision",
]);

export const workforceRouterInputSchema = z.object({
  datasetId: z.string().optional(),
  dbPath: z.string().optional(),
  userQuestion: z.string(),
  query: z.string().optional(),
  opportunityId: z.string().optional(),
  roleId: z.string().optional(),
  skills: z.array(z.string()).optional(),
  roleName: z.string().optional(),
  discipline: z.string().optional(),
  grade: z.string().optional(),
  location: z.string().optional(),
  domain: z.string().optional(),
  asOfDate: z.string().optional(),
  availabilityWindowDays: z.number().int().positive().optional(),
  minFte: z.number().positive().optional(),
  resourceSupplyLimit: z.number().int().positive().max(50).default(20),
  limitPerRole: z.number().int().positive().max(10).default(5),
  preferredOptionType: z.string().optional(),
  intentOverride: workforceRouterIntentSchema.optional(),
});

export const workforceRouterExecutionStepSchema = z.object({
  order: z.number(),
  agent: z.string(),
  purpose: z.string(),
  dependsOn: z.array(z.string()),
});

export const workforceRouterRoleSupplySchema = z.object({
  roleId: z.string(),
  roleName: z.string(),
  resourceSupply: resourceSupplyOutputSchema,
});

export const workforceRouterOutputSchema = z.object({
  route: z.object({
    intent: workforceRouterIntentSchema,
    confidence: z.string(),
    reason: z.string(),
    executionMode: z.enum(["tool_orchestrated", "no_db_required", "needs_context", "blocked", "clarification"]),
    plannedAgentPath: z.array(z.string()),
    agentsToRun: z.array(z.string()),
    skippedAgents: z.array(z.string()),
    executionPlan: z.array(workforceRouterExecutionStepSchema),
  }),
  opportunityAssessment: opportunityAssessmentOutputSchema.nullable(),
  resourceSupply: resourceSupplyOutputSchema.nullable(),
  resourceSupplyByRole: z.array(workforceRouterRoleSupplySchema),
  teamBuilder: teamBuilderOutputSchema.nullable(),
  riskInsights: riskInsightsOutputSchema.nullable(),
  approvalDecision: approvalDecisionOutputSchema.nullable(),
  finalResponseType: z.string(),
  message: z.string(),
  evidence: z.array(z.string()),
});

export type OpportunityAssessmentInput = z.input<typeof opportunityAssessmentInputSchema>;
export type OpportunityAssessmentOutput = z.infer<typeof opportunityAssessmentOutputSchema>;
export type ResourceSupplyInput = z.input<typeof resourceSupplyInputSchema>;
export type ResourceSupplyOutput = z.infer<typeof resourceSupplyOutputSchema>;
export type TeamBuilderInput = z.input<typeof teamBuilderInputSchema>;
export type TeamBuilderOutput = z.infer<typeof teamBuilderOutputSchema>;
export type RiskInsightsInput = z.input<typeof riskInsightsInputSchema>;
export type RiskInsightsOutput = z.infer<typeof riskInsightsOutputSchema>;
export type ApprovalDecisionInput = z.input<typeof approvalDecisionInputSchema>;
export type ApprovalDecisionOutput = z.infer<typeof approvalDecisionOutputSchema>;
export type WorkforceRouterInput = z.input<typeof workforceRouterInputSchema>;
export type WorkforceRouterOutput = z.infer<typeof workforceRouterOutputSchema>;
