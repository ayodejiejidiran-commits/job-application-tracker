"use client";

import { useState } from "react";

type Props = {
  onReplace: (text: string) => void;
  currentText: string;
  jobDescription: string;
  onJobDescriptionChange: (val: string) => void;
};

export function TailorResumePanel({ onReplace, currentText, jobDescription, onJobDescriptionChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  async function handleTailor() {
    setLoading(true);
    setError(null);
    setSuggestions([]);
    try {
      const resp = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: currentText, jobDescription })
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(t || `Tailor failed (${resp.status})`);
      }
      const json = (await resp.json()) as { tailoredResume?: string; suggestions?: string[] };
      if (json.tailoredResume) onReplace(json.tailoredResume);
      setSuggestions(json.suggestions ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Tailor failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <h2>Tailor to Job Description</h2>
      <p className="small">Optimizes for ATS keywords while keeping facts true.</p>
      <label htmlFor="job-description">Job description</label>
      <textarea
        id="job-description"
        rows={6}
        value={jobDescription}
        onChange={(e) => onJobDescriptionChange(e.target.value)}
        placeholder="Paste the job description"
        style={{ width: "100%", marginBottom: 8 }}
      />
      <button type="button" onClick={handleTailor} disabled={loading || !jobDescription.trim()}>
        {loading ? "Tailoring..." : "Tailor Resume"}
      </button>
      {error ? <p className="error-line">{error}</p> : null}
      {suggestions.length ? (
        <div style={{ marginTop: 8 }}>
          <p className="small">Suggestions</p>
          <ul>
            {suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
