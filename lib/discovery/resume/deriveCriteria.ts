import type { Criteria } from "@/lib/match";
import type { ResumeJSON } from "@/lib/resumeMatch";

const DEFAULT_TITLES = [
  "product manager",
  "technical product manager",
  "digital product manager",
  "product owner",
  "senior product manager",
  "senior digital product manager"
];

const DEFAULT_INCLUDE = [
  "sql",
  "rest",
  "api",
  "postman",
  "jira",
  "confluence",
  "figma",
  "aws",
  "azure",
  "gcp",
  "a/b testing",
  "experimentation",
  "backlog",
  "user stories",
  "acceptance criteria",
  "roadmap",
  "stakeholder management",
  "voc",
  "analytics"
];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function dedupe(values: string[]) {
  return [...new Set(values.map(normalize).filter(Boolean))];
}

export function deriveCriteriaFromResume(resume: ResumeJSON, resumeText?: string): Criteria {
  const resumeSkills = dedupe((resume.skills ?? []).map((s) => s.toLowerCase()));
  const resumeCompetencies = dedupe((resume.competencies ?? []).map((s) => s.toLowerCase()));

  const titles = dedupe(
    DEFAULT_TITLES.filter((title) =>
      `${resume.summary ?? ""} ${(resume.competencies ?? []).join(" ")}`.toLowerCase().includes(title)
    )
  );

  const mergedTitles = titles.length ? titles : DEFAULT_TITLES;

  const include_keywords = dedupe([...DEFAULT_INCLUDE, ...resumeSkills, ...resumeCompetencies]).slice(0, 30);

  const text = (resumeText ?? `${resume.summary ?? ""} ${(resume.skills ?? []).join(" ")}`).toLowerCase();
  const hasAustin = text.includes("austin") || text.includes("tx") || text.includes("texas");
  const hasRemote = text.includes("remote");

  const locations = hasAustin ? ["Austin, TX", ...(hasRemote ? ["Remote"] : [])] : hasRemote ? ["Remote"] : [];

  const years = resume.yearsExp ?? 3;

  return {
    titles: mergedTitles,
    locations,
    remote_only: hasRemote && !hasAustin,
    min_years: Math.max(0, years - 1),
    max_years: Math.max(years + 6, years),
    include_keywords,
    exclude_keywords: ["intern", "unpaid", "principal scientist"]
  };
}
