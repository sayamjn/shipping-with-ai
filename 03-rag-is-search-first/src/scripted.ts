import type { Model, ModelRequest } from "./types.ts";

const estimate = (text: string) => Math.ceil(text.length / 4);

const parse = (request: ModelRequest) => {
  const text = request.turns[0]?.text ?? "";
  const post = /\nPost: (.*)$/s.exec(text)?.[1] ?? "";
  const mappings = [...text.matchAll(/^- (.+) → (.+)$/gm)].map(([, term, word]) => ({ term, word }));
  return { post, mappings: [...mappings].sort((a, b) => b.term.length - a.term.length) };
};

export const literalRewrite = (request: ModelRequest) => {
  const { post, mappings } = parse(request);
  return mappings.reduce((current, { term, word }) => current.replace(new RegExp(`\\b${term}\\b`, "gi"), word), post);
};

export const scriptedModel = (): Model => ({
  name: "scripted (offline stand-in, not a real model)",
  generate: async (request) => {
    const text = literalRewrite(request);
    return { text, usage: { inputTokens: estimate(JSON.stringify(request)), outputTokens: estimate(text) } };
  },
});
