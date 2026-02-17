"use client";

import { useMemo, useState } from "react";

type Job = {
  id: string;
  title: string;
  company?: string | null;
  location?: string | null;
  url?: string | null;
  description?: string | null;
  posted_at?: string | null;
};

type Props = {
  jobs: Job[];
  onSelect: (description: string, job?: Job) => void;
};

export function JobPicker({ jobs, onSelect }: Props) {
  const [selectedId, setSelectedId] = useState<string>("");

  const latest = useMemo(() => {
    if (!jobs.length) return null;
    return [...jobs].sort((a, b) => (b.posted_at ?? "").localeCompare(a.posted_at ?? ""))[0];
  }, [jobs]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    const job = jobs.find((j) => j.id === id);
    if (job?.description) onSelect(job.description, job);
  };

  const handleLatest = () => {
    if (latest?.description) {
      setSelectedId(latest.id);
      onSelect(latest.description, latest);
    }
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <label htmlFor="job-select">Select a tracked job</label>
      <select id="job-select" value={selectedId} onChange={(e) => handleSelect(e.target.value)}>
        <option value="">-- Choose --</option>
        {jobs.map((j) => (
          <option key={j.id} value={j.id}>
            {j.title} {j.company ? `· ${j.company}` : ""} {j.posted_at ? `· ${j.posted_at}` : ""}
          </option>
        ))}
      </select>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={handleLatest} disabled={!latest}>
          Use latest discovered job
        </button>
        {selectedId && jobs.find((j) => j.id === selectedId)?.url ? (
          <a
            className="primary-link"
            href={jobs.find((j) => j.id === selectedId)?.url ?? "#"}
            target="_blank"
            rel="noreferrer"
          >
            Open Job Posting
          </a>
        ) : null}
      </div>
    </div>
  );
}
