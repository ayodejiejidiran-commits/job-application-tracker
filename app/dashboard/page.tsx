import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { FindJobsButton } from "@/app/dashboard/find-jobs-button";
import { RefreshListingsButton } from "@/app/dashboard/refresh-listings-button";
import { isLikelyEnglishJob, isRemoteLocation, isUnitedStatesJob } from "@/lib/discovery/usFilters";

type RawJob = {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  source: string;
  url: string;
  posted_at: string | null;
  description: string | null;
};

type RawApplication = {
  id: string;
  status: "DRAFT" | "READY_TO_REVIEW" | "APPLIED" | "ARCHIVED" | string;
  updated_at: string;
  jobs: RawJob | RawJob[] | null;
};

type ApplicationRow = {
  id: string;
  status: "DRAFT" | "READY_TO_REVIEW" | "APPLIED" | "ARCHIVED" | string;
  updated_at: string;
  job: RawJob | null;
};

type MatchRow = {
  job_id: string;
  score: number;
};

type ReminderRow = {
  goal_min: number;
  goal_max: number;
} | null;

type NotificationRow = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

const COLUMNS: Array<{
  key: "DRAFT" | "READY_TO_REVIEW" | "APPLIED" | "ARCHIVED";
  label: string;
}> = [
  { key: "DRAFT", label: "Draft" },
  { key: "READY_TO_REVIEW", label: "Ready to Review" },
  { key: "APPLIED", label: "Applied" },
  { key: "ARCHIVED", label: "Archived" }
];

function normalizeJob(job: RawApplication["jobs"]): RawJob | null {
  if (!job) return null;
  return Array.isArray(job) ? job[0] ?? null : job;
}

function normalizeApplications(rows: RawApplication[] | null): ApplicationRow[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    status: row.status,
    updated_at: row.updated_at,
    job: normalizeJob(row.jobs)
  }));
}

function formatDate(iso: string) {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric"
  }).format(dt);
}

function startOfWeekIso() {
  const now = new Date();
  const copy = new Date(now);
  const day = copy.getDay();
  const mondayOffset = day === 0 ? 6 : day - 1;
  copy.setDate(copy.getDate() - mondayOffset);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString();
}

function recentCutoffIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};

  const paramValue = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const view = paramValue("view") === "table" ? "table" : "board";
  const statusParam = paramValue("status");
  const sourceParam = paramValue("source");
  const minScoreParam = paramValue("minScore");
  const queryParam = paramValue("q");
  const recentParam = paramValue("recent");
  const locationTypeParam = paramValue("locationType");
  const cityParam = paramValue("city");
  const usOnlyParam = paramValue("usOnly");

  const statusFilter = statusParam && statusParam !== "ALL" ? statusParam : "ALL";
  const sourceFilter = sourceParam && sourceParam !== "ALL" ? sourceParam : "ALL";
  const minScore = Number(minScoreParam ?? "0");
  const search = (queryParam ?? "").toLowerCase().trim();
  const recentOnly = recentParam !== "false";
  const locationType =
    locationTypeParam === "REMOTE" || locationTypeParam === "CITY" ? locationTypeParam : "ALL";
  const cityFilter = (cityParam ?? "").toLowerCase().trim();
  const usOnly = usOnlyParam !== "false";

  const sb = await supabaseServer();
  const {
    data: { user }
  } = await sb.auth.getUser();

  if (!user) redirect("/login");

  const weekStart = startOfWeekIso();

  const [
    { data: apps },
    { data: reminder },
    { count: appliedThisWeek },
    { count: createdThisWeek },
    { data: notifications },
    { data: criteria }
  ] = await Promise.all([
    sb
      .from("applications")
      .select("id,status,updated_at,jobs(id,title,company,location,source,url,posted_at,description)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    sb.from("reminder_settings").select("goal_min,goal_max").eq("user_id", user.id).maybeSingle(),
    sb
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "APPLIED")
      .gte("applied_at", weekStart),
    sb
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", weekStart),
    sb
      .from("notifications")
      .select("id,title,body,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3),
    sb
      .from("job_criteria")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const rows = normalizeApplications((apps ?? null) as unknown as RawApplication[] | null);
  const jobIds = rows.map((r) => r.job?.id).filter((id): id is string => Boolean(id));

  let matchMap = new Map<string, number>();
  if (jobIds.length) {
    const { data: matches } = await sb
      .from("job_matches")
      .select("job_id,score")
      .eq("user_id", user.id)
      .in("job_id", jobIds);

    matchMap = new Map(((matches ?? []) as unknown as MatchRow[]).map((m) => [m.job_id, m.score]));
  }

  const recentCutoff = recentCutoffIso(14);

  const filteredRows = rows.filter((row) => {
    const job = row.job;
    if (!job) return false;

    const score = matchMap.get(job.id) ?? 0;
    const remote = isRemoteLocation({
      title: job.title,
      location: job.location,
      description: job.description
    });
    const usJob = isUnitedStatesJob({
      title: job.title,
      location: job.location,
      description: job.description
    });
    const englishJob = isLikelyEnglishJob({
      title: job.title,
      location: job.location,
      description: job.description
    });

    if (statusFilter !== "ALL" && row.status !== statusFilter) return false;
    if (sourceFilter !== "ALL" && job.source !== sourceFilter) return false;
    if (score < minScore) return false;
    if (!englishJob) return false;
    if (usOnly && !usJob) return false;
    if (locationType === "REMOTE" && !remote) return false;
    if (locationType === "CITY" && remote) return false;
    if (cityFilter && !(job.location ?? "").toLowerCase().includes(cityFilter)) return false;
    if (recentOnly) {
      const posted = job.posted_at;
      if (!posted) return false;
      if (posted < recentCutoff.slice(0, 10)) return false;
      if (row.updated_at < recentCutoff) {
        return false;
      }
    }

    if (search) {
      const hay = `${job.title} ${job.company ?? ""} ${job.location ?? ""}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }

    return true;
  });

  const grouped = new Map<string, ApplicationRow[]>();
  for (const col of COLUMNS) grouped.set(col.key, []);
  for (const row of filteredRows) {
    if (!grouped.has(row.status)) grouped.set(row.status, []);
    grouped.get(row.status)?.push(row);
  }

  const reminderSettings = (reminder ?? { goal_min: 5, goal_max: 10 }) as ReminderRow;
  const typedNotifications = (notifications ?? null) as unknown as NotificationRow[] | null;
  const goalMin = reminderSettings?.goal_min ?? 5;
  const goalMax = reminderSettings?.goal_max ?? 10;
  const appliedCount = appliedThisWeek ?? 0;
  const createdCount = createdThisWeek ?? 0;
  const progressPct = Math.min(100, Math.round((appliedCount / Math.max(1, goalMin)) * 100));

  return (
    <main className="job-shell">
      <aside className="job-sidebar">
        <div className="job-brand">JT</div>
        <div className="nav-dot active" />
        <div className="nav-dot" />
        <div className="nav-dot" />
        <div className="nav-dot" />
      </aside>

      <section className="job-content">
        <header className="job-topbar">
          <nav className="job-tabs">
            <Link className={`tab ${view === "board" ? "active" : ""}`} href="/dashboard?view=board">
              Application Board
            </Link>
            <Link className={`tab ${view === "table" ? "active" : ""}`} href="/dashboard?view=table">
              Table View
            </Link>
            <Link className={`tab ${criteria ? "active" : ""}`} href="/criteria">
              Job Criteria
            </Link>
          </nav>
          <div className="top-actions">
            <FindJobsButton />
            <RefreshListingsButton />
            <Link className="add-btn" href="/jobs/new">
              + Add Job
            </Link>
            <form action="/api/auth/logout" method="post">
              <button className="logout-btn" type="submit">
                Sign Out
              </button>
            </form>
          </div>
        </header>

        <section className="metrics-row">
          <article className="metric-card">
            <p className="metric-label">Weekly Goal</p>
            <h3>
              {appliedCount} / {goalMin}-{goalMax} applied
            </h3>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="small">{createdCount} jobs added this week</p>
          </article>

          <article className="metric-card">
            <p className="metric-label">Reminder Settings</p>
            <form action="/api/reminder-settings" method="post" className="goal-form">
              <label>
                Min
                <input type="number" name="goal_min" min={1} max={100} defaultValue={goalMin} />
              </label>
              <label>
                Max
                <input type="number" name="goal_max" min={1} max={100} defaultValue={goalMax} />
              </label>
              <button type="submit">Save</button>
            </form>
          </article>

          <article className="metric-card">
            <p className="metric-label">Latest Reminder</p>
            {typedNotifications?.length ? (
              <>
                <strong>{typedNotifications[0].title}</strong>
                <p className="small">{typedNotifications[0].body}</p>
              </>
            ) : (
              <p className="small">No reminder yet. Monday cron will create one automatically.</p>
            )}
          </article>
        </section>

        <form method="get" className="filter-row">
          <input type="hidden" name="view" value={view} />
          <input name="q" placeholder="Search title/company/location" defaultValue={queryParam ?? ""} />
          <select name="status" defaultValue={statusFilter}>
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="READY_TO_REVIEW">Ready to Review</option>
            <option value="APPLIED">Applied</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <select name="source" defaultValue={sourceFilter}>
            <option value="ALL">All Sources</option>
            <option value="linkedin">LinkedIn</option>
            <option value="indeed">Indeed</option>
            <option value="glassdoor">Glassdoor</option>
            <option value="remotive">Remotive</option>
            <option value="arbeitnow">Arbeitnow</option>
            <option value="usajobs">USAJobs</option>
            <option value="other">Other</option>
          </select>
          <input type="number" name="minScore" min={0} max={100} defaultValue={String(minScore)} placeholder="Min score" />
          <select name="locationType" defaultValue={locationType}>
            <option value="ALL">All Job Types</option>
            <option value="REMOTE">Remote Only</option>
            <option value="CITY">City (On-site/Hybrid)</option>
          </select>
          <input name="city" placeholder="City (e.g., Austin)" defaultValue={cityParam ?? ""} />
          <select name="usOnly" defaultValue={usOnly ? "true" : "false"}>
            <option value="true">United States only</option>
            <option value="false">Any country</option>
          </select>
          <select name="recent" defaultValue={recentOnly ? "true" : "false"}>
            <option value="true">Last 14 days</option>
            <option value="false">All time</option>
          </select>
          <button type="submit">Apply Filters</button>
        </form>

        {view === "board" ? (
          <div className="board-scroll">
            {COLUMNS.map((col) => {
              const cards = grouped.get(col.key) ?? [];
              return (
                <section key={col.key} className="board-column">
                  <div className="column-head">
                    <h2>{col.label}</h2>
                    <span>{cards.length}</span>
                  </div>

                  <div className="column-list">
                    {cards.map((item) => {
                      const job = item.job;
                      if (!job) return null;
                      const score = matchMap.get(job.id);

                      return (
                        <article key={item.id} className="job-card-panel">
                          <p className="job-title">{job.title}</p>
                          <p className="job-company">{job.company ?? "Unknown Company"}</p>
                          <p className="job-meta">
                            {job.location ?? "Location not set"} | {job.source}
                          </p>

                          <div className="pill-row">
                            <span className="pill">{typeof score === "number" ? `${score}% match` : "No score yet"}</span>
                            <span className="pill subtle">{formatDate(item.updated_at)}</span>
                          </div>

                          <div className="card-actions">
                            <a href={job.url} target="_blank" rel="noreferrer">
                              Open Apply
                            </a>
                            <Link href={`/applications/${item.id}`}>Review</Link>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <section className="card table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Company</th>
                  <th>Location</th>
                  <th>Source</th>
                  <th>Match</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const job = row.job;
                  if (!job) return null;
                  const score = matchMap.get(job.id);
                  return (
                    <tr key={row.id}>
                      <td>{job.title}</td>
                      <td>{job.company ?? "-"}</td>
                      <td>{job.location ?? "-"}</td>
                      <td>{job.source}</td>
                      <td>{typeof score === "number" ? `${score}%` : "-"}</td>
                      <td>{row.status}</td>
                      <td>{formatDate(row.updated_at)}</td>
                      <td>
                        <a href={job.url} target="_blank" rel="noreferrer">
                          Open Apply
                        </a>{" "}
                        | <Link href={`/applications/${row.id}`}>Review</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}
      </section>
    </main>
  );
}
