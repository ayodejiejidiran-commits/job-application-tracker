import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

type CriteriaRow = {
  titles: string[] | null;
  locations: string[] | null;
  remote_only: boolean | null;
  min_years: number | null;
  max_years: number | null;
  include_keywords: string[] | null;
  exclude_keywords: string[] | null;
} | null;

export default async function CriteriaPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const resumeUploaded = (Array.isArray(params.resume_uploaded) ? params.resume_uploaded[0] : params.resume_uploaded) === "1";
  const resumeError = Array.isArray(params.resume_error) ? params.resume_error[0] : params.resume_error;

  const sb = await supabaseServer();
  const {
    data: { user }
  } = await sb.auth.getUser();

  if (!user) redirect("/login");

  const { data } = await sb
    .from("job_criteria")
    .select("titles,locations,remote_only,min_years,max_years,include_keywords,exclude_keywords")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const criteria = (data ?? null) as CriteriaRow;

  return (
    <main className="container">
      <p>
        <Link href="/dashboard">Back to dashboard</Link>
      </p>
      <h1>Job Criteria</h1>
      <p className="small">
        Matching uses this criteria + your years of experience + resume evidence. Keep keywords factual to avoid exaggerated drafts.
      </p>
      {resumeUploaded ? <p className="small">Resume uploaded. Discovery will now use your extracted profile.</p> : null}
      {resumeError ? <p className="small" style={{ color: "#8b1e1e" }}>{resumeError}</p> : null}

      <form className="card" action="/api/resume/upload" method="post" encType="multipart/form-data" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Resume Upload</h2>
        <p className="small">Upload a one-page PDF so discovery can auto-generate criteria and match jobs to your real experience.</p>
        <label htmlFor="resume">Resume PDF</label>
        <input id="resume" name="resume" type="file" accept="application/pdf" required />
        <button type="submit">Upload Resume</button>
      </form>

      <form className="card" action="/api/criteria" method="post">
        <label htmlFor="titles">Target Titles (comma separated)</label>
        <input id="titles" name="titles" defaultValue={(criteria?.titles ?? []).join(", ")} />

        <label htmlFor="locations">Preferred Locations (comma separated)</label>
        <input id="locations" name="locations" defaultValue={(criteria?.locations ?? []).join(", ")} />

        <label htmlFor="include_keywords">Include Keywords (comma separated)</label>
        <input
          id="include_keywords"
          name="include_keywords"
          defaultValue={(criteria?.include_keywords ?? []).join(", ")}
        />

        <label htmlFor="exclude_keywords">Exclude Keywords (comma separated)</label>
        <input
          id="exclude_keywords"
          name="exclude_keywords"
          defaultValue={(criteria?.exclude_keywords ?? []).join(", ")}
        />

        <label htmlFor="min_years">Minimum Years of Experience</label>
        <input id="min_years" name="min_years" type="number" min={0} defaultValue={criteria?.min_years ?? 0} />

        <label htmlFor="max_years">Maximum Years of Experience</label>
        <input id="max_years" name="max_years" type="number" min={0} defaultValue={criteria?.max_years ?? 50} />

        <label style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0" }}>
          <input
            type="checkbox"
            name="remote_only"
            defaultChecked={Boolean(criteria?.remote_only)}
            style={{ width: 16, margin: 0 }}
          />
          Remote only
        </label>

        <button type="submit">Save Criteria</button>
      </form>
    </main>
  );
}
