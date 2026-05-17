# @react-doctor/core

## 0.2.0-beta.5

### Patch Changes

- [#252](https://github.com/millionco/react-doctor/pull/252) [`2d90c1c`](https://github.com/millionco/react-doctor/commit/2d90c1c5ae6d901913a575d40a784058478479ec) - Add public env-prefix detection (`get-public-env-prefix.ts`) and a
  recommendation builder (`build-no-secrets-recommendation.ts`) so
  client-secret diagnostics are scoped to actually client-reachable
  bindings instead of every string literal in the project.
  `run-oxlint.ts` and `runners/oxlint/config.ts` pass the detected
  prefix and the file-exposure classification through to the
  `no-secrets-in-client-code` rule.

- [#260](https://github.com/millionco/react-doctor/pull/260) [`b53d873`](https://github.com/millionco/react-doctor/commit/b53d8730459d2dc469a8f9841def231048c8de7e) Thanks [@NisargIO](https://github.com/NisargIO)! - `run-oxlint.ts` + `runners/oxlint/config.ts` thread the new
  locally-scoped-safe-bindings classification through to the GET
  handler rule so `response.headers` and locally-constructed `Map` /
  `Set` / `Headers` no longer fail the Next.js GET-handler diagnostic.

- [#271](https://github.com/millionco/react-doctor/pull/271) [`7a7ec84`](https://github.com/millionco/react-doctor/commit/7a7ec84fad631d96f70279394be5f086b8424d17) - **Per-surface diagnostic filtering.** New public API:
  `diagnostic-surface.ts` (the `DiagnosticSurface` type - `pr-comment`,
  `cli`, `ci-failure-gate`), `filter-for-surface.ts` (filter a
  diagnostic list to those allowed on a given surface), and extended
  `validate-config-types.ts` with `surfaces.*` schema. Consumers can
  now demote whole categories (design, Tailwind cleanup) from default
  PR comments while keeping them visible in the CLI report and the
  CI gate. Exported from `packages/core/src/index.ts`.

- [#266](https://github.com/millionco/react-doctor/pull/266) [`529015d`](https://github.com/millionco/react-doctor/commit/529015d1d89441c4708f49413ecd540db7c04255) - Scope React Native rules to per-package boundaries. Previously every
  `rn-*` rule fired on every file in a project whose top-level framework
  was detected as React Native or Expo - even on sibling workspaces that
  were clearly web targets. In a mixed RN + web monorepo (`apps/mobile`
  alongside `apps/web` and `packages/storybook`) the rules would noisily
  report issues against Next.js, Vite, Docusaurus, Storybook, and plain
  React DOM packages where they don't apply.

  React Native rules now walk up to the file's nearest `package.json`
  before running. The rule body is skipped when the package declares a
  web-only framework (`next`, `vite`, `react-scripts`, `gatsby`,
  `@remix-run/react`, `@docusaurus/core`, `@storybook/*`, or plain
  `react-dom` without an RN sibling) and stays active when the package
  declares `react-native`, `expo`, `react-native-tvos`, `react-native-windows`,
  `react-native-macos`, anything under the `@react-native/` or
  `@react-native-` community namespaces (`@react-native-firebase/*`,
  `@react-native-async-storage/*`, `@react-native-community/*`, …), or
  Metro's top-level `"react-native"` resolution field.

  The detection is bidirectional: a web-rooted monorepo (root
  `package.json` declares `next` or `vite`) still loads `rn-*` rules
  when any workspace targets React Native or Expo, so the rules now
  fire on `apps/mobile` of a `next`-rooted repo as well as the inverse
  layout that the file-level boundary alone covered.

  `rn-no-raw-text` additionally skips raw text inside `Platform.OS === "web"`
  branches: `if`, `?:`, and `&&` / `||` short-circuits, the mirror
  `Platform.OS !== "web"` else branches, `switch (Platform.OS) { case "web": … }`
  case bodies, and the `web` arm of `Platform.select({ web: …, default: … })`.
  Optional chaining (`Platform?.OS`) and the TS non-null assertion
  (`Platform.OS!`) parse the same way as the bare form. The walker stops
  at function and `Program` boundaries so JSX defined inside a callback
  hoisted out of a `Platform.OS` branch does not inherit the parent
  guard.

  Native-only file extensions (`.ios.tsx`, `.android.tsx`, `.native.tsx`)
  keep the rule active even when the surrounding package classification
  is ambiguous.

- Updated dependencies [[`529015d`](https://github.com/millionco/react-doctor/commit/529015d1d89441c4708f49413ecd540db7c04255)]:
  - oxlint-plugin-react-doctor@0.2.0-beta.5
  - @react-doctor/project-info@0.2.0-beta.3
  - @react-doctor/types@0.2.0-beta.3

## 0.2.0-beta.4

### Patch Changes

- Updated dependencies []:
  - oxlint-plugin-react-doctor@0.2.0-beta.4

## 0.2.0-beta.3

### Patch Changes

- Updated dependencies []:
  - oxlint-plugin-react-doctor@0.2.0-beta.3

## 0.2.0-beta.2

### Minor Changes

- [#249](https://github.com/millionco/react-doctor/pull/249) [`f0198e2`](https://github.com/millionco/react-doctor/commit/f0198e2f2d9560a15bdb4a78f4a378ca2ac5fcdd) - **New public package.** Extracted from the `react-doctor` monolith
  in [#249](https://github.com/millionco/react-doctor/pull/249).
  Public surface: the oxlint runner family
  (`runners/oxlint/{config,capabilities,resolve-use-call-binding}.ts`,
  `run-oxlint`, `apply-ignore-overrides`, `batch-include-paths`),
  scoring (`calculate-score`), config validation
  (`validate-config-types`, `can-oxlint-extend-config`), diagnostic
  combination / dedupe / JSON reports (`combine-diagnostics`,
  `dedupe-diagnostics`, `build-json-report`,
  `build-json-report-error`), and the
  `check-reduced-motion` / `collect-ignore-patterns` /
  `list-source-files` helpers. Consumers that previously reached into
  `react-doctor/src/utils/*` should switch to importing from
  `@react-doctor/core`.

### Patch Changes

- [#208](https://github.com/millionco/react-doctor/pull/208) [`8556b31`](https://github.com/millionco/react-doctor/commit/8556b31d8e4e165f791db0aa60a6b038b18ec777) - **User-feedback sweep.** Surface each rule's contribution to the
  project score via the new scoring transparency hooks, accept
  per-rule severity overrides, and accept a `ruleSet` selector from
  config - all without changing the public `diagnose()` signature.

- [#254](https://github.com/millionco/react-doctor/pull/254) [`bfaf9c9`](https://github.com/millionco/react-doctor/commit/bfaf9c9530a9f8761df6e2d69abcf44c1699ff77) - `runners/oxlint/capabilities.ts` now consults the detected React
  major version when deciding which capability flags to enable. The
  React-19-only rule families are switched off on React 18 projects
  so the runner stops emitting rules the project can't act on.

- [#257](https://github.com/millionco/react-doctor/pull/257) [`ffbd20f`](https://github.com/millionco/react-doctor/commit/ffbd20f3d0ebda2221d2ea93f87342165da90fdb) - Adds `runners/oxlint/resolve-use-call-binding.ts` (619 LOC binding
  resolver) and `runners/oxlint/should-suppress-local-use-hook-diagnostic.ts`
  so the runner can post-filter rules-of-hooks diagnostics that point
  at locally-defined `useX` helpers (not actually React hooks).

- [#262](https://github.com/millionco/react-doctor/pull/262) [`bca5d30`](https://github.com/millionco/react-doctor/commit/bca5d30fc549a16c4628001dcd2c5a83e85c04f8) - Eval-driven oxlint robustness pass. `run-oxlint.ts` now batches
  include paths via the new `list-source-files` helper instead of
  globbing the universe, `utils/dedupe-diagnostics.ts` collapses
  duplicate diagnostics emitted across batched runs, and the runner
  recovers diagnostics from large monorepo projects that previously
  silently dropped output. Backed by `dedupe-diagnostics.test.ts`,
  `oxlint-batching.test.ts`, and `build-json-report.test.ts`.

- Updated dependencies []:
  - oxlint-plugin-react-doctor@0.2.0-beta.2
  - @react-doctor/project-info@0.2.0-beta.2
  - @react-doctor/types@0.2.0-beta.2
