// Simple ATS-friendly print CSS template for resumes
export const RESUME_PRINT_CSS = `
  @page { margin: 0.6in; size: A4; }
  * { box-sizing: border-box; }
  body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; line-height: 1.45; color: #111; }
  header { margin-bottom: 12px; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 18px 0 8px; text-transform: uppercase; letter-spacing: 0.04em; }
  h3 { font-size: 14px; margin: 6px 0; }
  p { margin: 4px 0; }
  ul { margin: 6px 0 6px 18px; padding: 0; }
  li { margin-bottom: 4px; }
  section { page-break-inside: avoid; }
  .meta { color: #444; font-size: 13px; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; }
  .pill { border: 1px solid #ccc; border-radius: 999px; padding: 3px 8px; font-size: 12px; }
`;
