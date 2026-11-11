import type { Case, Chat, CheckedFinding, ExpectedFinding, Finding } from "../types.ts";
import { verifyFindings } from "../verify.ts";

export type Match = "correct" | "wrong_kind" | "unexpected";

export type GradedFinding = CheckedFinding & { match: Match };

export type CaseGrade = {
  caseId: string;
  tags: ReadonlyArray<string>;
  pass: boolean;
  expectedCount: number;
  findings: ReadonlyArray<GradedFinding>;
  missed: ReadonlyArray<ExpectedFinding>;
  wrongKind: ReadonlyArray<ExpectedFinding>;
  error?: string;
};

type Claims = { found: ReadonlyArray<number>; wrongKind: ReadonlyArray<number>; missed: ReadonlyArray<ExpectedFinding>; wrongKindItems: ReadonlyArray<ExpectedFinding> };

const samePlace = (finding: Finding, item: ExpectedFinding) => finding.chatId === item.chatId && finding.messageId === item.messageId;

const claim = (findings: ReadonlyArray<Finding>, expected: ReadonlyArray<ExpectedFinding>): Claims =>
  expected.reduce<Claims>(
    (claims, item) => {
      const taken = (idx: number) => claims.found.includes(idx) || claims.wrongKind.includes(idx);
      const exact = findings.findIndex((finding, idx) => !taken(idx) && samePlace(finding, item) && finding.kind === item.kind);
      if (exact >= 0) return { ...claims, found: [...claims.found, exact] };
      const placed = findings.findIndex((finding, idx) => !taken(idx) && samePlace(finding, item));
      if (placed >= 0) return { ...claims, wrongKind: [...claims.wrongKind, placed], wrongKindItems: [...claims.wrongKindItems, item] };
      return { ...claims, missed: [...claims.missed, item] };
    },
    { found: [], wrongKind: [], missed: [], wrongKindItems: [] },
  );

const matchOf = (idx: number, claims: Claims): Match => {
  if (claims.found.includes(idx)) return "correct";
  if (claims.wrongKind.includes(idx)) return "wrong_kind";
  return "unexpected";
};

export const gradeFindings = (findings: ReadonlyArray<Finding>, expected: ReadonlyArray<ExpectedFinding>, chats: ReadonlyArray<Chat>) => {
  const claims = claim(findings, expected);
  const graded = verifyFindings(findings, chats).map((finding, idx): GradedFinding => ({ ...finding, match: matchOf(idx, claims) }));
  const pass = !claims.missed.length && !claims.wrongKindItems.length && graded.every((finding) => finding.match === "correct" && finding.verified);
  return { pass, findings: graded, missed: claims.missed, wrongKind: claims.wrongKindItems };
};

export const gradeCase = (testCase: Case, findings: ReadonlyArray<Finding>): CaseGrade => ({
  caseId: testCase.id,
  tags: testCase.tags,
  expectedCount: testCase.expected.length,
  ...gradeFindings(findings, testCase.expected, testCase.chats),
});

export const erroredCase = (testCase: Case, error: string): CaseGrade => ({
  caseId: testCase.id,
  tags: testCase.tags,
  pass: false,
  expectedCount: testCase.expected.length,
  findings: [],
  missed: testCase.expected,
  wrongKind: [],
  error,
});

export const gradeTotals = (grades: ReadonlyArray<CaseGrade>) => {
  const findings = grades.flatMap((grade) => grade.findings);
  return {
    cases: grades.length,
    casesPassed: grades.filter((grade) => grade.pass).length,
    expected: grades.reduce((sum, grade) => sum + grade.expectedCount, 0),
    found: findings.filter((finding) => finding.match === "correct").length,
    falsePositives: findings.filter((finding) => finding.match === "unexpected").length,
    missed: grades.reduce((sum, grade) => sum + grade.missed.length, 0),
    wrongKind: findings.filter((finding) => finding.match === "wrong_kind").length,
    quoteFailures: findings.filter((finding) => !finding.verified).length,
    errors: grades.filter((grade) => grade.error).length,
  };
};
