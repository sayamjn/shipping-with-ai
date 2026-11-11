import type { Model, ModelReply, ModelRequest } from "./types.ts";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_RATE_LIMIT_RETRIES = 6;
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_WAIT_MS = 90_000;

export const lowerSchemaTypes = (schema: unknown): unknown => {
  if (Array.isArray(schema)) return schema.map(lowerSchemaTypes);
  if (!schema || typeof schema !== "object") return schema;
  return Object.fromEntries(
    Object.entries(schema).map(([key, value]) => [key, key === "type" && typeof value === "string" ? value.toLowerCase() : lowerSchemaTypes(value)]),
  );
};

const retryAfterMs = (response: Response) => {
  const seconds = Number(response.headers.get("retry-after") ?? 30);
  return Math.min(MAX_WAIT_MS, Math.ceil((Number.isFinite(seconds) ? seconds : 30) + 1) * 1000);
};

export const groqModel = (apiKey: string, model = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b"): Model => ({
  name: `groq ${model}`,
  generate: async (request: ModelRequest): Promise<ModelReply> => {
    const body = {
      model,
      messages: [{ role: "system", content: request.system }, ...request.turns.map((turn) => ({ role: turn.role, content: turn.text }))],
      ...(request.jsonSchema
        ? { response_format: { type: "json_schema", json_schema: { name: request.schemaName ?? "reply", schema: lowerSchemaTypes(request.jsonSchema) } } }
        : {}),
    };
    const send = () =>
      fetch(GROQ_URL, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    let waitedMs = 0;
    let response = await send();
    for (let attempt = 1; response.status === 429 && attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
      const delayMs = retryAfterMs(response);
      await response.text();
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      waitedMs += delayMs;
      response = await send();
    }
    if (!response.ok) throw new Error(`Groq answered ${response.status}: ${(await response.text()).slice(0, 300)}`);
    const data = await response.json();
    const thinkingTokens = data.usage?.completion_tokens_details?.reasoning_tokens ?? 0;
    return {
      text: data.choices?.[0]?.message?.content || undefined,
      usage: { inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: (data.usage?.completion_tokens ?? 0) - thinkingTokens, thinkingTokens },
      waitedMs,
    };
  },
});
