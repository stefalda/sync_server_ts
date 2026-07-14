---
type: Interview Ledger
parent: spec.md
---

## Records

### L1

Status: current

Question: What data integrity and performance issues exist in the sync repository?

Source: doc/code_review_findings.md — H3, H9, H11, M2, M9, L8

Answer: Six findings in `src/repositories/sync_repository.ts`:

- H3: Missing `await` on `setUserClient` calls at lines 179, 199 — database not updated before function returns, causing race on `syncing` state
- H9: Race condition in pull sync locking — two concurrent requests both see `syncing == null` and both proceed
- H11: N+1 query pattern — `pull()` executes one `getRowDataValue()` per change in serial loop; `push()` does `processData` + `setSyncData` per change
- M2: Operation "D" (delete) never executes SQL DELETE — data persists forever
- M9: `push()` writes to `data` and `sync_data` without transaction — partial data on crash
- L8: `realm` parameter typed as `any` instead of `string`, bypassing type checking

Decision: Fix all six issues to ensure data integrity and improve performance.

Constraints:
- All `setUserClient` calls must be awaited
- Pull locking must use atomic `UPDATE ... SET syncing = $1 WHERE syncing IS NULL AND clientid = $2`
- N+1 queries must be batched using `SELECT ... WHERE rowguid = ANY($1)` and multi-row INSERT
- DELETE SQL must execute for operation "D" when the row exists
- Push loop must be wrapped in `BEGIN ... COMMIT/ROLLBACK`
- Realm parameter type must be changed from `any` to `string`
