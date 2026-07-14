---
type: Spec
title: Sync Repository Data Integrity & Performance
---

## Problem

The sync repository has six data-integrity and performance defects. Missing `await` on `setUserClient` causes race conditions on `syncing` state. Pull sync locking is check-then-act (non-atomic), allowing two concurrent requests to both acquire the lock. Both `pull()` and `push()` exhibit N+1 query patterns. Delete operations ("D") never execute SQL DELETE — data persists forever. `push()` writes to `data` and `sync_data` without a transaction, risking partial writes on crash. Realm parameters are typed `any` rather than `string`.

## Proposed Outcome

Sync operations are atomic, performant, and correct: pull locking is atomic, N+1 queries are batched, DELETE operations actually delete, push runs in a transaction, and type safety is restored. Findings H3, H9, H11, M2, M9, L8 are resolved. [L1]

## User Stories

1. As a user, concurrent pull requests for the same client do not both acquire the sync lock.
2. As a user, syncing with 1000 changes completes in fewer than 1000 round-trips to the database.
3. As a user, deleted records are actually removed from the database.
4. As a user, a server crash during push does not leave partial data.
5. As a developer, the sync repository functions are type-safe (no `any` parameters).

## Requirements

1. **Await setUserClient**: Add `await` before every `UserRepository.getInstance().setUserClient(realm, userClient)` call at `src/repositories/sync_repository.ts:179, 199`. [L1]
2. **Atomic pull locking**: Replace the current check-then-act (SELECT + conditional UPDATE) with a single atomic SQL statement that both acquires the lock and handles stale-lock recovery. [L1]  
   - Acquire lock: `UPDATE ... SET syncing = $1 WHERE syncing IS NULL AND clientid = $2`.  
   - Stale-lock recovery: also update when `syncing` is older than 2 minutes: `WHERE (syncing IS NULL OR syncing < $3) AND clientid = $2` where `$3` is the stale threshold timestamp.  
   - Verify the row count to determine lock acquisition.  
   - Preserve the existing 2-minute stale-lock timeout from `isAlreadySyncing`.
3. **Batch N+1 queries in pull**: Replace the per-change loop of `getRowDataValue()` with a single `SELECT json FROM data WHERE rowguid = ANY($1)` (or equivalent `= ANY(...)` pattern) at `src/repositories/sync_repository.ts:72-83`. [L1]
4. **Batch N+1 queries in push**: Replace the per-change loop of `processData` + `setSyncData` with multi-row `INSERT INTO ... VALUES (...), (...), (...)` at `src/repositories/sync_repository.ts:115-124`. [L1]
5. **DELETE for operation "D"**: When `operation == "D"` and the row exists in `data`, execute `DELETE FROM data WHERE rowguid = $1` at `src/repositories/sync_repository.ts:232-233` instead of returning silently. [L1]
6. **Push transaction**: Wrap the push loop at `src/repositories/sync_repository.ts:113-144` in `BEGIN ... COMMIT / ROLLBACK`. [L1]
7. **Realm type**: Change `realm: any` to `realm: string` in all function signatures at `src/repositories/sync_repository.ts:26, 101, 154, 192, 221`. [L1]

## Technical Decisions

- Use `pg` client-level transaction (`BEGIN`/`COMMIT`/`ROLLBACK`) rather than the pool-level `pg-pool` transactional helper, to keep the implementation explicit and avoid abstraction overhead. [L1]
- Use `ANY($1:uuid[])` array parameter for batching SELECT queries. [L1]

## Testing Strategy

**Test Seam**: The pg Pool instance in `database_repository.ts` is the natural seam — use a test helper that wraps a real in-memory or local PostgreSQL, or mock `pool.query` to verify SQL structure.

- Unit-test that concurrent pull attempts with simulated delay only one proceeds (verify atomic UPDATE)
- Unit-test that `await setUserClient` completes before the function returns
- Integration-test that `push` with a crash mid-way does not leave partially written data (rollback)
- Unit-test that operation "D" emits a DELETE SQL statement

## Out of Scope

- Database error propagation (covered by Spec 0003)
- Chunk upload processing (covered by Spec 0005)
