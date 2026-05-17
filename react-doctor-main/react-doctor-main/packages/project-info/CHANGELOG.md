# @react-doctor/project-info

## 0.2.0-beta.3

### Patch Changes

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

- [#262](https://github.com/millionco/react-doctor/pull/262) [`bca5d30`](https://github.com/millionco/react-doctor/commit/bca5d30fc549a16c4628001dcd2c5a83e85c04f8) - `list-workspace-packages.ts` enumerates each workspace's declared
  framework so per-package rule scoping (used by the RN rules in
  beta.5) can short-circuit before the file walker runs.

- Updated dependencies [[`529015d`](https://github.com/millionco/react-doctor/commit/529015d1d89441c4708f49413ecd540db7c04255)]:
  - @react-doctor/types@0.2.0-beta.3

## 0.2.0-beta.2

### Minor Changes

- [#249](https://github.com/millionco/react-doctor/pull/249) [`f0198e2`](https://github.com/millionco/react-doctor/commit/f0198e2f2d9560a15bdb4a78f4a378ca2ac5fcdd) - **New public package.** Project / dependency / framework detection,
  extracted from the `react-doctor` monolith in
  [#249](https://github.com/millionco/react-doctor/pull/249). Public
  surface: `discover-project`, `extract-dependency-info`,
  `find-dependency-info-from-monorepo-root`,
  `find-react-in-workspaces`, `parse-react-major`,
  `parse-react-peer-range`, `resolve-catalog-version` (pnpm + Bun
  grouped catalogs), `resolve-effective-react-major`,
  `list-workspace-packages`, and the
  `utils/{dependency-version-spec,get-dependency-declaration,is-concrete-dependency-version}.ts`
  helpers.

### Patch Changes

- [#194](https://github.com/millionco/react-doctor/pull/194) - Resolve
  the React version from Bun grouped catalogs (in addition to pnpm
  catalogs) so monorepos using Bun for dependency hoisting still get
  an accurate React major back from `resolve-catalog-version`.

- [#254](https://github.com/millionco/react-doctor/pull/254) [`bfaf9c9`](https://github.com/millionco/react-doctor/commit/bfaf9c9530a9f8761df6e2d69abcf44c1699ff77) - React major-version resolution hardens against the shapes that
  showed up in beta-tester repros. Shared dependency-version-spec
  parsing replaces the per-call regexes
  (`utils/dependency-version-spec.ts`); monorepo-root traversal walks
  parent `package.json` peer ranges
  (`find-dependency-info-from-monorepo-root.ts`); and
  `is-concrete-dependency-version.ts` distinguishes pinned versions
  from ranges so React-19-only rules don't activate on `^18 || ^19`
  declarations.

- Updated dependencies []:
  - @react-doctor/types@0.2.0-beta.2
