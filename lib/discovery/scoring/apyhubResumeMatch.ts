import { promises as fs } from "node:fs";
import path from "node:path";

type ApyHubMatch = {
  score: number | null;
  status: string;
  raw: unknown;
};

function readPathIfExists(filePath: string) {
  return fs.readFile(filePath).catch(() => null);
}

function normalizePath(filePath: string) {
  if (path.isAbsolute(filePath)) return filePath;
  return path.join("/Users/ayodejiejidiran/Desktop/Resumes", filePath);
}

function extractString(value: unknown, keys: string[]): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  for (const key of keys) {
    const hit = record[key];
    if (typeof hit === "string" && hit.trim()) return hit;
  }

  for (const nested of Object.values(record)) {
    if (nested && typeof nested === "object") {
      const hit = extractString(nested, keys);
      if (hit) return hit;
    }
  }

  return null;
}

function extractNumber(value: unknown, keys: string[]): number | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  for (const key of keys) {
    const hit = record[key];
    if (typeof hit === "number" && Number.isFinite(hit)) return hit;
    if (typeof hit === "string") {
      const parsed = Number(hit);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  for (const nested of Object.values(record)) {
    if (nested && typeof nested === "object") {
      const hit = extractNumber(nested, keys);
      if (hit !== null) return hit;
    }
  }

  return null;
}

export async function runApyHubResumeJobMatch(args: {
  resume_pdf_path: string;
  job_text: string;
  timeout_ms?: number;
}): Promise<ApyHubMatch | null> {
  const apiKey = process.env.APYHUB_API_KEY ?? "";
  if (!apiKey) return null;

  const submitUrl = "https://api.apyhub.com/sharpapi/api/v1/hr/resume_job_match_score";
  const statusBaseUrl = "https://api.apyhub.com/sharpapi/api/v1/hr/resume_job_match_score/job/status";

  const normalizedPath = normalizePath(args.resume_pdf_path);
  const pdfBuffer = await readPathIfExists(normalizedPath);
  if (!pdfBuffer) return null;

  const form = new FormData();
  form.append("file", new Blob([pdfBuffer], { type: "application/pdf" }), path.basename(normalizedPath));
  form.append("job_description", args.job_text);

  const submitResponse = await fetch(submitUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: form
  });

  if (!submitResponse.ok) return null;
  const submitPayload = await submitResponse.json().catch(() => null);
  if (!submitPayload) return null;

  const immediateScore = extractNumber(submitPayload, [
    "overall_match_score",
    "overall_match",
    "match_score",
    "score"
  ]);
  if (immediateScore !== null) {
    return {
      score: Math.max(0, Math.min(100, Math.round(immediateScore))),
      status: "done",
      raw: submitPayload
    };
  }

  const jobId =
    extractString(submitPayload, ["job_id", "id", "request_id"]) ??
    extractString(submitPayload, ["jobId", "task_id"]);
  if (!jobId) return null;

  const timeoutMs = args.timeout_ms ?? 12_000;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const statusResponse = await fetch(`${statusBaseUrl}/${encodeURIComponent(jobId)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (!statusResponse.ok) continue;
    const statusPayload = await statusResponse.json().catch(() => null);
    if (!statusPayload) continue;

    const status =
      extractString(statusPayload, ["status", "state"])?.toLowerCase() ??
      "unknown";

    const score = extractNumber(statusPayload, [
      "overall_match_score",
      "overall_match",
      "match_score",
      "score"
    ]);

    if (score !== null || status === "done" || status === "completed" || status === "success") {
      return {
        score: score === null ? null : Math.max(0, Math.min(100, Math.round(score))),
        status,
        raw: statusPayload
      };
    }
  }

  return null;
}
