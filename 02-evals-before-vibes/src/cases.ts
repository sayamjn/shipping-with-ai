import { readFileSync } from "node:fs";
import type { Case } from "./types.ts";

const KINDS = new Set(["waiting_on_me", "i_promised"]);

const duplicates = (values: ReadonlyArray<string>) => values.filter((value, idx) => values.indexOf(value) !== idx);

export const caseProblems = (testCase: Case): ReadonlyArray<string> => {
  const chatIds = testCase.chats.map((chat) => chat.id);
  const positions = testCase.expected.map((item) => `${item.chatId}/${item.messageId}`);
  return [
    ...(testCase.tags.length ? [] : ["no tags"]),
    ...(testCase.chats.length >= 1 && testCase.chats.length <= 3 ? [] : ["needs 1 to 3 chats"]),
    ...duplicates(chatIds).map((id) => `duplicate chat ${id}`),
    ...testCase.chats.flatMap((chat) => duplicates(chat.messages.map((message) => message.id)).map((id) => `duplicate message ${chat.id}/${id}`)),
    ...duplicates(positions).map((position) => `expected twice ${position}`),
    ...testCase.expected.flatMap((item) => {
      const chat = testCase.chats.find((candidate) => candidate.id === item.chatId);
      if (!chat) return [`expected chat ${item.chatId} missing`];
      if (!chat.messages.some((message) => message.id === item.messageId)) return [`expected message ${item.chatId}/${item.messageId} missing`];
      return KINDS.has(item.kind) ? [] : [`unknown kind ${item.kind}`];
    }),
  ].map((problem) => `${testCase.id}: ${problem}`);
};

export const parseCases = (jsonl: string): ReadonlyArray<Case> => {
  const cases: ReadonlyArray<Case> = jsonl
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
  const problems = [...duplicates(cases.map((testCase) => testCase.id)).map((id) => `duplicate case id ${id}`), ...cases.flatMap(caseProblems)];
  if (problems.length) throw new Error(`invalid cases:\n${problems.join("\n")}`);
  return cases;
};

export const loadCases = (url = new URL("../data/cases.jsonl", import.meta.url)) => parseCases(readFileSync(url, "utf8"));

export const vibesCases = (cases: ReadonlyArray<Case>) => cases.filter((testCase) => testCase.tags.includes("vibes"));
