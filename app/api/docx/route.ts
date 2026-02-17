import { NextResponse } from "next/server";
import { sanitizeWithReport } from "@/lib/sanitize";
import htmlToDocx from "html-to-docx";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const { html, filename } = (await req.json().catch(() => ({}))) as { html?: string; filename?: string };
  if (!html) return NextResponse.json({ error: "html is required" }, { status: 400 });

  const { clean } = sanitizeWithReport(html);

  try {
    const buffer = await htmlToDocx(clean, undefined, {
      table: { row: { cantSplit: true } },
      footer: false,
      pageNumber: false
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename || "resume"}.docx"`
      }
    });
  } catch (err) {
    console.error("/api/docx error", err);
    // Minimal fallback: return an empty docx buffer
    const empty = await htmlToDocx("<p>Resume</p>");
    return new NextResponse(new Uint8Array(empty), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename || "resume"}.docx"`
      }
    });
  }
}

