---
type: Interview Ledger
parent: spec.md
---

## Records

### L1

Status: current

Question: What database layer correctness issues exist in the codebase?

Source: doc/code_review_findings.md — H2, H4

Answer: Two critical bugs in the database repository layer:

- H2: SQL placeholder `?` (MySQL style) used instead of `$1` (pg style) in `authentication_repository.ts:37`. The function `getUserIdFromToken` is completely non-functional at runtime.
- H4: `database_repository.ts:71-74` — catch block logs error but does not rethrow, returns `undefined`. Callers cannot distinguish between "no result" and "database error".

Decision: Fix both issues to make authentication work and ensure errors propagate.

Constraints:
- Replace `?` with `$1` in authentication_repository.ts query
- Rethrow error after logging in database_repository.ts, or return a consistent error object
