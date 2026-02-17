import { z } from "zod";

export const sectionsSchema = z.object({
  header: z.string(),
  summary: z.string(),
  experience: z.string(),
  education: z.string(),
  skills: z.string()
});

const heading = (label: string) => new RegExp(`\\b${label}\\b`, "i");

const H_SUMMARY = heading("SUMMARY");
const H_CORE = heading("CORE COMPETENCIES");
const H_SKILLS = heading("TECHNICAL SKILLS|SKILLS");
const H_EXPERIENCE = heading("PROFESSIONAL EXPERIENCE|EXPERIENCE");
const H_EDUCATION = heading("EDUCATION");

export function splitResumeIntoSections(raw: string) {
  const text = raw.replace(/\r\n/g, "\n").replace(/\s+\n/g, "\n").trim();

  const find = (re: RegExp) => {
    const m = text.search(re);
    return m >= 0 ? m : -1;
  };

  const idxSummary = find(H_SUMMARY);
  const idxCore = find(H_CORE);
  const idxSkills = find(H_SKILLS);
  const idxExp = find(H_EXPERIENCE);
  const idxEdu = find(H_EDUCATION);

  const header = idxSummary > 0 ? text.slice(0, idxSummary).trim() : text.slice(0, Math.max(0, Math.min(idxExp, idxEdu, idxSkills).valueOf()));

  const summaryEndCandidates = [idxCore, idxSkills, idxExp].filter((n) => n > idxSummary);
  const summaryEnd = summaryEndCandidates.length ? Math.min(...summaryEndCandidates) : text.length;
  const summary =
    idxSummary >= 0 ? text.slice(idxSummary + "SUMMARY".length, summaryEnd).trim() : "";

  const skillsStart = idxSkills >= 0 ? idxSkills : idxCore >= 0 ? idxCore : -1;
  const skillsEnd = idxExp > skillsStart ? idxExp : idxEdu > skillsStart ? idxEdu : text.length;
  const skills =
    skillsStart >= 0 ? text.slice(skillsStart + (idxSkills >= 0 ? "SKILLS".length : "CORE COMPETENCIES".length), skillsEnd).trim() : "";

  const expStart = idxExp >= 0 ? idxExp : skillsEnd > 0 ? skillsEnd : -1;
  const expEnd = idxEdu > expStart ? idxEdu : text.length;
  const experience = expStart >= 0 ? text.slice(expStart + "EXPERIENCE".length, expEnd).trim() : "";

  const education = idxEdu >= 0 ? text.slice(idxEdu + "EDUCATION".length).trim() : "";

  const result = {
    header: header || "",
    summary: summary || "",
    experience: experience || "",
    education: education || "",
    skills: skills || ""
  };

  return sectionsSchema.parse(result);
}
