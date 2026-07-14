---
type: Interview Ledger
parent: spec.md
---

## Records

### L1

Status: current

Question: What configuration loading and server bootstrap issues exist?

Source: doc/code_review_findings.md — M1, L3, L11, L12, L16, L19, L20, L6

Answer: Eight findings in configuration and server initialization:

- M1: `getPool` falls back to `pools.get("default")!` for unknown realms — bypasses realm isolation if a "default" pool exists
- L3: `for (let realm in configJson.db.realms)` iterates prototype properties — if config object is polluted, unexpected realms appear
- L11: Mixed CJS/ESM import styles in `main.ts` (`import * as cors`, `const compression = require('compression')`, `import morgan = require('morgan')`)
- L12: `process.setMaxListeners(50)` without comment — masks potential memory leaks
- L16: Config loaded independently in 4 files (`main.ts`, `authorization.ts`, `email_client.ts`, `user_repository.ts`)
- L19: No `/healthz` or readiness endpoint — container orchestrators and load balancers cannot health-check
- L20: Pool created with `new Pool({ connectionString })` using defaults — max 10 connections, no idle timeout, no connection timeout
- L6: `morganStream` defined but unused (the only consumer is commented out)

Decision: Fix all bootstrap and configuration issues for security, maintainability, and operational readiness.

Constraints:
- Unknown realms must be validated against configured keys before falling back, or return 404
- Config iteration must use `Object.keys()` or similar
- Import style should be consistent (all ESM or all CJS)
- `setMaxListeners(50)` must be documented or removed
- Config should be loaded once and shared
- `/healthz` endpoint must be added to `base.ts`
- Pool must be configured with `max`, `idleTimeoutMillis`, `connectionTimeoutMillis`
- Unused `morganStream` variable must be removed
