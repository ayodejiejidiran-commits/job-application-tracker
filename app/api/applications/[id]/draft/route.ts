import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { generateCoverLetter, generateShortAnswers } from "@/lib/draft";
import type { ResumeJSON } from "@/lib/resumeMatch";

type JobRow = {
  title: string;
  company: string | null;
  description: string | null;
};

type ApplicationRow = {
  id: string;
  job_id: string;
  jobs: JobRow | JobRow[] | null;
};

async function generate(req: Request, id: string) {
  const sb = await supabaseServer();
  const {
    data: { user }
  } = await sb.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [{ data: profile }, { data: application }, { data: resumeRow }] = await Promise.all([
    sb.from("profiles").select("full_name,years_experience").eq("user_id", user.id).maybeSingle(),
    sb
      .from("applications")
      .select("id,job_id,jobs(title,company,description)")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    sb
      .from("resume_versions")
      .select("id,resume_json")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const typedApplication = application as ApplicationRow | null;
  const job = Array.isArray(typedApplication?.jobs) ? typedApplication?.jobs[0] : typedApplication?.jobs;

  if (!typedApplication || !job) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const resume = (resumeRow?.resume_json ?? {}) as ResumeJSON;
  const fullName = profile?.full_name ?? resume.name ?? "Candidate";
  const yearsExp = profile?.years_experience ?? resume.yearsExp ?? 0;

  const coverLetter = generateCoverLetter({
    fullName,
    yearsExp,
    jobTitle: job.title,
    company: job.company ?? "Hiring",
    jobDescription: job.description ?? "",
    resume
  });

  const answers = generateShortAnswers({
    resume,
    yearsExp,
    role: job.title
  });

  const { error: draftError } = await sb.from("drafts").upsert(
    {
      user_id: user.id,
      application_id: id,
      cover_letter: coverLetter,
      answers,
      resume_version_id: resumeRow?.id ?? null
    },
    { onConflict: "user_id,application_id" }
  );

  if (draftError) {
    return NextResponse.json({ error: draftError.message }, { status: 400 });
  }

  await sb
    .from("applications")
    .update({ status: "READY_TO_REVIEW" })
    .eq("id", id)
    .eq("user_id", user.id);

  if (req.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) {
    return NextResponse.redirect(new URL(`/applications/${id}`, req.url), { status: 303 });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return generate(req, id);
}
