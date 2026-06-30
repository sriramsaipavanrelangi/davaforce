import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ROOT_DIR, text } from "./workforce-data-utils";

export const DUMMY_USER_ROLES = [
  "Workforce Planner",
  "Delivery Manager",
  "Sales / Client Partner",
  "Regional Leader",
] as const;

export type DummyUserRole = (typeof DUMMY_USER_ROLES)[number];

export type DummyUserRecord = {
  userId: string;
  username: string;
  password: string;
  role: DummyUserRole;
  profileImage: string;
};

export type DummyUserPublicRecord = {
  userId: string;
  username: string;
  role: DummyUserRole;
  profileImage: string;
};

type TableInfoRow = {
  name: string;
};

const APP_STATE_DB_PATH = join(ROOT_DIR, "data", "app-state.db");

const avatarSvgBase64 = (initials: string, accent: string) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="28" fill="#192b37"/><circle cx="66" cy="28" r="18" fill="${accent}" opacity=".9"/><circle cx="34" cy="64" r="24" fill="#ffffff" opacity=".08"/><text x="48" y="57" text-anchor="middle" font-family="Dava Sans, Arial, sans-serif" font-size="30" font-weight="700" fill="#ffffff">${initials}</text></svg>`,
  ).toString("base64");

const SEEDED_USERS: DummyUserRecord[] = [
  {
    userId: "user_sarah_001",
    username: "sarah",
    password: "sarah123",
    role: "Workforce Planner",
    profileImage: avatarSvgBase64("SA", "#ff5640"),
  },
  {
    userId: "user_jenny_001",
    username: "jenny",
    password: "jenny123",
    role: "Sales / Client Partner",
    profileImage: avatarSvgBase64("JE", "#5899c4"),
  },
  {
    userId: "user_raj_001",
    username: "raj",
    password: "raj123",
    role: "Delivery Manager",
    profileImage: avatarSvgBase64("RA", "#2fa66a"),
  },
  {
    userId: "user_david_001",
    username: "david",
    password: "david123",
    role: "Regional Leader",
    profileImage: avatarSvgBase64("DA", "#f59e0b"),
  },
];

const OBSOLETE_SEEDED_USER_IDS = ["user_demo_001", "user_alice_001", "user_bob_001"];

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS "DummyUser" (
  "userId" TEXT NOT NULL PRIMARY KEY,
  "username" TEXT NOT NULL UNIQUE,
  "password" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "profile_image" TEXT NOT NULL
);
`;

export const isDummyUserRole = (value: string | null | undefined): value is DummyUserRole =>
  DUMMY_USER_ROLES.some((role) => role === value);

const normalizeRole = (value: string | null | undefined): DummyUserRole =>
  isDummyUserRole(value) ? value : "Workforce Planner";

const ensureDummyUserSchema = (db: DatabaseSync) => {
  db.exec(SCHEMA_SQL);
  const columns = db.prepare(`PRAGMA table_info("DummyUser")`).all() as TableInfoRow[];
  if (!columns.some((column) => column.name === "role")) {
    db.exec(`ALTER TABLE "DummyUser" ADD COLUMN "role" TEXT`);
  }
  if (!columns.some((column) => column.name === "profile_image")) {
    db.exec(`ALTER TABLE "DummyUser" ADD COLUMN "profile_image" TEXT`);
  }

  db.prepare(`UPDATE "DummyUser" SET "role" = ? WHERE "role" IS NULL OR TRIM("role") = ''`).run("Workforce Planner");
  db.prepare(`UPDATE "DummyUser" SET "profile_image" = ? WHERE "profile_image" IS NULL OR TRIM("profile_image") = ''`).run(
    SEEDED_USERS[0].profileImage,
  );
};

