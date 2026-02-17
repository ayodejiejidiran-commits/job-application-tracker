import { NextResponse } from "next/server";
import OpenAI from "openai";

const isMock = process.env.AI_MOCK_MODE === "1" || process.env.NODE_ENV === "test";
if (!process.env.OPENAI_API_KEY && !isMock) {
  throw new Error("OPENAI_API_KEY is required unless AI_MOCK_MODE=1 or NODE_ENV=test");
}

export const runtime = "nodejs";
export const maxDuration = 15;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const mock = process.env.AI_MOCK_MODE === "1" || process.env.NODE_ENV === "test";
  if (!process.env.OPENAI_API_KEY && !mock) {
    return NextResponse.json({ error: "OPENAI_API_KEY not set" }, { status: 500 });
  }

  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text || !text.trim()) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }

  try {
    if (mock) {
      const improved = `${text.trim()} (improved)`;
      return NextResponse.json({ improved });
    }

    const prompt = `Rewrite this resume bullet to be concise, action-oriented, and factually the same. Keep it first-person implicit, start with a strong verb, avoid exaggeration. Return only the rewritten bullet.\n\nBullet: ${text}`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You improve resume bullets without adding unverified claims." },
        { role: "user", content: prompt }
      ],
      temperature: 0.4,
      max_tokens: 120
    });

    const improved = completion.choices[0]?.message?.content?.trim();
    if (!improved) throw new Error("Empty response from OpenAI");

    return NextResponse.json({ improved });
  } catch (err: unknown) {
    console.error("improve error", err);
    return NextResponse.json({ error: "OpenAI request failed" }, { status: 500 });
  }
}
