import { PROMPTS } from "./prompts.ts";
import type { Chat, Finding, Message, ModelRequest } from "./types.ts";

const ENGLISH_PROMISE = /\bI(?:'ll| will)\b/i;
const HINGLISH_PROMISE = /\b(?:dunga|dungi|karunga|karungi|karta hoon|karti hoon|bhejta hoon)\b/i;
const REQUEST = /\b(?:please|need your|send me|can you|could you)\b/i;
const PROBLEM = /\bbroken\b|not working/i;
const THANKS = /\b(?:got it|thanks|received)\b/i;
const NOT_A_NAME = new Set(["Sayam", "Hi", "Hey", "Bro", "Bhai", "Ok"]);

type Rule = (message: Message, later: ReadonlyArray<Message>) => Finding["kind"] | null;

const isQuestion = (message: Message) => message.text.trimEnd().endsWith("?");

const addressedToSomeoneElse = (message: Message) => {
  const name = /^([A-Z][a-z]+),/.exec(message.text)?.[1];
  return Boolean(name && !NOT_A_NAME.has(name));
};

const firstPromptRule: Rule = (message) => {
  if (ENGLISH_PROMISE.test(message.text)) return "i_promised";
  if (message.from === "them" && (isQuestion(message) || PROBLEM.test(message.text))) return "waiting_on_me";
  return null;
};

const clearerPromptRule: Rule = (message, later) => {
  if (message.from === "me") {
    const promised = ENGLISH_PROMISE.test(message.text) || HINGLISH_PROMISE.test(message.text);
    const kept = later.some((reply) => reply.from === "them" && THANKS.test(reply.text));
    return promised && !kept ? "i_promised" : null;
  }
  if (addressedToSomeoneElse(message) || later.some((reply) => reply.from === "me")) return null;
  return isQuestion(message) || REQUEST.test(message.text) ? "waiting_on_me" : null;
};

const findingsFor = (chats: ReadonlyArray<Chat>, rule: Rule): ReadonlyArray<Finding> =>
  chats.flatMap((chat) =>
    chat.messages.flatMap((message, idx): ReadonlyArray<Finding> => {
      const kind = rule(message, chat.messages.slice(idx + 1));
      return kind ? [{ chatId: chat.id, messageId: message.id, kind, quote: message.text, summary: `${kind === "i_promised" ? "Promised" : "Waiting for"} ${chat.name}` }] : [];
    }),
  );

const judge = (chat: Chat, finding: Pick<Finding, "messageId" | "kind">) => {
  const message = chat.messages.find((candidate) => candidate.id === finding.messageId);
  if (!message) return { verdict: "fail", reason: "No such message." };
  if (finding.kind === "i_promised") {
    return message.from === "me" && ENGLISH_PROMISE.test(message.text)
      ? { verdict: "pass", reason: "Sayam says he will do something." }
      : { verdict: "fail", reason: "No promise from Sayam in this message." };
  }
  return message.from === "them" && (isQuestion(message) || REQUEST.test(message.text))
    ? { verdict: "pass", reason: "Someone asks Sayam for something." }
    : { verdict: "fail", reason: "Nothing is asked of Sayam here." };
};

export const scriptedReply = (request: ModelRequest): string => {
  const lines = request.turns.map((turn) => turn.text).join("\n").split("\n");
  if (request.schemaName === "verdict") return JSON.stringify(judge(JSON.parse(lines[1]), JSON.parse(lines[3])));
  const chats: ReadonlyArray<Chat> = JSON.parse(lines[1]);
  const rule = request.system === PROMPTS.v1 ? firstPromptRule : clearerPromptRule;
  return JSON.stringify({ findings: findingsFor(chats, rule) });
};
