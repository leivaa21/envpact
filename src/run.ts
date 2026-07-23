import pkg from "../package.json" with { type: "json" };

export interface RunResult {
  readonly output: string;
  readonly exitCode: number;
}

const HELP = `envpact — a pact between your env schema and your .env

Usage:
  envpact <command> [options]

Commands (landing in M1):
  check      validate .env against the schema
  example    generate .env.example from the schema
  diff       report drift between schema, .env and .env.example

Options:
  -h, --help       show this help
  -v, --version    print the version`;

export function run(argv: readonly string[]): RunResult {
  const [command] = argv;

  if (command === "-v" || command === "--version") {
    return { output: pkg.version, exitCode: 0 };
  }
  if (command === undefined || command === "-h" || command === "--help") {
    return { output: HELP, exitCode: 0 };
  }
  return { output: `Unknown command "${command}".\n\n${HELP}`, exitCode: 1 };
}
