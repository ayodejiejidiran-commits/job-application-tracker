import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import parsePdf from "pdf-parse";
import { splitResumeIntoSections } from "@/lib/resumeParser";
import { textToHtml } from "@/lib/textToHtml";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user && process.env.E2E_AUTH_BYPASS !== "1") return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const label = (form.get("label") ?? "uploaded") as string;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const arrayBuf = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
  const parsed = await parsePdf(buffer);
  const text = parsed.text ?? "";

  const resumeJson = {
    raw_text: text,
    sections: splitResumeIntoSections(text),
    resume_html: textToHtml(text)
  };

  if (user) {
    const { error } = await supabase.from("resume_versions").insert({
      user_id: user.id,
      label,
      resume_json: resumeJson
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("application/json") || req.headers.get("x-requested-with") === "fetch") {
    return NextResponse.json({ ok: true, rawText: text, html: textToHtml(text) });
  }
  // Fallback for plain form submit: 303 ensures GET /resume
  return NextResponse.redirect(new URL("/resume", req.url), { status: 303 });
}
