---
type: Interview Ledger
parent: spec.md
---

## Records

### L1

Status: current

Question: What password and PIN security issues exist in the codebase?

Source: doc/code_review_findings.md — H5, H7, M8, L2, L7

Answer: Five findings in user credential and PIN handling:

- H5: Password hashing uses SHA-512 (fast, hardware-accelerated, no key stretching)
- H7: PIN generation uses `Math.random()` (Xorshift128+, predictable)
- M8: Race condition in `generatePin` — two concurrent requests both DELETE then INSERT
- L2: `throw "string"` instead of `throw new Error(...)` in user_repository.ts
- L7: Hardcoded `FROM users` instead of `Tables.User` constant

Decision: Fix all five issues to strengthen credential security and code quality.

Constraints:
- SHA-512 must be replaced with bcrypt, crypto.scryptSync, or argon2
- PIN must use `crypto.randomInt(100000, 999999)`
- PIN insert must use UPSERT (`INSERT ... ON CONFLICT DO UPDATE`)
- All throws must be `new Error(...)` with proper stack traces
- Table references must use the `Tables.User` constant
