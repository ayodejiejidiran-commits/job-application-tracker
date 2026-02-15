import type { SupabaseClient } from "@supabase/supabase-js";
import { discoverJobs } from "@/lib/discovery/discoverJobs";
import { loadOrCreateResumeAndCriteria } from "@/lib/discovery/resume/loadResumeAndCriteria";
import { runApyHubResumeJobMatch } from "@/lib/discovery/scoring/apyhubResumeMatch";
import { isLikelyEnglishJob, isUnitedStatesJob } from "@/lib/discovery/usFilters";
import type { DiscoverySourceId } from "@/lib/discovery/types";

type DiscoveryRunSummary = {
  run_id: string | null;
  fetched_count: number;
  inserted_count: number;
  reactivated_count: number;
  skipped_count: number;
  top_matches: Array<{ title: string; company: string | null; url: string; score: number; source: string }>;
  source_errors: string[];
  rate_limited: boolean;
  rate_limit_until: string | null;
};

type SourceConfigRow = {
  discovery_enabled?: boolean | null;
  enable_remotive?: boolean | null;
  enable_arbeitnow?: boolean | null;
  enable_usajobs?: boolean | null;
  enable_serpapi?: boolean | null;
} | null;

function defaultSources() {
  const sources: DiscoverySourceId[] = [];
  if (process.env.SERPAPI_API_KEY) sources.push("serpapi");
  sources.push("remotive");
  if (process.env.USAJOBS_USER_AGENT_EMAIL) sources.push("usajobs");
  return [...new Set(sources)];
}

function toIso(date: Date) {
  return date.toISOString();
}

function mapDiscoverySourceToDbSource(source: DiscoverySourceId) {
  if (source === "serpapi") return "other";
  return source;
}

async function blendApyHubScore(args: {
  resume_pdf_path: string | null;
  matches: Array<{
    score: number;
    job: {
      source: DiscoverySourceId;
      url: string;
      title: string;
      company: string | null;
      location: string | null;
      description: string | null;
      posted_at: string | null;
    };
    evidence: Record<string, string[]>;
  }>;
}) {
  if (!args.resume_pdf_path || !process.env.APYHUB_API_KEY) {
    return { matches: args.matches, error: null as string | null };
  }

  try {
    const top = args.matches.slice(0, 5);
    for (const entry of top) {
      const jobText = `${entry.job.title}\n${entry.job.company ?? ""}\n${entry.job.location ?? ""}\n${entry.job.description ?? ""}`;
      const result = await runApyHubResumeJobMatch({
        resume_pdf_path: args.resume_pdf_path,
        job_text: jobText
      });

      if (typeof result?.score === "number") {
        entry.score = Math.round(entry.score * 0.7 + result.score * 0.3);
        entry.evidence.__external = [
          ...(entry.evidence.__external ?? []),
          `ApyHub score: ${result.score}`
        ];
      }
    }

    return { matches: args.matches, error: null as string | null };
  } catch (error) {
    return {
      matches: args.matches,
      error: error instanceof Error ? error.message : "ApyHub score merge failed"
    };
  }
}

