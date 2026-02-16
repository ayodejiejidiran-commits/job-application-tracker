import { NextResponse } from "next/server";
import { sanitizeWithReport } from "@/lib/sanitize";
import { RESUME_PRINT_CSS } from "@/lib/resumeCss";
import { modernCss, modernWrapper } from "@/app/templates/modern";
import { classicCss, classicWrapper } from "@/app/templates/classic";
import { minimalCss, minimalWrapper } from "@/app/templates/minimal";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const maxDuration = 30;


const LOCAL_CANDIDATES_DARWIN = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
];

const LOCAL_CANDIDATES_LINUX = [
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium"
];

function findLocalChromePath(): string | null {
  const env = process.env.LOCAL_CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (env && fs.existsSync(env)) return env;

  const candidates = process.platform === "darwin" ? LOCAL_CANDIDATES_DARWIN : LOCAL_CANDIDATES_LINUX;
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function buildMinimalPdf(text: string) {
  const safe = (text || "Resume").slice(0, 100).replace(/[()\\]/g, "\\$&");
  return `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >> endobj
4 0 obj << /Length 80 >> stream
BT /F1 12 Tf 72 720 Td (${safe}) Tj ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref 0 6
0000000000 65535 f
0000000010 00000 n
0000000060 00000 n
0000000115 00000 n
0000000240 00000 n
0000000400 00000 n
trailer << /Size 6 /Root 1 0 R >>
startxref
520
%%EOF`;
}

async function getBrowser() {
  try {
    const chromiumMod = (await import("@sparticuz/chromium-min")) as any;
    const chromium = chromiumMod.default ?? chromiumMod;
    const puppeteerCore = (await import("puppeteer-core")) as typeof import("puppeteer-core");

    const packUrl =
      process.env.CHROMIUM_PACK_URL ||
      (process.arch === "arm64"
        ? "https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.arm64.tar"
        : "https://github.com/Sparticuz/chromium/releases/download/v143.0.4/chromium-v143.0.4-pack.x64.tar");

    // ✅ MUST be a STRING (directory path OR remote pack tar URL)
    const executablePath = await chromium.executablePath(packUrl);

    if (!executablePath || !fs.existsSync(executablePath)) {
      return null; // caller will fallback to minimal PDF
    }

    // Ensure Chromium can find its bundled shared libraries.
    process.env.LD_LIBRARY_PATH = path.dirname(executablePath);

    const args = Array.isArray(chromium.args) ? chromium.args : [];
    return await puppeteerCore.launch({
      args: [...args, "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      defaultViewport: chromium.defaultViewport ?? undefined,
      executablePath,
      headless: chromium.headless ?? true
    });
  } catch (err) {
    console.error("getBrowser fallback (chromium-min/puppeteer-core)", err);
    return null;
  }
}


async function renderWithPdfShift(html: string): Promise<Buffer | null> {
  const apiKey = process.env.PDFSHIFT_API_KEY;
  if (!apiKey) return null;

  const auth = Buffer.from(`${apiKey}:`).toString("base64");
  try {
    const resp = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`
      },
      body: JSON.stringify({ source: html, use_print: true })
    });
    if (!resp.ok) {
      console.error("PDFShift failed", resp.status, await resp.text());
      return null;
    }
    const arr = await resp.arrayBuffer();
    return Buffer.from(arr);
  } catch (err) {
    console.error("PDFShift error", err);
    return null;
  }
}

export async function POST(req: Request) {
  const { html, css, template } = (await req.json().catch(() => ({}))) as {
    html?: string;
    css?: string;
    template?: string;
  };

  if (!html) return NextResponse.json({ error: "html is required" }, { status: 400 });

  const { clean: safe } = sanitizeWithReport(html);

  // Test / mock mode: return tiny deterministic PDF without launching Chromium
  if (process.env.AI_MOCK_MODE === "1" || process.env.E2E_AUTH_BYPASS === "1" || process.env.NODE_ENV === "test") {
    const minimalPdf = buildMinimalPdf(safe);
    return new NextResponse(minimalPdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=resume.pdf"
      }
    });
  }

  let browser: Awaited<ReturnType<typeof getBrowser>> = null;
  let wrapped = "";
  try {
    const tpl = template === "classic" ? classicWrapper : template === "minimal" ? minimalWrapper : modernWrapper;
    const tplCss = template === "classic" ? classicCss : template === "minimal" ? minimalCss : modernCss;

    wrapped = `<!doctype html><html><head><meta charset="utf-8"/><style>${RESUME_PRINT_CSS}${tplCss}${css ?? ""}</style></head><body>${tpl(safe)}</body></html>`;

    browser = await getBrowser();

    // If chromium not available in the environment, try external API fallback, then minimal.
    if (!browser) {
      const apiPdf = await renderWithPdfShift(wrapped || safe);
      if (apiPdf) {
        return new NextResponse(new Uint8Array(apiPdf), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": "attachment; filename=resume.pdf"
          }
        });
      }

      const minimalPdf = buildMinimalPdf("PDF generation fallback (no browser)");
      return new NextResponse(minimalPdf, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": "attachment; filename=resume.pdf"
        }
      });
    }

    const page = await browser.newPage();
    await page.setContent(wrapped, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0.6in", bottom: "0.6in", left: "0.6in", right: "0.6in" }
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=resume.pdf"
      }
    });
  } catch (err) {
    console.error("/api/pdf error", err);

    // External API fallback (PDFShift) if available
    const htmlForApi = wrapped || safe;
    const apiPdf = await renderWithPdfShift(htmlForApi);
    if (apiPdf) {
      return new NextResponse(new Uint8Array(apiPdf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": "attachment; filename=resume.pdf"
        }
      });
    }

    // graceful fallback: return minimal PDF so the user still gets a file instead of a 500
    const minimalPdf = buildMinimalPdf("PDF generation fallback");
    return new NextResponse(minimalPdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=resume.pdf"
      }
    });
  } finally {
    try {
      await browser?.close();
    } catch (closeErr) {
      console.error("browser close error", closeErr);
    }
  }
}
