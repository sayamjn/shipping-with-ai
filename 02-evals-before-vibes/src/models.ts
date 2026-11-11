import { scriptedReply } from "./scripted.ts";
import type { Model, ModelReply, ModelRequest } from "./types.ts";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_RATE_LIMIT_RETRIES = 6;
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_WAIT_MS = 90_000;

const retryDelayMs = (errorBody: string) => {
  const seconds = Number(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/.exec(errorBody)?.[1] ?? 30);
  return Math.min(MAX_WAIT_MS, Math.ceil(seconds + 1) * 1000);
};

export const geminiModel = (apiKey: string, model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash"): Model => ({
  name: model,
  generate: async (request: ModelRequest): Promise<ModelReply> => {
    const body = {
      systemInstruction: { parts: [{ text: request.system }] },
      contents: request.turns.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
      ...(request.jsonSchema ? { generationConfig: { responseMimeType: "application/json", responseSchema: request.jsonSchema } } : {}),
    };
    const send = () =>
      fetch(`${GEMINI_URL}/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    let waitedMs = 0;
    let response = await send();
    for (let attempt = 1; response.status === 429 && attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
      const delayMs = retryDelayMs(await response.text());
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      waitedMs += delayMs;
      response = await send();
    }
    if (!response.ok) throw new Error(`Gemini answered ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const data = await response.json();
    const parts: ReadonlyArray<{ text?: string }> = data.candidates?.[0]?.content?.parts ?? [];
    return {
      text: parts.map((part) => part.text ?? "").join("") || undefined,
      usage: { inputTokens: data.usageMetadata?.promptTokenCount ?? 0, outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0, thinkingTokens: data.usageMetadata?.thoughtsTokenCount ?? 0 },
      waitedMs,
    };
  },
});

const estimate = (value: unknown) => Math.ceil(JSON.stringify(value).length / 4);

export const scriptedModel = (): Model => ({
  name: "scripted (offline stand-in, not a real model)",
  generate: async (request) => {
    const text = scriptedReply(request);
    return { text, usage: { inputTokens: estimate(request), outputTokens: estimate(text) } };
  },
});
