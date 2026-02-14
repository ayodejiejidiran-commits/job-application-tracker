import type { ResumeJSON } from "@/lib/resumeMatch";

export function trimResumeToOnePage(resume: ResumeJSON): ResumeJSON {
  const copy: ResumeJSON = structuredClone(resume ?? {});

  copy.experiences = (copy.experiences ?? []).slice(0, 3).map((e) => ({
    ...e,
    bullets: (e.bullets ?? []).slice(0, 3).map((b) => (b.length > 120 ? `${b.slice(0, 117)}...` : b))
  }));

  copy.skills = (copy.skills ?? []).slice(0, 12);

  if (copy.summary && copy.summary.length > 260) {
    copy.summary = `${copy.summary.slice(0, 257)}...`;
  }

  return copy;
}