export async function runDiscoveryForUser(args: {
  admin: SupabaseClient;
  user_id: string;
  source_override?: DiscoverySourceId[];
  ignore_rate_limit?: boolean;
}): Promise<DiscoveryRunSummary> {
  const admin = args.admin;
  const userId = args.user_id;
  const usOnlyMode = process.env.DISCOVERY_US_ONLY !== "false";
  const rateLimitHours = Number(process.env.DISCOVERY_RATE_LIMIT_HOURS ?? "1");

  const { data: sourceConfigData } = await admin
    .from("discovery_sources_config")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  const sourceConfig = (sourceConfigData ?? null) as SourceConfigRow;

  const discoveryEnabled = sourceConfig?.discovery_enabled ?? true;
  if (!discoveryEnabled) {
    return {
      run_id: null,
      fetched_count: 0,
      inserted_count: 0,
      reactivated_count: 0,
      skipped_count: 0,
      top_matches: [],
      source_errors: [],
      rate_limited: false,
      rate_limit_until: null
    };
  }

  const enabledFromConfig: DiscoverySourceId[] = [
    sourceConfig?.enable_remotive !== false ? "remotive" : null,
    !usOnlyMode && sourceConfig?.enable_arbeitnow !== false ? "arbeitnow" : null,
    process.env.USAJOBS_USER_AGENT_EMAIL && sourceConfig?.enable_usajobs !== false ? "usajobs" : null,
    process.env.SERPAPI_API_KEY && sourceConfig?.enable_serpapi !== false ? "serpapi" : null
  ].filter((v): v is DiscoverySourceId => Boolean(v));

  const enabled_sources = args.source_override?.length
    ? args.source_override
    : enabledFromConfig.length
      ? enabledFromConfig
      : defaultSources();

  if (!enabled_sources.length) {
    return {
      run_id: null,
      fetched_count: 0,
      inserted_count: 0,
      reactivated_count: 0,
      skipped_count: 0,
      top_matches: [],
      source_errors: ["No discovery sources enabled."],
      rate_limited: false,
      rate_limit_until: null
    };
  }

  if (!args.ignore_rate_limit) {
    const { data: latestRun } = await admin
      .from("job_discovery_runs")
      .select("started_at")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestRun?.started_at) {
      const last = new Date(latestRun.started_at);
      const next = new Date(last.getTime() + rateLimitHours * 60 * 60 * 1000);
      if (next > new Date()) {
        return {
          run_id: null,
          fetched_count: 0,
          inserted_count: 0,
          reactivated_count: 0,
          skipped_count: 0,
          top_matches: [],
          source_errors: [],
          rate_limited: true,
          rate_limit_until: toIso(next)
        };
      }
    }
  }

  const started_at = new Date();
  const { data: createdRun } = await admin
    .from("job_discovery_runs")
    .insert({
      user_id: userId,
      started_at: toIso(started_at),
      sources: enabled_sources,
      inserted_count: 0,
      skipped_count: 0
    })
    .select("id")
    .single();

  const runId = createdRun?.id ?? null;

  try {
    const context = await loadOrCreateResumeAndCriteria(admin, userId);

    const discovery = await discoverJobs({
      criteria: context.criteria,
      resume: context.resume,
      years_experience: context.years_experience,
      enabled_sources
    });

    const blended = await blendApyHubScore({
      resume_pdf_path: context.resume_pdf_path ?? null,
      matches: discovery.matches
    });

    const discoveredMatches = blended.matches;
    const urls = discoveredMatches.map((match) => match.job.url);
    const existingUrls = new Set<string>();

    if (urls.length) {
      const { data: existingRows } = await admin
        .from("jobs")
        .select("id,url")
        .eq("user_id", userId)
        .in("url", urls);

      for (const row of existingRows ?? []) {
        if (row.url) existingUrls.add(row.url);
      }
    }

    const newMatches = discoveredMatches.filter((match) => !existingUrls.has(match.job.url));

    const jobsToUpsert = discoveredMatches.map((match) => ({
      user_id: userId,
      source: mapDiscoverySourceToDbSource(match.job.source),
      title: match.job.title,
      company: match.job.company,
      location: match.job.location,
      url: match.job.url,
      description: match.job.description,
      posted_at: match.job.posted_at ? match.job.posted_at.slice(0, 10) : null
    }));

    let upsertedJobRows: Array<{ id: string; url: string }> = [];
    let reactivated_count = 0;

    if (jobsToUpsert.length) {
      const { data: upserted, error: jobUpsertError } = await admin
        .from("jobs")
        .upsert(jobsToUpsert, { onConflict: "user_id,url" })
        .select("id,url");

      if (jobUpsertError) {
        throw new Error(`Failed to insert discovered jobs: ${jobUpsertError.message}`);
      }

      upsertedJobRows = (upserted ?? []) as Array<{ id: string; url: string }>;

      await admin.from("applications").upsert(
        upsertedJobRows.map((job) => ({
          user_id: userId,
          job_id: job.id,
          status: "DRAFT"
        })),
        { onConflict: "user_id,job_id", ignoreDuplicates: true }
      );

      const { data: reactivatedRows } = await admin
        .from("applications")
        .update({
          status: "DRAFT",
          updated_at: toIso(new Date())
        })
        .eq("user_id", userId)
        .eq("status", "ARCHIVED")
        .in("job_id", upsertedJobRows.map((row) => row.id))
        .select("id");

      reactivated_count = (reactivatedRows ?? []).length;
    }

    const urlToJobId = new Map(upsertedJobRows.map((row) => [row.url, row.id]));

    const matchRows = discoveredMatches
      .map((match) => {
        const jobId = urlToJobId.get(match.job.url);
        if (!jobId) return null;

        return {
          user_id: userId,
          job_id: jobId,
          score: match.score,
          matched_keywords: match.matched_keywords,
          missing_keywords: match.missing_keywords,
          evidence: match.evidence
        };
      })
      .filter((v): v is NonNullable<typeof v> => Boolean(v));

    if (matchRows.length) {
      await admin.from("job_matches").upsert(matchRows, { onConflict: "user_id,job_id" });
    }

    const { data: existingDrafts } = await admin
      .from("applications")
      .select("id,status,jobs(title,location,description)")
      .eq("user_id", userId)
      .in("status", ["DRAFT", "READY_TO_REVIEW"]);

    const toArchive = (existingDrafts ?? [])
      .filter((row) => {
        const job = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
        if (!job) return false;

        const us = isUnitedStatesJob({
          title: job.title,
          location: job.location,
          description: job.description
        });
        const english = isLikelyEnglishJob({
          title: job.title,
          location: job.location,
          description: job.description
        });
        return !us || !english;
      })
      .map((row) => row.id)
      .filter((id): id is string => Boolean(id));

    if (toArchive.length) {
      await admin
        .from("applications")
        .update({
          status: "ARCHIVED",
          updated_at: toIso(new Date())
        })
        .eq("user_id", userId)
        .in("id", toArchive);
    }

    const fetched_count = discoveredMatches.length;
    const inserted_count = newMatches.length;
    const skipped_count = discovery.skipped_count + (fetched_count - inserted_count);
    const source_errors = discovery.source_results
      .filter((result) => Boolean(result.error))
      .map((result) => `${result.source}: ${result.error}`);

    if (blended.error) source_errors.push(`apyhub: ${blended.error}`);

    if (runId) {
      await admin
        .from("job_discovery_runs")
        .update({
          finished_at: toIso(new Date()),
          inserted_count,
          skipped_count,
          error: source_errors.length ? source_errors.join(" | ") : null
        })
        .eq("id", runId);
    }

    return {
      run_id: runId,
      fetched_count,
      inserted_count,
      reactivated_count,
      skipped_count,
      top_matches: discoveredMatches.slice(0, 10).map((match) => ({
        title: match.job.title,
        company: match.job.company,
        url: match.job.url,
        score: match.score,
        source: match.job.source
      })),
      source_errors,
      rate_limited: false,
      rate_limit_until: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Discovery run failed";

    if (runId) {
      await admin
        .from("job_discovery_runs")
        .update({
          finished_at: toIso(new Date()),
          inserted_count: 0,
          skipped_count: 0,
          error: message
        })
        .eq("id", runId);
    }

    throw error;
  }
}
