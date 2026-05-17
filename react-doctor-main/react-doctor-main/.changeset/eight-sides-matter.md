---
"@react-doctor/core": patch
"eslint-plugin-react-doctor": patch
"oxlint-plugin-react-doctor": patch
"@react-doctor/project-info": patch
"react-doctor": patch
"@react-doctor/types": patch
---

Rule-fix wave for the 0.2.0-beta.5 release:

- Scope `no-secrets-in-client-code` to client-reachable bindings -
  skips server-only modules, public env-prefixed values, and
  locally-classified safe files (#252).
- `nextjs-no-side-effect-in-get-handler` stops flagging
  `response.headers.set(...)` and locally-constructed `Map` / `Set` /
  `Headers` inside GET handlers; the same safe-bindings classifier
  benefits `server-auth-actions` and the TanStack Start
  `get-mutation` rule (#260).
- `async-defer-await` no longer reports awaits inside destructured
  patterns with defaults, bare-statement early-returns, or awaits
  guarded by an earlier `if … return …` (#265).
- `js-length-check-first` detects length guards anywhere earlier in
  an `&&` chain, not only as the immediate left operand (#269).
- `async-parallel` is suppressed in test files, browser-fixture /
  Playwright helpers, and ordered UI flows where serial awaits are
  deliberate (#270).
- `js-combine-iterations` skips lazy `Iterator` helper chains
  (`Iterator.from`, `Iterator.prototype.{map,filter,take,drop,…}`)
  whose evaluation semantics differ from `Array.prototype` (#272,
  resolves #205).
- `no-prevent-default` is framework-aware: Remix / Next.js
  progressive-enhancement form handlers, synthetic event types with
  no documented alternative, and form `onSubmit` handlers that
  subsequently call `fetch` / a server action no longer trip (#274).
- New per-surface diagnostic controls in `@react-doctor/core` +
  `react-doctor`: design and Tailwind cleanup categories are demoted
  from the default PR-comment surface while staying visible in the
  CLI report and at the CI failure gate (#271).
