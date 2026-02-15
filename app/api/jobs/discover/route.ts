import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { runDiscoveryForUser } from "@/lib/discovery/runDiscoveryForUser";
import type { DiscoverySourceId } from "@/lib/discovery/types";

export const runtime = "nodejs";

const payloadSchema = z
  .object({
    sources: z.array(z.enum(["remotive", "arbeitnow", "usajobs", "serpapi"])).optional(),
    force: z.boolean().optional()
  })
  .default({});

export async function POST(req: Request) {
  const sb = await supabaseServer();
  const {
    data: { user }
  } = await sb.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = payloadSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid discover payload" }, { status: 400 });
  }

  const sources = (parsed.data.sources ?? undefined) as DiscoverySourceId[] | undefined;
  const force = parsed.data.force ?? false;

  try {
    const summary = await runDiscoveryForUser({
      admin: sb,
      user_id: user.id,
      source_override: sources,
      ignore_rate_limit: force
    });

    if (summary.rate_limited) {
      return NextResponse.json(
        {
          error: "Rate limited",
          next_allowed_at: summary.rate_limit_until,
          summary
        },
        { status: 429 }
      );
    }

    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Discovery failed";
    const status = message.includes("No resume profile found") ? 400 : 500;
    return NextResponse.json(
      {
        error: message
      },
      { status }
    );
  }
}
