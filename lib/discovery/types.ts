export type DiscoverySourceId = "remotive" | "arbeitnow";

export type DiscoveredJob = {
  source: DiscoverySourceId;
  source_id: string;
  title: string;
  company: string | null;
  location: string | null;
  url: string;
  description: string | null;
  posted_at: string | null;
  metadata?: Record<string, unknown>;
};

export type DiscoveryContext = {
  titles: string[];
  keywords: string[];
  locations: string[];
  remote_only: boolean;
  posted_after: Date;
  max_results_per_source: number;
};

export type DiscoverySourceResult = {
  source: DiscoverySourceId;
  jobs: DiscoveredJob[];
  error?: string;
};

export type DiscoveryMatch = {
  job: DiscoveredJob;
  score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  evidence: Record<string, string[]>;
};

export type DiscoverySummary = {
  matches: DiscoveryMatch[];
  source_results: DiscoverySourceResult[];
  skipped_count: number;
};
