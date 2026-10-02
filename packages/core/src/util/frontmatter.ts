import { parse, stringify } from "yaml";

/** Parse a YAML document (flows, GitHub workflow/action files). */
export const parseYaml = (text: string): unknown => parse(text);

export interface Frontmatter<T = Record<string, unknown>> {
  data: T;
  body: string;
}

/** Split `---\nyaml\n---\nbody`. Files without frontmatter return `{}`. */
export function parseFrontmatter(text: string): Frontmatter {
  const m = text.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  const data = (parse(m[1]!) ?? {}) as Record<string, unknown>;
  return { data, body: m[2]! };
}

export function stringifyFrontmatter(data: Record<string, unknown>, body: string): string {
  return `---\n${stringify(data, { lineWidth: 0 }).trimEnd()}\n---\n\n${body.replace(/^\n+/, "")}`;
}
