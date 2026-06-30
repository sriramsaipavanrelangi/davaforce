export type AnyRecord = Record<string, unknown>;
export type ChartRow = { label: string; value: number; color?: string };

export const COLORS = {
  brand: "#FF5640",
  blue: "#5899C4",
  amber: "#F99C11",
  green: "#30A661",
  violet: "#8684BF",
  ink: "#192B37",
};

export function riskColor(risk: string) {
  if (risk === "High") return COLORS.brand;
  if (risk === "Medium") return COLORS.amber;
  return COLORS.green;
}

export function record(value: unknown): AnyRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AnyRecord) : null;
}

export function records(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.map(record).filter((item): item is AnyRecord => Boolean(item)) : [];
}

export function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean) : [];
}

export function text(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  const next = String(value).trim();
  return next || fallback;
}

export function number(value: unknown, fallback = 0): number {
  const next = typeof value === "number" ? value : Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export function bool(value: unknown): boolean {
  return value === true || value === "true";
}

export function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function percent(value: unknown) {
  const numeric = number(value);
  const normalized = numeric <= 1 ? numeric * 100 : numeric;
  return `${Math.round(normalized)}%`;
}
