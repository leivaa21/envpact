import { pathToFileURL } from "node:url";

import { messageOf } from "./errors.ts";

/** Unusable schema file (D-103/D-104): run.ts maps this to exit code 2. */
export class SchemaLoadError extends Error {
  override readonly name = "SchemaLoadError";
}

/**
 * A zod v4 issue, described structurally. `check` renders issues from the *user's* zod
 * instance, so we type only the fields we read and never import their types (D-102).
 */
export interface SchemaIssue {
  readonly code?: string;
  readonly path: readonly PropertyKey[];
  readonly message: string;
  /** invalid_type */
  readonly expected?: string;
  /** invalid_format */
  readonly format?: string;
  /** invalid_value (enums/literals) */
  readonly values?: readonly unknown[];
  /** unrecognized_keys */
  readonly keys?: readonly string[];
}

export type SafeParseResult =
  | { readonly success: true }
  | { readonly success: false; readonly error: { readonly issues: readonly SchemaIssue[] } };

/** The slice of a zod object schema that `check` needs — structural on purpose (D-102). */
export interface EnvSchema {
  safeParse(input: unknown): SafeParseResult;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function zodTypeOf(value: unknown): string | undefined {
  // The zod v4 `_zod` internals protocol — shared across v4 instances, unlike instanceof.
  const def = asRecord(asRecord(asRecord(value)?._zod)?.def);
  return typeof def?.type === "string" ? def.type : undefined;
}

/** Structural check (never instanceof) so any zod v4 instance the user installed works. */
export function isZodObjectSchema(value: unknown): value is EnvSchema {
  return typeof asRecord(value)?.safeParse === "function" && zodTypeOf(value) === "object";
}

function describeExport(value: unknown): string {
  if (value === undefined) return "no default export";
  if (value === null) return "null";
  const zodType = zodTypeOf(value);
  if (zodType !== undefined && zodType !== "object") return `a zod ${zodType} schema`;
  if (Array.isArray(value)) return "an array";
  return typeof value === "object" ? "an object that is not a zod schema" : `a ${typeof value}`;
}

/**
 * safeParse never throws for sync schemas, but an async `.refine()` makes zod v4 throw
 * $ZodAsyncError on sync parse. That is a schema problem, not a broken pact — map it to
 * SchemaLoadError (exit 2) instead of letting it escape as a crash.
 */
export function parseWithSchema(schema: EnvSchema, input: unknown): SafeParseResult {
  try {
    return schema.safeParse(input);
  } catch (error) {
    const isAsyncParseError = error instanceof Error && error.constructor.name === "$ZodAsyncError";
    throw new SchemaLoadError(
      isAsyncParseError
        ? `The schema uses an async refinement, which \`envpact check\` cannot run — ` +
            `use synchronous .refine()/.check() functions in the env schema.`
        : `The schema threw while validating:\n  ${messageOf(error)}`,
    );
  }
}

/** Dynamic-imports the schema module (D-103) and verifies its default export structurally. */
export async function loadSchema(schemaPath: string): Promise<EnvSchema> {
  let module: unknown;
  try {
    module = (await import(pathToFileURL(schemaPath).href)) as unknown;
  } catch (error) {
    throw new SchemaLoadError(
      `Could not load the schema from ${schemaPath}:\n  ${messageOf(error)}\n\n` +
        `Check the "schema" path in your package.json "envpact" config.`,
    );
  }

  const candidate = asRecord(module)?.default;
  if (!isZodObjectSchema(candidate)) {
    throw new SchemaLoadError(
      `${schemaPath} must default-export a zod object schema (z.object({ ... })), ` +
        `but found ${describeExport(candidate)}.`,
    );
  }
  return candidate;
}
