import { createHash } from "node:crypto";
import { resolve } from "node:path";
import type { CellValue, WorkbookSheets } from "./workbook-xlsx";

const formatUtcDatePart = (value: number) => String(value).padStart(2, "0");

export const ROOT_DIR = resolve(process.cwd());
export const DEFAULT_EXCEL_PATH = resolve(ROOT_DIR, "python-scripts", "input_data.xlsx");
export const DEFAULT_DB_PATH = resolve(ROOT_DIR, "workforce.db");

export const REQUIRED_CANONICAL_SHEETS = [
  "People",
  "Skills",
  "Skill Catalog",
  "Profiles",
  "Allocations",
  "Bench",
  "Partial Capacity",
  "Availability Calendar",
  "Bench Movement",
  "Project History",
  "Opportunities",
  "Opportunity Roles",
  "Opportunity Overlays",
  "EWA Requests",
  "Scenario Targets",
];

export const NATURAL_KEY_COLUMNS: Record<string, string> = {
  README: "Item",
  "Dataset Summary": "Metric",
  "Data Dictionary": "Column",
  People: "Employee_ID",
  Skills: "Skill_Row_ID",
  "Skill Catalog": "SkillName",
  Profiles: "Profile_ID",
  Allocations: "Allocation_ID",
  Bench: "Bench_Record_ID",
  "Partial Capacity": "Bench_Record_ID",
  "Availability Calendar": "Availability_ID",
  "Bench Movement": "WeekStartDate",
  "Project History": "History_ID",
  Opportunities: "Opportunity_ID",
  "Opportunity Roles": "Opportunity_Role_ID",
  "Opportunity Overlays": "Overlay_ID",
  "EWA Requests": "EWA_Request_ID",
  "Scenario Targets": "Scenario_ID",
  "Starter Prompts": "Prompt_ID",
  "Change Log": "Change_ID",
  "Validation Summary": "Check_ID",
};

const ensureAscii = (value: string) =>
  value.replace(/[^\x00-\x7F]/g, (character) => {
    const codePoint = character.codePointAt(0);
    if (codePoint == null) {
      return character;
    }

    if (codePoint <= 0xffff) {
      return `\\u${codePoint.toString(16).padStart(4, "0")}`;
    }

    const adjusted = codePoint - 0x10000;
    const high = 0xd800 + (adjusted >> 10);
    const low = 0xdc00 + (adjusted & 0x3ff);
    return `\\u${high.toString(16).padStart(4, "0")}\\u${low.toString(16).padStart(4, "0")}`;
  });

const isMidnightUtc = (value: Date) =>
  value.getUTCHours() === 0 &&
  value.getUTCMinutes() === 0 &&
  value.getUTCSeconds() === 0 &&
  value.getUTCMilliseconds() === 0;

export const formatDateValue = (value: Date) => {
  const year = value.getUTCFullYear();
  const month = formatUtcDatePart(value.getUTCMonth() + 1);
  const day = formatUtcDatePart(value.getUTCDate());

  if (isMidnightUtc(value)) {
    return `${year}-${month}-${day}`;
  }

  const hours = formatUtcDatePart(value.getUTCHours());
  const minutes = formatUtcDatePart(value.getUTCMinutes());
  const seconds = formatUtcDatePart(value.getUTCSeconds());
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
};

export const normalizeForJson = (value: CellValue): string | number | boolean | null => {
  if (value instanceof Date) {
    return formatDateValue(value);
  }
  return value ?? null;
};

export const text = (value: unknown): string => {
  if (value == null) {
    return "";
  }
  if (value instanceof Date) {
    return formatDateValue(value);
  }
  return String(value).trim();
};

export const optionalText = (value: unknown): string | null => {
  const cleaned = text(value);
  return cleaned || null;
};

export const asInt = (value: unknown): number => {
  if (value == null || value === "") {
    return 0;
  }
  return Math.trunc(Number.parseFloat(String(value)));
};

export const asFloat = (value: unknown): number => {
  if (value == null || value === "") {
    return 0;
  }
  return Number.parseFloat(String(value));
};

export const asBool = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  const cleaned = text(value).toLowerCase();
  if (cleaned === "yes" || cleaned === "true" || cleaned === "1") {
    return true;
  }
  if (cleaned === "no" || cleaned === "false" || cleaned === "0" || cleaned === "") {
    return false;
  }

  throw new Error(`Cannot coerce ${JSON.stringify(value)} to bool.`);
};

export const parseSemicolonList = (value: unknown) =>
  text(value)
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);

export const utcNowIsoWithOffset = () => new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00");

const jsonScalar = (value: unknown): string => {
  if (value === null) {
    return "null";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    if (Number.isNaN(value)) {
      return "NaN";
    }
    if (value === Number.POSITIVE_INFINITY) {
      return "Infinity";
    }
    if (value === Number.NEGATIVE_INFINITY) {
      return "-Infinity";
    }
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return ensureAscii(JSON.stringify(value));
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => jsonScalar(item)).join(", ")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    );
    const parts = entries.map(
      ([key, item]) => `${ensureAscii(JSON.stringify(key))}: ${jsonScalar(item)}`,
    );
    return `{${parts.join(", ")}}`;
  }

  return "null";
};

export const rowPayloadJson = (row: Record<string, CellValue>) => {
  const normalized: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key] = normalizeForJson(value);
  }
  return jsonScalar(normalized);
};

export const rowHash = (payloadJson: string) =>
  createHash("sha256").update(payloadJson, "utf8").digest("hex");

export const workbookVersion = (sheets: WorkbookSheets): string | null => {
  if (!sheets.README) {
    return null;
  }

  const metadata = Object.fromEntries(
    sheets.README.rows.map((row) => [text(row.values.Item), text(row.values.Details)]),
  );
  return metadata.Version || null;
};

export const ensureRequiredSheets = (sheets: WorkbookSheets) => {
  const missing = REQUIRED_CANONICAL_SHEETS.filter((sheetName) => !(sheetName in sheets));
  if (missing.length > 0) {
    throw new Error(`Workbook is missing required sheets: ${missing.join(", ")}`);
  }
};

export const asUtcDate = (value: unknown) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(value));
  if (!match) {
    throw new Error(`Invalid ISO date: ${text(value)}`);
  }

  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
};

export const addUtcDays = (value: Date, days: number) => new Date(value.getTime() + days * 86400000);

export const utcWeekday = (value: Date) => (value.getUTCDay() + 6) % 7;
