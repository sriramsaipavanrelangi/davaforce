import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { attachConversationToDataset, assertDatasetOwnedByUser, deleteDatasetRecord } from "./workforce-dataset-store";
import { ROOT_DIR, text, utcNowIsoWithOffset } from "./workforce-data-utils";

export const WORKFORCE_MEMORY_DIR = resolve(ROOT_DIR, "data", "workforce-memory");
export const WORKFORCE_MEMORY_DB_PATH = join(WORKFORCE_MEMORY_DIR, "workforce-memory.db");

export type WorkforceConversationRole = "user" | "assistant";

export type WorkforceConversationMessage = {
  id: string;
  conversationId: string;
  role: WorkforceConversationRole;
  content: string;
  detailView: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
};

export type WorkforceConversationSummary = {
  id: string;
  userId: string;
  datasetId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  activeOpportunityId: string | null;
  activeOpportunityName: string | null;
  lastDetailView: string | null;
  lastSummary: string | null;
  messageCount: number;
  lastMessage: string | null;
};

export type WorkforceConversation = WorkforceConversationSummary & {
  messages: WorkforceConversationMessage[];
};

type ConversationRow = {
  id: string;
  user_id: string;
  dataset_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  active_opportunity_id: string | null;
  active_opportunity_name: string | null;
  last_detail_view: string | null;
  last_summary: string | null;
  message_count?: number;
  last_message?: string | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  role: WorkforceConversationRole;
  content: string;
  detail_view: string | null;
  details_json: string | null;
  created_at: string;
};

type CountRow = {
  count: number;
};

type IdRow = {
  id: string;
};

const createConversationId = () => `conv_${randomUUID()}`;
const createMessageId = () => `msg_${randomUUID()}`;

const titleFromMessage = (message: string) => {
  const cleaned = text(message).replace(/\s+/g, " ");
  if (!cleaned) {
    return "New workforce chat";
  }
  return cleaned.length > 72 ? `${cleaned.slice(0, 69)}...` : cleaned;
};

const ensureMemoryDir = () => {
  if (!existsSync(WORKFORCE_MEMORY_DIR)) {
    mkdirSync(WORKFORCE_MEMORY_DIR, { recursive: true });
  }
};

