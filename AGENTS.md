## ACT Workflow

ACT workflow storage for new Specs is configured in `.act/config.yaml`.

ACT workflow semantics, Workflow Storage selection, artifact vocabulary, and domain-doc guidance are defined in `.act/workflow.md`.

## Completed Specs (Jul 2026)

All findings from `doc/code_review_findings.md` (11 HIGH, 10 MEDIUM, 24 LOW) have been addressed across 9 Specs:

| Spec | Title | Key Changes |
|------|-------|-------------|
| 0001 | Authentication & Authorization Security | JWT refresh key fix, synchronous verify, email enumeration fix, Bearer prefix, type safety |
| 0002 | Password & PIN Security | scrypt key-stretching, crypto.randomInt for PIN, UPSERT, throw Error |
| 0003 | Database Layer Correctness | SQL `?` → `$1`, error rethrow |
| 0004 | Sync Repository Data Integrity | Atomic locking, N+1 batching, DELETE op, push transaction, realm types |
| 0005 | Chunk Processor Security | Path traversal validation, atomic assembly, async rename, O(n²) fix |
| 0006 | Email Client Reliability | Singleton transport, template cache, await sendMail |
| 0007 | API Layer Hardening | Body limit 10MB, helmet, rate limiting, global error handler |
| 0008 | Configuration & Bootstrap | Realm validation, pool config, healthz endpoint, setMaxListeners doc |
| 0009 | Maintainability | Logger dedup, CockroachDB schema fix, emoji removal, duplicate code extraction |

Plus Spec 0010 (test infrastructure): Vitest, config.test.json, globalSetup, fixture helpers, singleton reset().
