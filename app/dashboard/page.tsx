import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

type AppRow = {
  id: string;
  status: string;
  updated_at: string;
  jobs:
    | {
        id: string;
        title: string;
        company: string | null;
        location: string | null;
        source: string;
        url: string;
      }
    | {
        id: string;
        title: string;
        company: string | null;
        location: string | null;
        source: string;
        url: string;
      }[]
    | null;
};

type JobRow = {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  source: string;
  url: string;
};

type NormalizedAppRow = {
  id: string;
  status: string;
  updated_at: string;
  jobs: JobRow | null;
};

function normalizeJob(jobs: AppRow["jobs"]): JobRow | null {
  if (!jobs) return null;
  return Array.isArray(jobs) ? jobs[0] ?? null : jobs;
}

type MatchRow = {
  job_id: string;
  score: number;
};

const normalizeApps = (apps: AppRow[] | null): NormalizedAppRow[] =>
  (apps ?? []).map((app) => ({
    id: app.id,
    status: app.status,
    updated_at: app.updated_at,
    jobs: normalizeJob(app.jobs)
  }));

export default async function DashboardPage() {
  const sb = await supabaseServer();
  const {
    data: { user }
  } = await sb.auth.getUser();

  if (!user) {
    return (
      <main className="container">
        <h1>Job Application Tracker</h1>
        <p className="small">Sign in with Supabase Auth to load your applications.</p>
      </main>
    );
  }

  const { data: apps } = await sb
    .from("applications")
    .select("id,status,updated_at,jobs(id,title,company,location,source,url)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const typedApps = normalizeApps((apps ?? null) as unknown as AppRow[] | null);

  const jobIds = typedApps
    .map((row) => row.jobs?.id)
    .filter((id): id is string => Boolean(id));

  let matchMap = new Map<string, number>();
  if (jobIds.length) {
    const { data: matches } = await sb
      .from("job_matches")
      .select("job_id,score")
      .eq("user_id", user.id)
      .in("job_id", jobIds);

    matchMap = new Map(
      ((matches ?? []) as unknown as MatchRow[]).map((m) => [m.job_id, m.score])
    );
  }

  return (
    <main className="container">
      <h1>Job Applications</h1>
      <p className="small">Status flow: DRAFT -&gt; READY_TO_REVIEW -&gt; APPLIED -&gt; ARCHIVED</p>

      <div style={{ margin: "12px 0 16px" }}>
        <Link href="/jobs/new">+ Add Job</Link>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Company</th>
              <th>Location</th>
              <th>Source</th>
              <th>Match</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {typedApps.map((app) => {
              const job = app.jobs;
              if (!job) return null;

              const score = matchMap.get(job.id);
              return (
                <tr key={app.id}>
                  <td>{job.title}</td>
                  <td>{job.company ?? "-"}</td>
                  <td>{job.location ?? "-"}</td>
                  <td>{job.source}</td>
                  <td>{typeof score === "number" ? `${score}%` : "-"}</td>
                  <td>{app.status}</td>
                  <td>
                    <a href={job.url} target="_blank" rel="noreferrer">
                      Open Apply
                    </a>{" "}
                    | <Link href={`/applications/${app.id}`}>Review Draft</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
