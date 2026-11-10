import type { Chat, Finding, Model, ModelReply, ModelRequest, ToolCall, Turn } from "./types.ts";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_RATE_LIMIT_RETRIES = 6;

const retryDelayMs = (errorBody: string) => {
  const seconds = Number(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/.exec(errorBody)?.[1] ?? 30);
  return Math.ceil(seconds + 1) * 1000;
};

const toGeminiContent = (turn: Turn) => {
  if (turn.role === "user") return { role: "user", parts: [{ text: turn.text }] };
  if (turn.role === "tool") return { role: "user", parts: [{ functionResponse: { name: turn.name, response: { result: turn.result } } }] };
  const parts = [...(turn.text ? [{ text: turn.text }] : []), ...(turn.toolCalls ?? []).map((call) => ({ functionCall: call }))];
  return { role: "model", parts };
};

export const geminiModel = (apiKey: string, model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash"): Model => ({
  name: model,
  generate: async (request: ModelRequest): Promise<ModelReply> => {
    const body = {
      systemInstruction: { parts: [{ text: request.system }] },
      contents: request.turns.map(toGeminiContent),
      ...(request.tools ? { tools: [{ functionDeclarations: request.tools }] } : {}),
      ...(request.jsonSchema ? { generationConfig: { responseMimeType: "application/json", responseSchema: request.jsonSchema } } : {}),
    };
    const send = () =>
      fetch(`${GEMINI_URL}/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
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
    const parts: ReadonlyArray<{ text?: string; functionCall?: ToolCall }> = data.candidates?.[0]?.content?.parts ?? [];
    return {
      text: parts.map((part) => part.text ?? "").join("") || undefined,
      toolCalls: parts.flatMap((part) => (part.functionCall ? [{ name: part.functionCall.name, args: part.functionCall.args ?? {} }] : [])),
      usage: { inputTokens: data.usageMetadata?.promptTokenCount ?? 0, outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0, thinkingTokens: data.usageMetadata?.thoughtsTokenCount ?? 0 },
      waitedMs,
    };
  },
});

const PROMISE = /\bI(?:'ll| will)\b/i;

export const heuristicFindings = (chats: ReadonlyArray<Chat>): ReadonlyArray<Finding> =>
  chats.flatMap((chat) =>
    chat.messages.flatMap((message): ReadonlyArray<Finding> => {
      if (message.from === "me" && PROMISE.test(message.text)) {
        return [{ chatId: chat.id, messageId: message.id, kind: "i_promised", quote: message.text, summary: `Promised ${chat.name}` }];
      }
      const isLast = message === chat.messages[chat.messages.length - 1];
      if (message.from === "them" && isLast && !chat.muted && message.text.includes("?")) {
        return [{ chatId: chat.id, messageId: message.id, kind: "waiting_on_me", quote: message.text, summary: `${chat.name} is waiting` }];
      }
      return [];
    }),
  );

const estimate = (value: unknown) => Math.ceil(JSON.stringify(value).length / 4);

const nextAgentCall = (turns: ReadonlyArray<Turn>, allChats: ReadonlyArray<Chat>): ToolCall => {
  const results = turns.filter((turn): turn is Extract<Turn, { role: "tool" }> => turn.role === "tool");
  const listed = results.find((turn) => turn.name === "list_chats");
  if (!listed) return { name: "list_chats", args: {} };
  const read = new Set(results.filter((turn) => turn.name === "read_chat").map((turn) => (turn.result as { id: string }).id));
  const toRead = (listed.result as ReadonlyArray<{ id: string; ignored: boolean }>).filter((chat) => !chat.ignored && !read.has(chat.id));
  if (toRead.length) return { name: "read_chat", args: { chatId: toRead[0].id } };
  const readChats = allChats.filter((chat) => read.has(chat.id));
  return { name: "finish", args: { findings: heuristicFindings(readChats) } };
};

export const scriptedModel = (chats: ReadonlyArray<Chat>): Model => ({
  name: "scripted (offline stand-in, not a real model)",
  generate: async (request) => {
    if (request.tools) {
      const call = nextAgentCall(request.turns, chats);
      return { toolCalls: [call], usage: { inputTokens: estimate(request), outputTokens: estimate(call) } };
    }
    const prompt = request.turns.filter((turn) => turn.role === "user").map((turn) => (turn as { text: string }).text).join("\n");
    const sent = chats.filter((chat) => prompt.includes(`"id":"${chat.id}"`));
    const text = JSON.stringify({ findings: heuristicFindings(sent) });
    return { text, toolCalls: [], usage: { inputTokens: estimate(request), outputTokens: estimate(text) } };
  },
});
