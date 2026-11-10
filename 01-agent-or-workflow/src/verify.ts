import type { Chat, CheckedFinding, Finding } from "./types.ts";

const normalise = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

const checkOne = (finding: Finding, chats: ReadonlyArray<Chat>): CheckedFinding => {
  const chat = chats.find((candidate) => candidate.id === finding.chatId);
  if (!chat) return { ...finding, verified: false, reason: "unknown chat" };
  const message = chat.messages.find((candidate) => candidate.id === finding.messageId);
  if (!message) return { ...finding, verified: false, reason: "unknown message" };
  if (!finding.quote.trim() || !normalise(message.text).includes(normalise(finding.quote))) {
    return { ...finding, verified: false, reason: "quote not in message" };
  }
  const expectedSender = finding.kind === "i_promised" ? "me" : "them";
  if (message.from !== expectedSender) return { ...finding, verified: false, reason: "wrong sender for this kind" };
  return { ...finding, verified: true, reason: null };
};

export const verifyFindings = (findings: ReadonlyArray<Finding>, chats: ReadonlyArray<Chat>): ReadonlyArray<CheckedFinding> =>
  findings.map((finding) => checkOne(finding, chats));
