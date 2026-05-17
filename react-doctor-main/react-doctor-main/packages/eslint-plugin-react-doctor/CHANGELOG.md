# eslint-plugin-react-doctor

## 0.2.0-beta.5

### Patch Changes

- Inherits the rule-fix wave from
  `oxlint-plugin-react-doctor@0.2.0-beta.5` via the shared rule
  registry: `no-secrets-in-client-code` scoping
  ([#252](https://github.com/millionco/react-doctor/pull/252)),
  `nextjs-no-side-effect-in-get-handler` safe local bindings
  ([#260](https://github.com/millionco/react-doctor/pull/260)),
  `async-defer-await` destructuring / bare-statement / early-return
  fixes ([#265](https://github.com/millionco/react-doctor/pull/265)),
  `js-length-check-first` `&&`-chain detection
  ([#269](https://github.com/millionco/react-doctor/pull/269)),
  `async-parallel` test / browser-fixture suppression
  ([#270](https://github.com/millionco/react-doctor/pull/270)),
  `js-combine-iterations` lazy `Iterator` skip
  ([#272](https://github.com/millionco/react-doctor/pull/272)), and
  `no-prevent-default` framework awareness
  ([#274](https://github.com/millionco/react-doctor/pull/274)). See
  the oxlint plugin changelog for per-rule detail.

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

## 0.2.0-beta.4

### Patch Changes

- Updated dependencies []:
  - oxlint-plugin-react-doctor@0.2.0-beta.4

## 0.2.0-beta.3

### Patch Changes

- Inherits the `no-barrel-import` index-resolution fix from
  [#253](https://github.com/millionco/react-doctor/pull/253) via the
  shared rule registry. See the oxlint plugin changelog.

- Updated dependencies []:
  - oxlint-plugin-react-doctor@0.2.0-beta.3

## 0.2.0-beta.2

### Minor Changes

- Inherits the per-rule module restructuring from
  `oxlint-plugin-react-doctor@0.2.0-beta.2`
  ([#249](https://github.com/millionco/react-doctor/pull/249) and
  follow-ups). The published ESLint plugin shape (flat-config-ready
  `recommended` / framework presets, `react-doctor/*` rule namespace)
  is unchanged - the bump is minor because rule authors writing
  custom shims now consume per-file modules instead of the previous
  kitchen-sink files.

### Patch Changes

- Inherits the beta.2 false-positive sweep from
  `oxlint-plugin-react-doctor@0.2.0-beta.2`:
  user-feedback rule tuning + scoring transparency
  ([#208](https://github.com/millionco/react-doctor/pull/208)),
  React-19 rule version-gating
  ([#254](https://github.com/millionco/react-doctor/pull/254)),
  render-reachable state analysis
  ([#255](https://github.com/millionco/react-doctor/pull/255)),
  narrowed `no-effect-event-handler` detection
  ([#256](https://github.com/millionco/react-doctor/pull/256)), and
  local `useX` helper suppression + new typography rules
  ([#257](https://github.com/millionco/react-doctor/pull/257)).

- Updated dependencies []:
  - oxlint-plugin-react-doctor@0.2.0-beta.2
