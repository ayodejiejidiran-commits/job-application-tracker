"use client";

import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export type Filters = {
  q: string;
  status: string;
  source: string;
  minScore: string;
  locationType: string;
  city: string;
  usOnly: string;
  recent: string;
};

export function JobFilters({ initialFilters }: { initialFilters: Filters }) {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const router = useRouter();
  const pathname = usePathname();

  const set = (key: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFilters((prev) => ({ ...prev, [key]: e.target.value }));

  const apply = () => {
    const params = new URLSearchParams();
    params.set("view", "board");
    params.set("q", filters.q);
    params.set("status", filters.status);
    params.set("source", filters.source);
    params.set("minScore", filters.minScore);
    params.set("locationType", filters.locationType);
    params.set("city", filters.city);
    params.set("usOnly", filters.usOnly);
    params.set("recent", filters.recent);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="space-y-3 overflow-auto pb-3">
      <div className="form-row">
        <label>Search</label>
        <input name="q" placeholder="Search title/company" value={filters.q} onChange={set("q")} />
      </div>
      <div className="form-row">
        <label>Status</label>
        <select name="status" value={filters.status} onChange={set("status")}>
          <option value="ALL">All</option>
          <option value="DRAFT">Draft</option>
          <option value="READY_TO_REVIEW">Ready</option>
          <option value="APPLIED">Applied</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>
      <div className="form-row">
        <label>Source</label>
        <select name="source" value={filters.source} onChange={set("source")}>
          <option value="ALL">All</option>
          <option value="linkedin">LinkedIn</option>
          <option value="indeed">Indeed</option>
          <option value="glassdoor">Glassdoor</option>
          <option value="remotive">Remotive</option>
          <option value="arbeitnow">Arbeitnow</option>
          <option value="usajobs">USAJobs</option>
          <option value="serpapi">SerpApi</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="form-row">
        <label>Min score</label>
        <input type="number" min={0} max={100} name="minScore" value={filters.minScore} onChange={set("minScore")} />
      </div>
      <div className="form-row">
        <label>Job type</label>
        <select name="locationType" value={filters.locationType} onChange={set("locationType")}>
          <option value="ALL">All</option>
          <option value="REMOTE">Remote</option>
          <option value="CITY">City/Hybrid</option>
        </select>
      </div>
      <div className="form-row">
        <label>City</label>
        <input name="city" placeholder="e.g. Austin" value={filters.city} onChange={set("city")} />
      </div>
      <div className="form-row">
        <label>United States only</label>
        <select name="usOnly" value={filters.usOnly} onChange={set("usOnly")}>
          <option value="true">Yes</option>
          <option value="false">All</option>
        </select>
      </div>
      <div className="form-row">
        <label>Recency</label>
        <select name="recent" value={filters.recent} onChange={set("recent")}>
          <option value="true">Last 14 days</option>
          <option value="false">All time</option>
        </select>
      </div>
      <div style={{ paddingTop: 4 }}>
        <button type="button" className="button" onClick={apply}>
          Apply Filters
        </button>
      </div>
    </div>
  );
}
