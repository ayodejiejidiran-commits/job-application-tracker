import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    { error: "PDF export removed. Use DOCX export instead." },
    { status: 410 }
  );
}
