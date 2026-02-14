export const APPLICATION_STATUSES = [
  "DRAFT",
  "READY_TO_REVIEW",
  "APPLIED",
  "ARCHIVED"
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
