import { NextResponse } from "next/server";
import OpenAI from "openai";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 20;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const mock = process.env.AI_MOCK_MODE === "1" || process.env.NODE_ENV === "test";
  if (!process.env.OPENAI_API_KEY && !mock) {
    return NextResponse.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? "anon";
  const rl = rateLimit(`tailor:${ip}`, 8, 60_000);
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limited", retryAfter: rl.retryAfter }, { status: 429 });
  }

  const { resumeText, jobDescription } = (await req.json().catch(() => ({}))) as {
    resumeText?: string;
    jobDescription?: string;
  };

  if (!resumeText || !jobDescription || resumeText.length > 40_000 || jobDescription.length > 20_000) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  try {
    if (mock) {
      const tailoredResume = `${resumeText}\n\n[Tailored to JD]`;
      const suggestions = ["Add metric to first bullet", "Mention SQL/AWS in skills"];
      return NextResponse.json({ tailoredResume, suggestions });
    }

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "You are a professional resume optimization expert. Tailor the resume to match the job description while preserving truthfulness. Optimize for ATS keywords and keep formatting clean."
        },
        {
          role: "user",
          content: `Resume:\n${resumeText}\n\nJob Description:\n${jobDescription}\n\nReturn tailored resume text and bullet suggestions as a JSON object with keys tailoredResume and suggestions (array).`
        }
      ]
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    let tailoredResume = "";
    let suggestions: string[] = [];
    if (raw && raw.startsWith("{")) {
      try {
        const parsed = JSON.parse(raw);
        tailoredResume = parsed.tailoredResume ?? raw;
        suggestions = parsed.suggestions ?? [];
      } catch {
        tailoredResume = raw;
      }
    } else {
      tailoredResume = raw ?? resumeText;
    }

    return NextResponse.json({ tailoredResume, suggestions });
  } catch (err) {
    console.error("tailor error", err);
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}
