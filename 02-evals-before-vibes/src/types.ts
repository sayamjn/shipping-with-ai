export type Message = { id: string; from: "me" | "them"; at: string; text: string };

export type Chat = { id: string; name: string; unread: number; muted: boolean; group: boolean; ignored: boolean; messages: ReadonlyArray<Message> };

export type Kind = "waiting_on_me" | "i_promised";

export type Finding = { chatId: string; messageId: string; kind: Kind; quote: string; summary: string };

export type CheckedFinding = Finding & { verified: boolean; reason: string | null };

export type ExpectedFinding = { chatId: string; messageId: string; kind: Kind };

export type Case = { id: string; tags: ReadonlyArray<string>; chats: ReadonlyArray<Chat>; expected: ReadonlyArray<ExpectedFinding>; notes: string };

export type Turn = { role: "user"; text: string };

export type ModelRequest = { system: string; turns: ReadonlyArray<Turn>; jsonSchema?: Record<string, unknown>; schemaName?: string };

export type Usage = { inputTokens: number; outputTokens: number; thinkingTokens?: number };

export type ModelReply = { text?: string; usage: Usage; waitedMs?: number };

export type Model = { name: string; generate: (request: ModelRequest) => Promise<ModelReply> };

export type TraceStep = { kind: "code" | "model"; label: string; ms: number; usage?: Usage; waitedMs?: number };
