# CLAUDE.md — envpact

> **What this repo is:** a CLI that treats your environment variables as a typed contract — a
> zod schema is the single source of truth, and envpact validates `.env` against it, generates
> `.env.example`, and detects drift between the three.
> Part of leivaa's public-projects workspace — the workspace `../CLAUDE.md` rules (quality,
> security, docs, git) apply here in full; this file only adds what's specific to this project.
> Read this file before every task and re-read the **Current state** line.

> **Current state (2026-07-23):** freshly scaffolded — CLI entry with `--help`/`--version`,
> test/lint/typecheck/build green; `check`/`example`/`diff` are stubs in the help text only.
> Next: **M1 — `check` + `example` end-to-end, dogfooded on the portfolio repo, published to
> npm.** Keep this line current after every merged slice.

## Identity

- **Registry index:** 0 (see `../PROJECTS.md`)
- **Ports:** none (CLI)
- **Repo:** github.com/leivaa21/envpact · **License:** MIT
- **npm:** `envpact` (verified free 2026-07-23; original working name "envdoctor" was taken)

## What it does & how it's shaped

Single-package TypeScript CLI — deliberately flat, no hexagonal layering (size-to-fit): the
domain is small enough that `src/` with focused modules is the honest structure. Node 24
(runs TS directly in dev via type stripping), ESM only, tsup bundles `src/cli.ts` to `dist/`.

Core split to preserve as it grows:

- `src/cli.ts` — the only file touching `process`; thin: argv in, output + exit code out
  (plus a last-resort catch that maps envpact bugs to exit `70`).
- `src/run.ts` — dispatch: `(argv, { cwd }) → { output, exitCode }`, with `cwd` injected by
  cli.ts; also maps each module's typed error to its exit code.
- File and module I/O is confined to `src/config.ts`, `src/env-file.ts`, and
  `src/schema-loader.ts`. Commands (`src/commands/`) orchestrate those modules; validation
  and rendering stay pure functions over parsed data so their tests need no filesystem.

## Project-specific conventions

- **Exit codes are the API.** CI is a first-class consumer: `0` = pact holds, `1` = broken
  pact (env doesn't match the schema, or the env file is missing), `2` = usage/config error
  (missing/invalid `envpact` config, bad schema file, unknown command — D-104), `70` =
  internal envpact bug (never confusable with the pact codes). Document any new code in the
  README the moment it exists.
- **Error messages are the product.** Every failure names the variable, what was expected,
  and how to fix it. No stack traces to users.
- **Zod is the schema language** — don't invent a DSL.
- Runtime dependencies need strong justification (zod is planned; each addition beyond it is
  a decision for `docs/decisions.md`).

## Commands

```bash
pnpm install
pnpm dev --help      # runs src/cli.ts directly on Node 24 (no `--`: pnpm forwards flags as-is)
pnpm test
pnpm lint && pnpm typecheck
pnpm build           # tsup → dist/cli.js
```

## Non-goals

No secret storage, no encryption, no remote sync, no runtime dotenv replacement — envpact is
a contract checker, not a secrets manager. Say no on purpose.
