import type { SupabaseClient } from "@supabase/supabase-js";
import type { Criteria } from "@/lib/match";
import type { ResumeJSON } from "@/lib/resumeMatch";
import { deriveCriteriaFromResume } from "@/lib/discovery/resume/deriveCriteria";
import { parseLatestResumePdf } from "@/lib/discovery/resume/parseResumePdf";

type DiscoveryContextData = {
  resume: ResumeJSON;
  criteria: Criteria;
  years_experience: number;
};

function hasResumeData(resume: ResumeJSON | null | undefined) {
  if (!resume) return false;
  return Boolean(resume.summary || (resume.skills?.length ?? 0) || (resume.experiences?.length ?? 0));
}

function mapCriteria(row: Record<string, unknown> | null | undefined): Criteria | null {
  if (!row) return null;

  return {
    titles: (row.titles as string[] | null) ?? [],
    locations: (row.locations as string[] | null) ?? [],
    remote_only: Boolean(row.remote_only ?? false),
    min_years: Number(row.min_years ?? 0),
    max_years: Number(row.max_years ?? 50),
    include_keywords: (row.include_keywords as string[] | null) ?? [],
    exclude_keywords: (row.exclude_keywords as string[] | null) ?? []
  };
}

export async function loadOrCreateResumeAndCriteria(admin: SupabaseClient, userId: string): Promise<DiscoveryContextData> {
  const [{ data: profileRow }, { data: resumeRow }, { data: criteriaRow }] = await Promise.all([
    admin.from("profiles").select("years_experience").eq("user_id", userId).maybeSingle(),
    admin
      .from("resume_versions")
      .select("id,resume_json,pdf_path")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("job_criteria")
      .select("titles,locations,remote_only,min_years,max_years,include_keywords,exclude_keywords")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  let resume = (resumeRow?.resume_json ?? null) as ResumeJSON | null;
  let resumeText: string | undefined;

  if (!hasResumeData(resume)) {
    const parsed = await parseLatestResumePdf({
      manual_paths: [resumeRow?.pdf_path].filter((v): v is string => Boolean(v))
    });

    if (parsed) {
      resume = parsed.resume_json;
      resumeText = parsed.text;

      await admin.from("resume_versions").insert({
        user_id: userId,
        label: "auto-discovery",
        resume_json: parsed.resume_json,
        pdf_path: parsed.path
      });
    }
  }

  if (!resume) {
    throw new Error(
      "No resume profile found. Add resume_json to resume_versions or provide readable PDF files via RESUME_PDF_PATHS/RESUME_PDF_DIR."
    );
  }

  let criteria = mapCriteria(criteriaRow as Record<string, unknown> | null);
  if (!criteria) {
    criteria = deriveCriteriaFromResume(resume, resumeText);
    await admin.from("job_criteria").insert({ user_id: userId, ...criteria });
  }

  const years_experience = Number(profileRow?.years_experience ?? resume.yearsExp ?? criteria.min_years ?? 0);

  return {
    resume,
    criteria,
    years_experience
  };
}
