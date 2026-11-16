import type { Model } from "./types.ts";

const estimate = (text: string) => Math.ceil(text.length / 4);

export const scriptedModel = (): Model => ({
  name: "scripted (offline stand-in, not a real model): repeats its whole prompt",
  generate: async (request) => {
    const text = request.turns.map((turn) => turn.text).join("\n");
    return { text, usage: { inputTokens: estimate(request.system + text), outputTokens: estimate(text) } };
  },
});
