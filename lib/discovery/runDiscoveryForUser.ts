import type { SupabaseClient } from "@supabase/supabase-js";
import { discoverJobs } from "@/lib/discovery/discoverJobs";
import { loadOrCreateResumeAndCriteria } from "@/lib/discovery/resume/loadResumeAndCriteria";
import type { DiscoverySourceId } from "@/lib/discovery/types";

type DiscoveryRunSummary = {
  run_id: string | null;
  inserted_count: number;
  skipped_count: number;
  top_matches: Array<{ title: string; company: string | null; url: string; score: number; source: string }>;
  source_errors: string[];
  rate_limited: boolean;
  rate_limit_until: string | null;
};

const DEFAULT_SOURCES: DiscoverySourceId[] = ["remotive", "arbeitnow"];

function toIso(date: Date) {
  return date.toISOString();
}

export async function runDiscoveryForUser(args: {
  admin: SupabaseClient;
  user_id: string;
  source_override?: DiscoverySourceId[];
  ignore_rate_limit?: boolean;
}): Promise<DiscoveryRunSummary> {
  const admin = args.admin;
  const userId = args.user_id;

  const rateLimitHours = Number(process.env.DISCOVERY_RATE_LIMIT_HOURS ?? "1");

  const { data: sourceConfig } = await admin
    .from("discovery_sources_config")
    .select("discovery_enabled,enable_remotive,enable_arbeitnow")
    .eq("user_id", userId)
    .maybeSingle();

  const discoveryEnabled = sourceConfig?.discovery_enabled ?? true;
  if (!discoveryEnabled) {
    return {
      run_id: null,
      inserted_count: 0,
      skipped_count: 0,
      top_matches: [],
      source_errors: [],
      rate_limited: false,
      rate_limit_until: null
    };
  }

  const enabledFromConfig = [
    sourceConfig?.enable_remotive !== false ? "remotive" : null,
    sourceConfig?.enable_arbeitnow !== false ? "arbeitnow" : null
  ].filter((v): v is DiscoverySourceId => Boolean(v));

  const enabled_sources = args.source_override?.length
    ? args.source_override
    : enabledFromConfig.length
      ? enabledFromConfig
      : DEFAULT_SOURCES;

  if (!enabled_sources.length) {
    return {
      run_id: null,
      inserted_count: 0,
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
          inserted_count: 0,
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

    const urls = discovery.matches.map((match) => match.job.url);
    const existingUrls = new Set<string>();

    if (urls.length) {
      const { data: existingRows } = await admin
        .from("jobs")
        .select("url")
        .eq("user_id", userId)
        .in("url", urls);

      for (const row of existingRows ?? []) {
        if (row.url) existingUrls.add(row.url);
      }
    }

    const newMatches = discovery.matches.filter((match) => !existingUrls.has(match.job.url));

    const jobsToInsert = newMatches.map((match) => ({
      user_id: userId,
      source: match.job.source,
      title: match.job.title,
      company: match.job.company,
      location: match.job.location,
      url: match.job.url,
      description: match.job.description,
      posted_at: match.job.posted_at ? match.job.posted_at.slice(0, 10) : null
    }));

    let insertedJobRows: Array<{ id: string; url: string }> = [];
    if (jobsToInsert.length) {
      const { data: inserted, error: jobInsertError } = await admin
        .from("jobs")
        .upsert(jobsToInsert, { onConflict: "user_id,url" })
        .select("id,url");

      if (jobInsertError) {
        throw new Error(`Failed to insert discovered jobs: ${jobInsertError.message}`);
      }

      insertedJobRows = (inserted ?? []) as Array<{ id: string; url: string }>;

      await admin.from("applications").upsert(
        insertedJobRows.map((job) => ({
          user_id: userId,
          job_id: job.id,
          status: "DRAFT"
        })),
        { onConflict: "user_id,job_id", ignoreDuplicates: true }
      );
    }

    const urlToJobId = new Map(insertedJobRows.map((row) => [row.url, row.id]));

    const matchRows = newMatches
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

    const inserted_count = newMatches.length;
    const skipped_count = discovery.skipped_count + (discovery.matches.length - inserted_count);
    const source_errors = discovery.source_results
      .filter((result) => Boolean(result.error))
      .map((result) => `${result.source}: ${result.error}`);

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
      inserted_count,
      skipped_count,
      top_matches: discovery.matches.slice(0, 10).map((match) => ({
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
