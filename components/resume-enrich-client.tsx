"use client";

import { useMemo, useState } from "react";

type ResumeOption = {
  id: string;
  label?: string | null;
  created_at?: string | null;
};

type DraftResponse = {
  note?: string;
  mergedText?: string;
  jobDescription?: string;
  [key: string]: unknown;
};

export function ResumeEnrichClient({ resumes }: { resumes: ResumeOption[] }) {
  const [resumeId, setResumeId] = useState(resumes[0]?.id ?? "");
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftResponse | null>(null);
  const [edited, setEdited] = useState<string>("");

  const labelMap = useMemo(
    () => Object.fromEntries(resumes.map((r) => [r.id, r.label ?? "Resume"])),
    [resumes]
  );

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setDraft(null);
    try {
      const fd = new FormData();
      fd.append("resume_version_id", resumeId);
      fd.append("job_description", jobDescription);
      const resp = await fetch("/api/resume/enrich", {
        method: "POST",
        body: fd
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(t || `Request failed (${resp.status})`);
      }
      const json = (await resp.json()) as { draft?: DraftResponse };
      const d = json.draft ?? null;
      setDraft(d);
      setEdited(d?.mergedText ?? "");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    const blob = new Blob([edited || ""], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${labelMap[resumeId] ?? "resume"}-enriched.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <h2>Enrich with Job Keywords</h2>
      <p className="small">
        Paste a job description. We call the AI provider (RxResume) to weave in matched keywords without exaggeration. You can edit the
        output before exporting.
      </p>

      <form onSubmit={handleGenerate} style={{ display: "grid", gap: 10 }}>
        <label htmlFor="resume_version_id">Pick resume version</label>
        <select
          id="resume_version_id"
          value={resumeId}
          onChange={(e) => setResumeId(e.target.value)}
          required
        >
          <option value="">Select...</option>
          {resumes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label ?? "Resume"} — {r.created_at ? new Date(r.created_at).toLocaleString() : ""}
            </option>
          ))}
        </select>

        <label htmlFor="job_description">Job description</label>
        <textarea
          id="job_description"
          name="job_description"
          rows={8}
          required
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste the JD here"
        />

        <button type="submit" className="auth-button" disabled={loading || !resumeId}>
          {loading ? "Working..." : "Generate draft with keywords"}
        </button>
      </form>

      {error ? <p className="error-line">{error}</p> : null}

      {draft ? (
        <div style={{ marginTop: 14 }}>
          {draft.note ? <p className="small">{draft.note}</p> : null}
          <label htmlFor="edited">Editable draft</label>
          <textarea
            id="edited"
            rows={10}
            value={edited}
            onChange={(e) => setEdited(e.target.value)}
            style={{ width: "100%" }}
          />
          <div className="card-actions" style={{ marginTop: 8 }}>
            <button type="button" onClick={handleDownload}>
              Download TXT
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
