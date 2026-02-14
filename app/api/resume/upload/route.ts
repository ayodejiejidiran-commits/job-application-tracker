import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { deriveCriteriaFromResume } from "@/lib/discovery/resume/deriveCriteria";
import { parseLatestResumePdf } from "@/lib/discovery/resume/parseResumePdf";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

function wantsRedirect(contentType: string) {
  return contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded");
}

export async function POST(req: Request) {
  const sb = await supabaseServer();
  const {
    data: { user }
  } = await sb.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = req.headers.get("content-type") ?? "";
  const shouldRedirect = wantsRedirect(contentType);
  const fail = (message: string, status = 400) => {
    if (shouldRedirect) {
      const url = new URL(`/criteria?resume_error=${encodeURIComponent(message)}`, req.url);
      return NextResponse.redirect(url, { status: 303 });
    }
    return NextResponse.json({ error: message }, { status });
  };

  const form = await req.formData().catch(() => null);
  if (!form) return fail("Invalid form payload.");

  const entry = form.get("resume");
  if (!(entry instanceof File)) return fail("Missing resume file.");
  if (!entry.name.toLowerCase().endsWith(".pdf")) return fail("Please upload a PDF resume.");
  if (entry.size <= 0 || entry.size > MAX_FILE_SIZE_BYTES) return fail("Resume PDF must be between 1 byte and 8 MB.");

  const safeName = entry.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const tmpPath = path.join("/tmp", `resume-${user.id}-${Date.now()}-${safeName}`);

  try {
    const arrayBuffer = await entry.arrayBuffer();
    await fs.writeFile(tmpPath, Buffer.from(arrayBuffer));

    const parsed = await parseLatestResumePdf({
      manual_paths: [tmpPath],
      default_dir: "/tmp"
    });

    if (!parsed) return fail("Could not read text from this PDF. Please try another resume file.");

    const { error: resumeErr } = await sb.from("resume_versions").insert({
      user_id: user.id,
      label: "uploaded",
      resume_json: parsed.resume_json,
      pdf_path: entry.name
    });

    if (resumeErr) return fail(`Failed saving resume: ${resumeErr.message}`);

    const { data: existingCriteria } = await sb
      .from("job_criteria")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!existingCriteria) {
      const criteria = deriveCriteriaFromResume(parsed.resume_json, parsed.text);
      await sb.from("job_criteria").insert({
        user_id: user.id,
        ...criteria
      });
    }

    const { error: profileErr } = await sb.from("profiles").upsert(
      {
        user_id: user.id,
        years_experience: parsed.resume_json.yearsExp ?? 0,
        full_name: parsed.resume_json.name ?? null
      },
      { onConflict: "user_id" }
    );

    if (profileErr) return fail(`Resume saved, but profile update failed: ${profileErr.message}`);

    if (shouldRedirect) {
      const url = new URL("/criteria?resume_uploaded=1", req.url);
      return NextResponse.redirect(url, { status: 303 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Resume upload failed";
    return fail(message, 500);
  } finally {
    await fs.unlink(tmpPath).catch(() => undefined);
  }
}
