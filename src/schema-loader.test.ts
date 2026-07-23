import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import {
  SchemaLoadError,
  isZodObjectSchema,
  loadSchema,
  parseWithSchema,
} from "./schema-loader.ts";

describe("isZodObjectSchema", () => {
  it("accepts a real zod object schema", () => {
    expect(isZodObjectSchema(z.object({ PORT: z.string() }))).toBe(true);
  });

  it("rejects non-object zod schemas", () => {
    expect(isZodObjectSchema(z.string())).toBe(false);
  });

  it("rejects impostors that have safeParse but no zod internals", () => {
    expect(isZodObjectSchema({ safeParse: () => ({ success: true }) })).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isZodObjectSchema(undefined)).toBe(false);
    expect(isZodObjectSchema(42)).toBe(false);
  });
});

describe("parseWithSchema", () => {
  it("passes through the safeParse result of a synchronous schema", () => {
    const result = parseWithSchema(z.object({ A: z.string() }), { A: "x" });

    expect(result.success).toBe(true);
  });

  it("maps zod's async-refinement throw to a SchemaLoadError instead of crashing", () => {
    // zod v4 safeParse THROWS $ZodAsyncError when the schema needs async parsing.
    const schema = z.object({ A: z.string().refine(() => Promise.resolve(true)) });

    expect(() => parseWithSchema(schema, { A: "x" })).toThrow(SchemaLoadError);
    expect(() => parseWithSchema(schema, { A: "x" })).toThrow(/async refinement/);
  });
});

describe("loadSchema", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "envpact-schema-"));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function loadFixture(name: string, contents: string): Promise<unknown> {
    const schemaPath = path.join(dir, name);
    await writeFile(schemaPath, contents);
    return loadSchema(schemaPath).catch((cause: unknown) => cause);
  }

  it("fails on a missing file, naming the path", async () => {
    const schemaPath = path.join(dir, "nope.schema.ts");
    const error = await loadSchema(schemaPath).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(SchemaLoadError);
    expect((error as SchemaLoadError).message).toContain(schemaPath);
  });

  it("fails when the default export is not a schema, naming what was found", async () => {
    const error = await loadFixture("number.mjs", "export default 42;");

    expect(error).toBeInstanceOf(SchemaLoadError);
    expect((error as SchemaLoadError).message).toContain("found a number");
    expect((error as SchemaLoadError).message).toContain("zod object schema");
  });

  it("fails when there is no default export", async () => {
    const error = await loadFixture("named-only.mjs", "export const schema = 1;");

    expect(error).toBeInstanceOf(SchemaLoadError);
    expect((error as SchemaLoadError).message).toContain("no default export");
  });

  it("fails on an unloadable module, without a stack trace in the message", async () => {
    const error = await loadFixture("broken.mjs", "export default {{{");

    expect(error).toBeInstanceOf(SchemaLoadError);
    expect((error as SchemaLoadError).message).toContain("Could not load the schema");
    expect((error as SchemaLoadError).message).not.toContain("    at ");
  });
});
