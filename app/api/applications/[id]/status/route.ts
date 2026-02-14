import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/status";

const bodySchema = z.object({
  status: z.enum(APPLICATION_STATUSES)
});

async function parseStatus(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    return bodySchema.safeParse({ status: form.get("status") });
  }

  const json = await req.json().catch(() => ({}));
  return bodySchema.safeParse(json);
}

async function updateStatus(req: Request, id: string) {
  const parsed = await parseStatus(req);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const sb = await supabaseServer();
  const {
    data: { user }
  } = await sb.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nextStatus = parsed.data.status as ApplicationStatus;

  const { error } = await sb
    .from("applications")
    .update({
      status: nextStatus,
      applied_at: nextStatus === "APPLIED" ? new Date().toISOString() : null
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (req.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) {
    return NextResponse.redirect(new URL(`/applications/${id}`, req.url), { status: 303 });
  }

  return NextResponse.json({ ok: true, status: nextStatus });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return updateStatus(req, id);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return updateStatus(req, id);
}
