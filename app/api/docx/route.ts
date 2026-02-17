import { NextResponse } from "next/server";
<<<<<<< HEAD
import { Buffer } from "node:buffer";
=======
import { sanitizeWithReport } from "@/lib/sanitize";
import htmlToDocx from "html-to-docx";
>>>>>>> 8ed19a7 (Move export to DOCX; remove PDF route)

export const runtime = "nodejs";
export const maxDuration = 30;

<<<<<<< HEAD
type HtmlToDocxFn = (html: string) => Promise<unknown> | unknown;

function isFunction(x: unknown): x is (...args: unknown[]) => unknown {
  return typeof x === "function";
}

function toBuffer(x: unknown): Buffer {
  if (Buffer.isBuffer(x)) return x;
  if (x instanceof ArrayBuffer) return Buffer.from(x);
  if (ArrayBuffer.isView(x)) return Buffer.from(x.buffer);
  throw new Error("DOCX generator returned unsupported type");
}

export async function POST(req: Request) {
  const { html, filename } = (await req.json().catch(() => ({}))) as {
    html?: string;
    filename?: string;
  };

  if (!html) return NextResponse.json({ error: "html is required" }, { status: 400 });

  const mod = (await import("html-to-docx")) as unknown;
  const maybeDefault =
    (mod as { default?: unknown }).default ?? mod;

  if (!isFunction(maybeDefault)) {
    return NextResponse.json({ error: "html-to-docx import is not a function" }, { status: 500 });
  }

  const htmlToDocx = maybeDefault as HtmlToDocxFn;
  const result = await htmlToDocx(html);
  const docxBuffer = toBuffer(result);

  const outName = (filename || "resume").replace(/[^a-z0-9._-]/gi, "_") + ".docx";

  return new NextResponse(new Uint8Array(docxBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${outName}"`
    }
  });
}
=======
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

>>>>>>> 8ed19a7 (Move export to DOCX; remove PDF route)
