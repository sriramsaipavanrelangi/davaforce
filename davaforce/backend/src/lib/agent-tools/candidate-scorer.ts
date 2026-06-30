import { availabilitySearch, type AvailabilitySearchInput, type AvailabilitySearchCandidate } from "./availability-search";
import { skillsMatcher } from "./skills-matcher";
import { asNumber, buildInClause, matchExpected, resolveRoleContext, withPlanningDb, all } from "./shared";
import type { AgentToolResolvedSource } from "./shared";

export type CandidateScorerInput = AvailabilitySearchInput & {
  skills?: string[];
  weights?: Partial<{
    capability: number;
    availability: number;
    context: number;
    overlay: number;
  }>;
};

export type CandidateScore = AvailabilitySearchCandidate & {
  requiredCoverage: number;
  desiredCoverage: number;
  capabilityScore: number;
  availabilityScore: number;
  contextScore: number;
  overlayScore: number;
  totalScore: number;
  fitBucket: "Recommended" | "Backup" | "Stretch" | "Unavailable" | "Blocked" | "Low Fit";
  matchedRequiredSkills: string[];
  missingRequiredSkills: string[];
  matchedDesiredSkills: string[];
  overlayRank: number | null;
  overlayFitStatus: string | null;
  overlayRationale: string | null;
  blockingConstraint: string | null;
  evidence: string[];
};

