import type { Chat, ToolDefinition } from "./types.ts";

export const findingSchema = {
  type: "OBJECT",
  properties: {
    findings: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          chatId: { type: "STRING" },
          messageId: { type: "STRING" },
          kind: { type: "STRING", enum: ["waiting_on_me", "i_promised"] },
          quote: { type: "STRING", description: "Exact words copied from the message" },
          summary: { type: "STRING" },
        },
        required: ["chatId", "messageId", "kind", "quote", "summary"],
      },
    },
  },
  required: ["findings"],
} as const;

export const agentTools: ReadonlyArray<ToolDefinition> = [
  {
    name: "list_chats",
    description: "List every chat with its name, unread count, and muted, group and ignored flags. Sayam never wants ignored chats triaged. No message text.",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "read_chat",
    description: "Read all messages in one chat.",
    parameters: { type: "OBJECT", properties: { chatId: { type: "STRING" } }, required: ["chatId"] },
  },
  {
    name: "finish",
    description: "Call once at the end with everything that is waiting on Sayam or that he promised.",
    parameters: findingSchema,
  },
];

export const runTool = (name: string, args: Record<string, unknown>, chats: ReadonlyArray<Chat>): unknown => {
  if (name === "list_chats") return chats.map(({ id, name: chatName, unread, muted, group, ignored }) => ({ id, name: chatName, unread, muted, group, ignored }));
  if (name === "read_chat") {
    const chat = chats.find((candidate) => candidate.id === args.chatId);
    return chat ? { id: chat.id, name: chat.name, messages: chat.messages } : { error: `no chat ${String(args.chatId)}` };
  }
  return { error: `unknown tool ${name}` };
};
