import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { matchResumeToJob, type ResumeJSON } from "@/lib/resumeMatch";

const importSchema = z.object({
  source: z.enum(["linkedin", "indeed", "glassdoor", "other"]).default("other"),
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

  const { data: resumeRow } = await sb
    .from("resume_versions")
    .select("id,resume_json")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (resumeRow?.resume_json) {
    const match = matchResumeToJob(resumeRow.resume_json as ResumeJSON, {
      title: job.title,
      company: job.company,
      location: job.location,
      description: job.description
    });

    await sb.from("job_matches").upsert(
      {
        user_id: user.id,
        job_id: job.id,
        score: match.score,
        matched_keywords: match.matched_keywords,
        missing_keywords: match.missing_keywords,
        evidence: match.evidence
      },
      { onConflict: "user_id,job_id" }
    );
  }

  return NextResponse.json({ ok: true, job_id: job.id, application_id: application.id });
}
