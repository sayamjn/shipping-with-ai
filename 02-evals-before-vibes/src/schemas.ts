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

export const verdictSchema = {
  type: "OBJECT",
  properties: {
    verdict: { type: "STRING", enum: ["pass", "fail"] },
    reason: { type: "STRING", description: "One line" },
  },
  required: ["verdict", "reason"],
} as const;
