import { promises as fs } from "node:fs";
import path from "node:path";
import type { ResumeJSON } from "@/lib/resumeMatch";

const TITLE_KEYWORDS = [
  "product manager",
  "technical product manager",
  "digital product manager",
  "product owner",
  "senior product manager",
  "senior digital product manager"
];

const SKILL_KEYWORDS = [
  "sql",
  "rest",
  "http api",
  "apis",
  "postman",
  "jira",
  "confluence",
  "figma",
  "aws",
  "azure",
  "gcp",
  "google cloud",
  "a/b testing",
  "experimentation",
  "backlog",
  "user stories",
  "acceptance criteria",
  "roadmap",
  "stakeholder management",
  "voice of customer",
  "voc",
  "analytics"
];

type ParsedResume = {
  resume_json: ResumeJSON;
  text: string;
  path: string;
};

function normalizeText(text: string) {
  return text.replace(/\u00a0/g, " ").replace(/\r/g, "").replace(/\t/g, " ").replace(/ +/g, " ").trim();
}

function findYears(text: string) {
  const patterns = [
    /(\d{1,2})\+?\s+years?\s+of\s+experience/gi,
    /over\s+(\d{1,2})\s+years?/gi,
    /at least\s+(\d{1,2})\s+years?/gi
  ];

  const values: number[] = [];
  for (const pattern of patterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      const n = Number(m[1]);
      if (!Number.isNaN(n) && n > 0 && n < 50) values.push(n);
    }
  }

  if (!values.length) return 0;
  return Math.max(...values);
}

function pickName(text: string) {
  const line = text.split("\n").map((v) => v.trim()).find((v) => /^[A-Za-z][A-Za-z\s.'-]{4,}$/.test(v));
  return line ?? "Candidate";
}

function pickSummary(text: string) {
  const lines = text
    .split("\n")
    .map((v) => v.trim())
    .filter((v) => v.length > 40)
    .slice(0, 2);

  return lines.join(" ").slice(0, 300);
}

function pickSkills(text: string) {
  const lower = text.toLowerCase();
  const skills = SKILL_KEYWORDS.filter((k) => lower.includes(k.toLowerCase()));
  return [...new Set(skills.map((s) => s.toUpperCase() === "GCP" ? "GCP" : s.replace(/\b\w/g, (c) => c.toUpperCase())))];
}

function pickBullets(text: string) {
  const lines = text
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);

  const bullets = lines
    .filter((line) => /^[-•*]\s+/.test(line) || /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^[-•*\d.\s]+/, "").trim())
    .filter((line) => line.length > 20)
    .slice(0, 12);

  return bullets;
}

function toResumeJson(text: string): ResumeJSON {
  const lower = text.toLowerCase();
  const titles = TITLE_KEYWORDS.filter((title) => lower.includes(title));
  const skills = pickSkills(text);
  const yearsExp = findYears(text);
  const bullets = pickBullets(text);

  return {
    name: pickName(text),
    yearsExp: yearsExp || 3,
    summary: pickSummary(text),
    skills,
    competencies: [...new Set([...titles, ...skills])].slice(0, 20),
    experiences: bullets.length
      ? [
          {
            company: "Resume",
            title: "Experience Highlights",
            bullets
          }
        ]
      : []
  };
}

async function listPdfFilesInDir(dir: string) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const pdfs = entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".pdf"))
      .map((e) => path.join(dir, e.name));
    return pdfs;
  } catch {
    return [];
  }
}

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function pickNewest(paths: string[]) {
  const stats = await Promise.all(
    paths.map(async (filePath) => ({
      filePath,
      stat: await fs.stat(filePath)
    }))
  );

  stats.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
  return stats[0]?.filePath ?? null;
}

export async function parseLatestResumePdf(options?: {
  manual_paths?: string[];
  default_dir?: string;
}): Promise<ParsedResume | null> {
  const manual = (options?.manual_paths ?? []).filter(Boolean);
  const envPaths = (process.env.RESUME_PDF_PATHS ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  const dirs = [
    options?.default_dir ?? process.env.RESUME_PDF_DIR ?? "/mnt/data",
    "/Users/ayodejiejidiran/Desktop/Resumes",
    "/tmp"
  ];

  const directoryPdfs = (await Promise.all(dirs.map((dir) => listPdfFilesInDir(dir)))).flat();

  const manualExisting = [] as string[];
  for (const candidate of manual) {
    if (await pathExists(candidate)) manualExisting.push(candidate);
  }

  let picked: string | null = null;
  if (manualExisting.length) {
    picked = await pickNewest(manualExisting);
  } else {
    const candidates = [...new Set([...envPaths, ...directoryPdfs])];
    const existing = [] as string[];

    for (const candidate of candidates) {
      if (await pathExists(candidate)) existing.push(candidate);
    }

    if (!existing.length) return null;
    picked = await pickNewest(existing);
  }

  if (!picked) return null;

  const buffer = await fs.readFile(picked);
  const pdfParseImport = await import("pdf-parse");
  const pdfParse = (pdfParseImport.default ?? pdfParseImport) as unknown as (data: Buffer) => Promise<{ text: string }>;
  const parsed = await pdfParse(buffer);

  const text = normalizeText(parsed.text ?? "");
  if (!text) return null;

  return {
    resume_json: toResumeJson(text),
    text,
    path: picked
  };
}
