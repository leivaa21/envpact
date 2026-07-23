import { execFile } from "node:child_process";
import { cp, lstat, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import { run } from "../run.ts";

const execFileAsync = promisify(execFile);

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

const SCHEMA = `import { z } from "zod";

export default z.object({
  PORT: z.coerce.number().int().min(1).max(65535),
  MONGO_URL: z.url(),
  API_TOKEN: z.string().min(40),
});
`;

const VALID_ENV = `PORT=5010
MONGO_URL=mongodb://localhost:27017
API_TOKEN=0123456789012345678901234567890123456789
`;

describe("envpact check (integration: real files, real import())", () => {
  let dir: string;

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  /**
   * A throwaway project dir. By default node_modules is symlinked (Node realpaths it to the
   * repo's zod). `separateZod` instead COPIES the zod package, dereferenced, so the schema
   * resolves a genuinely distinct zod module instance — the D-102 interop scenario.
   */
  async function createProject(
    files: Readonly<Record<string, string>>,
    options: { readonly separateZod?: boolean } = {},
  ): Promise<void> {
    dir = await mkdtemp(path.join(tmpdir(), "envpact-check-"));
    if (options.separateZod === true) {
      await cp(path.join(repoRoot, "node_modules", "zod"), path.join(dir, "node_modules", "zod"), {
        recursive: true,
        dereference: true,
      });
    } else {
      await symlink(path.join(repoRoot, "node_modules"), path.join(dir, "node_modules"), "dir");
    }
    for (const [name, contents] of Object.entries(files)) {
      await writeFile(path.join(dir, name), contents);
    }
  }

  function packageJson(envpact: unknown): string {
    return JSON.stringify({ name: "fixture", type: "module", envpact });
  }

  /** Runs the real CLI (src/cli.ts on Node, native module resolution) in the fixture dir. */
  async function runCliCheck(
    cwd: string,
  ): Promise<{ readonly output: string; readonly exitCode: number }> {
    const cliPath = path.join(repoRoot, "src", "cli.ts");
    try {
      const { stdout, stderr } = await execFileAsync(process.execPath, [cliPath, "check"], { cwd });
      return { output: stdout + stderr, exitCode: 0 };
    } catch (error) {
      const failure = error as { code?: number; stdout?: string; stderr?: string };
      return {
        output: (failure.stdout ?? "") + (failure.stderr ?? ""),
        exitCode: failure.code ?? -1,
      };
    }
  }

  it("exits 0 with a success line when the env matches the schema", async () => {
    await createProject({
      "package.json": packageJson({ schema: "./env.schema.ts" }),
      "env.schema.ts": SCHEMA,
      ".env": VALID_ENV,
    });

    const result = await run(["check"], { cwd: dir });

    expect(result.output).toContain("✔ Pact holds");
    expect(result.exitCode).toBe(0);
  });

  it("finds the nearest package.json when run from a subdirectory", async () => {
    await createProject({
      "package.json": packageJson({ schema: "./env.schema.ts" }),
      "env.schema.ts": SCHEMA,
      ".env": VALID_ENV,
    });
    const nested = path.join(dir, "src", "deep");
    await mkdir(nested, { recursive: true });

    const result = await run(["check"], { cwd: nested });

    expect(result.exitCode).toBe(0);
  });

  it("exits 1 on a broken pact, naming each variable but never a value", async () => {
    await createProject({
      "package.json": packageJson({ schema: "./env.schema.ts" }),
      "env.schema.ts": SCHEMA,
      ".env": "PORT=not-a-port\nAPI_TOKEN=supersecret\n",
    });

    const result = await run(["check"], { cwd: dir });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("✖ Broken pact — 3 problems in .env");
    expect(result.output).toContain("PORT");
    expect(result.output).toContain("MONGO_URL");
    expect(result.output).toContain("API_TOKEN");
    expect(result.output).not.toContain("supersecret");
    expect(result.output).not.toContain("not-a-port");
  });

  it("passes when .env has extra vars: the pact only covers declared ones (diff is M2's job)", async () => {
    await createProject({
      "package.json": packageJson({ schema: "./env.schema.ts" }),
      "env.schema.ts": SCHEMA,
      ".env": `${VALID_ENV}UNDECLARED_EXTRA=anything\n`,
    });

    const result = await run(["check"], { cwd: dir });

    expect(result.exitCode).toBe(0);
  });

  it("exits 1 when the env file is missing, pointing at the expected path", async () => {
    await createProject({
      "package.json": packageJson({ schema: "./env.schema.ts", env: ".env.local" }),
      "env.schema.ts": SCHEMA,
    });

    const result = await run(["check"], { cwd: dir });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain(path.join(dir, ".env.local"));
    expect(result.output).toContain("envpact example");
  });

  it("exits 2 with the config snippet when package.json has no envpact key", async () => {
    await createProject({ "package.json": JSON.stringify({ name: "fixture" }) });

    const result = await run(["check"], { cwd: dir });

    expect(result.exitCode).toBe(2);
    expect(result.output).toContain('"schema": "./env.schema.ts"');
  });

  it("interops with a physically separate zod v4 instance in the project (D-102)", async () => {
    await createProject(
      {
        "package.json": packageJson({ schema: "./env.schema.ts" }),
        "env.schema.ts": SCHEMA,
        ".env": VALID_ENV,
      },
      { separateZod: true },
    );

    // Separation by construction: the fixture's zod is a real copied directory, and the CLI
    // is spawned as a subprocess so native Node resolution (nearest node_modules, no test
    // runner dedupe) is guaranteed to load that copy for the schema, while envpact itself
    // loads the repo's zod — two live instances, bridged only by the structural check.
    const zodStats = await lstat(path.join(dir, "node_modules", "zod"));
    expect(zodStats.isDirectory()).toBe(true);
    expect(zodStats.isSymbolicLink()).toBe(false);

    const holds = await runCliCheck(dir);
    expect(holds.exitCode).toBe(0);
    expect(holds.output).toContain("✔ Pact holds");

    await writeFile(path.join(dir, ".env"), "PORT=not-a-port\n");
    const broken = await runCliCheck(dir);
    expect(broken.exitCode).toBe(1);
    expect(broken.output).toContain("✖ Broken pact");
    expect(broken.output).not.toContain("not-a-port");
  });

  it("exits 2 instead of crashing when the schema uses an async refinement", async () => {
    await createProject({
      "package.json": packageJson({ schema: "./env.schema.ts" }),
      "env.schema.ts":
        'import { z } from "zod";\n' +
        "export default z.object({ PORT: z.string().refine(async () => true) });\n",
      ".env": "PORT=5010\n",
    });

    const result = await run(["check"], { cwd: dir });

    expect(result.exitCode).toBe(2);
    expect(result.output).toContain("async refinement");
    expect(result.output).not.toContain("    at "); // no stack trace
  });

  it("exits 2 naming the nearest package.json when a child without envpact shadows a parent with it", async () => {
    // Chosen monorepo semantics: the NEAREST package.json wins outright — a parent's envpact
    // config is never consulted once a child package.json exists.
    await createProject({
      "package.json": packageJson({ schema: "./env.schema.ts" }),
      "env.schema.ts": SCHEMA,
      ".env": VALID_ENV,
    });
    const child = path.join(dir, "packages", "app");
    await mkdir(child, { recursive: true });
    await writeFile(path.join(child, "package.json"), JSON.stringify({ name: "child" }));

    const result = await run(["check"], { cwd: child });

    expect(result.exitCode).toBe(2);
    expect(result.output).toContain(path.join(child, "package.json"));
  });

  it("exits 2 when the schema file does not default-export a zod object schema", async () => {
    await createProject({
      "package.json": packageJson({ schema: "./env.schema.ts" }),
      "env.schema.ts": 'import { z } from "zod";\nexport default z.string();\n',
      ".env": VALID_ENV,
    });

    const result = await run(["check"], { cwd: dir });

    expect(result.exitCode).toBe(2);
    expect(result.output).toContain("a zod string schema");
  });
});
