export type Message = { id: string; from: "me" | "them"; at: string; text: string };

export type Chat = { id: string; name: string; unread: number; muted: boolean; group: boolean; ignored: boolean; messages: ReadonlyArray<Message> };

export type Finding = { chatId: string; messageId: string; kind: "waiting_on_me" | "i_promised"; quote: string; summary: string };

export type CheckedFinding = Finding & { verified: boolean; reason: string | null };

export type ToolCall = { name: string; args: Record<string, unknown> };

export type ToolDefinition = { name: string; description: string; parameters: Record<string, unknown> };

export type Turn =
  | { role: "user"; text: string }
  | { role: "model"; text?: string; toolCalls?: ReadonlyArray<ToolCall> }
  | { role: "tool"; name: string; result: unknown };

export type ModelRequest = {
  system: string;
  turns: ReadonlyArray<Turn>;
  tools?: ReadonlyArray<ToolDefinition>;
  jsonSchema?: Record<string, unknown>;
};

export type Usage = { inputTokens: number; outputTokens: number; thinkingTokens?: number };

export type ModelReply = { text?: string; toolCalls: ReadonlyArray<ToolCall>; usage: Usage; waitedMs?: number };

export type Model = { name: string; generate: (request: ModelRequest) => Promise<ModelReply> };

export type TraceStep = { kind: "code" | "model" | "tool"; label: string; ms: number; usage?: Usage; waitedMs?: number };

export type RunResult = {
  approach: "workflow" | "agent";
  model: string;
  findings: ReadonlyArray<CheckedFinding>;
  trace: ReadonlyArray<TraceStep>;
  stoppedBy: "done" | "step_limit" | "error";
};
