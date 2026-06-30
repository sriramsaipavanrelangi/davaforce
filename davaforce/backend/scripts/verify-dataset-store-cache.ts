import { createHash } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { utcNowIsoWithOffset } from "../src/lib/workforce-data-utils";
import {
  WORKFORCE_DATASETS_DIR,
  assertDatasetOwnedByUser,
  deleteDatasetRecord,
  listDatasetRecordsForUser,
  readDatasetRecord,
  resolveWorkforceDataSource,
  type WorkforceDatasetRecord,
  writeDatasetRecord,
} from "../src/lib/workforce-dataset-store";
import { GET, PATCH } from "../src/next/workforce-datasets-route";

const TEST_USER_ID = "user_demo_001";

const waitForFsTick = (ms = 25) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const expectSuccess = async (response: Response, context: string) => {
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok || body.status !== "success") {
    throw new Error(`${context} failed: ${JSON.stringify(body)}`);
  }
  return body;
};

const datasetId = `wf_cache_verify_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
const datasetDir = join(WORKFORCE_DATASETS_DIR, TEST_USER_ID, datasetId);
const metadataPath = join(datasetDir, "dataset.json");
const dbFileName = `${datasetId}.db`;
const excelFileName = `${datasetId}.xlsx`;
const dbPath = join(datasetDir, dbFileName);
const excelPath = join(datasetDir, excelFileName);

const buildRecord = (overrides: Partial<WorkforceDatasetRecord> = {}): WorkforceDatasetRecord => ({
  datasetId,
  ownerUserId: TEST_USER_ID,
  label: "cache verify seed",
  datasetDir,
  dbFileName,
  dbPath,
  excelFileName,
  excelPath,
  originalFileName: "cache-verify.xlsx",
  workbookVersion: "verify-v1",
  createdAt: utcNowIsoWithOffset(),
  importCounts: {
    Availability: 1,
  },
  conversationId: "conv_cache_verify_seed",
  sourceSha256: createHash("sha256").update(datasetId).digest("hex"),
  staticDashboard: null,
  ...overrides,
});

try {
  rmSync(datasetDir, { recursive: true, force: true });
  mkdirSync(datasetDir, { recursive: true });
  writeFileSync(dbPath, "");
  writeFileSync(excelPath, "");

  writeDatasetRecord(buildRecord());

  const initialRead = readDatasetRecord(datasetId);
  assert(initialRead.label === "cache verify seed", "Initial cached read should return the seeded label.");

  const storedUpdate = buildRecord({
    createdAt: initialRead.createdAt,
    label: "cache verify updated via store",
    conversationId: initialRead.conversationId,
    sourceSha256: initialRead.sourceSha256,
  });
  await waitForFsTick();
  writeDatasetRecord(storedUpdate);

  const listAfterStoreWrite = listDatasetRecordsForUser(TEST_USER_ID);
  assert(
    listAfterStoreWrite.some(
      (record) => record.datasetId === datasetId && record.label === "cache verify updated via store",
    ),
    "User dataset list should reflect store writes after cache invalidation.",
  );

  const externalUpdate = {
    ...storedUpdate,
    label: "cache verify updated outside store",
  };
  await waitForFsTick();
  writeFileSync(metadataPath, JSON.stringify(externalUpdate, null, 2), "utf8");

  const refreshedRead = readDatasetRecord(datasetId);
  assert(
    refreshedRead.label === "cache verify updated outside store",
    "Cached reads should refresh when the metadata file changes on disk.",
  );

  const listAfterExternalWrite = listDatasetRecordsForUser(TEST_USER_ID);
  assert(
    listAfterExternalWrite.some(
      (record) => record.datasetId === datasetId && record.label === "cache verify updated outside store",
    ),
    "User dataset list should pick up externally updated metadata through cached record refresh.",
  );

  const getSingleBody = await expectSuccess(
    await GET(new Request(`http://localhost/api/workforce-datasets?userId=${TEST_USER_ID}&datasetId=${datasetId}`)),
    "Dataset GET by id",
  );
  assert(
    (getSingleBody.dataset as Record<string, unknown>).datasetId === datasetId,
    "Dataset GET by id should return the temporary dataset.",
  );

  const getListBody = await expectSuccess(
    await GET(new Request(`http://localhost/api/workforce-datasets?userId=${TEST_USER_ID}`)),
    "Dataset GET list",
  );
  assert(
    Array.isArray(getListBody.datasets) &&
      getListBody.datasets.some(
        (record) => typeof record === "object" && record != null && (record as Record<string, unknown>).datasetId === datasetId,
      ),
    "Dataset GET list should include the temporary dataset.",
  );

  const patchedConversationId = `conv_cache_verify_${Date.now()}`;
  const patchBody = await expectSuccess(
    await PATCH(
      new Request("http://localhost/api/workforce-datasets", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          datasetId,
          conversationId: patchedConversationId,
          userId: TEST_USER_ID,
        }),
      }),
    ),
    "Dataset PATCH attach conversation",
  );
  assert(
    (patchBody.dataset as Record<string, unknown>).conversationId === patchedConversationId,
    "Dataset PATCH should update the cached conversation id.",
  );

  const ownedRecord = assertDatasetOwnedByUser(datasetId, TEST_USER_ID);
  assert(
    ownedRecord.conversationId === patchedConversationId,
    "Ownership checks should read the updated conversation id from cache-backed metadata.",
  );

  const dataSource = resolveWorkforceDataSource({ datasetId });
  assert(dataSource.datasetId === datasetId, "Resolved data source should preserve the dataset id.");
  assert(dataSource.dbPath === dbPath, "Resolved data source should point at the temporary SQLite path.");

  deleteDatasetRecord(datasetId);
  assert(
    !listDatasetRecordsForUser(TEST_USER_ID).some((record) => record.datasetId === datasetId),
    "Deleted datasets should be removed from the cached user list.",
  );

  let deletedReadFailed = false;
  try {
    readDatasetRecord(datasetId);
  } catch {
    deletedReadFailed = true;
  }
  assert(deletedReadFailed, "Deleted datasets should not be readable after cache invalidation.");

  console.log("Verified dataset metadata caching, invalidation, and dependent dataset route/read flows.");
} finally {
  if (existsSync(datasetDir)) {
    rmSync(datasetDir, { recursive: true, force: true });
  }
}
