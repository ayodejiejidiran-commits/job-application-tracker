import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const admin = supabaseAdmin();
  const { data: usersPage, error: usersError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  const users = usersPage.users ?? [];
  if (!users.length) {
    return NextResponse.json({ ok: true, users: 0 });
  }

  const notificationRows = users.map((u) => ({
    user_id: u.id,
    title: "Weekly job goal",
    body: "Apply to 5-10 jobs today. Review drafts marked READY_TO_REVIEW before submitting."
  }));

  const { error: insertError } = await admin.from("notifications").insert(notificationRows);
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  await admin
    .from("reminder_settings")
    .upsert(users.map((u) => ({ user_id: u.id, last_reminded_at: new Date().toISOString() })));

  return NextResponse.json({ ok: true, users: users.length });
}
