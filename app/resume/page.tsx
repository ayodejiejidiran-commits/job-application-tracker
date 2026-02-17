import { supabaseServer } from "@/lib/supabase/server";
import Link from "next/link";
import { ResumeBuilderClient } from "@/components/ResumeBuilderClient";
import { StepCard } from "@/components/StepCard";
import { FileUploadBox } from "@/components/FileUploadBox";
import { textToHtml } from "@/lib/textToHtml";
import { isUnitedStatesJob, isLikelyEnglishJob } from "@/lib/discovery/usFilters";
import { AppShell } from "@/components/layout/AppShell";

export default async function ResumePage() {
  const supabase = await supabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="page-container">
        <section className="card">
          <h1>Sign in</h1>
          <p className="small">Upload and enrich your resume after signing in.</p>
          <Link className="button" href="/login">
            Go to login
          </Link>
        </section>
      </main>
    );
  }

  const { data: resumes } = await supabase
    .from("resume_versions")
    .select("id,label,created_at,resume_json")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const { data: draftApps } = await supabase
    .from("applications")
    .select("jobs(id,title,company,location,url,description,posted_at)")
    .eq("user_id", user.id)
    .eq("status", "DRAFT")
    .limit(100);

  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const jobs = Array.from(
    new Map(
      (draftApps ?? [])
        .map((a) => (Array.isArray(a.jobs) ? a.jobs[0] : a.jobs))
        .filter((j): j is NonNullable<typeof draftApps>[number]["jobs"] => Boolean(j))
        .filter((j) => {
          const posted = j?.posted_at ? new Date(j.posted_at) : null;
          const recentOk = posted ? posted >= cutoff : true;
          const usOk = isUnitedStatesJob({ title: j?.title ?? "", location: j?.location ?? "", description: j?.description ?? "" });
          const englishOk = isLikelyEnglishJob({ title: j?.title ?? "", location: j?.location ?? "", description: j?.description ?? "" });
          return recentOk && usOk && englishOk;
        })
        .map((j) => [j!.id, j!])
    ).values()
  );

  const latest = resumes?.[0]?.resume_json ?? {};
  const rawText =
    latest?.raw_text ??
    (process.env.E2E_AUTH_BYPASS === "1" ? "Test Resume Content — Product Manager with 3+ years of experience. Skills: APIs, SQL, Jira." : "");
  const savedHtml = latest?.resume_html as string | undefined;
  const initialHtml = savedHtml ?? (rawText ? textToHtml(rawText) : "");

  return (
    <AppShell title="Resume">
      <StepCard step={1} title="Upload / Replace Resume" subtitle="Parse a PDF resume as your base">
        <FileUploadBox />
      </StepCard>

      <StepCard step={2} title="Edit & Improve" subtitle="Single rich-text editor with toolbar.">
        <ResumeBuilderClient initialHtml={initialHtml} jobs={jobs} />
      </StepCard>

      <StepCard step={3} title="Export" subtitle="Export as one-page PDF with selected template.">
        <p className="small">Use the Export area in the editor above to generate the PDF.</p>
      </StepCard>

      <StepCard step={4} title="Back to Applications">
        <Link className="button secondary" href="/dashboard">
          Back to dashboard
        </Link>
      </StepCard>
    </AppShell>
  );
}
