import { text } from "../workforce-data-utils";
import {
  buildInClause,
  readPersonSkills,
  readPlanningQuerySignals,
  resolveRoleContext,
  unique,
  withPlanningDb,
  all,
} from "./shared";
import type { AgentToolResolvedSource, AgentToolSourceInput, SkillEvidenceRecord } from "./shared";

export type SkillsMatcherInput = AgentToolSourceInput & {
  query?: string;
  opportunityId?: string;
  roleId?: string;
  candidateIds?: string[];
  skills?: string[];
  includeDesired?: boolean;
  limit?: number;
};

export type SkillsMatchRecord = {
  personId: string;
  name: string;
  matchedRequiredSkills: string[];
  missingRequiredSkills: string[];
  matchedDesiredSkills: string[];
  additionalMatchedQuerySkills: string[];
  requiredCoverage: number;
  desiredCoverage: number;
  avgSkillLevel: number;
  avgYearsExperience: number;
  strongestEvidence: SkillEvidenceRecord[];
};

export type SkillsMatcherOutput = {
  source: AgentToolResolvedSource;
  targetSkills: {
    requiredSkills: string[];
    desiredSkills: string[];
    querySkills: string[];
    unmatchedRequestedSkills: string[];
  };
  matches: SkillsMatchRecord[];
  evidence: string[];
};

const average = (values: number[]) =>
  values.length === 0 ? 0 : Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));

export function skillsMatcher(input: SkillsMatcherInput): SkillsMatcherOutput {
  return withPlanningDb(input, ({ db, source }) => {
    const querySignals = readPlanningQuerySignals(db, input.query);
    const context = resolveRoleContext(db, input);
    const querySkills = unique([...(input.skills ?? []), ...querySignals.skills]);
    const requiredSkills = unique([...(context?.requiredSkills ?? []), ...querySkills]);
    const desiredSkills = input.includeDesired === false ? [] : unique(context?.desiredSkills ?? []);
    const candidateClause = buildInClause("p.id", input.candidateIds ?? []);
    const people = all<{ personId: string; name: string }>(
      db,
      `
        SELECT p.id AS personId, p.name
        FROM "Person" p
        WHERE ${candidateClause.sql}
        ORDER BY p.name ASC
      `,
      candidateClause.params,
    );
    const personSkills = readPersonSkills(
      db,
      people.map((row) => text(row.personId)),
    );

    const matches = people
      .map((person) => {
        const skills = personSkills.get(text(person.personId)) ?? [];
        const matchedRequired = requiredSkills.filter((skill) =>
          skills.some((evidence) => evidence.skillName.toLowerCase() === skill.toLowerCase()),
        );
        const matchedDesired = desiredSkills.filter((skill) =>
          skills.some((evidence) => evidence.skillName.toLowerCase() === skill.toLowerCase()),
        );
        const matchedQuery = querySkills.filter((skill) =>
          skills.some((evidence) => evidence.skillName.toLowerCase() === skill.toLowerCase()),
        );
        const relevantEvidence = skills.filter(
          (evidence) =>
            matchedRequired.some((skill) => skill.toLowerCase() === evidence.skillName.toLowerCase()) ||
            matchedDesired.some((skill) => skill.toLowerCase() === evidence.skillName.toLowerCase()) ||
            matchedQuery.some((skill) => skill.toLowerCase() === evidence.skillName.toLowerCase()),
        );
        const strongestEvidence = [...relevantEvidence]
          .sort((left, right) => {
            if (right.skillLevel !== left.skillLevel) {
              return right.skillLevel - left.skillLevel;
            }
            if (right.yearsExperience !== left.yearsExperience) {
              return right.yearsExperience - left.yearsExperience;
            }
            return left.skillName.localeCompare(right.skillName);
          })
          .slice(0, 5);
        const requiredCoverage = requiredSkills.length === 0 ? 1 : matchedRequired.length / requiredSkills.length;
        const desiredCoverage = desiredSkills.length === 0 ? 1 : matchedDesired.length / desiredSkills.length;

        return {
          personId: text(person.personId),
          name: text(person.name),
          matchedRequiredSkills: matchedRequired,
          missingRequiredSkills: requiredSkills.filter(
            (skill) => !matchedRequired.some((matched) => matched.toLowerCase() === skill.toLowerCase()),
          ),
          matchedDesiredSkills: matchedDesired,
          additionalMatchedQuerySkills: matchedQuery.filter(
            (skill) => !matchedRequired.some((matched) => matched.toLowerCase() === skill.toLowerCase()),
          ),
          requiredCoverage: Number(requiredCoverage.toFixed(2)),
          desiredCoverage: Number(desiredCoverage.toFixed(2)),
          avgSkillLevel: average(strongestEvidence.map((evidence) => evidence.skillLevel)),
          avgYearsExperience: average(strongestEvidence.map((evidence) => evidence.yearsExperience)),
          strongestEvidence,
        } satisfies SkillsMatchRecord;
      })
      .sort((left, right) => {
        if (right.requiredCoverage !== left.requiredCoverage) {
          return right.requiredCoverage - left.requiredCoverage;
        }
        if (right.desiredCoverage !== left.desiredCoverage) {
          return right.desiredCoverage - left.desiredCoverage;
        }
        if (right.avgSkillLevel !== left.avgSkillLevel) {
          return right.avgSkillLevel - left.avgSkillLevel;
        }
        if (right.avgYearsExperience !== left.avgYearsExperience) {
          return right.avgYearsExperience - left.avgYearsExperience;
        }
        return left.name.localeCompare(right.name);
      })
      .slice(0, input.limit ?? 100);

    const unmatchedRequestedSkills = querySkills.filter(
      (skill) =>
        !matches.some((match) =>
          match.matchedRequiredSkills.some((matchedSkill) => matchedSkill.toLowerCase() === skill.toLowerCase()) ||
          match.additionalMatchedQuerySkills.some((matchedSkill) => matchedSkill.toLowerCase() === skill.toLowerCase()),
        ),
    );

    return {
      source,
      targetSkills: {
        requiredSkills,
        desiredSkills,
        querySkills,
        unmatchedRequestedSkills,
      },
      matches,
      evidence: [
      `Skills matched against PersonSkillEvidence rows.`,
        `Required skills: ${requiredSkills.length}; desired skills: ${desiredSkills.length}; query skills: ${querySkills.length}.`,
        `Returned ${matches.length} skill match record(s).`,
      ],
    };
  });
}
