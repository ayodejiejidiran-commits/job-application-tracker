"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function NewJobPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    const payload = {
      source: String(formData.get("source") ?? "other"),
      title: String(formData.get("title") ?? "").trim(),
      company: String(formData.get("company") ?? "").trim(),
      location: String(formData.get("location") ?? "").trim(),
      url: String(formData.get("url") ?? "").trim(),
      description: String(formData.get("description") ?? "").trim()
    };

    const res = await fetch("/api/jobs/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Failed to add job.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="container">
      <h1>Add Job</h1>
      <p className="small">
        Paste a job link and description. The app creates an application in DRAFT and computes a resume match.
      </p>

      <form
        className="card"
        onSubmit={async (e: FormEvent<HTMLFormElement>) => {
          e.preventDefault();
          await onSubmit(new FormData(e.currentTarget));
        }}
      >
        <label htmlFor="source">Source</label>
        <select id="source" name="source" defaultValue="linkedin">
          <option value="linkedin">LinkedIn</option>
          <option value="indeed">Indeed</option>
          <option value="glassdoor">Glassdoor</option>
          <option value="other">Other</option>
        </select>

        <label htmlFor="title">Job Title</label>
        <input id="title" name="title" required />

        <label htmlFor="company">Company</label>
        <input id="company" name="company" />

        <label htmlFor="location">Location</label>
        <input id="location" name="location" />

        <label htmlFor="url">Job URL</label>
        <input id="url" name="url" type="url" required />

        <label htmlFor="description">Job Description</label>
        <textarea id="description" name="description" rows={12} />

        <button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save Job"}
        </button>
      </form>

      {error ? <p style={{ color: "#b42318" }}>{error}</p> : null}
    </main>
  );
}