const openDb = () => {
  ensureMemoryDir();
  const db = new DatabaseSync(WORKFORCE_MEMORY_DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      dataset_id TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      active_opportunity_id TEXT,
      active_opportunity_name TEXT,
      last_detail_view TEXT,
      last_summary TEXT
    );

    CREATE TABLE IF NOT EXISTS conversation_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      detail_view TEXT,
      details_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS conversations_user_dataset_idx
      ON conversations(user_id, dataset_id, updated_at DESC);

    CREATE INDEX IF NOT EXISTS conversation_messages_conversation_idx
      ON conversation_messages(conversation_id, created_at ASC);
  `);
  return db;
};

const parseDetails = (value: string | null): Record<string, unknown> | null => {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const toMessage = (row: MessageRow): WorkforceConversationMessage => ({
  id: row.id,
  conversationId: row.conversation_id,
  role: row.role,
  content: row.content,
  detailView: row.detail_view,
  details: parseDetails(row.details_json),
  createdAt: row.created_at,
});

const toSummary = (row: ConversationRow): WorkforceConversationSummary => ({
  id: row.id,
  userId: row.user_id,
  datasetId: row.dataset_id,
  title: row.title,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  activeOpportunityId: row.active_opportunity_id,
  activeOpportunityName: row.active_opportunity_name,
  lastDetailView: row.last_detail_view,
  lastSummary: row.last_summary,
  messageCount: Number(row.message_count ?? 0),
  lastMessage: row.last_message ?? null,
});

const assertConversationRow = (
  db: DatabaseSync,
  input: { conversationId: string; userId: string; datasetId?: string | null },
) => {
  const datasetId = text(input.datasetId);
  const datasetFilter = datasetId ? "AND c.dataset_id = ?" : "";
  const params = datasetId
    ? [input.conversationId, input.userId, datasetId]
    : [input.conversationId, input.userId];
  const row = db
    .prepare(
      `
      SELECT c.*,
             COUNT(m.id) AS message_count,
             (
               SELECT content
               FROM conversation_messages lm
               WHERE lm.conversation_id = c.id
               ORDER BY lm.created_at DESC
               LIMIT 1
             ) AS last_message
      FROM conversations c
      LEFT JOIN conversation_messages m ON m.conversation_id = c.id
      WHERE c.id = ? AND c.user_id = ? ${datasetFilter}
      GROUP BY c.id
      `,
    )
    .get(...params) as ConversationRow | undefined;

  if (!row) {
    throw new Error("Conversation not found.");
  }

  return row;
};

export const createWorkforceConversation = (input: {
  conversationId?: string | null;
  userId: string;
  datasetId: string;
  title?: string | null;
  firstMessage?: string | null;
}) => {
  const userId = text(input.userId);
  const datasetId = text(input.datasetId);
  assertDatasetOwnedByUser(datasetId, userId);

  const db = openDb();
  try {
    const now = utcNowIsoWithOffset();
    const id = text(input.conversationId) || createConversationId();
    const title = text(input.title) || titleFromMessage(input.firstMessage ?? "");
    try {
      return toSummary(assertConversationRow(db, { conversationId: id, userId, datasetId }));
    } catch {
      // Missing row is expected when a dataset pre-seeded the conversationId during upload.
    }
    db.prepare(
      `
      INSERT INTO conversations (
        id, user_id, dataset_id, title, created_at, updated_at,
        active_opportunity_id, active_opportunity_name, last_detail_view, last_summary
      )
      VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL)
      `,
    ).run(id, userId, datasetId, title, now, now);
    attachConversationToDataset(datasetId, id);
    return toSummary(assertConversationRow(db, { conversationId: id, userId, datasetId }));
  } finally {
    db.close();
  }
};

export const getOrCreateWorkforceConversation = (input: {
  conversationId?: string | null;
  userId: string;
  datasetId: string;
  firstMessage?: string | null;
}) => {
  const conversationId = text(input.conversationId);
  const userId = text(input.userId);
  const datasetId = text(input.datasetId);

  if (!conversationId) {
    return createWorkforceConversation({
      userId,
      datasetId,
      firstMessage: input.firstMessage,
    });
  }

  assertDatasetOwnedByUser(datasetId, userId);
  const db = openDb();
  try {
    return toSummary(assertConversationRow(db, { conversationId, userId, datasetId }));
  } catch {
    // Fall through and create after closing this read handle.
  } finally {
    db.close();
  }

  return createWorkforceConversation({
    conversationId,
    userId,
    datasetId,
    firstMessage: input.firstMessage,
  });
};

export const listWorkforceConversations = (input: { userId: string; datasetId: string }) => {
  const userId = text(input.userId);
  const datasetId = text(input.datasetId);
  assertDatasetOwnedByUser(datasetId, userId);

  const db = openDb();
  try {
    const rows = db
      .prepare(
        `
        SELECT c.*,
               COUNT(m.id) AS message_count,
               (
                 SELECT content
                 FROM conversation_messages lm
                 WHERE lm.conversation_id = c.id
                 ORDER BY lm.created_at DESC
                 LIMIT 1
               ) AS last_message
        FROM conversations c
        LEFT JOIN conversation_messages m ON m.conversation_id = c.id
        WHERE c.user_id = ? AND c.dataset_id = ?
        GROUP BY c.id
        HAVING COUNT(m.id) > 0
        ORDER BY c.updated_at DESC
        `,
      )
      .all(userId, datasetId) as ConversationRow[];

    return rows.map(toSummary);
  } finally {
    db.close();
  }
};

export const listWorkforceConversationsForUser = (input: { userId: string }) => {
  const userId = text(input.userId);

  const db = openDb();
  try {
    const rows = db
      .prepare(
        `
        SELECT c.*,
               COUNT(m.id) AS message_count,
               (
                 SELECT content
                 FROM conversation_messages lm
                 WHERE lm.conversation_id = c.id
                 ORDER BY lm.created_at DESC
                 LIMIT 1
               ) AS last_message
        FROM conversations c
        LEFT JOIN conversation_messages m ON m.conversation_id = c.id
        WHERE c.user_id = ?
        GROUP BY c.id
        HAVING COUNT(m.id) > 0
        ORDER BY c.updated_at DESC
        `,
      )
      .all(userId) as ConversationRow[];

    return rows.map(toSummary);
  } finally {
    db.close();
  }
};

export const readWorkforceConversation = (input: {
  conversationId: string;
  userId: string;
  datasetId?: string | null;
}) => {
  const conversationId = text(input.conversationId);
  const userId = text(input.userId);
  const datasetId = text(input.datasetId);
  if (datasetId) {
    assertDatasetOwnedByUser(datasetId, userId);
  }

  const db = openDb();
  try {
    const summary = toSummary(assertConversationRow(db, { conversationId, userId, datasetId }));
    const messages = db
      .prepare(
        `
        SELECT *
        FROM conversation_messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC
        `,
      )
      .all(conversationId) as MessageRow[];

    return {
      ...summary,
      messages: messages.map(toMessage),
    };
  } finally {
    db.close();
  }
};

export const deleteWorkforceConversation = (input: { conversationId: string; userId: string }) => {
  const conversationId = text(input.conversationId);
  const userId = text(input.userId);
  if (!conversationId || !userId) {
    throw new Error("conversationId and userId are required.");
  }

  let datasetId = "";
  let shouldDeleteDataset = false;
  let replacementConversationId: string | null = null;

  const db = openDb();
  try {
    const conversation = assertConversationRow(db, { conversationId, userId });
    datasetId = conversation.dataset_id;
    assertDatasetOwnedByUser(datasetId, userId);

    const visibleConversationCount = db
      .prepare(
        `
        SELECT COUNT(*) AS count
        FROM (
          SELECT c.id
          FROM conversations c
          JOIN conversation_messages m ON m.conversation_id = c.id
          WHERE c.user_id = ? AND c.dataset_id = ?
          GROUP BY c.id
        ) visible_conversations
        `,
      )
      .get(userId, datasetId) as CountRow | undefined;

    shouldDeleteDataset = Number(visibleConversationCount?.count ?? 0) <= 1;

    if (shouldDeleteDataset) {
      db.prepare(
        `
        DELETE FROM conversation_messages
        WHERE conversation_id IN (
          SELECT id
          FROM conversations
          WHERE user_id = ? AND dataset_id = ?
        )
        `,
      ).run(userId, datasetId);
      db.prepare("DELETE FROM conversations WHERE user_id = ? AND dataset_id = ?").run(userId, datasetId);
    } else {
      db.prepare("DELETE FROM conversation_messages WHERE conversation_id = ?").run(conversationId);
      db.prepare("DELETE FROM conversations WHERE id = ? AND user_id = ?").run(conversationId, userId);

      const replacement = db
        .prepare(
          `
          SELECT c.id
          FROM conversations c
          JOIN conversation_messages m ON m.conversation_id = c.id
          WHERE c.user_id = ? AND c.dataset_id = ?
          GROUP BY c.id
          ORDER BY c.updated_at DESC
          LIMIT 1
          `,
        )
        .get(userId, datasetId) as IdRow | undefined;
      replacementConversationId = replacement?.id ?? null;
    }
  } finally {
    db.close();
  }

  if (shouldDeleteDataset) {
    deleteDatasetRecord(datasetId);
  } else if (replacementConversationId) {
    attachConversationToDataset(datasetId, replacementConversationId);
  }

  return {
    conversationId,
    datasetId,
    datasetDeleted: shouldDeleteDataset,
    replacementConversationId,
  };
};

export const appendWorkforceConversationMessage = (input: {
  conversationId: string;
  role: WorkforceConversationRole;
  content: string;
  detailView?: string | null;
  details?: Record<string, unknown> | null;
}) => {
  const conversationId = text(input.conversationId);
  const content = text(input.content);
  if (!conversationId || !content) {
    throw new Error("conversationId and content are required.");
  }

  const db = openDb();
  try {
    const now = utcNowIsoWithOffset();
    const id = createMessageId();
    db.prepare(
      `
      INSERT INTO conversation_messages (
        id, conversation_id, role, content, detail_view, details_json, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      id,
      conversationId,
      input.role,
      content,
      text(input.detailView) || null,
      input.details ? JSON.stringify(input.details) : null,
      now,
    );
    db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(now, conversationId);
    return {
      id,
      conversationId,
      role: input.role,
      content,
      detailView: text(input.detailView) || null,
      details: input.details ?? null,
      createdAt: now,
    } satisfies WorkforceConversationMessage;
  } finally {
    db.close();
  }
};

export const updateWorkforceConversationMemory = (input: {
  conversationId: string;
  activeOpportunityId?: string | null;
  activeOpportunityName?: string | null;
  lastDetailView?: string | null;
  lastSummary?: string | null;
  title?: string | null;
}) => {
  const conversationId = text(input.conversationId);
  const db = openDb();
  try {
    const now = utcNowIsoWithOffset();
    db.prepare(
      `
      UPDATE conversations
      SET active_opportunity_id = COALESCE(?, active_opportunity_id),
          active_opportunity_name = COALESCE(?, active_opportunity_name),
          last_detail_view = COALESCE(?, last_detail_view),
          last_summary = COALESCE(?, last_summary),
          title = CASE WHEN ? IS NOT NULL AND ? <> '' THEN ? ELSE title END,
          updated_at = ?
      WHERE id = ?
      `,
    ).run(
      text(input.activeOpportunityId) || null,
      text(input.activeOpportunityName) || null,
      text(input.lastDetailView) || null,
      text(input.lastSummary) || null,
      text(input.title) || null,
      text(input.title) || null,
      text(input.title) || null,
      now,
      conversationId,
    );
  } finally {
    db.close();
  }
};
