import { readFile } from "node:fs/promises";

import dotenv from "dotenv";

import { messageOf } from "./errors.ts";

/** Unusable env file (D-105): the pact cannot hold, so run.ts maps this to exit code 1. */
export class EnvFileError extends Error {
  override readonly name = "EnvFileError";
}

export type ParsedEnv = Readonly<Record<string, string>>;

/** Parse-only per D-102: never mutates process.env, never calls dotenv.config(). */
export function parseEnvContents(contents: string): ParsedEnv {
  return dotenv.parse(contents);
}

function isFileNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export async function readEnvFile(envPath: string, displayName: string): Promise<ParsedEnv> {
  let contents: string;
  try {
    contents = await readFile(envPath, "utf8");
  } catch (error) {
    if (isFileNotFound(error)) {
      throw new EnvFileError(
        `✖ Broken pact — env file not found: expected ${displayName} at ${envPath}\n\n` +
          `  → create ${displayName}, or generate a template with \`envpact example\` ` +
          `and fill it in`,
      );
    }
    // Anything else (EACCES, EISDIR, …) is not "missing" — say what actually happened.
    throw new EnvFileError(
      `✖ Broken pact — could not read ${displayName} at ${envPath}:\n  ${messageOf(error)}`,
    );
  }
  return parseEnvContents(contents);
}
