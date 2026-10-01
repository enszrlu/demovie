/** Parse the first GitHub-style pipe table in `text`. Cells are trimmed; header names are lowercased. */
export function parseMarkdownTable(text: string): { headers: string[]; rows: string[][] } | null {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length - 1; i++) {
    const header = lines[i]!.trim();
    const divider = lines[i + 1]!.trim();
    if (!header.startsWith("|") || !/^\|?\s*:?-{2,}/.test(divider)) continue;
    const headers = splitRow(header).map((h) => h.toLowerCase());
    const rows: string[][] = [];
    for (let j = i + 2; j < lines.length; j++) {
      const line = lines[j]!.trim();
      if (!line.startsWith("|")) break;
      rows.push(splitRow(line));
    }
    return { headers, rows };
  }
  return null;
}

function splitRow(line: string): string[] {
  const inner = line.replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let current = "";
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "\\" && inner[i + 1] === "|") {
      current += "|";
      i++;
    } else if (ch === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

/** Markdown headings (`#`–`######`) in order. */
export function markdownHeadings(text: string): { level: number; text: string }[] {
  const out: { level: number; text: string }[] = [];
  let inFence = false;
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (m) out.push({ level: m[1]!.length, text: m[2]!.replace(/[*_`]/g, "").trim() });
  }
  return out;
}
