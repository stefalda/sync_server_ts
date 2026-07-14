---
type: Interview Ledger
parent: spec.md
---

## Records

### L1

Status: current

Question: What code quality and maintainability issues exist across the codebase?

Source: doc/code_review_findings.md — M3, L5, L13, L18

Answer: Four miscellaneous code quality findings:

- M3: Logger in `src/helpers/logger.ts:25` — `console.log(msg)` inside winston printf format function causes every message to be printed twice (once by console.log, once by winston transport file write)
- L5: CockroachDB schema `database_cockroachdb_script.sql:189-195` — `users` table primary key references column `id` which does not exist; column is named `userid`
- L13: Emoji characters (`❌`, `🔄`) in structured log messages at `src/routes/sync.ts:15, 60` and `src/repositories/chunk_processor.ts:80` — can cause encoding issues in log aggregation systems (ELK, Splunk)
- L18: Duplicate code in `src/routes/sync.ts:17-42` and `57-85` — the `multiple` branch for chunk processor + progress check is identical between push and pull handlers

Decision: Fix all four issues to improve maintainability and log system compatibility.

Constraints:
- `console.log(msg)` must be removed from winston format function
- CockroachDB schema must either rename column to `id` or update PK to `userid`
- Emoji characters must be removed from all structured log messages
- Duplicate chunk processing code must be extracted into a shared function
