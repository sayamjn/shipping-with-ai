import type { Model, ModelReply, ModelRequest, ToolCall, Turn } from "./types.ts";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_RATE_LIMIT_RETRIES = 6;
const REQUEST_TIMEOUT_MS = 60_000;
const MAX_WAIT_MS = 90_000;

type GroqToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export const lowerSchemaTypes = (schema: unknown): unknown => {
  if (Array.isArray(schema)) return schema.map(lowerSchemaTypes);
  if (!schema || typeof schema !== "object") return schema;
  return Object.fromEntries(
    Object.entries(schema).map(([key, value]) => [key, key === "type" && typeof value === "string" ? value.toLowerCase() : lowerSchemaTypes(value)]),
  );
};

const callId = (call: ToolCall, turnIndex: number, callIndex: number) => call.id ?? `call_${turnIndex}_${callIndex}`;

export const toGroqMessages = (system: string, turns: ReadonlyArray<Turn>) => {
  const fallbackIds = turns.flatMap((turn, turnIndex) => (turn.role === "model" ? (turn.toolCalls ?? []).map((call, callIndex) => callId(call, turnIndex, callIndex)) : []));
  const toolTurns = turns.filter((turn) => turn.role === "tool");
  const messages = turns.map((turn, turnIndex) => {
    if (turn.role === "user") return { role: "user", content: turn.text };
    if (turn.role === "tool") return { role: "tool", tool_call_id: turn.callId ?? fallbackIds[toolTurns.indexOf(turn)], content: JSON.stringify(turn.result) };
    const calls = turn.toolCalls ?? [];
    return {
      role: "assistant",
      content: turn.text ?? null,
      ...(calls.length
        ? { tool_calls: calls.map((call, callIndex): GroqToolCall => ({ id: callId(call, turnIndex, callIndex), type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) } })) }
        : {}),
    };
  });
  return [{ role: "system", content: system }, ...messages];
};

const retryAfterMs = (response: Response) => {
  const seconds = Number(response.headers.get("retry-after") ?? 30);
  return Math.min(MAX_WAIT_MS, Math.ceil((Number.isFinite(seconds) ? seconds : 30) + 1) * 1000);
};

const parseArgs = (raw: string) => {
  try {
    return JSON.parse(raw || "{}") as Record<string, unknown>;
  } catch {
    return { unparsed: raw };
  }
};

export const groqModel = (apiKey: string, model = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b"): Model => ({
  name: `groq ${model}`,
  generate: async (request: ModelRequest): Promise<ModelReply> => {
    const body = {
      model,
      messages: toGroqMessages(request.system, request.turns),
      ...(request.tools
        ? { tools: request.tools.map((tool) => ({ type: "function", function: { ...tool, parameters: lowerSchemaTypes(tool.parameters) } })), tool_choice: "required" }
        : {}),
      ...(request.jsonSchema ? { response_format: { type: "json_schema", json_schema: { name: "findings", schema: lowerSchemaTypes(request.jsonSchema) } } } : {}),
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
    const message = data.choices?.[0]?.message ?? {};
    const calls: ReadonlyArray<GroqToolCall> = message.tool_calls ?? [];
    const thinkingTokens = data.usage?.completion_tokens_details?.reasoning_tokens ?? 0;
    return {
      text: message.content || undefined,
      toolCalls: calls.map((call) => ({ id: call.id, name: call.function.name, args: parseArgs(call.function.arguments) })),
      usage: { inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: (data.usage?.completion_tokens ?? 0) - thinkingTokens, thinkingTokens },
      waitedMs,
    };
  },
});
