import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

async function callRxResume(jobDescription: string, resumeText: string) {
  const apiKey = process.env.RXRESUME_API_KEY;
  const url = "https://rxresu.me/api/openapi/ai/test-ai-provider-connection";
  if (!apiKey) return null;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ jobDescription, resume: resumeText })
  });

  if (!resp.ok) {
    console.warn("rxresume error", await resp.text());
    return null;
  }
  return resp.json();
}

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const form = await req.formData();
  const resumeVersionId = form.get("resume_version_id") as string;
  const jobDescription = (form.get("job_description") ?? "").toString();
  if (!resumeVersionId || !jobDescription) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const { data: resumeRow, error } = await supabase
    .from("resume_versions")
    .select("id,resume_json")
    .eq("user_id", user.id)
    .eq("id", resumeVersionId)
    .single();
  if (error || !resumeRow) return NextResponse.json({ error: "Resume not found" }, { status: 404 });

  const resumeJson = (resumeRow.resume_json as Record<string, unknown> | null) ?? {};
  const resumeText =
    typeof resumeJson.raw_text === "string" && resumeJson.raw_text.length > 0
      ? resumeJson.raw_text
      : JSON.stringify(resumeJson);

  const ai = await callRxResume(jobDescription, resumeText);

  const draft = ai ?? {
    note: "AI provider disabled; returning original resume text. Set RXRESUME_API_KEY to enable enrichment.",
    mergedText: resumeText,
    jobDescription
  };

  return NextResponse.json({ ok: true, draft });
}
