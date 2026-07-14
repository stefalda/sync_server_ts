---
type: Interview Ledger
parent: spec.md
---

## Records

### L1

Status: current

Question: What API-layer hardening is missing from the server?

Source: doc/code_review_findings.md — M5, M7, M10, L24

Answer: Four findings in the API/middleware layer:

- M5: Body limit set to 50MB — single request can allocate 50MB+. No rate limiting on any endpoint (login, registration, password reset, sync).
- M7: No security headers middleware — missing `helmet`, so `X-Content-Type-Options`, `X-Frame-Options`, etc. are absent.
- M10: No global Express error handler — Express 4.x does not catch Promise rejections from async route handlers. Any `throw` in an async route crashes the process in Node 15+.
- L24: No request body validation — `req.body` is cast with `as` without validating the payload exists or is well-formed.

Decision: Harden the API layer against resource exhaustion, common web attacks, unhandled errors, and malformed input.

Constraints:
- Body limit should be reduced to 10-20MB
- Rate limiting must be per-endpoint (login, registration, password reset, sync)
- `helmet` middleware must be added
- Global Express error handler must catch async route rejections
- Request body validation must be added (zod, joi, or manual guards)
