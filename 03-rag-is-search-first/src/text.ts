const STOP_WORDS = new Set(["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by"]);
const MAX_PHRASE_WORDS = 4;

export const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1);

export const phrases = (tokens: ReadonlyArray<string>, maxWords = MAX_PHRASE_WORDS) =>
  tokens.flatMap((_, start) =>
    Array.from({ length: Math.min(maxWords, tokens.length - start) }, (_, extra) => tokens.slice(start, start + extra + 1).join(" ")),
  );

export const lookupTerms = (text: string) =>
  [...new Set(phrases(words(text)))].filter((term) => term.length > 2 && !STOP_WORDS.has(term) && !/^\d+$/.test(term));

export const normaliseWord = (word: string) => {
  const singular = /(ches|shes|xes|sses)$/.test(word) ? word.slice(0, -2) : word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
  if (singular.length > 5 && singular.endsWith("ing")) return singular.slice(0, -3);
  if (singular.length > 4 && singular.endsWith("ed")) return singular.slice(0, -1);
  return singular;
};

export const normalisePhrase = (phrase: string) => phrase.split(" ").map(normaliseWord).join(" ");

const trigrams = (text: string) => {
  const padded = `  ${text} `;
  return Array.from({ length: padded.length - 2 }, (_, idx) => padded.slice(idx, idx + 3));
};

const counts = (grams: ReadonlyArray<string>) =>
  grams.reduce<Readonly<Record<string, number>>>((acc, gram) => ({ ...acc, [gram]: (acc[gram] ?? 0) + 1 }), {});

export const similarity = (left: string, right: string) => {
  const a = trigrams(left);
  const b = trigrams(right);
  const inB = counts(b);
  const shared = Object.entries(counts(a)).reduce((sum, [gram, count]) => sum + Math.min(count, inB[gram] ?? 0), 0);
  return (2 * shared) / (a.length + b.length);
};
