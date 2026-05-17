---
"@react-doctor/core": minor
"eslint-plugin-react-doctor": minor
"oxlint-plugin-react-doctor": minor
"@react-doctor/project-info": minor
"react-doctor": minor
"@react-doctor/types": minor
---

Extract project / dependency / framework detection, the oxlint runner +
scoring engine, and the shared TypeScript type layer out of the
`react-doctor` monolith into three new public workspace packages:
`@react-doctor/types`, `@react-doctor/project-info`, and
`@react-doctor/core` (#249). The oxlint plugin is restructured into
per-rule modules under `src/plugin/rules/<category>/<rule>.ts` with a
codegen'd `rule-registry.ts` (#218, #228, #230, #231, #234, #235, #236,
#242). Land the user-feedback sweep (#208): scoring transparency hooks,
per-rule severity + rule-set selection config options, and reduced
false positives across the design / Tailwind / state-and-effects rule
families. Reorganise the CLI into `cli/commands/` + `cli/utils/`
(#250), and forward `reactMajorVersion` through programmatic
`diagnose()` (#174).
