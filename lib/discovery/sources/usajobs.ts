import { z } from "zod";
import type { DiscoveredJob, DiscoveryContext, DiscoverySourceResult } from "@/lib/discovery/types";

const usajobsPositionSchema = z.object({
  PositionID: z.string().nullish(),
  PositionTitle: z.string().nullish(),
  OrganizationName: z.string().nullish(),
  PositionURI: z.string().url().nullish(),
  PositionLocationDisplay: z.string().nullish(),
  PublicationStartDate: z.string().nullish(),
  UserArea: z
    .object({
      Details: z
        .object({
          JobSummary: z.string().nullish()
        })
        .nullish()
    })
    .nullish()
});

const usajobsSearchResultSchema = z.object({
  SearchResult: z.object({
    SearchResultItems: z.array(
      z.object({
        MatchedObjectDescriptor: usajobsPositionSchema
      })
    )
  })
});

function normalizeDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function buildUrl(args: { keyword: string; location?: string; resultsPerPage?: number }) {
  const url = new URL("https://data.usajobs.gov/api/search");
  url.searchParams.set("Keyword", args.keyword);
  if (args.location) url.searchParams.set("LocationName", args.location);
  url.searchParams.set("ResultsPerPage", String(args.resultsPerPage ?? 25));
  return url.toString();
}

export async function fetchUSAJobs(ctx: DiscoveryContext): Promise<DiscoverySourceResult> {
  const jobs: DiscoveredJob[] = [];
  const email = process.env.USAJOBS_USER_AGENT_EMAIL ?? "";
  const apiKey = process.env.USAJOBS_AUTH_KEY ?? "";

  if (!email) {
    return {
      source: "usajobs",
      jobs: [],
      error: "Missing USAJOBS_USER_AGENT_EMAIL env var."
    };
  }

  const keywords = [...new Set(ctx.titles.filter(Boolean))].slice(0, 3);
  const locations = [...new Set(ctx.locations.filter(Boolean))];
  const location = locations.find((loc) => /usa|united states|tx|austin|remote/i.test(loc)) ? undefined : locations[0];

  if (!keywords.length) keywords.push("Product Manager");

  try {
    for (const keyword of keywords) {
      const response = await fetch(buildUrl({ keyword, location, resultsPerPage: 25 }), {
        method: "GET",
        headers: {
          "User-Agent": email,
          ...(apiKey ? { "Authorization-Key": apiKey } : {})
        }
      });

      if (!response.ok) continue;
      const json = await response.json();
      const parsed = usajobsSearchResultSchema.safeParse(json);
      if (!parsed.success) continue;

      for (const item of parsed.data.SearchResult.SearchResultItems) {
        const row = item.MatchedObjectDescriptor;
        const title = row.PositionTitle ?? "";
        const url = row.PositionURI ?? "";
        if (!title || !url) continue;

        jobs.push({
          source: "usajobs",
          source_id: row.PositionID ?? url,
          title,
          company: row.OrganizationName ?? null,
          location: row.PositionLocationDisplay ?? "United States",
          url,
          description: row.UserArea?.Details?.JobSummary ?? null,
          posted_at: normalizeDate(row.PublicationStartDate),
          metadata: { keyword }
        });
      }
    }

    return { source: "usajobs", jobs };
  } catch (error) {
    return {
      source: "usajobs",
      jobs,
      error: error instanceof Error ? error.message : "Unknown USAJOBS source error"
    };
  }
}
