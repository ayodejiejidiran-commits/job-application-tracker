chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== "EXTRACT_JOB") return;

  const host = window.location.hostname;
  let source = "other";
  if (host.includes("linkedin.com")) source = "linkedin";
  if (host.includes("indeed.com")) source = "indeed";
  if (host.includes("glassdoor.com")) source = "glassdoor";

  const text = (selector) => document.querySelector(selector)?.innerText?.trim() || "";

  const title = text("h1") || text('[data-test="job-title"]');
  const company = text('[data-test="employer-name"]') || text(".topcard__org-name-link");
  const location = text('[data-test="location"]') || text(".topcard__flavor--bullet");
  const description =
    text('[data-test="jobDescriptionText"]') ||
    text(".description") ||
    text("#job-details") ||
    "";

  sendResponse({
    source,
    title,
    company,
    location,
    url: window.location.href,
    description
  });
});
