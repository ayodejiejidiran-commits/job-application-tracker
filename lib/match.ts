export type Criteria = {
  titles: string[];
  locations: string[];
  remote_only: boolean;
  min_years: number;
  max_years: number;
  include_keywords: string[];
  exclude_keywords: string[];
};

export type Job = {
  title: string;
  location?: string | null;
  description?: string | null;
};

const norm = (s: string) => s.toLowerCase().trim();

export function scoreJob(job: Job, criteria: Criteria, yearsExp: number) {
  if (yearsExp < criteria.min_years || yearsExp > criteria.max_years) return 0;

  const title = norm(job.title);
  const loc = norm(job.location ?? "");
  const desc = norm(job.description ?? "");

  for (const bad of criteria.exclude_keywords ?? []) {
    if (desc.includes(norm(bad)) || title.includes(norm(bad))) return 0;
  }

  let score = 0;

  for (const t of criteria.titles ?? []) {
    if (title.includes(norm(t))) score += 40;
  }

  if ((criteria.locations ?? []).length) {
    for (const l of criteria.locations) {
      if (loc.includes(norm(l))) score += 15;
    }
  } else {
    score += 5;
  }

  for (const k of criteria.include_keywords ?? []) {
    const nk = norm(k);
    if (desc.includes(nk) || title.includes(nk)) score += 8;
  }

  if (criteria.remote_only) {
    if (desc.includes("remote") || title.includes("remote")) score += 10;
    else score -= 15;
  }

  return Math.max(0, score);
}

export function clampMatchScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}
