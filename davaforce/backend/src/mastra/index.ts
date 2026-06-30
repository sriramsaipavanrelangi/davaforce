import { Mastra } from "@mastra/core";
import { approvalDecisionAgent } from "./agents/approval-decision-agent";
import { opportunityAssessmentAgent } from "./agents/opportunity-assessment-agent";
import { resourceSupplyAgent } from "./agents/resource-supply-agent";
import { riskInsightsAgent } from "./agents/risk-insights-agent";
import { teamBuilderAgent } from "./agents/team-builder-agent";
import { workforceRouterAgent } from "./agents/workforce-router-agent";

export const mastra = new Mastra({
  agents: {
    approvalDecisionAgent,
    opportunityAssessmentAgent,
    resourceSupplyAgent,
    riskInsightsAgent,
    teamBuilderAgent,
    workforceRouterAgent,
  },
});