const ensureAppStateDb = () => {
  mkdirSync(dirname(APP_STATE_DB_PATH), { recursive: true });
  const db = new DatabaseSync(APP_STATE_DB_PATH);
  try {
    ensureDummyUserSchema(db);
    const deleteObsolete = db.prepare(`DELETE FROM "DummyUser" WHERE "userId" = ?`);
    for (const userId of OBSOLETE_SEEDED_USER_IDS) {
      deleteObsolete.run(userId);
    }

    const insert = db.prepare(
      `
        INSERT INTO "DummyUser" ("userId", "username", "password", "role", "profile_image")
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT("userId") DO UPDATE SET
          "username" = excluded."username",
          "password" = excluded."password",
          "role" = excluded."role",
          "profile_image" = excluded."profile_image"
      `,
    );

    for (const user of SEEDED_USERS) {
      insert.run(user.userId, user.username, user.password, user.role, user.profileImage);
    }
  } finally {
    db.close();
  }
};

const withAppStateDb = <T>(fn: (db: DatabaseSync) => T) => {
  ensureAppStateDb();
  const db = new DatabaseSync(APP_STATE_DB_PATH);
  try {
    return fn(db);
  } finally {
    db.close();
  }
};

const toPublicUser = (user: DummyUserRecord | null): DummyUserPublicRecord | null =>
  user
    ? {
        userId: user.userId,
        username: user.username,
        role: normalizeRole(user.role),
        profileImage: user.profileImage,
      }
    : null;

export const loginDummyUser = (username: string, password: string): DummyUserPublicRecord | null =>
  withAppStateDb((db) =>
    toPublicUser(
      (db
        .prepare(
          `
            SELECT "userId", "username", "password", "role", "profile_image" AS "profileImage"
            FROM "DummyUser"
            WHERE "username" = ? AND "password" = ?
            LIMIT 1
          `,
        )
        .get(text(username), text(password)) as DummyUserRecord | undefined) ?? null,
    ),
  );

export const getDummyUserById = (userId: string): DummyUserPublicRecord | null =>
  withAppStateDb((db) =>
    toPublicUser(
      (db
        .prepare(
          `
            SELECT "userId", "username", "password", "role", "profile_image" AS "profileImage"
            FROM "DummyUser"
            WHERE "userId" = ?
            LIMIT 1
          `,
        )
        .get(text(userId)) as DummyUserRecord | undefined) ?? null,
    ),
  );

export const assertDummyUserExists = (userId: string) => {
  const user = getDummyUserById(userId);
  if (!user) {
    throw new Error(`User not found: ${text(userId)}`);
  }
  return user;
};

export const getDummyUserRoleById = (userId: string): DummyUserRole | null => getDummyUserById(userId)?.role ?? null;

export const listDummyUserRoles = (): DummyUserRole[] => [...DUMMY_USER_ROLES];

export const updateDummyUserRole = (input: {
  userId: string;
  role: string;
}): DummyUserPublicRecord => {
  const userId = text(input.userId);
  const role = text(input.role);

  if (!userId || !role) {
    throw new Error("userId and role are required.");
  }

  if (!isDummyUserRole(role)) {
    throw new Error(`Invalid role: ${role}`);
  }

  return withAppStateDb((db) => {
    const existing = db
      .prepare(
        `
          SELECT "userId", "username", "password", "role", "profile_image" AS "profileImage"
          FROM "DummyUser"
          WHERE "userId" = ?
          LIMIT 1
        `,
      )
      .get(userId) as DummyUserRecord | undefined;

    if (!existing) {
      throw new Error(`User not found: ${userId}`);
    }

    db.prepare(`UPDATE "DummyUser" SET "role" = ? WHERE "userId" = ?`).run(role, userId);
    return {
      userId: existing.userId,
      username: existing.username,
      role,
      profileImage: existing.profileImage,
    } satisfies DummyUserPublicRecord;
  });
};

export const listSeededDummyUsers = () =>
  withAppStateDb((db) =>
    (db
      .prepare(
        `
          SELECT "userId", "username", "role", "profile_image" AS "profileImage"
          FROM "DummyUser"
          ORDER BY "username"
        `,
      )
      .all() as Array<{ userId: string; username: string; role: string; profileImage: string }>).map((user) => ({
      userId: user.userId,
      username: user.username,
      role: normalizeRole(user.role),
      profileImage: user.profileImage,
    })),
  );

export const appStateDbExists = () => existsSync(APP_STATE_DB_PATH);
