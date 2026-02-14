import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { APPLICATION_STATUSES } from "@/lib/status";

type AppData = {
  id: string;
  status: string;
  notes: string | null;
  jobs:
    | {
        id: string;
        title: string;
        company: string | null;
        location: string | null;
        source: string;
        url: string;
        description: string | null;
      }
    | {
        id: string;
        title: string;
        company: string | null;
        location: string | null;
        source: string;
        url: string;
        description: string | null;
      }[]
    | null;
};

type JobData = {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  source: string;
  url: string;
  description: string | null;
};

type AppViewData = {
  id: string;
  status: string;
  notes: string | null;
  jobs: JobData | null;
};

type DraftData = {
  cover_letter: string;
  answers: Record<string, string>;
} | null;

type MatchData = {
  score: number;
  matched_keywords: string[];
  missing_keywords: string[];
  evidence: Record<string, string[]>;
} | null;

function normalizeJob(jobs: AppData["jobs"]): JobData | null {
  if (!jobs) return null;
  return Array.isArray(jobs) ? jobs[0] ?? null : jobs;
}

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await supabaseServer();
  const {
    data: { user }
  } = await sb.auth.getUser();

  if (!user) {
    return (
      <main className="container">
        <h1>Application</h1>
        <p className="small">Sign in to view this page.</p>
      </main>
    );
  }

  const { data: app } = await sb
    .from("applications")
    .select("id,status,notes,jobs(id,title,company,location,source,url,description)")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!app) notFound();

  const job = normalizeJob((app as AppData).jobs);
  if (!job) notFound();

  const [{ data: draft }, { data: match }] = await Promise.all([
    sb
      .from("drafts")
      .select("cover_letter,answers")
      .eq("application_id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    sb
      .from("job_matches")
      .select("score,matched_keywords,missing_keywords,evidence")
      .eq("job_id", job.id)
      .eq("user_id", user.id)
      .maybeSingle()
  ]);

  const typedDraft = draft as DraftData;
  const typedMatch = match as MatchData;

  return (
    <main className="container">
      <p>
        <Link href="/dashboard">Back to dashboard</Link>
      </p>
      <h1>{job.title}</h1>
      <p className="small">
        {job.company ?? "Unknown company"} | {job.location ?? "Unknown location"} | {job.source}
      </p>
      <p>
        <a href={job.url} target="_blank" rel="noreferrer">
          Open Apply Page
        </a>
      </p>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Status: {(app as AppViewData).status}</h2>
        <form action={`/api/applications/${id}/draft`} method="post" style={{ display: "inline-block", marginRight: 8 }}>
          <button type="submit">Generate / Refresh Draft</button>
        </form>

        {APPLICATION_STATUSES.map((status) => (
          <form
            key={status}
            action={`/api/applications/${id}/status`}
            method="post"
            style={{ display: "inline-block", marginRight: 8, marginTop: 8 }}
          >
            <input type="hidden" name="status" value={status} />
            <button className="alt" type="submit">
              Mark {status}
            </button>
          </form>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Resume Match</h2>
        <p>
          <strong>Score:</strong> {typedMatch?.score ?? "-"}%
        </p>
        <div>
          <p className="small">Matched Keywords</p>
          {(typedMatch?.matched_keywords ?? []).map((k) => (
            <span key={k} className="badge">
              {k}
            </span>
          ))}
        </div>
        <div>
          <p className="small">Missing Keywords</p>
          {(typedMatch?.missing_keywords ?? []).map((k) => (
            <span key={k} className="badge">
              {k}
            </span>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>
          <p className="small">Evidence (resume bullet support)</p>
          <table className="table">
            <thead>
              <tr>
                <th>Keyword</th>
                <th>Resume Evidence</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(typedMatch?.evidence ?? {}).map(([keyword, bullets]) => (
                <tr key={keyword}>
                  <td>{keyword}</td>
                  <td>{bullets.join(" ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Draft</h2>
        <p className="small">Generated from your stored resume content only.</p>

        <h3>Cover Letter</h3>
        <pre style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{typedDraft?.cover_letter ?? "No draft generated yet."}</pre>

        <h3>Answers</h3>
        <pre style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
          {JSON.stringify(typedDraft?.answers ?? {}, null, 2)}
        </pre>
      </div>
    </main>
  );
}
