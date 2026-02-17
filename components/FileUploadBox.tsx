"use client";

import { useState } from "react";

export function FileUploadBox({ defaultLabel = "Upload & Parse" }: { defaultLabel?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const onFile = (f: File | null) => {
    setFile(f);
    setStatus(f ? `${f.name} • ${(f.size / 1024).toFixed(1)} KB` : null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) {
      setStatus("Select a PDF first");
      return;
    }
    setStatus("Uploading…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("label", file.name);
      const resp = await fetch("/api/resume/upload", {
        method: "POST",
        body: fd,
        headers: { "x-requested-with": "fetch", accept: "application/json" },
        credentials: "include",
        cache: "no-store"
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Upload failed (${resp.status}): ${text || "Unknown error"}`);
      }
      setStatus("Uploaded and parsed. Reloading…");
      window.location.reload();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  return (
    <form encType="multipart/form-data" onSubmit={handleSubmit} action="/api/resume/upload" method="post">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        style={{
          border: "1px dashed #2d7dff",
          padding: 16,
          borderRadius: 12,
          background: "#0f172a",
          color: "#e5e7eb",
          textAlign: "center"
        }}
      >
        <p style={{ margin: 0, fontWeight: 600 }}>Drop PDF here or</p>
        <label
          style={{
            display: "inline-block",
            marginTop: 8,
            padding: "10px 14px",
            background: "#2d7dff",
            borderRadius: 10,
            cursor: "pointer",
            color: "#fff"
          }}
        >
          Choose File
          <input
            type="file"
            accept="application/pdf"
            style={{ display: "none" }}
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            name="file"
          />
        </label>
        {file ? <p style={{ marginTop: 8 }}>{file.name} · {(file.size / 1024).toFixed(1)} KB</p> : <p className="small">PDF only</p>}
      </div>
      <input type="hidden" name="label" value={file?.name ?? "uploaded"} />
      <button type="submit" style={{ marginTop: 10 }} disabled={!file} aria-label="Upload and parse resume">
        {defaultLabel}
      </button>
      {status ? <p className="small">{status}</p> : null}
    </form>
  );
}
