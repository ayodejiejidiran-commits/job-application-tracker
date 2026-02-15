"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DiscoverResponse = {
  ok?: boolean;
  error?: string;
  next_allowed_at?: string;
  summary?: {
    fetched_count?: number;
    inserted_count: number;
    reactivated_count?: number;
    skipped_count: number;
    source_errors: string[];
  };
};

export function FindJobsButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [needsResume, setNeedsResume] = useState(false);

  async function runDiscovery() {
    setLoading(true);
    setStatus("Running discovery...");
    setNeedsResume(false);

    try {
      const response = await fetch("/api/jobs/discover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ force: true })
      });

      const payload = (await response.json().catch(() => ({}))) as DiscoverResponse;

      if (!response.ok) {
        if (response.status === 429) {
          setStatus(`Rate limited. Try again after ${payload.next_allowed_at ?? "later"}.`);
        } else if (response.status === 400 && (payload.error ?? "").includes("No resume profile found")) {
          setStatus("Resume profile missing. Upload your PDF on Job Criteria, then run Find Jobs again.");
          setNeedsResume(true);
        } else {
          setStatus(payload.error ?? "Discovery failed.");
        }
        setLoading(false);
        return;
      }

      const fetched = payload.summary?.fetched_count ?? 0;
      const inserted = payload.summary?.inserted_count ?? 0;
      const reactivated = payload.summary?.reactivated_count ?? 0;
      const skipped = payload.summary?.skipped_count ?? 0;
      const errors = payload.summary?.source_errors?.length ? ` Source errors: ${payload.summary.source_errors.join(" | ")}` : "";

      setStatus(`Discovery done. Fetched ${fetched}, inserted ${inserted}, reactivated ${reactivated}, skipped ${skipped}.${errors}`);
      router.refresh();
    } catch {
      setStatus("Discovery failed due to a network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="discover-inline">
      <button type="button" className="add-btn" onClick={runDiscovery} disabled={loading}>
        {loading ? "Finding..." : "Find Jobs"}
      </button>
      {status ? <p className="small" style={{ marginTop: 6 }}>{status}</p> : null}
      {needsResume ? <a className="small" href="/criteria">Go to Job Criteria</a> : null}
    </div>
  );
}
