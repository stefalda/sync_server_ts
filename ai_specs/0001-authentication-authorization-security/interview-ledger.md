---
type: Interview Ledger
parent: spec.md
---

## Records

### L1

Status: current

Question: What authentication security issues exist in the codebase?

Source: doc/code_review_findings.md — H1, H10, M6, L1, L9, L10, L14, L15, L17

Answer: Nine findings in the authentication and authorization layer:

- H1: JWT refresh token verified with wrong key (`secret_key` instead of `secret_key_refresh`) + callback race condition
- H10: Email enumeration via 500 vs 200 response difference on password reset
- M6: `userToken.lastrefresh!` — token never expires if `lastrefresh` is undefined
- L1: `checkSimpleToken` does not verify "Bearer " prefix before extracting token
- L9: `next` parameter typed as `any` instead of `NextFunction`
- L10: Return types `String` (object) instead of `string` (primitive) in JWT functions
- L14: `userid` not initialized in destructuring (`let userid, email = null`)
- L15: `(req as any).userToken` and `(req as any).user` — custom properties on Request without type safety
- L17: `catch (error)` without type narrowing, accessing `error.message` on `unknown`

Decision: Fix all nine issues in a coordinated authentication security pass.

Constraints:
- JWT refresh token verification must use `secret_key_refresh`
- JWT verification must use try/catch or Promise, not callback-based race
- Password reset must return 200 for both registered and unregistered emails
- Token expiry check must guard against null/undefined `lastrefresh`
- Bearer prefix must be enforced in both simple token and JWT paths
- Type safety must be restored across auth middleware and login route