export type CandidateScorerOutput = {
  source: AgentToolResolvedSource;
  filters: {
    opportunityId: string | null;
    roleId: string | null;
    availabilityWindowDays: number;
    minFte: number;
    limit: number;
  };
  summary: {
    totalCandidates: number;
    recommended: number;
    backup: number;
    stretch: number;
    unavailable: number;
    blocked: number;
  };
  rankedCandidates: CandidateScore[];
  evidence: string[];
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const normalizeWeights = (weights?: CandidateScorerInput["weights"]) => {
  const merged = {
    capability: weights?.capability ?? 0.5,
    availability: weights?.availability ?? 0.25,
    context: weights?.context ?? 0.15,
    overlay: weights?.overlay ?? 0.1,
  };
  const total = merged.capability + merged.availability + merged.context + merged.overlay;
  return {
    capability: merged.capability / total,
    availability: merged.availability / total,
    context: merged.context / total,
    overlay: merged.overlay / total,
  };
};

const computeContextScore = (
  candidate: AvailabilitySearchCandidate,
  filters: {
    discipline: string | null;
    grade: string | null;
    location: string | null;
    domain: string | null;
  },
) => {
  const checks = [
    filters.discipline
      ? matchExpected(candidate.discipline, filters.discipline) || matchExpected(candidate.roleArchetype, filters.discipline)
      : null,
    filters.grade ? matchExpected(candidate.grade, filters.grade) : null,
    filters.location
      ? matchExpected(candidate.city, filters.location) ||
        matchExpected(candidate.country, filters.location) ||
        matchExpected(candidate.region, filters.location)
      : null,
    filters.domain ? matchExpected(candidate.primaryDomain, filters.domain) : null,
  ].filter((value): value is boolean => value != null);

  if (checks.length === 0) {
    return 100;
  }

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
};

export function candidateScorer(input: CandidateScorerInput): CandidateScorerOutput {
  const availability = availabilitySearch({
    ...input,
    limit: input.limit ?? 100,
  });
  const skills = skillsMatcher({
    datasetId: input.datasetId,
    dbPath: input.dbPath,
    query: input.query,
    opportunityId: input.opportunityId,
    roleId: input.roleId,
    skills: input.skills,
    candidateIds: availability.candidates.map((candidate) => candidate.personId),
    limit: availability.candidates.length,
  });
  const weights = normalizeWeights(input.weights);

  return withPlanningDb(input, ({ db, source }) => {
    const context = resolveRoleContext(db, input);
    const minFte = availability.filters.minFte;
    const limit = availability.filters.limit;
    const personClause = buildInClause("co.personId", availability.candidates.map((candidate) => candidate.personId));
    const overlayCandidates = all<{
      personId: string;
      fitStatus: string;
      rank: number | bigint;
      capabilityFitScore: number;
      availabilityFitScore: number;
      overallStaffingScore: number;
      rationale: string;
      candidateConstraint: string;
      ewaStatus: string;
    }>(
      db,
      `
        SELECT
          co.personId,
          co.fitStatus,
          co.rank,
          ROUND(co.capabilityFitScore, 1) AS capabilityFitScore,
          ROUND(co.availabilityFitScore, 1) AS availabilityFitScore,
          ROUND(co.overallStaffingScore, 1) AS overallStaffingScore,
          co.rationale,
          co."constraint" AS candidateConstraint,
          co.ewaStatus
        FROM "OpportunityCandidateOverlay" co
        WHERE (? IS NULL OR co.opportunityId = ?)
          AND (? IS NULL OR co.opportunityRoleId = ?)
          AND ${personClause.sql}
        ORDER BY co.overallStaffingScore DESC, co.rank ASC
      `,
      [
        context?.opportunityId ?? input.opportunityId ?? null,
        context?.opportunityId ?? input.opportunityId ?? null,
        context?.roleId ?? input.roleId ?? null,
        context?.roleId ?? input.roleId ?? null,
        ...personClause.params,
      ],
    );
    const overlayByPerson = new Map<string, (typeof overlayCandidates)[number]>();
    for (const overlay of overlayCandidates) {
      const personId = String(overlay.personId);
      if (!overlayByPerson.has(personId)) {
        overlayByPerson.set(personId, overlay);
      }
    }
    const skillByPerson = new Map(skills.matches.map((match) => [match.personId, match]));

    const rankedCandidates = availability.candidates
      .map((candidate) => {
        const skillMatch = skillByPerson.get(candidate.personId);
        const overlay = overlayByPerson.get(candidate.personId);
        const requiredCoverage = skillMatch?.requiredCoverage ?? (context?.requiredSkills.length ? 0 : 1);
        const desiredCoverage = skillMatch?.desiredCoverage ?? (context?.desiredSkills.length ? 0 : 1);
        const capabilityScore =
          overlay?.capabilityFitScore != null
            ? asNumber(overlay.capabilityFitScore)
            : Math.round(requiredCoverage * 80 + desiredCoverage * 20);
        const availabilityScore =
          minFte <= 0
            ? 100
            : clamp(Math.round((candidate.availableFteInWindow / minFte) * 100), 0, 100);
        const contextScore = computeContextScore(candidate, {
          discipline: availability.filters.discipline,
          grade: availability.filters.grade,
          location: availability.filters.location,
          domain: availability.filters.domain,
        });
        const overlayScore = overlay?.overallStaffingScore != null ? asNumber(overlay.overallStaffingScore) : capabilityScore;
        const totalScore = Number(
          (
            capabilityScore * weights.capability +
            availabilityScore * weights.availability +
            contextScore * weights.context +
            overlayScore * weights.overlay
          ).toFixed(2),
        );
        const effectiveBlockedStatus = (overlay?.ewaStatus ?? candidate.ewaStatus).toLowerCase().includes("blocked");

        let fitBucket: CandidateScore["fitBucket"] = "Low Fit";
        if (effectiveBlockedStatus) {
          fitBucket = "Blocked";
        } else if (candidate.availableFteInWindow < minFte) {
          fitBucket = "Unavailable";
        } else if (requiredCoverage >= 1 && availabilityScore >= 100 && totalScore >= 70) {
          fitBucket = "Recommended";
        } else if (requiredCoverage >= 0.75 && availabilityScore >= 75) {
          fitBucket = "Backup";
        } else if (requiredCoverage > 0 || desiredCoverage > 0 || totalScore >= 50) {
          fitBucket = "Stretch";
        }

        return {
          ...candidate,
          requiredCoverage,
          desiredCoverage,
          capabilityScore,
          availabilityScore,
          contextScore,
          overlayScore,
          totalScore,
          fitBucket,
          matchedRequiredSkills: skillMatch?.matchedRequiredSkills ?? [],
          missingRequiredSkills: skillMatch?.missingRequiredSkills ?? [],
          matchedDesiredSkills: skillMatch?.matchedDesiredSkills ?? [],
          overlayRank: overlay?.rank == null ? null : asNumber(overlay.rank),
          overlayFitStatus: overlay?.fitStatus ?? null,
          overlayRationale: overlay?.rationale ?? null,
          blockingConstraint: overlay?.candidateConstraint ?? null,
          evidence: [
            `Capability ${capabilityScore}, availability ${availabilityScore}, context ${contextScore}, overlay ${overlayScore}.`,
            skillMatch ? `Required coverage ${Math.round(requiredCoverage * 100)}%.` : "No skill evidence matched.",
            overlay?.rationale ? overlay.rationale : "",
            overlay?.candidateConstraint ? `Constraint: ${overlay.candidateConstraint}.` : "",
          ].filter(Boolean),
        } satisfies CandidateScore;
      })
      .sort((left, right) => {
        if (right.totalScore !== left.totalScore) {
          return right.totalScore - left.totalScore;
        }
        if (right.requiredCoverage !== left.requiredCoverage) {
          return right.requiredCoverage - left.requiredCoverage;
        }
        if (right.availableFteInWindow !== left.availableFteInWindow) {
          return right.availableFteInWindow - left.availableFteInWindow;
        }
        return left.name.localeCompare(right.name);
      })
      .slice(0, limit);

    return {
      source,
      filters: {
        opportunityId: context?.opportunityId ?? input.opportunityId ?? null,
        roleId: context?.roleId ?? input.roleId ?? null,
        availabilityWindowDays: availability.filters.availabilityWindowDays,
        minFte,
        limit,
      },
      summary: {
        totalCandidates: rankedCandidates.length,
        recommended: rankedCandidates.filter((candidate) => candidate.fitBucket === "Recommended").length,
        backup: rankedCandidates.filter((candidate) => candidate.fitBucket === "Backup").length,
        stretch: rankedCandidates.filter((candidate) => candidate.fitBucket === "Stretch").length,
        unavailable: rankedCandidates.filter((candidate) => candidate.fitBucket === "Unavailable").length,
        blocked: rankedCandidates.filter((candidate) => candidate.fitBucket === "Blocked").length,
      },
      rankedCandidates,
      evidence: [
      `Candidate scores calculated from availability, skills, context, and overlay evidence.`,
        `Weights capability=${weights.capability.toFixed(2)}, availability=${weights.availability.toFixed(2)}, context=${weights.context.toFixed(2)}, overlay=${weights.overlay.toFixed(2)}.`,
      ],
    };
  });
}
