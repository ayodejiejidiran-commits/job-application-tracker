import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { matchResumeToJob, type ResumeJSON } from "@/lib/resumeMatch";
import { clampMatchScore, scoreJob, type Criteria } from "@/lib/match";

const importSchema = z.object({
  source: z.enum(["linkedin", "indeed", "glassdoor", "remotive", "arbeitnow", "usajobs", "other"]).default("other"),
  title: z.string().min(1, "title is required"),
  company: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  url: z.string().url(),
  description: z.string().optional().nullable()
});

export async function POST(req: Request) {
  const sb = await supabaseServer();
  const {
    data: { user }
  } = await sb.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = importSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload" }, { status: 400 });
  }

  const payload = parsed.data;

  const { data: job, error: jobErr } = await sb
    .from("jobs")
    .insert({
      user_id: user.id,
      source: payload.source,
      title: payload.title,
      company: payload.company ?? null,
      location: payload.location ?? null,
      url: payload.url,
      description: payload.description ?? null
    })
    .select("id,title,company,location,description")
    .single();

  if (jobErr || !job) {
    return NextResponse.json({ error: jobErr?.message ?? "Unable to create job" }, { status: 400 });
  }

  const { data: application, error: appErr } = await sb
    .from("applications")
    .insert({ user_id: user.id, job_id: job.id, status: "DRAFT" })
    .select("id")
    .single();

  if (appErr || !application) {
    return NextResponse.json({ error: appErr?.message ?? "Unable to create application" }, { status: 400 });
  }

  const [{ data: resumeRow }, { data: profileRow }, { data: criteriaRow }] = await Promise.all([
    sb
      .from("resume_versions")
      .select("id,resume_json")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.from("profiles").select("years_experience").eq("user_id", user.id).maybeSingle(),
    sb
      .from("job_criteria")
      .select("titles,locations,remote_only,min_years,max_years,include_keywords,exclude_keywords")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  if (resumeRow?.resume_json) {
    const resume = resumeRow.resume_json as ResumeJSON;
    const resumeMatch = matchResumeToJob(resume, {
      title: job.title,
      company: job.company,
      location: job.location,
      description: job.description
    });

    const criteria = (criteriaRow
      ? {
          titles: criteriaRow.titles ?? [],
          locations: criteriaRow.locations ?? [],
          remote_only: criteriaRow.remote_only ?? false,
          min_years: criteriaRow.min_years ?? 0,
          max_years: criteriaRow.max_years ?? 50,
          include_keywords: criteriaRow.include_keywords ?? [],
          exclude_keywords: criteriaRow.exclude_keywords ?? []
        }
      : null) as Criteria | null;

    const yearsExp = profileRow?.years_experience ?? resume.yearsExp ?? 0;
    const criteriaScoreRaw = criteria
      ? scoreJob(
          { title: job.title, location: job.location, description: job.description },
          criteria,
          yearsExp
        )
      : resumeMatch.score;
    const criteriaScore = clampMatchScore(criteriaScoreRaw);
    const finalScore = criteria
      ? clampMatchScore(resumeMatch.score * 0.75 + criteriaScore * 0.25)
      : resumeMatch.score;

    const evidence = {
      ...resumeMatch.evidence,
      __criteria: [
        `Years experience: ${yearsExp}`,
        `Criteria score: ${criteriaScore}`,
        criteria ? "Criteria profile: active" : "Criteria profile: not set"
      ]
    };

    await sb.from("job_matches").upsert(
      {
        user_id: user.id,
        job_id: job.id,
        score: finalScore,
        matched_keywords: resumeMatch.matched_keywords,
        missing_keywords: resumeMatch.missing_keywords,
        evidence
      },
      { onConflict: "user_id,job_id" }
    );
  }

  return NextResponse.json({ ok: true, job_id: job.id, application_id: application.id });
}
