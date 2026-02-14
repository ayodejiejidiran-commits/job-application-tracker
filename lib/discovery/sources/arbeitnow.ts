import { z } from "zod";
import type { DiscoveredJob, DiscoveryContext, DiscoverySourceResult } from "@/lib/discovery/types";

const arbeitnowJobSchema = z.object({
  slug: z.string().nullish(),
  company_name: z.string().nullish(),
  title: z.string(),
  description: z.string().nullish(),
  remote: z.boolean().nullish(),
  url: z.string().url().nullish(),
  location: z.string().nullish(),
  created_at: z.union([z.number(), z.string()]).nullish()
});

const arbeitnowResponseSchema = z.object({
  data: z.array(arbeitnowJobSchema),
  links: z
    .object({
      next: z.string().nullish()
    })
    .nullish()
});

function normalizePostedAt(value: number | string | null | undefined) {
  if (typeof value === "number") {
    const maybeMs = value > 1_000_000_000_000 ? value : value * 1000;
    const d = new Date(maybeMs);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  return null;
}

function buildArbeitnowUrl(slug: string | null | undefined) {
  if (!slug) return null;
  return `https://www.arbeitnow.com/jobs/${slug}`;
}

export async function fetchArbeitnowJobs(ctx: DiscoveryContext): Promise<DiscoverySourceResult> {
  const jobs: DiscoveredJob[] = [];

  try {
    let pageUrl: string | null = "https://www.arbeitnow.com/api/job-board-api";
    let pageCount = 0;

    while (pageUrl && pageCount < 2 && jobs.length < ctx.max_results_per_source * 2) {
      const response = await fetch(pageUrl, {
        method: "GET",
        headers: { "content-type": "application/json" }
      });

      if (!response.ok) break;
      const payload = arbeitnowResponseSchema.safeParse(await response.json());
      if (!payload.success) break;

      for (const row of payload.data.data) {
        const url = row.url ?? buildArbeitnowUrl(row.slug);
        if (!url) continue;

        jobs.push({
          source: "arbeitnow",
          source_id: row.slug ?? url,
          title: row.title,
          company: row.company_name ?? null,
          location: row.location ?? (row.remote ? "Remote" : null),
          url,
          description: row.description ?? null,
          posted_at: normalizePostedAt(row.created_at),
          metadata: { remote: row.remote ?? false }
        });
      }

      pageUrl = payload.data.links?.next ?? null;
      pageCount += 1;
    }

    return { source: "arbeitnow", jobs };
  } catch (error) {
    return {
      source: "arbeitnow",
      jobs,
      error: error instanceof Error ? error.message : "Unknown Arbeitnow source error"
    };
  }
}
