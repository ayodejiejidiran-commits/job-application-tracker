export function modernWrapper(body: string) {
  return `<div class="modern">${body}</div>`;
}

export const modernCss = `
  body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; color: #0f172a; }
  .modern { padding: 16px; line-height: 1.45; }
  h1 { font-size: 26px; margin: 0 0 8px; }
  h2 { font-size: 16px; margin: 14px 0 6px; text-transform: uppercase; letter-spacing: 0.05em; }
  h3 { font-size: 14px; margin: 6px 0; }
  ul { margin: 6px 0 6px 18px; }
  li { margin-bottom: 4px; }
  .pill { background: #e8f0ff; border-radius: 999px; padding: 3px 8px; }
`;
