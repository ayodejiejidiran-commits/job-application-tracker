import { describe, expect, test } from "@jest/globals";
import { sanitizeResumeHtml } from "@/lib/sanitize";

describe("sanitizeResumeHtml", () => {
  test("removes script tags", () => {
    const dirty = '<p>hi</p><script>alert(1)</script>';
    const clean = sanitizeResumeHtml(dirty);
    expect(clean).toBe('<p>hi</p>');
  });

  test("removes event handlers", () => {
    const dirty = '<img src="x" onerror="alert(1)">';
    const clean = sanitizeResumeHtml(dirty);
    expect(clean).toBe("<img src=\"x\">");
  });

  test("strips javascript: URLs", () => {
    const dirty = '<a href="javascript:alert(1)">click</a>';
    const clean = sanitizeResumeHtml(dirty);
    expect(clean).toBe("<a>click</a>");
  });

  test("strips style tags", () => {
    const dirty = '<style>body{background:red}</style><p>ok</p>';
    const clean = sanitizeResumeHtml(dirty);
    expect(clean).toBe("<p>ok</p>");
  });

  test("allows safe inline styles", () => {
    const dirty = '<span style="font-size:12px;font-family:Arial;color:#111">Text</span>';
    const clean = sanitizeResumeHtml(dirty);
    expect(clean).toBe(dirty);
  });

  test("removes unsafe inline styles", () => {
    const dirty = '<span style="position:fixed;left:0;color:red">Text</span>';
    const clean = sanitizeResumeHtml(dirty);
    expect(clean).toBe('<span style="color:red">Text</span>');
  });
});

