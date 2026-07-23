import { loadConfig } from "../config.ts";
import { readEnvFile } from "../env-file.ts";
import type { RunResult } from "../run.ts";
import { loadSchema, parseWithSchema } from "../schema-loader.ts";

import { renderBrokenPact } from "./check-report.ts";

/**
 * `envpact check` — config → schema → env file → safeParse (D-105: checks the configured
 * file only, never process.env). Throws ConfigError / SchemaLoadError / EnvFileError;
 * run.ts maps those to exit codes.
 */
export async function runCheck(cwd: string): Promise<RunResult> {
  const config = await loadConfig(cwd);
  const schema = await loadSchema(config.schemaPath);
  const env = await readEnvFile(config.envPath, config.env);

  const result = parseWithSchema(schema, env);
  if (result.success) {
    return { output: `✔ Pact holds — ${config.env} matches ${config.schema}`, exitCode: 0 };
  }
  return {
    output: renderBrokenPact(result.error.issues, env, {
      envName: config.env,
      schemaName: config.schema,
    }),
    exitCode: 1,
  };
}
