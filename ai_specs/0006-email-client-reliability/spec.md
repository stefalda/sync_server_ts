---
type: Spec
title: Email Client Reliability
---

## Problem

The email client suffers from reliability and performance issues. `smtpTransport.sendMail()` is not awaited — the function returns immediately, errors are silently swallowed, and the SMTP transport is never closed. Email templates are read from disk and compiled on every send (no caching). A new SMTP transport (TCP + TLS handshake) is created for every email, adding 100-500ms overhead per send.

## Proposed Outcome

Email sending is reliable (errors propagate, transport is properly closed), performant (templates cached, transport reused), and maintainable. Findings H8, L21, L22 are resolved. [L1]

## User Stories

1. As a user, email sending failures are reported to the caller instead of being silently dropped.
2. As a user, repeated emails (e.g., password reset) do not pay the cost of template compilation every time.
3. As a system operator, the SMTP transport is not leaked (connections are closed or reused).

## Requirements

1. **Await sendMail**: Add `await` before `smtpTransport.sendMail(updatedData)` in `src/helpers/email_client.ts:43-45`. Remove the `.then(...)` fire-and-forget pattern. [L1]
2. **Error propagation**: Let the `await` rejection propagate to the caller of the enclosing function. Remove the silent `console.info`-only success handler. [L1]  
   - The outer `try/catch` at line 22 currently logs then swallows errors. Either remove it entirely so `await sendMail` can reject, or rethrow (`throw;`) after logging. Without this change, the function still silently succeeds from the caller's perspective.
3. **Transport lifecycle**: Close the SMTP transport with `smtpTransport.close()` after the send completes, OR create the transport once at module level and reuse it across calls. [L1]
   - Preferred: module-level singleton transport with a `close()` function called during graceful shutdown.
4. **Template caching**: Cache compiled Handlebars templates in a `Map<string, TemplateDelegate>` at module level. Read and compile the template file only on first access. Use the cached delegate on subsequent calls. [L1]
5. **Singleton transport**: Create the `smtpTransport` once at module level in `src/helpers/email_client.ts` instead of inside the send function. [L1]

## Technical Decisions

- Use module-level singleton SMTP transport with explicit `close()` for graceful shutdown, rather than create+close per email — this avoids the overhead of repeated TCP/TLS handshakes. [L1]
- Use a `Map<string, TemplateDelegate>` for template cache, keyed by template file path. [L1]

## Testing Strategy

**Test Seam**: Mock the `nodemailer.createTransport` and `transporter.sendMail` to avoid real SMTP calls. Use a test template file in a temp directory for template caching tests.

- Unit-test that `sendMail` rejects when the mock transport throws
- Unit-test that the template cache compiles once and returns the cached delegate on repeat calls
- Unit-test that the transport is created exactly once (singleton) across multiple calls

## Out of Scope

- Rate limiting on email endpoints (covered by Spec 0007)
- Email template content changes
