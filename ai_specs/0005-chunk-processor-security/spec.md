---
type: Spec
title: Chunk Processor Security & Reliability
---

## Problem

The chunk processor has a critical path traversal vulnerability — `clientId` (URL param) and `syncId` (body param) are used directly in `path.join()` without validation. Combined with `rm(..., { recursive: true, force: true })`, an attacker can delete arbitrary directories. Additionally, concurrent chunk uploads race on assembly (`renameSync` → ENOENT), `fs.renameSync` blocks the event loop, and `computeTotalSize` creates O(n²) I/O by calling `readdir` + per-file `stat` on every chunk.

## Proposed Outcome

Chunk uploads are secure against path traversal, free of race conditions, non-blocking, and I/O-efficient. Findings H6, M4, L4, L23 are resolved. [L1]

## User Stories

1. As a user, chunk uploads cannot delete files outside the temporary upload directory.
2. As a user, concurrent chunk uploads for the same sync do not cause ENOENT errors.
3. As a user, chunk uploads do not cause event-loop latency spikes.

## Requirements

1. **Input validation**: Validate `clientId` and `syncId` with a strict alphanumeric (and possibly hyphens/underscores) regex pattern before using them in `path.join()` at `src/repositories/chunk_processor.ts:28-29`. Reject invalid values with HTTP 400. [L1]
2. **Path containment**: Use `path.resolve()` on the constructed path and verify the resolved path starts with the resolved `TEMP_DIR` prefix. Reject traversal attempts. [L1]
3. **Atomic assembly**: Use a file-based or directory-based lock (e.g., `mkdir`-based atomic directory creation or a lock file with `fsPromises.writeFile` + existence check) to ensure only one request proceeds to assembly at `src/repositories/chunk_processor.ts:59-69`. [L1]  
   - Clean up the lock on failure (in the catch block) so a failed assembly does not permanently orphan the upload.  
   - Optionally add a stale-lock timeout check before attempting acquisition.
4. **Async rename**: Replace `fs.renameSync` with `await fsPromises.rename()` at lines 56 and 67. [L1]
5. **O(n²) I/O fix**: Replace the per-chunk `computeTotalSize` (readdir + per-file stat) with an in-memory counter at `src/repositories/chunk_processor.ts:64`. [L1]  
   - Store the counter in a **module-level `Map<string, number>`** keyed by `syncId`, because a per-request variable resets on every chunk upload call.  
   - Increment the counter as each chunk is written.  
   - Clean up the Map entry on completion, failure, or when the chunk directory is first created (which deletes prior files).

## Technical Decisions

- Use `fsPromises.mkdtemp`-style atomic directory creation (`mkdir` returns EEXIST) as the lock mechanism for chunk assembly — it is atomic on all major OS filesystems. [L1]
- Validation regex: `/^[a-zA-Z0-9_-]+$/` — adjust if production data uses other characters. [L1]

## Testing Strategy

**Test Seam**: The `TEMP_DIR` path and filesystem operations are the natural seam. Use a temp directory with controlled fixtures.

- Unit-test path traversal payloads (`../../etc/passwd`, absolute paths) are rejected
- Unit-test that concurrent `processChunk` calls with the same `syncId` produce exactly one successful assembly
- Unit-test that `receivedBytes` counter matches expected total
- Unit-test that `fsPromises.rename` does not throw when the directory structure is correct

## Out of Scope

- Rate limiting on chunk upload endpoints (covered by Spec 0007)
- Emoji removal from logs (covered by Spec 0009)

## Open Questions

- Does the existing `syncId` format already include non-alphanumeric characters (e.g., UUID dashes)? If so, the validation regex must include `-`.
