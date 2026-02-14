import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runDiscoveryForUser } from "@/lib/discovery/runDiscoveryForUser";

export const runtime = "nodejs";

function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { data: usersPage, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  const users = usersPage.users ?? [];
  const details: Array<{ user_id: string; inserted_count: number; skipped_count: number; error?: string }> = [];

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const user of users) {
    try {
      const result = await runDiscoveryForUser({
        admin,
        user_id: user.id,
        ignore_rate_limit: false
      });

      totalInserted += result.inserted_count;
      totalSkipped += result.skipped_count;

      details.push({
        user_id: user.id,
        inserted_count: result.inserted_count,
        skipped_count: result.skipped_count,
        error: result.source_errors.join(" | ") || undefined
      });
    } catch (error) {
      details.push({
        user_id: user.id,
        inserted_count: 0,
        skipped_count: 0,
        error: error instanceof Error ? error.message : "Unknown discovery error"
      });
    }
  }

  return NextResponse.json({
    ok: true,
    users: users.length,
    total_inserted: totalInserted,
    total_skipped: totalSkipped,
    details
  });
}
