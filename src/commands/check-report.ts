import type { ParsedEnv } from "../env-file.ts";
import type { SchemaIssue } from "../schema-loader.ts";

export interface ReportContext {
  /** Env file name as configured, e.g. ".env" — used in the header and hints. */
  readonly envName: string;
  /** Schema path as configured, e.g. "./env.schema.ts" — used in "required by" lines. */
  readonly schemaName: string;
}

interface Problem {
  readonly name: string;
  readonly detail: string;
  readonly hint: string;
}

const FORMAT_LABELS: Readonly<Record<string, string>> = {
  url: "URL",
  uuid: "UUID",
  email: "email address",
};

/**
 * Renders the broken-pact report. Never prints an env value — any of them may be a secret —
 * only its shape (missing, empty, non-numeric, length).
 */
export function renderBrokenPact(
  issues: readonly SchemaIssue[],
  env: ParsedEnv,
  context: ReportContext,
): string {
  const problems = issues.flatMap((issue) => toProblems(issue, env, context));
  const count = problems.length;
  const header = `✖ Broken pact — ${String(count)} ${count === 1 ? "problem" : "problems"} in ${context.envName}`;
  const width = Math.max(...problems.map((problem) => problem.name.length));

  const blocks = problems.map(
    (problem) =>
      `  ${problem.name.padEnd(width)}   ${problem.detail}\n` +
      `  ${" ".repeat(width)}   ${problem.hint}`,
  );
  return [header, ...blocks].join("\n\n");
}

function toProblems(issue: SchemaIssue, env: ParsedEnv, context: ReportContext): Problem[] {
  if (issue.code === "unrecognized_keys") {
    // Only reachable when the user's schema opts into strictness (see check tests).
    return (issue.keys ?? []).map((key) => ({
      name: key,
      detail: `not in the pact — ${context.schemaName} rejects unknown variables`,
      hint: `→ remove ${key} from ${context.envName} or add it to the schema`,
    }));
  }

  const name = String(issue.path[0] ?? "(root)");
  const value = env[name];
  if (value === undefined) {
    return [
      {
        name,
        detail: `missing — required by ${context.schemaName}`,
        hint: `→ set ${name} in ${context.envName}`,
      },
    ];
  }
  return [
    {
      name,
      detail: `${describeExpected(issue)} — ${describeGot(issue, value)}`,
      hint: `→ fix ${name} in ${context.envName}`,
    },
  ];
}

function describeExpected(issue: SchemaIssue): string {
  if (issue.code === "invalid_type" && issue.expected !== undefined) {
    return `expected ${withArticle(issue.expected)}`;
  }
  if (issue.code === "invalid_format" && issue.format !== undefined) {
    return `expected a valid ${FORMAT_LABELS[issue.format] ?? issue.format}`;
  }
  if (issue.code === "invalid_value" && issue.values !== undefined) {
    return `expected one of ${issue.values.map((value) => JSON.stringify(value)).join(", ")}`;
  }
  // zod's own message is already value-free for the remaining codes (too_small, too_big, …).
  return issue.message;
}

function describeGot(issue: SchemaIssue, value: string): string {
  if (value === "") return "got an empty string";
  if (issue.code === "invalid_type" && issue.expected === "number") {
    return "got a non-numeric string";
  }
  return `got a string of ${String(value.length)} characters (value hidden)`;
}

function withArticle(noun: string): string {
  return /^[aeiou]/i.test(noun) ? `an ${noun}` : `a ${noun}`;
}
