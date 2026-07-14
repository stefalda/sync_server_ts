---
type: Spec
title: Password & PIN Security
---

## Problem

Passwords are hashed with SHA-512 — a fast, hardware-accelerated hash that is not a password hashing function and is trivially brute-forced at billions of attempts/second. PIN codes for password reset are generated with `Math.random()` (Xorshift128+, predictable). The `generatePin` function has a race condition where two concurrent requests can both DELETE then INSERT, with the last write silently overwriting the first.

## Proposed Outcome

Password hashing uses a proper key-stretching algorithm. PINs are cryptographically random. PIN insertion is atomic (UPSERT). All findings H5, H7, M8, L2, L7 are resolved. [L1]

## User Stories

1. As a user, my password hash resists GPU-accelerated brute-force attacks.
2. As a user, my password reset PIN cannot be predicted by observing previous PINs.
3. As a user, concurrent password reset requests do not cause one PIN to silently replace another.

## Requirements

1. **Password hashing**: Replace `crypto.createHash('sha512').update(password).digest('hex')` in `src/helpers/utils.ts:9-10` with a proper key-stretching function. Use `crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })` and convert the Buffer to hex string via `.toString('hex')` to match the existing return format. Update all callers of the hashing function. [L1]
2. **Cryptographic PIN**: Replace `Math.random()` with `crypto.randomInt(100000, 999999)` at `src/repositories/user_repository.ts:314, 324-326`. [L1]
3. **Atomic PIN insertion**: Replace DELETE + INSERT pattern with `INSERT ... ON CONFLICT (userid) DO UPDATE SET pin = EXCLUDED.pin` at `src/repositories/user_repository.ts:310-316`. [L1]
4. **Error objects**: Replace `throw "string"` with `throw new Error(...)` in `src/repositories/user_repository.ts:258, 262, 307`. [L1]
5. **Table constant**: Replace hardcoded `FROM users` with `FROM ${Tables.User}` in `src/repositories/user_repository.ts:156`. [L1]

## Technical Decisions

- Use `crypto.scryptSync` (built-in Node, no extra dependency) rather than `bcrypt` or `argon2`, to avoid adding new dependencies. Verify the work factor is set high enough (e.g., N=16384, r=8, p=1 or equivalent). [L1]
- Use pg UPSERT syntax: `INSERT INTO ... VALUES (...) ON CONFLICT (userid) DO UPDATE SET pin = EXCLUDED.pin`. [L1]

## Testing Strategy

**Test Seam**: Extract password hashing into a testable function; inject the hashing function or compare against known scrypt output.

- Unit-test that `crypto.randomInt(100000, 999999)` produces values in range
- Unit-test that UPSERT does not throw on duplicate `userid`
- Unit-test that `throw new Error(...)` produces a proper Error instance with stack trace

## Dependencies

- **Spec 0001, Req 3** (email enumeration) affects the same code path at `user_repository.ts:307`. Implement **Spec 0001, Req 3** first to prevent enumeration, then this Spec's Req 4 (error-object hygiene).

## Out of Scope

- JWT token verification (covered by Spec 0001)
- Database error propagation (covered by Spec 0003)
- Email sending reliability (covered by Spec 0006)
