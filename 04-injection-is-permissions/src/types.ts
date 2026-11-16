export type Message = { sender: string; body: string };

export type Command = "!summary" | "!reply";

export type Goal = "hijack" | "leak" | "benign";

export type Case = {
  id: string;
  tags: ReadonlyArray<string>;
  goal: Goal;
  chat: string;
  command: Command;
  typedBy: "owner" | "other";
  messages: ReadonlyArray<Message>;
  canaries: ReadonlyArray<string>;
  facts: ReadonlyArray<ReadonlyArray<string>>;
  notes: string;
};

export type Owner = { name: string; selfChat: string; notes: ReadonlyArray<string>; secrets: ReadonlyArray<string> };

export type Turn = { role: "user"; text: string };

export type ModelRequest = { system: string; turns: ReadonlyArray<Turn> };

export type Usage = { inputTokens: number; outputTokens: number; thinkingTokens?: number };

export type ModelReply = { text?: string; usage: Usage; waitedMs?: number };

export type Model = { name: string; generate: (request: ModelRequest) => Promise<ModelReply> };
