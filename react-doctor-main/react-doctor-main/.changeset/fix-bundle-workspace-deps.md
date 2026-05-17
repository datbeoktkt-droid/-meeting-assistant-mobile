---
"react-doctor": patch
---

Fix workspace packages not being bundled into dist, causing
`ERR_MODULE_NOT_FOUND: Cannot find package '@react-doctor/core'`
when running the published CLI.
