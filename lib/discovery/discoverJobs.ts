import { clampMatchScore, scoreJob, type Criteria } from "@/lib/match";
import { matchResumeToJob, type ResumeJSON } from "@/lib/resumeMatch";
import { fetchArbeitnowJobs } from "@/lib/discovery/sources/arbeitnow";
import { fetchRemotiveJobs } from "@/lib/discovery/sources/remotive";
import { isLikelyEnglishJob, isUnitedStatesJob } from "@/lib/discovery/usFilters";
import type {
  DiscoveredJob,
  DiscoveryContext,
  DiscoveryMatch,
  DiscoverySourceId,
  DiscoverySourceResult,
  DiscoverySummary
} from "@/lib/discovery/types";

const SOURCE_FETCHERS: Record<DiscoverySourceId, (ctx: DiscoveryContext) => Promise<DiscoverySourceResult>> = {
  remotive: fetchRemotiveJobs,
  arbeitnow: fetchArbeitnowJobs
};

function normalizeUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    parsed.hash = "";
    parsed.searchParams.delete("utm_source");
    parsed.searchParams.delete("utm_medium");
    parsed.searchParams.delete("utm_campaign");
    return parsed.toString();
  } catch {
    return null;
  }
}

function containsKeyword(text: string, keywords: string[]) {
  const value = text.toLowerCase();
  return keywords.some((keyword) => keyword && value.includes(keyword.toLowerCase()));
}

function postedWithinWindow(postedAt: string | null, postedAfter: Date) {
  if (!postedAt) return false;
  const d = new Date(postedAt);
  if (Number.isNaN(d.getTime())) return false;
  return d >= postedAfter;
}

function toDiscoveryContext(criteria: Criteria, maxResultsPerSource = 80): DiscoveryContext {
  return {
    titles: criteria.titles ?? [],
    keywords: criteria.include_keywords ?? [],
    locations: criteria.locations ?? [],
    remote_only: criteria.remote_only ?? false,
    posted_after: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    max_results_per_source: maxResultsPerSource
  };
}

export async function discoverJobs(args: {
  criteria: Criteria;
  resume: ResumeJSON;
  years_experience: number;
  enabled_sources: DiscoverySourceId[];
}): Promise<DiscoverySummary> {
  const context = toDiscoveryContext(args.criteria);

  const sourceCalls = args.enabled_sources.map((source) => SOURCE_FETCHERS[source](context));
  const settled = await Promise.allSettled(sourceCalls);

  const source_results: DiscoverySourceResult[] = settled.map((result, index) => {
    if (result.status === "fulfilled") return result.value;
    return {
      source: args.enabled_sources[index],
      jobs: [],
      error: result.reason instanceof Error ? result.reason.message : "Unhandled source error"
    };
  });

  const dedup = new Map<string, DiscoveredJob>();
  let skipped_count = 0;

  for (const sourceResult of source_results) {
    for (const rawJob of sourceResult.jobs) {
      const normalizedUrl = normalizeUrl(rawJob.url);
      if (!normalizedUrl) {
        skipped_count += 1;
        continue;
      }

      if (
        !isUnitedStatesJob({
          title: rawJob.title,
          location: rawJob.location,
          description: rawJob.description
        })
      ) {
        skipped_count += 1;
        continue;
      }

      if (
        !isLikelyEnglishJob({
          title: rawJob.title,
          location: rawJob.location,
          description: rawJob.description
        })
      ) {
        skipped_count += 1;
        continue;
      }

      if (!postedWithinWindow(rawJob.posted_at, context.posted_after)) {
        skipped_count += 1;
        continue;
      }

      const text = `${rawJob.title} ${rawJob.company ?? ""} ${rawJob.location ?? ""} ${rawJob.description ?? ""}`;

      if (containsKeyword(text, args.criteria.exclude_keywords ?? [])) {
        skipped_count += 1;
        continue;
      }

      const criteriaScore = clampMatchScore(
        scoreJob(
          {
            title: rawJob.title,
            location: rawJob.location,
            description: rawJob.description
          },
          args.criteria,
          args.years_experience
        )
      );

      const resumeMatch = matchResumeToJob(args.resume, {
        title: rawJob.title,
        company: rawJob.company,
        location: rawJob.location,
        description: rawJob.description
      });

      const finalScore = clampMatchScore(resumeMatch.score * 0.7 + criteriaScore * 0.3);
      const includeKeywords = args.criteria.include_keywords ?? [];
      const includeHit = includeKeywords.length ? containsKeyword(text, includeKeywords) : true;
      const titleAligned = (args.criteria.titles ?? []).length
        ? containsKeyword(rawJob.title, args.criteria.titles ?? [])
        : true;

      if ((finalScore < 30 && !includeHit) || !titleAligned) {
        skipped_count += 1;
        continue;
      }

      const picked: DiscoveredJob = {
        ...rawJob,
        url: normalizedUrl,
        metadata: {
          ...(rawJob.metadata ?? {}),
          criteria_score: criteriaScore,
          resume_score: resumeMatch.score,
          final_score: finalScore
        }
      };

      const existing = dedup.get(normalizedUrl);
      const existingScore = Number(existing?.metadata?.final_score ?? 0);
      if (!existing || finalScore > existingScore) {
        dedup.set(normalizedUrl, picked);
      }
    }
  }

  const matches: DiscoveryMatch[] = [...dedup.values()]
    .map((job) => {
      const resumeMatch = matchResumeToJob(args.resume, {
        title: job.title,
        company: job.company,
        location: job.location,
        description: job.description
      });

      const criteriaScore = clampMatchScore(
        scoreJob(
          {
            title: job.title,
            location: job.location,
            description: job.description
          },
          args.criteria,
          args.years_experience
        )
      );

      const score = clampMatchScore(resumeMatch.score * 0.7 + criteriaScore * 0.3);
      return {
        job,
        score,
        matched_keywords: resumeMatch.matched_keywords,
        missing_keywords: resumeMatch.missing_keywords,
        evidence: {
          ...resumeMatch.evidence,
          __criteria: [`Criteria score: ${criteriaScore}`, `Years experience: ${args.years_experience}`]
        }
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.job.posted_at && b.job.posted_at) return b.job.posted_at.localeCompare(a.job.posted_at);
      if (a.job.posted_at) return -1;
      if (b.job.posted_at) return 1;
      return 0;
    });

  return {
    matches,
    source_results,
    skipped_count
  };
}
