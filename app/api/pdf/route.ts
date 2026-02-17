import { NextResponse } from "next/server";

export const runtime = "nodejs";
<<<<<<< HEAD

export async function POST() {
  return NextResponse.json(
    { error: "PDF export removed. Use DOCX export instead." },
    { status: 410 }
  );
}
=======
export const maxDuration = 30;

const PACK_VERSION = "v141.0.0";
const PACK_X64 = `https://github.com/Sparticuz/chromium/releases/download/${PACK_VERSION}/chromium-${PACK_VERSION}-pack.x64.tar`;
const PACK_ARM64 = `https://github.com/Sparticuz/chromium/releases/download/${PACK_VERSION}/chromium-${PACK_VERSION}-pack.arm64.tar`;

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
  const isVercel = !!process.env.VERCEL || process.env.NODE_ENV === "production";
  try {
    // chromium-min typings do not expose executablePath in the type, so we treat as unknown and assert shape at runtime.
    const chromiumMod = (await import("@sparticuz/chromium-min")) as unknown as {
      default?: {
        executablePath: (opts: { downloadUrl: string; arch: string; packVersion: string }) => Promise<string>;
        args?: string[];
        headless?: boolean;
        defaultViewport?: { width: number; height: number } | null;
      };
      executablePath?: (opts: { downloadUrl: string; arch: string; packVersion: string }) => Promise<string>;
      args?: string[];
      headless?: boolean;
      defaultViewport?: { width: number; height: number } | null;
    };

    const chromium = (chromiumMod.default ?? chromiumMod) as {
      executablePath: (opts: { downloadUrl: string; arch: string; packVersion: string }) => Promise<string>;
      args?: string[];
      headless?: boolean;
      defaultViewport?: { width: number; height: number } | null;
    };
    const puppeteerCore = (await import("puppeteer-core")) as typeof import("puppeteer-core");

    const packUrl = process.env.CHROMIUM_PACK_URL || (process.arch === "arm64" ? PACK_ARM64 : PACK_X64);

    // We do NOT trust CHROMIUM_PATH unless it exists.
    const configuredPath = process.env.CHROMIUM_PATH;
    const configuredValid = configuredPath && fs.existsSync(configuredPath);
    const localChromePath = !isVercel ? findLocalChromePath() : null;

    let executablePath: string | null = null;

    if (configuredValid) {
      executablePath = configuredPath!;
    } else if (localChromePath) {
      executablePath = localChromePath;
    } else {
      executablePath = await chromium.executablePath({
        downloadUrl: packUrl,
        arch: process.arch,
        packVersion: PACK_VERSION.replace("v", "")
      });
    }

    if (!executablePath) {
      console.error("getBrowser: no executable path found", { configuredPath, executablePath, packUrl });
      return null;
    }

    // Ensure shared libs are discoverable for chromium-min. Do not require fs.existsSync here; some envs mount paths virtually.
    const execDir = path.dirname(executablePath);
    process.env.LD_LIBRARY_PATH = [execDir, process.env.LD_LIBRARY_PATH].filter(Boolean).join(":");

    const launchArgs = isVercel
      ? [...(chromium.args ?? []), "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
      : [];

    try {
      return await puppeteerCore.launch({
        args: launchArgs,
        defaultViewport: chromium.defaultViewport ?? undefined,
        executablePath,
        headless: chromium.headless ?? true
      });
    } catch (launchErr) {
      console.error("getBrowser launch failed", launchErr);
      return null;
    }
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

    // External API fallback (PDFShift) if available
    const htmlForApi = wrapped ?? safe;
    const apiPdf = await renderWithPdfShift(htmlForApi);
    if (apiPdf) {
      return new NextResponse(apiPdf, {
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
>>>>>>> 8ed19a7 (Move export to DOCX; remove PDF route)
