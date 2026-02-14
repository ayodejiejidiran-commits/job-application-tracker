export type ResumeJSON = {
  name?: string;
  yearsExp?: number;
  summary?: string;
  skills?: string[];
  competencies?: string[];
  experiences?: Array<{
    company?: string;
    title?: string;
    bullets?: string[];
  }>;
};

export type JobRecord = {
  title: string;
  company?: string | null;
  location?: string | null;
  description?: string | null;
};

const STOP = new Set([
  "the", "and", "or", "to", "of", "in", "for", "a", "an", "with", "on", "at", "by", "from", "as",
  "is", "are", "be", "will", "you", "we", "our", "your", "this", "that", "it", "they", "their",
  "into", "across", "within", "about", "plus", "etc"
]);

const PHRASES = [
  "product management", "roadmap", "user stories", "acceptance criteria", "a/b testing", "ab testing",
  "experimentation", "sql", "api", "rest", "postman", "jira", "confluence", "figma", "aws", "azure",
  "google cloud", "gcp", "stakeholder management", "cross-functional", "voc", "voice of customer", "analytics",
  "monitoring", "reliability", "requirements", "backlog", "agile", "scrum"
];

function norm(s: string) {
  return (s ?? "")
    .toLowerCase()
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^a-z0-9+/#.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string) {
  return norm(text)
    .split(" ")
    .map((w) => w.replace(/^[\.-]+|[\.-]+$/g, ""))
    .filter((w) => w.length >= 3 && !STOP.has(w));
}

function extractJobKeywords(jobText: string) {
  const text = norm(jobText);
  const found = new Set<string>();

  for (const phrase of PHRASES) {
    if (text.includes(phrase)) found.add(phrase);
  }

  const freq = new Map<string, number>();
  for (const t of tokenize(text)) {
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }

  for (const [k] of [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
    if (k.length >= 4) found.add(k);
  }

  return [...found];
}

function resumeBullets(resume: ResumeJSON) {
  const bullets: string[] = [];
  for (const exp of resume.experiences ?? []) {
    for (const bullet of exp.bullets ?? []) {
      bullets.push(bullet);
    }
  }
  return bullets;
}

function bestEvidenceForKeyword(keyword: string, bullets: string[]) {
  const k = norm(keyword);
  const kTokens = new Set(tokenize(k));
  let best: { score: number; bullet: string } | null = null;

  for (const b of bullets) {
    const bt = new Set(tokenize(b));
    let overlap = 0;
    for (const t of kTokens) {
      if (bt.has(t)) overlap += 1;
    }

    const score = overlap + (norm(b).includes(k) ? 2 : 0);
    if (!best || score > best.score) best = { score, bullet: b };
  }

  return best && best.score > 0 ? best.bullet : null;
}

export function matchResumeToJob(resume: ResumeJSON, job: JobRecord) {
  const jobText = `${job.title} ${job.company ?? ""} ${job.description ?? ""}`;
  const jobKeywords = extractJobKeywords(jobText);

  const resumeText = [
    resume.summary ?? "",
    (resume.skills ?? []).join(" "),
    (resume.competencies ?? []).join(" "),
    resumeBullets(resume).join(" ")
  ].join(" ");

  const r = norm(resumeText);
  const bullets = resumeBullets(resume);

  const matched: string[] = [];
  const missing: string[] = [];
  const evidence: Record<string, string[]> = {};

  for (const kw of jobKeywords) {
    const k = norm(kw);
    const hit =
      r.includes(k) ||
      (k === "api" && (r.includes("api") || r.includes("apis"))) ||
      (k === "rest" && (r.includes("rest") || r.includes("rest/http")));

    if (hit) {
      matched.push(kw);
      const best = bestEvidenceForKeyword(kw, bullets);
      if (best) evidence[kw] = [best];
    } else {
      missing.push(kw);
    }
  }

  const overlap = jobKeywords.length ? matched.length / jobKeywords.length : 0;
  const years = resume.yearsExp ?? 0;

  return {
    score: Math.max(0, Math.min(100, Math.round(20 + 65 * overlap + Math.min(15, years * 2)))),
    matched_keywords: matched.slice(0, 40),
    missing_keywords: missing.slice(0, 40),
    evidence
  };
}
