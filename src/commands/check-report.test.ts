import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { ParsedEnv } from "../env-file.ts";
import type { SchemaIssue } from "../schema-loader.ts";

import { renderBrokenPact } from "./check-report.ts";

const context = { envName: ".env", schemaName: "./env.schema.ts" };

/** Real zod issues, so the renderer is tested against what safeParse actually produces. */
function issuesFor(schema: z.ZodType, env: ParsedEnv): readonly SchemaIssue[] {
  const result = schema.safeParse(env);
  if (result.success) throw new Error("fixture expected to fail validation");
  return result.error.issues;
}

describe("renderBrokenPact", () => {
  it("renders a missing variable with the schema that requires it and a fix hint", () => {
    const env: ParsedEnv = {};
    const output = renderBrokenPact(issuesFor(z.object({ PORT: z.string() }), env), env, context);

    expect(output).toContain("✖ Broken pact — 1 problem in .env");
    expect(output).toContain("missing — required by ./env.schema.ts");
    expect(output).toContain("→ set PORT in .env");
  });

  it("treats a coerced number that is missing from the env as missing, not NaN", () => {
    // z.coerce.number() reports NaN for an absent key — the env record is the honest source.
    const env: ParsedEnv = {};
    const output = renderBrokenPact(
      issuesFor(z.object({ PORT: z.coerce.number() }), env),
      env,
      context,
    );

    expect(output).toContain("missing — required by ./env.schema.ts");
  });

  it("renders a wrong type as expected-vs-got without echoing the value", () => {
    const env: ParsedEnv = { PORT: "not-a-port" };
    const output = renderBrokenPact(
      issuesFor(z.object({ PORT: z.coerce.number() }), env),
      env,
      context,
    );

    expect(output).toContain("expected a number — got a non-numeric string");
    expect(output).toContain("→ fix PORT in .env");
    expect(output).not.toContain("not-a-port");
  });

  it("renders an invalid format with a friendly label", () => {
    const env: ParsedEnv = { MONGO_URL: "not a url" };
    const output = renderBrokenPact(issuesFor(z.object({ MONGO_URL: z.url() }), env), env, context);

    expect(output).toContain("expected a valid URL");
    expect(output).not.toContain("not a url");
  });

  it("renders enum choices without echoing the value", () => {
    const env: ParsedEnv = { LOG_LEVEL: "loud" };
    const output = renderBrokenPact(
      issuesFor(z.object({ LOG_LEVEL: z.enum(["debug", "info"]) }), env),
      env,
      context,
    );

    expect(output).toContain('expected one of "debug", "info"');
    expect(output).not.toContain("loud");
  });

  it("renders an empty value as an empty string, not as missing", () => {
    const env: ParsedEnv = { API_KEY: "" };
    const output = renderBrokenPact(
      issuesFor(z.object({ API_KEY: z.string().min(1) }), env),
      env,
      context,
    );

    expect(output).toContain("got an empty string");
  });

  it("counts and renders multiple problems with a pluralized header", () => {
    const env: ParsedEnv = { PORT: "abc" };
    const schema = z.object({ PORT: z.coerce.number(), MONGO_URL: z.string() });
    const output = renderBrokenPact(issuesFor(schema, env), env, context);

    expect(output).toContain("✖ Broken pact — 2 problems in .env");
    expect(output).toContain("PORT");
    expect(output).toContain("MONGO_URL");
  });

  it("renders unrecognized keys from a strict schema as not-in-the-pact", () => {
    // Extra vars only fail when the user's schema opts in via strictObject (see check tests).
    const env: ParsedEnv = { PORT: "5010", LEGACY_FLAG: "1" };
    const output = renderBrokenPact(
      issuesFor(z.strictObject({ PORT: z.string() }), env),
      env,
      context,
    );

    expect(output).toContain("LEGACY_FLAG");
    expect(output).toContain("not in the pact");
    expect(output).toContain("→ remove LEGACY_FLAG from .env or add it to the schema");
  });

  it("never prints a value that fails validation — it may be a secret", () => {
    const env: ParsedEnv = { API_TOKEN: "supersecret" };
    const output = renderBrokenPact(
      issuesFor(z.object({ API_TOKEN: z.string().min(40) }), env),
      env,
      context,
    );

    expect(output).not.toContain("supersecret");
    expect(output).toContain("API_TOKEN");
  });
});
