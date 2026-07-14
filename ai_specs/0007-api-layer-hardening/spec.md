---
type: Spec
title: API Layer Hardening
---

## Problem

The API layer lacks fundamental security and reliability hardening. Body limit is 50MB with no rate limiting on any endpoint. Security headers (X-Content-Type-Options, X-Frame-Options, etc.) are absent. There is no global Express error handler — async route handler rejections crash the process. Request bodies are never validated — `req.body` is cast with `as` everywhere.

## Proposed Outcome

The server is hardened against resource exhaustion, common web attacks, unhandled promise rejections, and malformed input. Findings M5, M7, M10, L24 are resolved. [L1]

## User Stories

1. As a system operator, abusive clients cannot exhaust server memory or overwhelm endpoints.
2. As a system operator, the server responds with standard security headers.
3. As a system operator, unhandled async route errors do not crash the process — they return a 500 response.
4. As a developer, request bodies are validated before reaching business logic.

## Requirements

1. **Reduce body limit**: Change `express.json({ limit: '50mb' })` to `express.json({ limit: '10mb' })` in `src/main.ts:31-32`. [L1]
2. **Rate limiting**: Add `express-rate-limit` middleware per-endpoint for login, registration, password reset, and sync routes. Configure sensible limits (e.g., 5–10 requests/minute for auth endpoints, higher for sync). [L1]
3. **Security headers**: Add `helmet` middleware to the Express app in `src/main.ts`. [L1]
4. **Global error handler**: Add a global Express error-handling middleware (4-argument function `(err, req, res, next)`) in `src/main.ts` that returns a 500 JSON response and logs the error. Optionally import `express-async-errors` or ensure all async route handlers have a `.catch(next)` wrapper. [L1]
5. **Body validation**: Add runtime validation for request bodies on all route handlers. Use either `zod` schemas or manual guard functions to verify that required fields exist and have the correct types before passing to business logic. [L1]

## Technical Decisions

- Add `express-rate-limit` as a dependency. Configure separate rate limiters per route category. [L1]
- Add `helmet` as a dependency. Apply it globally with defaults. [L1]
- For async error handling, wrap async route handlers with a `.catch(next)` higher-order function rather than adding `express-async-errors` — this is more explicit and does not modify global behavior. [L1]
- Use `zod` for request body validation — it provides TypeScript type inference and readable error messages. [L1]

## Testing Strategy

**Test Seam**: The Express app instance is the natural seam — use `supertest` or manual request testing against the app.

- Integration-test that requests exceeding the body limit return 413
- Integration-test that rate-limited endpoints return 429 after exceeding the limit
- Integration-test that `curl -I` returns security headers (X-Content-Type-Options, etc.)
- Integration-test that an async route throwing an error returns 500 JSON instead of crashing
- Integration-test that requests with missing required body fields return 400 with validation error details

## Blocking Questions

- Confirm rate limit values per endpoint with a domain expert before implementation.
- Confirm acceptable body limit — 10MB may be too low if legitimate sync payloads exceed it.

## Out of Scope

- Authentication changes (covered by Spec 0001)
- Database layer changes (covered by Spec 0003)
