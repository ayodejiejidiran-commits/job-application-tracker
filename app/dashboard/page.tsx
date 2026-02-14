import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

type RawJob = {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  source: string;
  url: string;
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

export default async function DashboardPage() {
  const sb = await supabaseServer();
  const {
    data: { user }
  } = await sb.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: apps } = await sb
    .from("applications")
    .select("id,status,updated_at,jobs(id,title,company,location,source,url)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

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

  const grouped = new Map<string, ApplicationRow[]>();
  for (const col of COLUMNS) grouped.set(col.key, []);

  for (const row of rows) {
    if (!grouped.has(row.status)) grouped.set(row.status, []);
    grouped.get(row.status)?.push(row);
  }

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
            <span className="tab active">Application Board</span>
            <span className="tab">Saved Searches</span>
            <span className="tab">Weekly Goal</span>
          </nav>
          <div className="top-actions">
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
      </section>
    </main>
  );
}
