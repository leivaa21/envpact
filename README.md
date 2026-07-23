# envpact

> A pact between your env schema and your `.env` — validate, generate `.env.example`, detect
> drift.

![status](https://img.shields.io/badge/status-pre--release-orange)
![node](https://img.shields.io/badge/node-%E2%89%A5%2024-brightgreen)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Your environment variables are an API without a contract: nothing guarantees that the vars
your code needs exist, are well-formed, or match what `.env.example` promises new teammates.
**envpact** makes that contract explicit — a [zod](https://zod.dev) schema is the single
source of truth, and the CLI enforces it:

- ✅ **`envpact check`** — validate your `.env` against the schema. Broken pact → exit `1`,
  with an error that names the variable, what was expected, and how to fix it.
- 📄 **`envpact example`** — generate a documented `.env.example` from the schema. It can
  never drift, because it isn't hand-written.
- 🔍 **`envpact diff`** — report drift between schema, `.env`, and `.env.example` — the vars
  someone added to code but never documented, and the ones documented but no longer used.

Kill the _"works on my machine, missing var in prod"_ class of bugs at commit time, not at
3 a.m.

> **Status:** pre-release — the CLI shell is published here while `check`, `example`, and
> `diff` land in M1. Not on npm yet; the examples below show the committed design.

## How it will look

Define the contract once:

```ts
// env.schema.ts
import { z } from "zod";

export default z.object({
  // Port the API listens on
  PORT: z.coerce.number().int().min(1).max(65535),
  // MongoDB connection string
  MONGO_URL: z.string().url(),
  // Optional: verbose request logging
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});
```

Then let the CLI hold you to it:

```console
$ envpact check
✖ Broken pact — 2 problems in .env

  MONGO_URL   expected a URL, got "localhost:27017"
              → add a scheme, e.g. mongodb://localhost:27017

  PORT        missing — required by env.schema.ts
              → set PORT in .env (integer between 1 and 65535)

$ echo $?
1
```

CI is a first-class consumer: wire `envpact check` into your pipeline and a broken contract
fails the build before it fails production.

## Install

Not yet on npm — landing with M1. When it does:

```bash
pnpm add -D envpact    # or npm i -D / npx envpact
```

Until then, run it from source:

```bash
git clone git@github.com:leivaa21/envpact.git
cd envpact && pnpm install
pnpm dev --help
```

## Exit codes

Exit codes are part of the public API and follow semver:

| Code | Meaning                                                                                    |
| ---- | ------------------------------------------------------------------------------------------ |
| `0`  | Pact holds — env matches the schema                                                        |
| `1`  | Broken pact — env doesn't match the schema, or the env file is missing                     |
| `2`  | Usage or config error — missing/invalid `envpact` config, bad schema file, unknown command |
| `70` | Internal envpact bug — please [report it](https://github.com/leivaa21/envpact/issues)      |

## What envpact is _not_

A contract checker, not a secrets manager — no secret storage, no encryption, no remote
sync, no runtime dotenv replacement. Pair it with whatever loads your env; envpact only
guarantees the contract holds.

## Roadmap

- [x] CLI shell — `--help` / `--version`, CI-friendly exit codes
- [ ] **M1** — `check` + `example`, dogfooded on a real repo, published to npm
- [ ] **M2** — `diff` + watch mode
- [ ] Monorepo support — one pact per package

## Contributing

Issues and PRs welcome. The codebase is deliberately small and readable — `src/run.ts` is
pure dispatch (`argv → { output, exitCode }`), `src/cli.ts` is the only file touching
`process`, and every behavioral change ships with a test (`pnpm test`, `pnpm lint`,
`pnpm typecheck` must be green). Design history lives in [docs/decisions.md](docs/decisions.md).

## License

MIT © Adrián Leiva ([leivaa21](https://github.com/leivaa21)) · built in public as part of
[whos.leivaa.dev](https://whos.leivaa.dev)
