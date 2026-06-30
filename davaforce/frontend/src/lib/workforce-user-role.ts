export const WORKFORCE_USER_ROLES = [
  "Workforce Planner",
  "Delivery Manager",
  "Sales / Client Partner",
  "Regional Leader",
] as const;

export type WorkforceUserRole = (typeof WORKFORCE_USER_ROLES)[number];

export const isWorkforceUserRole = (value: string | null): value is WorkforceUserRole =>
  WORKFORCE_USER_ROLES.some((role) => role === value);
