import type { Chat } from "./types.ts";

export type Ranked = { chat: Chat; score: number; reasons: ReadonlyArray<string> };

export const THRESHOLD = 12;
export const MAX_CHATS = 50;
export const TOKEN_BUDGET = 40_000;

const PROMISE = /\bI(?:'ll| will)\b/i;

const rules = (chat: Chat, today: string): ReadonlyArray<[boolean, number, string]> => {
  const last = chat.messages[chat.messages.length - 1];
  const incoming = last?.from === "them";
  return [
    [chat.unread > 0, Math.min(30, 10 + chat.unread * 2), "unread"],
    [incoming, 10, "they wrote last"],
    [incoming && last.text.trimEnd().endsWith("?"), 14, "question for me"],
    [last?.from === "me" && PROMISE.test(last.text), 14, "I promised something"],
    [Boolean(last?.at.startsWith(today)), 8, "active today"],
    [chat.muted, -8, "muted"],
    [chat.group && chat.unread === 0, -8, "quiet group"],
  ];
};

export const scoreChat = (chat: Chat, today: string): Ranked => {
  if (chat.ignored) return { chat, score: -100, reasons: ["ignored"] };
  const hits = rules(chat, today).filter(([applies]) => applies);
  return { chat, score: hits.reduce((sum, [, points]) => sum + points, 0), reasons: hits.map(([, , reason]) => reason) };
};

export const estimateTokens = (chat: Chat) => Math.ceil(JSON.stringify(chat.messages).length / 4);

export const pickCandidates = (chats: ReadonlyArray<Chat>, today: string): ReadonlyArray<Ranked> => {
  const eligible = chats
    .map((chat) => scoreChat(chat, today))
    .filter((ranked) => ranked.score >= THRESHOLD)
    .sort((a, b) => b.score - a.score || a.chat.name.localeCompare(b.chat.name))
    .slice(0, MAX_CHATS);
  return eligible.reduce<{ picked: ReadonlyArray<Ranked>; tokens: number }>(
    (state, ranked) => {
      const tokens = estimateTokens(ranked.chat);
      return state.tokens + tokens > TOKEN_BUDGET ? state : { picked: [...state.picked, ranked], tokens: state.tokens + tokens };
    },
    { picked: [], tokens: 0 },
  ).picked;
};
