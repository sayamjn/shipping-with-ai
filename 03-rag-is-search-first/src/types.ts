export type Entry = { term: string; word: string; sense?: string };

export type Post = { id: string; tags: ReadonlyArray<string>; text: string; required: ReadonlyArray<string>; forbidden: ReadonlyArray<string>; notes: string };

export type Retriever = { name: string; retrieve: (text: string, glossary: ReadonlyArray<Entry>, post: Post) => ReadonlyArray<Entry> };

export type Turn = { role: "user"; text: string };

export type ModelRequest = { system: string; turns: ReadonlyArray<Turn> };

export type Usage = { inputTokens: number; outputTokens: number; thinkingTokens?: number };

export type ModelReply = { text?: string; usage: Usage; waitedMs?: number };

export type Model = { name: string; generate: (request: ModelRequest) => Promise<ModelReply> };
