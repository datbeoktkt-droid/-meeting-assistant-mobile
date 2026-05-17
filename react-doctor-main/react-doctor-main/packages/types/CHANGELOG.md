# @react-doctor/types

## 0.2.0-beta.3

### Patch Changes

- [#266](https://github.com/millionco/react-doctor/pull/266) [`529015d`](https://github.com/millionco/react-doctor/commit/529015d1d89441c4708f49413ecd540db7c04255) - Adds the package-classification type surface that the React Native
  rule scoping work in `oxlint-plugin-react-doctor` consumes (allowed
  framework names, RN-package detectors, Metro resolution-field
  shape). See the
  [#266](https://github.com/millionco/react-doctor/pull/266)
  description in the oxlint plugin / core changelogs for the full
  behavioural picture.

- [#262](https://github.com/millionco/react-doctor/pull/262) [`bca5d30`](https://github.com/millionco/react-doctor/commit/bca5d30fc549a16c4628001dcd2c5a83e85c04f8) - `inspect.ts` exposes additional fields used by the dedupe + batched
  oxlint runner in `@react-doctor/core@0.2.0-beta.5` so downstream
  consumers can typecheck against the new diagnostic shape.

## 0.2.0-beta.2

### Minor Changes

- [#249](https://github.com/millionco/react-doctor/pull/249) [`f0198e2`](https://github.com/millionco/react-doctor/commit/f0198e2f2d9560a15bdb4a78f4a378ca2ac5fcdd) - **New public package.** Shared TypeScript types, extracted from the
  `react-doctor` monolith in
  [#249](https://github.com/millionco/react-doctor/pull/249). Public
  surface: per-rule metadata interfaces (severity, category,
  framework, recommendation, examples - the colocation shape used by
  [#228](https://github.com/millionco/react-doctor/pull/228) /
  [#230](https://github.com/millionco/react-doctor/pull/230) /
  [#231](https://github.com/millionco/react-doctor/pull/231) /
  [#234](https://github.com/millionco/react-doctor/pull/234)),
  diagnostic + inspect types, the single `RuleSeverity` enum
  (deduped in
  [#245](https://github.com/millionco/react-doctor/pull/245)), and
  `EsTreeNode = TSESTree.Node` from
  [#235](https://github.com/millionco/react-doctor/pull/235)
  - the loose `[key: string]: any` escape hatch on AST node types is
  gone. Consumers writing custom rule shims can now import these
  from `@react-doctor/types` instead of redeclaring them locally.
