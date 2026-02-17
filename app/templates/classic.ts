export function classicWrapper(body: string) {
  return `<div class="classic">${body}</div>`;
}

export const classicCss = `
  body { font-family: 'Georgia', 'Times New Roman', serif; color: #111; }
  .classic { padding: 18px; }
  h1 { font-size: 24px; margin: 0 0 6px; letter-spacing: 0.02em; }
  h2 { font-size: 15px; margin: 12px 0 6px; text-transform: uppercase; letter-spacing: 0.08em; }
  h3 { font-size: 13px; margin: 5px 0; }
  ul { margin: 6px 0 6px 18px; }
  li { margin-bottom: 4px; }
  .meta { font-style: italic; color: #444; }
`;
