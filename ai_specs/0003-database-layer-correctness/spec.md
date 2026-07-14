---
type: Spec
title: Database Layer Correctness
---

## Problem

Two critical bugs make database operations unreliable. The authentication query uses MySQL-style `?` placeholder instead of pg-style `$1`, making `getUserIdFromToken` completely non-functional. The core `query()` method in `database_repository.ts` swallows all errors in a catch block that logs but never rethrows, returning `undefined` — callers cannot distinguish "no rows" from "database error".

## Proposed Outcome

Authentication queries execute correctly against PostgreSQL. Database errors propagate to callers instead of being silently swallowed. Findings H2 and H4 are resolved. [L1]

## User Stories

1. As a user, my refresh token lookup works correctly at runtime (authentication is no longer broken).
2. As a developer, database errors are not silently swallowed — I can handle them at the call site.

## Requirements

1. **SQL placeholder**: Replace `WHERE ut.token = ?` with `WHERE ut.token = $1` in `src/repositories/authentication_repository.ts:37`. [L1]
2. **Error propagation**: Modify `src/repositories/database_repository.ts:71-74` to rethrow the error after logging it, so callers receive a rejected Promise instead of `undefined`. [L1]
   - Alternatively, return a consistent result object `{ rows, error }` — but this requires updating all callers. Rethrowing is the minimal, non-breaking change.

## Technical Decisions

- Rethrow after logging rather than changing the return type, to minimize the blast radius of changes. Callers already use try/catch or `.catch()` patterns and will handle the rejection. [L1]

## Testing Strategy

**Test Seam**: The `query()` method in `database_repository.ts` is the natural seam — subclass or mock the pool and force a query error.

- Unit-test that `query()` rejects when the underlying pool query throws
- Unit-test that `getUserIdFromToken` with a valid token returns the expected user ID (regression test after placeholder fix)

## Out of Scope

- N+1 query batching (covered by Spec 0004)
- Transaction support for push operations (covered by Spec 0004)
