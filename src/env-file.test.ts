import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { EnvFileError, parseEnvContents, readEnvFile } from "./env-file.ts";

describe("parseEnvContents", () => {
  it("parses KEY=value pairs", () => {
    expect(parseEnvContents("PORT=5010\nHOST=localhost")).toEqual({
      PORT: "5010",
      HOST: "localhost",
    });
  });

  it("ignores comments and blank lines", () => {
    expect(parseEnvContents("# a comment\n\nPORT=5010\n")).toEqual({ PORT: "5010" });
  });

  it("strips surrounding quotes and keeps inner content intact", () => {
    expect(parseEnvContents("URL=\"mongodb://localhost:27017\"\nMSG='hi there'")).toEqual({
      URL: "mongodb://localhost:27017",
      MSG: "hi there",
    });
  });

  it("keeps an explicitly empty value as an empty string", () => {
    expect(parseEnvContents("EMPTY=")).toEqual({ EMPTY: "" });
  });

  it("supports the `export KEY=value` shell style", () => {
    expect(parseEnvContents("export PORT=5010")).toEqual({ PORT: "5010" });
  });

  it("returns an empty record for empty contents", () => {
    expect(parseEnvContents("")).toEqual({});
  });
});

describe("readEnvFile", () => {
  let dir: string | undefined;

  afterEach(async () => {
    if (dir !== undefined) await rm(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("reads and parses an existing env file", async () => {
    dir = await mkdtemp(path.join(tmpdir(), "envpact-env-"));
    const envPath = path.join(dir, ".env");
    await writeFile(envPath, "PORT=5010\n");

    await expect(readEnvFile(envPath, ".env")).resolves.toEqual({ PORT: "5010" });
  });

  it("fails on a missing file, naming the expected path and suggesting `envpact example`", async () => {
    const envPath = path.join(tmpdir(), "envpact-definitely-missing", ".env");

    const error = await readEnvFile(envPath, ".env").catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(EnvFileError);
    expect((error as EnvFileError).message).toContain(envPath);
    expect((error as EnvFileError).message).toContain("envpact example");
  });

  it("reports a non-ENOENT read failure honestly instead of claiming the file is missing", async () => {
    dir = await mkdtemp(path.join(tmpdir(), "envpact-env-"));
    const envPath = path.join(dir, ".env");
    await mkdir(envPath); // a DIRECTORY at the env path: readFile fails with EISDIR

    const error = await readEnvFile(envPath, ".env").catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(EnvFileError);
    expect((error as EnvFileError).message).toContain("could not read .env");
    expect((error as EnvFileError).message).not.toContain("not found");
  });
});
