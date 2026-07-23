import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { messageOf } from "./errors.ts";

/** Misconfiguration (D-101/D-104): run.ts maps this to exit code 2 — the env is not at fault. */
export class ConfigError extends Error {
  override readonly name = "ConfigError";
}

// Strict on purpose: a typo like "exmaple" should fail loudly at the door, not be ignored.
const configShape = z.strictObject({
  schema: z.string().min(1),
  env: z.string().min(1).default(".env"),
  example: z.string().min(1).default(".env.example"),
});

export type EnvpactConfig = z.infer<typeof configShape>;

export interface ResolvedConfig extends EnvpactConfig {
  /** Directory of the package.json the config came from; relative paths resolve against it. */
  readonly packageDir: string;
  readonly schemaPath: string;
  readonly envPath: string;
  readonly examplePath: string;
}

const CONFIG_SNIPPET = `  "envpact": {
    "schema": "./env.schema.ts"
  }`;

const CONFIG_FOOTNOTE = `"schema" points at your zod schema module. Optional keys: "env" (default ".env") and "example" (default ".env.example").`;

/** Pure part of config loading — parses package.json contents; throws ConfigError. */
export function parseEnvpactConfig(contents: string, packageJsonPath: string): ResolvedConfig {
  const packageDir = path.dirname(packageJsonPath);

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new ConfigError(`${packageJsonPath} is not valid JSON: ${messageOf(error)}`);
  }

  if (typeof parsed !== "object" || parsed === null || !("envpact" in parsed)) {
    throw new ConfigError(
      `No "envpact" config found in ${packageJsonPath}.\n\n` +
        `Add this to your package.json:\n\n${CONFIG_SNIPPET}\n\n${CONFIG_FOOTNOTE}`,
    );
  }

  const result = configShape.safeParse((parsed as Record<string, unknown>).envpact);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${["envpact", ...issue.path.map(String)].join(".")}: ${issue.message}`)
      .join("\n");
    throw new ConfigError(
      `Invalid "envpact" config in ${packageJsonPath}:\n\n${problems}\n\n` +
        `Expected shape:\n\n${CONFIG_SNIPPET}\n\n${CONFIG_FOOTNOTE}`,
    );
  }

  const config = result.data;
  return {
    ...config,
    packageDir,
    schemaPath: path.resolve(packageDir, config.schema),
    envPath: path.resolve(packageDir, config.env),
    examplePath: path.resolve(packageDir, config.example),
  };
}

/** Loads the "envpact" config from the nearest package.json, walking up from `cwd`. */
export async function loadConfig(cwd: string): Promise<ResolvedConfig> {
  const packageJsonPath = await findNearestPackageJson(cwd);
  if (packageJsonPath === undefined) {
    throw new ConfigError(
      `No package.json found in ${cwd} or any parent directory.\n\n` +
        `envpact reads its config from the nearest package.json. Add this to it:\n\n` +
        `${CONFIG_SNIPPET}\n\n${CONFIG_FOOTNOTE}`,
    );
  }
  let contents: string;
  try {
    contents = await readFile(packageJsonPath, "utf8");
  } catch (error) {
    throw new ConfigError(`Could not read ${packageJsonPath}: ${messageOf(error)}`);
  }
  return parseEnvpactConfig(contents, packageJsonPath);
}

async function findNearestPackageJson(startDir: string): Promise<string | undefined> {
  let dir = path.resolve(startDir);
  for (;;) {
    const candidate = path.join(dir, "package.json");
    try {
      await access(candidate);
      return candidate;
    } catch {
      // not here — keep walking up
    }
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}
