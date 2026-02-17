export function textToHtml(raw: string): string {
  const lines = raw.split(/\r?\n/).map((l) => l.trimEnd());
  const blocks: string[] = [];
  let currentList: string[] = [];

  const flushList = () => {
    if (!currentList.length) return;
    blocks.push(`<ul>${currentList.map((li) => `<li>${li}</li>`).join("")}</ul>`);
    currentList = [];
  };

  for (const line of lines) {
    if (!line.trim()) {
      flushList();
      continue;
    }
    if (/^(?:•|-|\\*)\\s+/.test(line)) {
      currentList.push(line.replace(/^(?:•|-|\\*)\\s+/, ""));
      continue;
    }
    flushList();
    blocks.push(`<p>${line}</p>`);
  }
  flushList();

  return blocks.join("");
}
