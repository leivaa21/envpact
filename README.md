# envpact

A pact between your env schema and your `.env`. Define your environment contract once as a
zod schema and envpact validates `.env` against it, generates a documented `.env.example`,
and detects drift — killing the "works on my machine, missing var in prod" class of bugs at
commit time.

> **Status: pre-release scaffold.** The CLI shell is in place; `check`, `example`, and `diff`
> land in M1. Not yet on npm.

## Quickstart

```bash
git clone git@github.com:leivaa21/envpact.git
cd envpact
pnpm install
pnpm dev --help
```

Planned usage once M1 lands:

```bash
envpact check      # validate .env against the schema → CI-friendly exit code
envpact example    # (re)generate .env.example from the schema
envpact diff       # drift report: schema vs .env vs .env.example
```

## Architecture

```
src/
├── cli.ts        # entry — the only file touching process; argv in, exit code out
├── run.ts        # pure dispatch: (argv) → { output, exitCode }
└── run.test.ts
```

Commands are pure functions over injected file contents — the filesystem enters through one
small module (M1), so everything else tests without I/O. Node ≥ 24, ESM, bundled with tsup.

## Decisions

- **Zod as the schema language** — one source of truth teams already know; no bespoke DSL.
- **Exit codes are the API** — built CI-first: `0` pact holds, `1` broken contract.
- **Contract checker, not a secrets manager** — no storage, encryption, or sync, by design.

## Status

- [x] Scaffold: CLI entry, `--help`/`--version`, tests/lint/typecheck/build green
- [ ] M1: `check` + `example`, dogfooded on a real repo, published to npm
- [ ] M2: `diff` + watch mode

---

MIT © Adrián Leiva ([leivaa21](https://github.com/leivaa21)) · part of
[whos.leivaa.dev](https://whos.leivaa.dev)
