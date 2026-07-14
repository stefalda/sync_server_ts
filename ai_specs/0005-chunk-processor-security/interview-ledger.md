---
type: Interview Ledger
parent: spec.md
---

## Records

### L1

Status: current

Question: What security and reliability issues exist in the chunk processor?

Source: doc/code_review_findings.md — H6, M4, L4, L23

Answer: Four findings in `src/repositories/chunk_processor.ts`:

- H6: Path traversal — `clientId` (URL param) and `syncId` (body param) used directly in `path.join()` without validation. Combined with `rm(..., { recursive: true, force: true })`, allows arbitrary file deletion.
- M4: Race condition in chunk assembly — two concurrent requests for the same `syncId` can both count files, determine both are the last chunk, and race on `renameSync` → ENOENT.
- L4: `fs.renameSync` blocks the event loop in async methods
- L23: `computeTotalSize` called per chunk — O(n²) I/O with N `readdir` + N² `stat` calls
- L13: Part of emoji issue in chunk_processor.ts:80

Decision: Fix all issues to prevent path traversal, race conditions, and poor I/O patterns.

Constraints:
- `clientId` and `syncId` must be validated with strict alphanumeric (or appropriate) pattern
- Resolved paths must be verified to stay within `TEMP_DIR`
- Chunk assembly must use atomic lock to ensure single request proceeds
- `fs.renameSync` must be replaced with `await fsPromises.rename()`
- `computeTotalSize` loop must be replaced with in-memory `receivedBytes` counter
- Remove emoji from structured log messages
