import { NextResponse } from "next/server";
import { sanitizeWithReport } from "@/lib/sanitize";
import { RESUME_PRINT_CSS } from "@/lib/resumeCss";
import { modernCss, modernWrapper } from "@/app/templates/modern";
import { classicCss, classicWrapper } from "@/app/templates/classic";
import { minimalCss, minimalWrapper } from "@/app/templates/minimal";
import fs from "node:fs";

type ChromiumLike = {
  args: string[];
  headless?: boolean;
  defaultViewport?: { width: number; height: number } | null;
  executablePath: () => Promise<string>;
};

export const runtime = "nodejs";
export const maxDuration = 30;

async function getBrowser() {
  try {
    const chromiumMod = (await import("@sparticuz/chromium")) as unknown as { default?: ChromiumLike } & ChromiumLike;
    const chromium: ChromiumLike = chromiumMod.default ?? (chromiumMod as ChromiumLike);
    const puppeteerCore = (await import("puppeteer-core")) as typeof import("puppeteer-core");

    const isVercel = !!process.env.VERCEL;

    // IMPORTANT: Only honor CHROMIUM_PATH if it actually exists.
    const configuredPath = process.env.CHROMIUM_PATH;
    const configuredIsValid = !!configuredPath && fs.existsSync(configuredPath);

    // Local dev (Mac): use installed Chrome path so you don't fall back.
    const localChromePath = !isVercel ? findLocalChromePath() : null;

    // Vercel/prod: ask Sparticuz for the executable path.
    const chromiumPath = await chromium.executablePath();

    const executablePath = configuredIsValid
      ? configuredPath!
      : (localChromePath ?? chromiumPath);

    if (!executablePath || !fs.existsSync(executablePath)) {
      // No usable browser executable; signal caller to use minimal PDF fallback.
      return null;
    }

    // Use Vercel/serverless args only on Vercel. Local Chrome doesn't need them.
    const launchArgs = isVercel
      ? [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
      : [];

    return await puppeteerCore.launch({
      args: launchArgs,
      defaultViewport: isVercel ? (chromium.defaultViewport ?? undefined) : undefined,
      executablePath,
      headless: isVercel ? (chromium.headless ?? true) : true
    });
  } catch (err) {
    console.error("getBrowser fallback (chromium/puppeteer)", err);
    return null;
  }
}

function findLocalChromePath(): string | null {
  const env = process.env.LOCAL_CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
  if (env && fs.existsSync(env)) return env;

  // macOS common installs
  const candidates =
    process.platform === "darwin"
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Chromium.app/Contents/MacOS/Chromium",
          "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
          "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
        ]
      : [
          // Linux fallbacks
          "/usr/bin/google-chrome-stable",
          "/usr/bin/google-chrome",
          "/usr/bin/chromium-browser",
          "/usr/bin/chromium"
        ];

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

  let browser: any = null;
  try {
    const tpl = template === "classic" ? classicWrapper : template === "minimal" ? minimalWrapper : modernWrapper;
    const tplCss = template === "classic" ? classicCss : template === "minimal" ? minimalCss : modernCss;

    const wrapped = `<!doctype html><html><head><meta charset="utf-8"/><style>${RESUME_PRINT_CSS}${tplCss}${css ?? ""}</style></head><body>${tpl(safe)}</body></html>`;

    browser = await getBrowser();

    // If chromium not available in the environment, fall back to minimal PDF immediately.
    if (!browser) {
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
      if (browser) await browser.close();
    } catch {}
  }
}
