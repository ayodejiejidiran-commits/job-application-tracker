"use client";

import { useEffect, useMemo, useState } from "react";
import { TailorResumePanel } from "@/components/TailorResumePanel";
import { RESUME_PRINT_CSS } from "@/lib/resumeCss";
import { JobPicker } from "@/components/JobPicker";
import { ResumeUnifiedEditor } from "@/components/ResumeUnifiedEditor";

interface Props {
  initialHtml?: string;
  jobs?: Array<{ id: string; title: string; company?: string | null; location?: string | null; url?: string | null; description?: string | null; posted_at?: string | null }>;
}

export function ResumeBuilderClient({ initialHtml, jobs = [] }: Props) {
  const [html, setHtml] = useState<string>(initialHtml || "");
  const [status, setStatus] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [template, setTemplate] = useState<"modern" | "classic" | "minimal">("modern");
  const [jobDescription, setJobDescription] = useState<string>("");
  const [lastExportAt, setLastExportAt] = useState<string | null>(null);
  const [showCss, setShowCss] = useState<boolean>(false);

  useEffect(() => {
    if (initialHtml) setHtml(initialHtml);
  }, [initialHtml]);

  const handleImprove = async (selected: string, replace: (text: string) => void) => {
    if (!selected.trim()) {
      setStatus("Highlight text to improve.");
      return;
    }
    try {
      const resp = await fetch("/api/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selected })
      });
      if (!resp.ok) throw new Error(await resp.text());
      const json = (await resp.json()) as { improved?: string };
      if (json.improved) replace(json.improved);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Improve failed");
    }
  };

  async function handlePdf() {
    setStatus(null);
    setDownloading(true);
    try {
      const resp = await fetch("/api/docx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, template })
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(t || `PDF failed (${resp.status})`);
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "resume.docx";
      a.click();
      URL.revokeObjectURL(url);
      setStatus("PDF downloaded");
      setLastExportAt(new Date().toLocaleString());
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : "PDF failed");
    } finally {
      setDownloading(false);
    }
  }

  const warningTooLong = html.length > 8000;
  const exportDisabled = !html.trim();
  const placeholderHtml = useMemo(() => "<p>Paste or upload your resume to start editing.</p>", []);

  return (
    <div>
      <div className="card" style={{ marginBottom: 12 }}>
        <ResumeUnifiedEditor
          initialContent={html || placeholderHtml}
          onChange={(val) => setHtml(val)}
          onImprove={handleImprove}
        />
      </div>

      <JobPicker
        jobs={jobs}
        onSelect={(desc) => {
          setJobDescription(desc);
        }}
      />

      <TailorResumePanel
        currentText={html}
        jobDescription={jobDescription}
        onJobDescriptionChange={setJobDescription}
        onReplace={(text) => {
          setHtml(text);
        }}
      />

      <div className="card" style={{ marginBottom: 18 }}>
        <h2>Export</h2>
        <p className="small">Exports the current editor content with the ATS-friendly CSS template.</p>
        <label htmlFor="template">Template</label>
        <select
          id="template"
          value={template}
          onChange={(e) => setTemplate(e.target.value as "modern" | "classic" | "minimal")}
          style={{ marginBottom: 8 }}
        >
          <option value="modern">Modern</option>
          <option value="classic">Classic</option>
          <option value="minimal">Minimal</option>
        </select>
        <button type="button" onClick={handlePdf} disabled={downloading || exportDisabled} aria-label="Export Word (.docx)">
          {downloading ? "Generating..." : "Export Word (.docx)"}
        </button>
        {warningTooLong ? <p className="error-line">Export would exceed 1 page. Trim content.</p> : null}
        {status ? <p className="small">{status}</p> : null}
        {lastExportAt ? <p className="small">Last export: {lastExportAt}</p> : null}
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <h2 style={{ margin: 0 }}>Template CSS (ATS-friendly)</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => setShowCss((v) => !v)} aria-expanded={showCss} aria-controls="template-css" aria-label="Toggle template CSS">
              {showCss ? "Hide" : "Show"}
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(RESUME_PRINT_CSS);
                  setStatus("CSS copied");
                } catch {
                  setStatus("Copy failed");
                }
              }}
            >
              Copy CSS
            </button>
          </div>
        </div>
        {showCss ? (
          <pre
            id="template-css"
            style={{ whiteSpace: "pre-wrap", background: "#0f172a", color: "#e5e7eb", padding: 12, borderRadius: 8, overflowX: "auto" }}
          >
            {RESUME_PRINT_CSS}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
