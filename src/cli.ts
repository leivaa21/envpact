#!/usr/bin/env node
import { messageOf } from "./errors.ts";
import { run } from "./run.ts";

/** EX_SOFTWARE: an envpact bug — never confusable with 0/1/2, the documented pact codes. */
const EXIT_INTERNAL_ERROR = 70;

try {
  const { output, exitCode } = await run(process.argv.slice(2), { cwd: process.cwd() });
  const stream = exitCode === 0 ? process.stdout : process.stderr;
  stream.write(`${output}\n`);
  process.exitCode = exitCode;
} catch (error) {
  process.stderr.write(
    `envpact crashed — this is a bug in envpact, not in your config. ` +
      `Please report it: https://github.com/leivaa21/envpact/issues (${messageOf(error)})\n`,
  );
  process.exitCode = EXIT_INTERNAL_ERROR;
}
