---
"@react-doctor/core": patch
"eslint-plugin-react-doctor": patch
"oxlint-plugin-react-doctor": patch
"@react-doctor/project-info": patch
"react-doctor": patch
"@react-doctor/types": patch
---

False-positive sweep across the rule plugin and the oxlint runner:

- Gate React-19-only rules on the detected React major version so they
  stay silent on React 18 projects, with hardened catalog / peer-range /
  workspace traversal in `@react-doctor/project-info` (#254).
- Treat early-return guards as render-reachable state reads so
  `rerender-state-only-in-handlers` / `no-event-trigger-state` stop
  recommending `useRef` for state that gates render output (#255).
- Narrow `no-effect-event-handler` - DOM imperatives, prop callbacks
  invoked from effects, and side effects routed through a stable ref
  are no longer reclassified as handler-only (#256).
- Suppress rules-of-hooks diagnostics on locally-defined `useX`
  helpers that are not React hooks, and add the `no-em-dash-in-jsx-text`
  / `no-three-period-ellipsis` typography rules (#257).
- Collapse duplicate oxlint diagnostics and recover diagnostics from
  large monorepo projects via batched runs + a new
  `dedupe-diagnostics` helper in `@react-doctor/core` (#262).
