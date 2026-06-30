import {
  buildWorkforceDashboard,
  type WorkforceDashboardBundle,
  type WorkforceDashboardSection,
  type WorkforceDashboardSkillGap,
} from "./workforce-dashboard";
import { type WorkforceDatasetRecord, writeDatasetRecord } from "./workforce-dataset-store";
import { utcNowIsoWithOffset } from "./workforce-data-utils";

export const STATIC_DASHBOARD_SCHEMA_VERSION = 1;

export type WorkforceStaticDashboardTrigger = "upload" | "backfill";

export type WorkforceStaticDashboardHistoryEntry = {
  generatedAt: string;
  trigger: WorkforceStaticDashboardTrigger;
  sourceSha256: string;
  importedAt: string;
};

export type WorkforceStaticDashboardSource = {
  datasetId: string;
  sourceSha256: string;
  originalFileName: string;
  sourceName: string;
  workbookVersion: string | null;
  createdAt: string;
  importedAt: string;
};

export type WorkforceStaticDashboardSnapshot = {
  schemaVersion: number;
  generatedAt: string;
  source: WorkforceStaticDashboardSource;
  history: WorkforceStaticDashboardHistoryEntry[];
  sections: WorkforceDashboardBundle;
};

const normalizeHistoryEntries = (value: unknown): WorkforceStaticDashboardHistoryEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const candidate = entry as Partial<WorkforceStaticDashboardHistoryEntry>;
    const generatedAt = typeof candidate.generatedAt === "string" ? candidate.generatedAt.trim() : "";
    const sourceSha256 = typeof candidate.sourceSha256 === "string" ? candidate.sourceSha256.trim() : "";
    const importedAt = typeof candidate.importedAt === "string" ? candidate.importedAt.trim() : "";

    if (!generatedAt || !sourceSha256 || !importedAt) {
      return [];
    }

    if (candidate.trigger !== "upload" && candidate.trigger !== "backfill") {
      return [];
    }

    return [
      {
        generatedAt,
        trigger: candidate.trigger,
        sourceSha256,
        importedAt,
      },
    ];
  });
};

export const getStoredStaticDashboardSnapshot = (
  record: WorkforceDatasetRecord,
): WorkforceStaticDashboardSnapshot | null => {
  const snapshot = record.staticDashboard;
  if (!snapshot) {
    return null;
  }

  if (snapshot.schemaVersion !== STATIC_DASHBOARD_SCHEMA_VERSION) {
    return null;
  }

  if (snapshot.source?.datasetId !== record.datasetId || snapshot.source?.sourceSha256 !== record.sourceSha256) {
    return null;
  }

  if (snapshot.sections?.summary?.datasetId !== record.datasetId) {
    return null;
  }

  return snapshot;
};

const createStaticDashboardSnapshot = (
  record: WorkforceDatasetRecord,
  sections: WorkforceDashboardBundle,
  trigger: WorkforceStaticDashboardTrigger,
): WorkforceStaticDashboardSnapshot => {
  const generatedAt = utcNowIsoWithOffset();

  return {
    schemaVersion: STATIC_DASHBOARD_SCHEMA_VERSION,
    generatedAt,
    source: {
      datasetId: record.datasetId,
      sourceSha256: record.sourceSha256,
      originalFileName: record.originalFileName,
      sourceName: sections.summary.sourceName,
      workbookVersion: record.workbookVersion,
      createdAt: record.createdAt,
      importedAt: sections.summary.importedAt,
    },
    history: [
      ...normalizeHistoryEntries(record.staticDashboard?.history),
      {
        generatedAt,
        trigger,
        sourceSha256: record.sourceSha256,
        importedAt: sections.summary.importedAt,
      },
    ],
    sections,
  };
};

export const persistStaticDashboardSnapshot = (
  record: WorkforceDatasetRecord,
  sections: WorkforceDashboardBundle,
  trigger: WorkforceStaticDashboardTrigger,
): WorkforceDatasetRecord => {
  const nextRecord: WorkforceDatasetRecord = {
    ...record,
    staticDashboard: createStaticDashboardSnapshot(record, sections, trigger),
  };

  writeDatasetRecord(nextRecord);
  return nextRecord;
};

export const ensureDatasetStaticDashboard = (
  record: WorkforceDatasetRecord,
  trigger: WorkforceStaticDashboardTrigger,
) => {
  const snapshot = getStoredStaticDashboardSnapshot(record);
  if (snapshot) {
    return {
      record,
      snapshot,
      cacheStatus: "hit" as const,
    };
  }

  const sections = buildWorkforceDashboard(record);
  const nextRecord = persistStaticDashboardSnapshot(record, sections, trigger);

  return {
    record: nextRecord,
    snapshot: nextRecord.staticDashboard as WorkforceStaticDashboardSnapshot,
    cacheStatus: "generated" as const,
  };
};

export const getStaticDashboardSection = <T extends WorkforceDashboardSection>(
  snapshot: WorkforceStaticDashboardSnapshot,
  section: T,
): WorkforceDashboardBundle[T] => snapshot.sections[section];

export const getStaticDashboardSkillGaps = (snapshot: WorkforceStaticDashboardSnapshot): WorkforceDashboardSkillGap[] =>
  snapshot.sections.skills.skillGaps;
