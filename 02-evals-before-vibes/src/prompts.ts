export const PROMPTS = {
  v1: "You read WhatsApp chats for Sayam. Return only what is waiting on him (someone asked him something) and what he promised. Copy the quote exactly from the message.",
  v2: [
    "You read WhatsApp chats for Sayam. Messages with from \"me\" are Sayam's; messages with from \"them\" are from other people.",
    "Return two kinds of findings:",
    "- waiting_on_me: someone asks Sayam a question or requests something from him, and he has not answered it or done it later in the chat.",
    "- i_promised: Sayam commits to a future action, in any language including Hinglish, and has not done it later in the chat.",
    "These do not count: statements and updates, even about a problem; rhetorical questions; questions or requests addressed to someone else; anything Sayam has already answered or done.",
    "If nothing counts, return an empty list. Copy the quote exactly from the message.",
  ].join("\n"),
} as const;

export type PromptVersion = keyof typeof PROMPTS;

export const PROMPT_VERSIONS: ReadonlyArray<PromptVersion> = ["v1", "v2"];

export const JUDGE_SYSTEM =
  "You check one finding from a WhatsApp triage for Sayam. Messages with from \"me\" are Sayam's; messages with from \"them\" are from other people. Read the chat, then answer the question about the named message with pass or fail and a one line reason.";

export const JUDGE_QUESTIONS = {
  waiting_on_me: "Is this message really something waiting on Sayam?",
  i_promised: "Is this message really a promise Sayam made?",
} as const;

export const extractionPrompt = (chats: unknown) => `Chats:\n${JSON.stringify(chats)}`;

export const judgePrompt = (chat: unknown, finding: { messageId: string; kind: keyof typeof JUDGE_QUESTIONS; quote: string }) =>
  `Chat:\n${JSON.stringify(chat)}\nFinding:\n${JSON.stringify({ messageId: finding.messageId, kind: finding.kind, quote: finding.quote })}\nQuestion: ${JUDGE_QUESTIONS[finding.kind]}`;
