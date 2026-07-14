---
type: Spec
title: Authentication & Authorization Security
---

## Problem

The authentication and authorization layer has nine defects spanning security vulnerabilities, runtime bugs, and type-safety gaps. JWT refresh token verification is completely broken (wrong key + callback race). Password reset leaks registered email addresses via response status codes. Token expiry never triggers when `lastrefresh` is undefined. Type coercion and missing safety checks compound these issues.

## Proposed Outcome

The authentication flow is secure, correctly verified, type-safe, and does not leak user enumeration information. All findings H1, H10, M6, L1, L9, L10, L14, L15, L17 are resolved. [L1]

## User Stories

1. As a user, my JWT refresh token is correctly verified so I can obtain new access tokens when my current one expires.
2. As a user, I cannot determine whether an email is registered via the password reset endpoint.
3. As a user, my refresh token eventually expires even if `lastrefresh` was never set.
4. As a developer, the auth middleware rejects non-Bearer authorization headers instead of extracting garbage tokens.
5. As a developer, custom `req.userToken` (injected by `checkSimpleToken`) and `req.user` (injected by `checkJWTToken` and `checkBasicAuthentication`) are type-safe without `as any` casts.

## Requirements

1. **JWT refresh token verification**: Replace `configJson.server.secret_key` with `secret_key_refresh` in `src/routes/login.ts:100-115`. [L1]
2. **Remove callback race**: Convert the `jwt.verify` callback pattern to try/catch or Promise-based verification so `res.statusCode` is not read before the callback sets it. [L1]
3. **Email enumeration**: Change `src/routes/login.ts:152-157` and `src/repositories/user_repository.ts:306-307` to always return HTTP 200 with a generic message ("If the email is registered, a PIN has been sent"). Log the actual error server-side only. [L1]
4. **Null-safe token expiry**: Add `if (userToken.lastrefresh == null || differenceInHours > 24)` in `src/middleware/authorization.ts:45` and `src/routes/login.ts:139`. [L1]
5. **Bearer prefix check**: Add `!token.startsWith("Bearer ")` guard in `checkSimpleToken` at `src/middleware/authorization.ts:28-36`. [L1]
6. **`next` type**: Change `next: any` to `next: NextFunction` in `src/middleware/authorization.ts:115`. [L1]
7. **Return type**: Change `String` to `string` in `generateJWTToken` and `generateRefreshJWTToken` signatures at `src/middleware/authorization.ts:150, 160`. [L1]
8. **Destructuring init**: Fix `let userid, email = null` to `let userid = null, email = null` in `src/routes/login.ts:101`. [L1]
9. **Type-safe request properties**: Use TypeScript declaration merging to extend `express.Request` with `userToken` and `user` typed properties, removing all `(req as any)` casts in `src/middleware/authorization.ts` and `src/routes/login.ts`. [L1]
10. **Catch type narrowing**: Add proper type narrowing (e.g., `if (error instanceof Error)`) for `catch (error)` blocks at `src/middleware/authorization.ts:95` and `src/routes/login.ts:108` before accessing `error.message`. [L1]

## Technical Decisions

- Use try/catch with synchronous `jwt.verify` (available in jsonwebtoken typings) instead of converting to Promise manually, as it matches the existing code style better. [L1]
- Use TypeScript declaration merging (`declare module 'express-serve-static-core'`) for Request extensions, matching Express 4 conventions. [L1]

## Testing Strategy

**Test Seam**: The `jwt.verify` wrapper is the natural seam. Test with known valid/invalid tokens signed with both `secret_key` and `secret_key_refresh`.

- Unit-test that tokens signed with `secret_key_refresh` are rejected when verified with `secret_key` and vice versa
- Unit-test that an undefined `lastrefresh` triggers token expiry
- Integration-test that password reset returns 200 for both registered and unregistered emails (no error body leak)
- Unit-test that `checkSimpleToken` rejects `Basic`, `Digest`, and missing headers

## Out of Scope

- Password hashing algorithm (covered by Spec 0002)
- PIN generation security (covered by Spec 0002)
- Database layer error propagation (covered by Spec 0003)

## Open Questions

- Should `jwt.verify` be wrapped in a shared utility function or fixed inline? The answer affects code reuse but not correctness. Resolve before Work Item creation for clean decomposition.

## Dependencies

- **Spec 0002, Req 4** (`throw "string"` → `new Error()` in `user_repository.ts:307`) affects the same line as this Spec's Req 3. Implement **Spec 0001, Req 3** first (enumeration fix), then **Spec 0002, Req 4** (error-object hygiene).
