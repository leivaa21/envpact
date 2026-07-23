# Decisions

## 2026-07-23 — TypeScript pinned to 6.x (not 7)

**Context:** `pnpm add -D typescript` resolved to 7.0.2 (the new Go-based compiler).
`tsc`/tsup/vitest all worked, but typescript-eslint 8.65 refuses TS 7.0 outright, breaking
`pnpm lint`.
**Decision:** pin `typescript@^6.0.3` until typescript-eslint supports TS ≥ 7
(tracking: typescript-eslint/typescript-eslint#10940).
**Consequences:** revisit on typescript-eslint releases; nothing in the codebase depends on
6.x-only behavior, so the unpin should be a one-line bump.

## 2026-07-23 — `.ts`-extension imports + Node-native dev

**Context:** dev runs `node src/cli.ts` directly (Node 24 type stripping), which does not
rewrite NodeNext-style `./run.js` specifiers to `.ts` files.
**Decision:** import with real `.ts` extensions and enable `allowImportingTsExtensions`
(valid because `tsc` is noEmit-only; tsup/esbuild and vitest resolve them natively). No tsx/
ts-node dependency.
**Consequences:** if the package ever emits with `tsc` instead of tsup, switch to
`rewriteRelativeImportExtensions` or back to `.js` specifiers.
