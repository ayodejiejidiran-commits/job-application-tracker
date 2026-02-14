import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

const criteriaSchema = z.object({
  titles: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
  remote_only: z.boolean().default(false),
  min_years: z.number().int().min(0).default(0),
  max_years: z.number().int().min(0).default(50),
  include_keywords: z.array(z.string()).default([]),
  exclude_keywords: z.array(z.string()).default([])
});

function toArray(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export async function GET() {
  const sb = await supabaseServer();
  const {
    data: { user }
  } = await sb.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await sb
    .from("job_criteria")
    .select("id,titles,locations,remote_only,min_years,max_years,include_keywords,exclude_keywords,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ data: data ?? null });
}

export async function POST(req: Request) {
  const sb = await supabaseServer();
  const {
    data: { user }
  } = await sb.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = req.headers.get("content-type") ?? "";
  let payload: unknown;

  if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
    const form = await req.formData();
    payload = {
      titles: toArray(form.get("titles")),
      locations: toArray(form.get("locations")),
      remote_only: form.get("remote_only") === "on" || form.get("remote_only") === "true",
      min_years: Number(form.get("min_years") ?? 0),
      max_years: Number(form.get("max_years") ?? 50),
      include_keywords: toArray(form.get("include_keywords")),
      exclude_keywords: toArray(form.get("exclude_keywords"))
    };
  } else {
    payload = await req.json().catch(() => ({}));
  }

  const parsed = criteriaSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid criteria payload" }, { status: 400 });
  }

  const { error } = await sb.from("job_criteria").insert({
    user_id: user.id,
    ...parsed.data
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
    return NextResponse.redirect(new URL("/criteria", req.url), { status: 303 });
  }

  return NextResponse.json({ ok: true });
}
