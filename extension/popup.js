const msg = document.getElementById("msg");
const apiInput = document.getElementById("api");

chrome.storage.local.get(["apiBase"], (result) => {
  if (result.apiBase) apiInput.value = result.apiBase;
});

document.getElementById("save").addEventListener("click", async () => {
  const apiBase = apiInput.value.trim();
  if (!apiBase) {
    msg.textContent = "Enter your deployed app URL first.";
    return;
  }

  chrome.storage.local.set({ apiBase });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_JOB" }, async (job) => {
    if (!job || !job.url || !job.title) {
      msg.textContent = "Could not extract this posting.";
      return;
    }

    try {
      const response = await fetch(`${apiBase}/api/jobs/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(job)
      });
      msg.textContent = response.ok ? "Saved." : "Save failed.";
    } catch {
      msg.textContent = "Network error.";
    }
  });
});
