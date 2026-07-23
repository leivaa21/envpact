import pkg from "../package.json" with { type: "json" };
import { runCheck } from "./commands/check.ts";
import { ConfigError } from "./config.ts";
import { EnvFileError } from "./env-file.ts";
import { SchemaLoadError } from "./schema-loader.ts";

export interface RunResult {
  readonly output: string;
  readonly exitCode: number;
}

export interface RunOptions {
  /** Injected by cli.ts (process.cwd()) so run stays free of process globals. */
  readonly cwd: string;
}

const HELP = `envpact — a pact between your env schema and your .env

Usage:
  envpact <command> [options]

Commands:
  check      validate .env against the schema
  example    generate .env.example from the schema (landing in M1)
  diff       report drift between schema, .env and .env.example (landing in M2)

Options:
  -h, --help       show this help
  -v, --version    print the version

Exit codes:
  0  pact holds · 1  broken pact · 2  usage or config error`;

export async function run(argv: readonly string[], options: RunOptions): Promise<RunResult> {
  const [command] = argv;

  if (command === "-v" || command === "--version") {
    return { output: pkg.version, exitCode: 0 };
  }
  if (command === undefined || command === "-h" || command === "--help") {
    return { output: HELP, exitCode: 0 };
  }
  if (command === "check") {
    return runCommand(() => runCheck(options.cwd));
  }
  return { output: `Unknown command "${command}".\n\n${HELP}`, exitCode: 2 };
}

/** Maps each module's typed error to its exit code (D-104: 2 = misconfigured, 1 = broken pact). */
async function runCommand(command: () => Promise<RunResult>): Promise<RunResult> {
  try {
    return await command();
  } catch (error) {
    if (error instanceof ConfigError || error instanceof SchemaLoadError) {
      return { output: error.message, exitCode: 2 };
    }
    if (error instanceof EnvFileError) {
      return { output: error.message, exitCode: 1 };
    }
    throw error; // a bug in envpact, not a user mistake — let it surface loudly
  }
}
