import { existsSync } from "node:fs";
import { getDummyUserById } from "../lib/dummy-users-store";
import {
  type WorkforceDashboardSection,
} from "../lib/workforce-dashboard";
import {
  ensureDatasetStaticDashboard,
  getStaticDashboardSection,
  getStaticDashboardSkillGaps,
  getStoredStaticDashboardSnapshot,
} from "../lib/workforce-static-dashboard-cache";
import { readDatasetRecord, type WorkforceDatasetRecord } from "../lib/workforce-dataset-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => Response.json(body, { status });

class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

const sectionFromPath = (pathSegments: string[]): WorkforceDashboardSection | null => {
  if (pathSegments.length === 0) {
    return null;
  }

  if (pathSegments.length > 1) {
    throw new HttpError(404, "API route not found.");
  }

  switch (pathSegments[0]) {
    case "summary":
      return "summary";
    case "supply":
      return "supply";
    case "demand":
      return "demand";
    case "staffing-fit":
      return "staffingFit";
    case "skills":
      return "skills";
    case "ewa":
      return "ewa";
    default:
      throw new HttpError(404, "API route not found.");
  }
};

const isSkillGapsPath = (pathSegments: string[]) =>
  pathSegments.length === 2 && pathSegments[0] === "skills" && pathSegments[1] === "gaps";

const requireDashboardDataset = (request: Request): WorkforceDatasetRecord => {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId")?.trim() ?? "";
  const datasetId = searchParams.get("datasetId")?.trim() ?? "";

  if (!userId || !datasetId) {
    throw new HttpError(400, "userId and datasetId are required.");
  }

  if (!getDummyUserById(userId)) {
    throw new HttpError(404, "Dataset not found.");
  }

  let dataset: WorkforceDatasetRecord;
  try {
    dataset = readDatasetRecord(datasetId);
  } catch {
    throw new HttpError(404, "Dataset not found.");
  }

  if (dataset.ownerUserId !== userId) {
    throw new HttpError(403, "Dataset does not belong to user.");
  }

  return dataset;
};

const resolveDashboardSnapshot = (dataset: WorkforceDatasetRecord) => {
  const snapshot = getStoredStaticDashboardSnapshot(dataset);
  if (snapshot) {
    return snapshot;
  }

  if (!existsSync(dataset.dbPath)) {
    throw new HttpError(404, "Dataset not found.");
  }

  return ensureDatasetStaticDashboard(dataset, "backfill").snapshot;
};

export async function GET(request: Request, dashboardPath: string[] = []) {
  try {
    const isSkillGaps = isSkillGapsPath(dashboardPath);
    const dataset = requireDashboardDataset(request);
    const snapshot = resolveDashboardSnapshot(dataset);

    if (isSkillGaps) {
      return json({
        status: "success",
        skillGaps: getStaticDashboardSkillGaps(snapshot),
      });
    }

    const section = sectionFromPath(dashboardPath);

    if (!section) {
      return json({
        status: "success",
        ...snapshot.sections,
      });
    }

    return json({
      status: "success",
      ...getStaticDashboardSection(snapshot, section),
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ status: "failure", error: error.message }, error.statusCode);
    }

    return json({ status: "failure", error: "Failed to build dashboard data." }, 500);
  }
}
