export function minimalWrapper(body: string) {
  return `<div class="minimal">${body}</div>`;
}

export const minimalCss = `
  body { font-family: 'Inter', system-ui, sans-serif; color: #0c0c0c; }
  .minimal { padding: 14px; line-height: 1.5; }
  h1 { font-size: 22px; margin: 0 0 6px; font-weight: 700; }
  h2 { font-size: 14px; margin: 10px 0 4px; font-weight: 700; }
  h3 { font-size: 13px; margin: 4px 0; font-weight: 600; }
  ul { margin: 4px 0 4px 16px; }
  li { margin-bottom: 3px; }
  section { page-break-inside: avoid; }
`;
