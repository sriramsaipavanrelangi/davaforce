import { randomUUID } from "node:crypto";
import { text, utcNowIsoWithOffset } from "./workforce-data-utils";

export const WORKFORCE_UPLOAD_STEP_LABELS = [
  "Reading workbook structure",
  "Normalizing skills and availability",
  "Converting rows into a planning table",
  "Data processing done",
] as const;

export type WorkforceUploadProgressStatus = "pending" | "processing" | "success" | "failure";

export type WorkforceUploadProgressStage =
  | "awaiting_upload"
  | "reading_workbook"
  | "normalizing_skills"
  | "building_planning_table"
  | "verifying_import"
  | "complete"
  | "failed";

export type WorkforceUploadProgressVerification = {
  passed: number;
  failed: number;
};

export type WorkforceUploadProgressSnapshot = {
  revision: number;
  uploadId: string;
  userId: string;
  status: WorkforceUploadProgressStatus;
  stage: WorkforceUploadProgressStage;
  stepIndex: number;
  stepCount: number;
  progress: number;
  message: string;
  detail: string | null;
  datasetId: string | null;
  error: string | null;
  verification: WorkforceUploadProgressVerification | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type WorkforceUploadProgressUpdate = {
  status?: WorkforceUploadProgressStatus;
  stage?: WorkforceUploadProgressStage;
  stepIndex?: number;
  progress?: number;
  message?: string;
  detail?: string | null;
  datasetId?: string | null;
  error?: string | null;
  verification?: WorkforceUploadProgressVerification | null;
};

export type WorkforceUploadProgressEventName = "progress" | "complete" | "failed";

type ProgressListener = (
  snapshot: WorkforceUploadProgressSnapshot,
  eventName: WorkforceUploadProgressEventName,
) => void;

type UploadProgressSession = {
  snapshot: WorkforceUploadProgressSnapshot;
  listeners: Map<string, ProgressListener>;
};

type SessionOptions = {
  uploadId?: string | null;
  userId: string;
  allowCompleted?: boolean;
};

const TERMINAL_SESSION_TTL_MS = 15 * 60 * 1000;
const ACTIVE_SESSION_TTL_MS = 60 * 60 * 1000;
const uploadIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{5,127}$/;
const uploadSessions = new Map<string, UploadProgressSession>();

const cloneVerification = (value: WorkforceUploadProgressVerification | null) =>
  value ? { ...value } : null;

const cloneSnapshot = (value: WorkforceUploadProgressSnapshot): WorkforceUploadProgressSnapshot => ({
  ...value,
  verification: cloneVerification(value.verification),
});

const isExpired = (session: UploadProgressSession, now: number) => {
  const updatedAt = Date.parse(session.snapshot.updatedAt);
  const completedAt = session.snapshot.completedAt ? Date.parse(session.snapshot.completedAt) : null;
  const referenceTime = completedAt != null && Number.isFinite(completedAt) ? completedAt : updatedAt;
  const ttl = isTerminalUploadStatus(session.snapshot.status) ? TERMINAL_SESSION_TTL_MS : ACTIVE_SESSION_TTL_MS;
  return !Number.isFinite(referenceTime) || now - referenceTime > ttl;
};

const cleanupExpiredSessions = () => {
  const now = Date.now();
  for (const [uploadId, session] of uploadSessions.entries()) {
    if (!isExpired(session, now)) {
      continue;
    }

    uploadSessions.delete(uploadId);
    session.listeners.clear();
  }
};

const nextUploadId = () => randomUUID();

const normalizeUploadId = (value: string | null | undefined) => {
  if (value == null) {
    return null;
  }

  const normalized = text(value);
  if (!normalized) {
    return null;
  }
  if (!uploadIdPattern.test(normalized)) {
    throw new Error("uploadId must be 6-128 characters and contain only letters, numbers, hyphens, or underscores.");
  }
  return normalized;
};

const normalizeProgress = (value: number | undefined, current: number) => {
  if (value == null || !Number.isFinite(value)) {
    return current;
  }
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return Math.max(current, clamped);
};

const normalizeStepIndex = (value: number | undefined, current: number, status: WorkforceUploadProgressStatus) => {
  if (value == null || !Number.isFinite(value)) {
    return current;
  }

  const lowerBound = status === "pending" ? -1 : 0;
  const next = Math.trunc(value);
  return Math.max(current, Math.min(WORKFORCE_UPLOAD_STEP_LABELS.length - 1, Math.max(lowerBound, next)));
};

const createSnapshot = (uploadId: string, userId: string): WorkforceUploadProgressSnapshot => {
  const now = utcNowIsoWithOffset();
  return {
    revision: 0,
    uploadId,
    userId,
    status: "pending",
    stage: "awaiting_upload",
    stepIndex: -1,
    stepCount: WORKFORCE_UPLOAD_STEP_LABELS.length,
    progress: 0,
    message: "Awaiting upload",
    detail: "Open the SSE stream first, then send the workbook upload using the same uploadId.",
    datasetId: null,
    error: null,
    verification: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
};

const findActiveSessionsForUser = (userId: string) =>
  [...uploadSessions.values()].filter(
    (session) =>
      session.snapshot.userId === userId &&
      !isTerminalUploadStatus(session.snapshot.status),
  );

const requireSession = (options: SessionOptions) => {
  cleanupExpiredSessions();

  const normalizedUserId = text(options.userId);
  if (!normalizedUserId) {
    throw new Error("userId is required.");
  }

  const providedUploadId = normalizeUploadId(options.uploadId);
  if (!providedUploadId) {
    const activeSessions = findActiveSessionsForUser(normalizedUserId);
    if (activeSessions.length > 1) {
      throw new Error(`Multiple active upload sessions exist for user ${normalizedUserId}. Provide uploadId explicitly.`);
    }
    if (activeSessions.length === 1) {
      return activeSessions[0];
    }
  }

  const normalizedUploadId = providedUploadId ?? nextUploadId();
  const existing = uploadSessions.get(normalizedUploadId);

  if (!existing) {
    const session: UploadProgressSession = {
      snapshot: createSnapshot(normalizedUploadId, normalizedUserId),
      listeners: new Map<string, ProgressListener>(),
    };
    uploadSessions.set(normalizedUploadId, session);
    return session;
  }

  if (existing.snapshot.userId !== normalizedUserId) {
    throw new Error(`Upload session ${normalizedUploadId} does not belong to user ${normalizedUserId}.`);
  }

  if (!options.allowCompleted && isTerminalUploadStatus(existing.snapshot.status)) {
    throw new Error(`Upload session ${normalizedUploadId} has already completed. Create a new session before uploading again.`);
  }

  return existing;
};

const nextEventName = (status: WorkforceUploadProgressStatus): WorkforceUploadProgressEventName => {
  if (status === "success") {
    return "complete";
  }
  if (status === "failure") {
    return "failed";
  }
  return "progress";
};

export const isTerminalUploadStatus = (status: WorkforceUploadProgressStatus) =>
  status === "success" || status === "failure";

export const getUploadProgressSession = (options: SessionOptions) =>
  cloneSnapshot(requireSession(options).snapshot);

export const subscribeToUploadProgress = (
  options: SessionOptions,
  listener: ProgressListener,
) => {
  const session = requireSession({ ...options, allowCompleted: true });
  if (isTerminalUploadStatus(session.snapshot.status)) {
    return {
      snapshot: cloneSnapshot(session.snapshot),
      unsubscribe: () => {},
    };
  }

  const listenerId = randomUUID();
  session.listeners.set(listenerId, listener);

  return {
    snapshot: cloneSnapshot(session.snapshot),
    unsubscribe: () => {
      const current = uploadSessions.get(session.snapshot.uploadId);
      current?.listeners.delete(listenerId);
    },
  };
};

export const publishUploadProgress = (
  options: SessionOptions,
  update: WorkforceUploadProgressUpdate,
) => {
  const session = requireSession(options);
  const current = session.snapshot;
  const nextStatus = update.status ?? current.status;
  const nextStepIndex = normalizeStepIndex(update.stepIndex, current.stepIndex, nextStatus);
  const nextProgress = normalizeProgress(update.progress, current.progress);
  const now = utcNowIsoWithOffset();

  const nextSnapshot: WorkforceUploadProgressSnapshot = {
    revision: current.revision + 1,
    uploadId: current.uploadId,
    userId: current.userId,
    status: nextStatus,
    stage: update.stage ?? current.stage,
    stepIndex: nextStepIndex,
    stepCount: current.stepCount,
    progress: nextStatus === "success" ? 100 : nextProgress,
    message:
      update.message ??
      (nextStepIndex >= 0 ? WORKFORCE_UPLOAD_STEP_LABELS[nextStepIndex] : current.message),
    detail: update.detail === undefined ? current.detail : update.detail,
    datasetId: update.datasetId === undefined ? current.datasetId : update.datasetId,
    error: update.error === undefined ? current.error : update.error,
    verification: update.verification === undefined ? cloneVerification(current.verification) : cloneVerification(update.verification),
    createdAt: current.createdAt,
    updatedAt: now,
    completedAt: isTerminalUploadStatus(nextStatus) ? current.completedAt ?? now : null,
  };

  if (nextStatus !== "failure") {
    nextSnapshot.error = null;
  }

  session.snapshot = nextSnapshot;
  const eventName = nextEventName(nextStatus);

  for (const [listenerId, listener] of [...session.listeners.entries()]) {
    try {
      listener(cloneSnapshot(nextSnapshot), eventName);
    } catch {
      session.listeners.delete(listenerId);
    }
  }

  if (isTerminalUploadStatus(nextStatus)) {
    session.listeners.clear();
  }

  return cloneSnapshot(nextSnapshot);
};

export const parseUploadId = (value: string | null | undefined) => normalizeUploadId(value);
