import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";

const schema = z.object({
  goal_min: z.number().int().min(1).max(100),
  goal_max: z.number().int().min(1).max(100)
});

export async function POST(req: Request) {
  const sb = await supabaseServer();
  const {
    data: { user }
  } = await sb.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const parsed = schema.safeParse({
    goal_min: Number(form.get("goal_min") ?? 5),
    goal_max: Number(form.get("goal_max") ?? 10)
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid reminder settings" }, { status: 400 });
  }

  const goalMin = Math.min(parsed.data.goal_min, parsed.data.goal_max);
  const goalMax = Math.max(parsed.data.goal_min, parsed.data.goal_max);

  const { error } = await sb.from("reminder_settings").upsert({
    user_id: user.id,
    goal_min: goalMin,
    goal_max: goalMax
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.redirect(new URL("/dashboard", req.url), { status: 303 });
}
