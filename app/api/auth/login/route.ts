import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const formData = await req.formData();
  const email = (formData.get("email") ?? "").toString();
  const password = (formData.get("password") ?? "").toString();

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const url = new URL("/login", req.url);
    url.searchParams.set("error", error.message);
    return NextResponse.redirect(url);
  }

  const url = new URL("/dashboard", req.url);
  return NextResponse.redirect(url);
}
