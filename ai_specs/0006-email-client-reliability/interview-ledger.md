---
type: Interview Ledger
parent: spec.md
---

## Records

### L1

Status: current

Question: What reliability and performance issues exist in the email client?

Source: doc/code_review_findings.md — H8, L21, L22

Answer: Three findings in `src/helpers/email_client.ts`:

- H8: `sendMail` called without `await` — fire-and-forget. Errors are silently swallowed. SMTP transport never closed.
- L21: Email template read from disk (`fs.readFileSync`) and compiled with Handlebars on every send — no caching.
- L22: New SMTP transport (TCP + TLS handshake) created per email — 100-500ms overhead per send.

Decision: Fix all three issues for reliable, performant email sending.

Constraints:
- `smtpTransport.sendMail()` must be awaited
- Transport must be closed after send, or reused via module-level singleton
- Errors must be propagated to caller
- Compiled templates must be cached in a `Map<string, TemplateDelegate>`
- SMTP transport should be created once at module level
