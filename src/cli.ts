#!/usr/bin/env node
import { run } from "./run.ts";

const { output, exitCode } = run(process.argv.slice(2));
const stream = exitCode === 0 ? process.stdout : process.stderr;
stream.write(`${output}\n`);
process.exitCode = exitCode;
