"use client";

import { useState } from "react";

export function DraftActions({
  jobUrl,
  coverLetter,
  answers
}: {
  jobUrl: string;
  coverLetter: string;
  answers: Record<string, unknown>;
}) {
  const [message, setMessage] = useState<string>("");

  async function copyText(text: string, label: string) {
    if (!text.trim()) {
      setMessage(`No ${label.toLowerCase()} to copy yet.`);
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setMessage(`${label} copied.`);
    } catch {
      setMessage(`Unable to copy ${label.toLowerCase()}.`);
    }
  }

  async function openAndCopy() {
    window.open(jobUrl, "_blank", "noopener,noreferrer");
    await copyText(coverLetter, "Cover letter");
  }

  return (
    <div>
      <div className="copy-row">
        <button type="button" onClick={openAndCopy}>
          One-click Apply Assist
        </button>
        <button type="button" className="alt" onClick={() => copyText(coverLetter, "Cover letter")}>Copy Cover Letter</button>
        <button
          type="button"
          className="alt"
          onClick={() => copyText(JSON.stringify(answers ?? {}, null, 2), "Answers")}
        >
          Copy Answers JSON
        </button>
      </div>
      {message ? <p className="small" style={{ marginTop: 8 }}>{message}</p> : null}
    </div>
  );
}
