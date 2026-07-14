---
type: Spec
title: Maintainability
---

## Problem

Four unrelated code quality issues degrade maintainability and log-system compatibility. The winston logger prints every message twice. The CockroachDB schema references a non-existent column `id` as the primary key. Emoji characters in structured log messages can cause encoding issues in ELK/Splunk. Identical chunk-processing code is duplicated between push and pull handlers.

## Proposed Outcome

Loggers behave predictably, the CockroachDB schema is correct, log messages are encoding-safe, and duplicate code is eliminated. Findings M3, L5, L13, L18 are resolved. [L1]

## User Stories

1. As a system operator, each log message appears exactly once.
2. As a system operator, log messages are safe for any aggregation system (no emoji encoding issues).
3. As a database operator, the CockroachDB schema creates correctly without manual fixes.
4. As a developer, chunk processing logic is defined once and reused.

## Requirements

1. **Logger deduplication**: Remove `console.log(msg)` from the winston printf format function in `src/helpers/logger.ts:25`. [L1]
2. **CockroachDB schema fix**: In `database_cockroachdb_script.sql:189-195`, change `CONSTRAINT users_pkey PRIMARY KEY (id ASC)` to `CONSTRAINT users_pkey PRIMARY KEY (userid ASC)`, matching the actual column name. [L1]
3. **Remove emoji from logs**: Remove emoji characters (`❌`, `🔄`) from all structured log messages at `src/repositories/chunk_processor.ts:80` and `src/routes/sync.ts:15, 60`. Replace with plain-text equivalents (`ERROR`, `SYNC`, etc.). [L1]
4. **Extract duplicate chunk code**: Extract the `multiple` branch for chunk processor + progress check from `src/routes/sync.ts:17-42` and `57-85` into a shared helper function. Both push and pull handlers call the shared function. [L1]  
   - The code logic is identical but the IN_PROGRESS response status code differs: pull returns **206**, push returns **200**. The shared function must accept the HTTP status code as a parameter to preserve this difference.

## Technical Decisions

- For the logger, the winston transport file write is sufficient for file logging; `console.log` inside the format function was likely added for debugging and should be removed. [L1]
- For the CockroachDB schema, use `userid` as the PK column to match the existing column name, rather than renaming the column to `id`. [L1]
- Extract the shared chunk-processing logic to a new function `processSyncChunk` or similar in a routes helper file. [L1]

## Testing Strategy

**Test Seam**: Logger deduplication can be verified by inspecting winston transport output. Schema correctness is verified by running the SQL script against a test database.

- Manual test: observe that log file contains exactly one copy of each message after the fix
- Integration-test: run the CockroachDB schema script against a test instance and verify `users` table creates successfully
- Visual inspection: grep for emoji characters in log output to confirm removal
- Unit-test: the extracted chunk processing function with both push and pull inputs to verify identical behavior

## Out of Scope

- Logger format or level changes beyond removing the duplicate
- Any changes to CockroachDB data migration or existing deployments
