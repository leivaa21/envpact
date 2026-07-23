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

- `src/cli.ts` — the only file touching `process`; thin: argv in, output + exit code out.
- `src/run.ts` — pure dispatch: `(argv) → { output, exitCode }`. All commands stay pure
  functions over injected file contents so tests need no filesystem; file I/O enters through
  one small module when M1 lands.

## Project-specific conventions

- **Exit codes are the API.** CI is a first-class consumer: `0` = pact holds, `1` = broken
  contract / unknown command. Document any new code in the README the moment it exists.
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
