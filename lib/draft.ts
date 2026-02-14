import type { ResumeJSON } from "@/lib/resumeMatch";

function pickEvidenceBullets(resume: ResumeJSON, jobText: string, max = 3) {
  const text = jobText.toLowerCase();
  const picked: string[] = [];

  for (const exp of resume.experiences ?? []) {
    for (const bullet of exp.bullets ?? []) {
      const tokens = bullet.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      const overlap = tokens.some((t) => t.length >= 5 && text.includes(t));
      if (overlap) picked.push(bullet);
      if (picked.length >= max) return picked;
    }
  }

  if (!picked.length) {
    for (const exp of resume.experiences ?? []) {
      for (const bullet of exp.bullets ?? []) {
        picked.push(bullet);
        if (picked.length >= max) return picked;
      }
    }
  }

  return picked.slice(0, max);
}

export function generateCoverLetter(args: {
  fullName: string;
  yearsExp: number;
  company: string;
  jobTitle: string;
  jobDescription: string;
  resume: ResumeJSON;
}) {
  const evidence = pickEvidenceBullets(
    args.resume,
    `${args.jobTitle} ${args.company} ${args.jobDescription}`,
    3
  );

  return [
    `Hello ${args.company} team,`,
    "",
    `I am applying for the ${args.jobTitle} role. I have ${args.yearsExp} years of experience and focus on clear, measurable outcomes.`,
    "",
    evidence.length
      ? `Relevant experience from my resume:\n- ${evidence.join("\n- ")}`
      : "Relevant experience is included in my attached resume.",
    "",
    "Thank you for your time and consideration.",
    "",
    "Sincerely,",
    args.fullName
  ].join("\n");
}

export function generateShortAnswers(args: {
  resume: ResumeJSON;
  yearsExp: number;
  role: string;
}) {
  const topBullets = (args.resume.experiences ?? [])
    .flatMap((e) => e.bullets ?? [])
    .slice(0, 2);

  return {
    why_this_role: `This ${args.role} role aligns with my ${args.yearsExp} years of experience and my background delivering scoped product outcomes with cross-functional teams.`,
    strengths: topBullets.length ? topBullets.join(" ") : "I deliver structured execution, stakeholder alignment, and measurable improvements."
  };
}
