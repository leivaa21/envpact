import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ConfigError, loadConfig, parseEnvpactConfig } from "./config.ts";

const packageJsonPath = "/repo/app/package.json";

function pkg(envpact?: unknown): string {
  return JSON.stringify(envpact === undefined ? { name: "app" } : { name: "app", envpact });
}

describe("parseEnvpactConfig", () => {
  it("resolves schema/env/example paths against the package.json directory", () => {
    const config = parseEnvpactConfig(
      pkg({ schema: "./env.schema.ts", env: "config/.env", example: "config/.env.example" }),
      packageJsonPath,
    );

    expect(config.packageDir).toBe("/repo/app");
    expect(config.schemaPath).toBe("/repo/app/env.schema.ts");
    expect(config.envPath).toBe("/repo/app/config/.env");
    expect(config.examplePath).toBe("/repo/app/config/.env.example");
  });

  it('defaults env to ".env" and example to ".env.example"', () => {
    const config = parseEnvpactConfig(pkg({ schema: "./env.schema.ts" }), packageJsonPath);

    expect(config.env).toBe(".env");
    expect(config.example).toBe(".env.example");
    expect(config.envPath).toBe("/repo/app/.env");
    expect(config.examplePath).toBe("/repo/app/.env.example");
  });

  it("rejects a missing envpact key with a copy-pasteable snippet", () => {
    expect(() => parseEnvpactConfig(pkg(), packageJsonPath)).toThrow(ConfigError);
    expect(() => parseEnvpactConfig(pkg(), packageJsonPath)).toThrow(
      /"schema": "\.\/env\.schema\.ts"/,
    );
  });

  it("rejects a config without the required schema path, naming the field", () => {
    expect(() => parseEnvpactConfig(pkg({ env: ".env" }), packageJsonPath)).toThrow(
      /envpact\.schema/,
    );
  });

  it("rejects unknown config keys so typos fail loudly", () => {
    expect(() =>
      parseEnvpactConfig(
        pkg({ schema: "./env.schema.ts", exmaple: ".env.example" }),
        packageJsonPath,
      ),
    ).toThrow(/exmaple/);
  });

  it("rejects a non-object envpact value", () => {
    expect(() => parseEnvpactConfig(pkg("./env.schema.ts"), packageJsonPath)).toThrow(ConfigError);
  });

  it("rejects unparseable package.json contents, naming the file", () => {
    expect(() => parseEnvpactConfig("{ not json", packageJsonPath)).toThrow(
      /\/repo\/app\/package\.json is not valid JSON/,
    );
  });
});

describe("loadConfig", () => {
  let dir: string | undefined;

  afterEach(async () => {
    if (dir !== undefined) await rm(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("maps an unreadable package.json to a ConfigError instead of crashing", async () => {
    dir = await mkdtemp(path.join(tmpdir(), "envpact-config-"));
    // A DIRECTORY named package.json passes the existence probe but fails readFile (EISDIR).
    await mkdir(path.join(dir, "package.json"));

    const error = await loadConfig(dir).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ConfigError);
    expect((error as ConfigError).message).toContain("Could not read");
    expect((error as ConfigError).message).toContain(path.join(dir, "package.json"));
  });
});
