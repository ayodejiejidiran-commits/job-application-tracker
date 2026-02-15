import { z } from "zod";
import type { DiscoveredJob, DiscoveryContext, DiscoverySourceResult } from "@/lib/discovery/types";

const applyOptionSchema = z.object({
  title: z.string().nullish(),
  link: z.string().url().nullish()
});

const serpApiJobSchema = z.object({
  job_id: z.string().nullish(),
  title: z.string().nullish(),
  company_name: z.string().nullish(),
  location: z.string().nullish(),
  description: z.string().nullish(),
  apply_options: z.array(applyOptionSchema).nullish(),
  related_links: z.array(z.object({ link: z.string().url().nullish() })).nullish(),
  share_link: z.string().url().nullish(),
  via: z.string().nullish(),
  detected_extensions: z
    .object({
      posted_at: z.string().nullish()
    })
    .nullish()
});

const serpApiResponseSchema = z.object({
  jobs_results: z.array(serpApiJobSchema).default([])
});

function normalizePostedAt(value: string | null | undefined) {
  if (!value) return null;
  const text = value.toLowerCase().trim();
  const now = Date.now();

  if (text.includes("today") || text.includes("just posted")) return new Date(now).toISOString();

  const relative = text.match(/(\d+)\s+(hour|day|week|month|year)s?\s+ago/);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2];
    const unitMs =
      unit === "hour"
        ? 60 * 60 * 1000
        : unit === "day"
          ? 24 * 60 * 60 * 1000
          : unit === "week"
            ? 7 * 24 * 60 * 60 * 1000
            : unit === "month"
              ? 30 * 24 * 60 * 60 * 1000
              : 365 * 24 * 60 * 60 * 1000;
    return new Date(now - amount * unitMs).toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function pickApplyUrl(job: z.infer<typeof serpApiJobSchema>) {
  const apply = (job.apply_options ?? []).find((option) => Boolean(option.link))?.link;
  if (apply) return apply;

  const related = (job.related_links ?? []).find((link) => Boolean(link.link))?.link;
  if (related) return related;

  return job.share_link ?? null;
}

function queryList(ctx: DiscoveryContext) {
  const seeded = [...ctx.titles, ...ctx.keywords]
    .map((q) => q.trim())
    .filter((q) => q.length >= 4);
  const dedup = [...new Set(seeded)];
  return dedup.slice(0, 4);
}

function buildUrl(args: { query: string; location?: string; apiKey: string }) {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_jobs");
  url.searchParams.set("q", args.query);
  url.searchParams.set("hl", "en");
  url.searchParams.set("gl", "us");
  url.searchParams.set("google_domain", "google.com");
  url.searchParams.set("api_key", args.apiKey);
  if (args.location) url.searchParams.set("location", args.location);
  return url.toString();
}

export async function fetchSerpApiJobs(ctx: DiscoveryContext): Promise<DiscoverySourceResult> {
  const apiKey = process.env.SERPAPI_API_KEY ?? "";
  if (!apiKey) {
    return {
      source: "serpapi",
      jobs: [],
      error: "Missing SERPAPI_API_KEY env var."
    };
  }

  const queries = queryList(ctx);
  if (!queries.length) queries.push("Product Manager");

  const locationHint = ctx.locations.find((loc) => /austin|texas|united states|usa|remote/i.test(loc)) ?? "United States";
  const jobs: DiscoveredJob[] = [];

  try {
    for (const baseQuery of queries) {
      const query = ctx.remote_only ? `${baseQuery} remote` : baseQuery;
      const response = await fetch(buildUrl({ query, location: locationHint, apiKey }), {
        method: "GET",
        headers: { "content-type": "application/json" }
      });

      if (!response.ok) continue;
      const payload = serpApiResponseSchema.safeParse(await response.json());
      if (!payload.success) continue;

      for (const row of payload.data.jobs_results.slice(0, ctx.max_results_per_source)) {
        const title = row.title ?? "";
        const url = pickApplyUrl(row);
        if (!title || !url) continue;

        jobs.push({
          source: "serpapi",
          source_id: row.job_id ?? `${title}-${url}`,
          title,
          company: row.company_name ?? row.via ?? null,
          location: row.location ?? (ctx.remote_only ? "Remote, United States" : "United States"),
          url,
          description: row.description ?? null,
          posted_at: normalizePostedAt(row.detected_extensions?.posted_at),
          metadata: {
            via: row.via ?? null,
            query
          }
        });
      }
    }

    return { source: "serpapi", jobs };
  } catch (error) {
    return {
      source: "serpapi",
      jobs,
      error: error instanceof Error ? error.message : "Unknown SerpApi source error"
    };
  }
}
