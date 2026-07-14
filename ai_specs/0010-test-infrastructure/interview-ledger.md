---
type: Interview Ledger
parent: spec.md
---

## Records

### L1

Status: current

Question: Which test framework should be used?

Answer: Vitest (migrate from placeholder `"test": "echo Error"`).

Decision: Use Vitest as the test runner with its built-in TypeScript support via esbuild.

Reason: Faster than Jest, Jest-compatible API, built-in TypeScript support without ts-jest, vi.mock for module mocking.

### L2

Status: current

Question: What kind of tests should be created?

Answer: Integration tests against a real test database, plus unit tests for pure logic.

Decision: Repository and route tests hit a real Postgres database. Pure utility functions (e.g., encryptPassword) are unit-tested in isolation.

Reason: SQL correctness bugs (like `?` vs `$1`) require real SQL execution to verify. Mocking pg would miss the most critical bugs.

### L3

Status: current

Question: How should tests handle singleton repository instances?

Answer: Add a `static reset()` method to each repository class.

Decision: DatabaseRepository, UserRepository, SyncRepository, and AuthenticationRepository each gain a `reset()` method that clears the singleton instance (and pools where applicable). Called in beforeEach/afterEach per suite.

Reason: Tests must have isolated state between suites. Private constructors prevent test instantiation.

### L4

Status: current

Question: How should the test database be provisioned and cleaned?

Answer: Dedicated test realm + per-suite schema cleanup.

Decision: A `todo_test` realm in config.test.json points to a dedicated test database. Each test suite deletes relevant table rows in beforeEach/afterEach to reset state. A Vitest globalSetup file runs the schema script once per test run.

### L5

Status: current

Question: How should tests find the test database connection string without modifying production config.json?

Answer: Test-specific config.test.json loaded via environment variable.

Decision: Create `config.test.json` with a `todo_test` realm pointing to the test database. Vitest config resolves config.json imports to config.test.json via resolve.alias when NODE_ENV=test. Production config.json is never modified.

### L6

Status: current

Question: Should all test files be created first, or incrementally with each fix?

Answer: Create the full test framework and all test files first, then apply the 9 Spec fixes.

Decision: Establish the complete test infrastructure + empty test file stubs, then fill in tests per Spec group, then implement fixes validated against those tests.

### L7

Status: current

Question: How should test files be laid out?

Answer: Mirror src/ structure under test/.

Decision: test/utils.test.ts → src/helpers/utils.ts, test/repositories/sync_repository.test.ts → src/repositories/sync_repository.ts, etc.

### L8

Status: current

Question: How should test fixtures (known DB state) be structured?

Answer: A test/fixtures.ts helper with async functions.

Decision: Exported functions like createTestUser, createTestClient, createTestToken insert minimum rows and return created objects. A shared registry tracks created IDs for cleanup in afterEach.

### L9

Status: current

Question: How should email tests handle nodemailer (real SMTP)?

Answer: Mock nodemailer at the module level via Vitest.

Decision: Use vi.mock('nodemailer') to replace the real transport with a fake. Tests verify sendMail was called with right args, transport is created once (singleton), template caching works.

### L10

Status: current

Question: Should schema provisioning be automated?

Answer: Yes, via Vitest globalSetup.

Decision: A test/globalSetup.ts file connects to the test DB and runs database_postgres_script.sql once before all tests. Developers still create the empty database manually once.
