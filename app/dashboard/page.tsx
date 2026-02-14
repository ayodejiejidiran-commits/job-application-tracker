import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";

type AppRow = {
  id: string;
  status: string;
  updated_at: string;
  jobs: {
    id: string;
    title: string;
    company: string | null;
    location: string | null;
    source: string;
    url: string;
  } | null;
};

type MatchRow = {
  job_id: string;
  score: number;
};

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

  const jobIds = ((apps ?? []) as AppRow[])
    .map((row) => row.jobs?.id)
    .filter((id): id is string => Boolean(id));

  let matchMap = new Map<string, number>();
  if (jobIds.length) {
    const { data: matches } = await sb
      .from("job_matches")
      .select("job_id,score")
      .eq("user_id", user.id)
      .in("job_id", jobIds);

    matchMap = new Map((matches ?? []).map((m) => [(m as MatchRow).job_id, (m as MatchRow).score]));
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
            {(apps as AppRow[] | null)?.map((app) => {
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
