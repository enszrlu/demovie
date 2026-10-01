import type { Glossary } from "@demovie/core";
import type { Vocabulary } from "./types.ts";

const WORD = /[\p{L}][\p{L}\p{N}'’-]*/gu;
/** Numbers that stand alone (not part of a word like "Q4" or "v2"). */
const NUMBER = /(?<![\p{L}\p{N}])[-+]?\d[\d,]*(?:\.\d+)?%?(?![\p{L}\p{N}])/gu;

export function words(text: string): string[] {
  return text.match(WORD) ?? [];
}

export function numbers(text: string): string[] {
  return (text.match(NUMBER) ?? []).map(normalizeNumber);
}

export function normalizeNumber(n: string): string {
  return n.replace(/,/g, "").replace(/^\+/, "");
}

/** Build the allowed vocabulary from the glossary, the brief and captured UI text (SPEC §12, DM-G02/G04). */
export function buildVocabulary(glossary: Glossary | null, brief: string, uiTexts: Iterable<string>): Vocabulary {
  const vocab: Vocabulary = { glossary, words: new Set(), numbers: new Set(), phrases: new Set() };
  const addText = (text: string | null | undefined) => {
    if (!text) return;
    for (const w of words(text)) vocab.words.add(w.toLowerCase());
    for (const n of numbers(text)) vocab.numbers.add(n);
  };
  if (glossary) {
    for (const s of [
      glossary.productName,
      glossary.tagline,
      glossary.ctaUrl,
      ...glossary.uiLabels,
      ...glossary.entities,
      ...glossary.people,
    ]) {
      addText(s);
      if (s) vocab.phrases.add(s.toLowerCase());
    }
    for (const f of glossary.features) {
      addText(f.term);
      vocab.phrases.add(f.term.toLowerCase());
    }
  }
  addText(brief);
  for (const t of uiTexts) addText(t);
  return vocab;
}

/**
 * Capitalized terms that a viewer would read as product vocabulary: capitalized words that don't start a sentence,
 * and acronyms anywhere. Sentence-initial words are ordinary English.
 */
export function capitalizedTerms(text: string): string[] {
  const out: string[] = [];
  const sentences = text.split(/(?<=[.!?:·—–|])\s+|\n+/);
  for (const sentence of sentences) {
    const ws = words(sentence);
    ws.forEach((w, i) => {
      const acronym = /^[A-Z]{2,}[0-9]*$/.test(w);
      if (acronym || (i > 0 && /^[A-Z]/.test(w))) out.push(w);
    });
  }
  return out;
}

/** Ordinary words that are fine anywhere even when capitalized mid-sentence. */
export const COMMON = new Set(
  [
    "i",
    "ok",
    "ai",
    "ui",
    "api",
    "faq",
    "new",
    "now",
    "all",
    "every",
    "your",
    "you",
    "we",
    "our",
    "the",
    "and",
    "pro",
    "free",
  ].map((w) => w.toLowerCase()),
);
