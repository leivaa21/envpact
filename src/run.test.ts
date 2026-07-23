import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import pkg from "../package.json" with { type: "json" };
import { run } from "./run.ts";

describe("run", () => {
  // A temp dir with an envpact-less package.json: hermetic for the argv-only paths, and a
  // deterministic nearest-package.json for the check path (unlike assuming "/" is empty).
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "envpact-run-"));
    await writeFile(path.join(dir, "package.json"), JSON.stringify({ name: "fixture" }));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("prints the package version for --version", async () => {
    const result = await run(["--version"], { cwd: dir });

    expect(result.output).toBe(pkg.version);
    expect(result.exitCode).toBe(0);
  });

  it("prints usage for --help and for a bare invocation", async () => {
    for (const argv of [["--help"], []]) {
      const result = await run(argv, { cwd: dir });

      expect(result.output).toContain("Usage:");
      expect(result.exitCode).toBe(0);
    }
  });

  it("fails on an unknown command with exit 2 (usage error, D-104) and names it", async () => {
    const result = await run(["chekc"], { cwd: dir });

    expect(result.output).toContain('Unknown command "chekc"');
    expect(result.exitCode).toBe(2);
  });

  it("maps a missing envpact config to exit 2 with a copy-pasteable snippet", async () => {
    const result = await run(["check"], { cwd: dir });

    expect(result.exitCode).toBe(2);
    expect(result.output).toContain('"envpact"');
    expect(result.output).toContain('"schema": "./env.schema.ts"');
  });
});
