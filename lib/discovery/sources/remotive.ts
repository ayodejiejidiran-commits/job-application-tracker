import { z } from "zod";
import type { DiscoveredJob, DiscoveryContext, DiscoverySourceResult } from "@/lib/discovery/types";

const remotiveJobSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  title: z.string(),
  company_name: z.string().nullish(),
  candidate_required_location: z.string().nullish(),
  url: z.string().url(),
  description: z.string().nullish(),
  publication_date: z.string().nullish()
});

const remotiveResponseSchema = z.object({
  jobs: z.array(remotiveJobSchema)
});

function normalizeDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function pickQueries(ctx: DiscoveryContext) {
  const queries = [...ctx.titles, ...ctx.keywords].filter(Boolean);
  const dedup = [...new Set(queries.map((q) => q.trim()))];
  return dedup.slice(0, 5);
}

export async function fetchRemotiveJobs(ctx: DiscoveryContext): Promise<DiscoverySourceResult> {
  const queries = pickQueries(ctx);
  const jobs: DiscoveredJob[] = [];

  try {
    if (!queries.length) {
      queries.push("product manager");
    }

    for (const query of queries) {
      const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        method: "GET",
        headers: { "content-type": "application/json" }
      });

      if (!response.ok) continue;
      const payload = remotiveResponseSchema.safeParse(await response.json());
      if (!payload.success) continue;

      for (const row of payload.data.jobs.slice(0, ctx.max_results_per_source)) {
        jobs.push({
          source: "remotive",
          source_id: String(row.id ?? row.url),
          title: row.title,
          company: row.company_name ?? null,
          location: row.candidate_required_location ?? "Remote",
          url: row.url,
          description: row.description ?? null,
          posted_at: normalizeDate(row.publication_date),
          metadata: { query }
        });
      }
    }

    return { source: "remotive", jobs };
  } catch (error) {
    return {
      source: "remotive",
      jobs,
      error: error instanceof Error ? error.message : "Unknown Remotive source error"
    };
  }
}
