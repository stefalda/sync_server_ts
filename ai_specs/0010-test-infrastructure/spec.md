---
type: Spec
title: Test Infrastructure & Foundation
---

## Problem

The project has no test framework — the `test` script in package.json is a placeholder (`echo "Error: no test specified"`). The single existing test file (`test/registration.ts`) is a manual smoke script that requires a running server. Before applying any of the 9 code-review fix Specs (0001–0009), we need a test foundation that can validate those fixes and prevent regressions.

All four repositories use singleton patterns with private constructors, making them untestable in isolation. Configuration is loaded from `config.json` via direct `import` in each file, so tests need a way to use a different database without modifying production config.

## Proposed Outcome

A complete test infrastructure is in place: Vitest as the test runner, a test-specific database configuration, automated schema provisioning, per-suite state isolation, and test file stubs for all 9 fix Specs. Tests run with `npm test` and pass (or correctly fail until fixes are applied). [L1] [L2] [L6]

## User Stories

1. As a developer, I can run `npm test` and get a pass/fail result with only an empty test database created (no server startup, no manual schema setup).
2. As a developer, each of the 9 fix Specs (0001–0009) has a test file that covers its requirements, so I can validate fixes before committing.
3. As a developer, test suites do not interfere with each other — database state is isolated per suite. [L3] [L4]

## Requirements

### Framework & Runner

1. **Install Vitest**: Add `vitest` as a devDependency. Configure it with `tsconfig.json` compatible settings (CommonJS module, TypeScript via esbuild). [L1]
2. **Test script**: Replace `package.json` test script with `"test": "vitest run"` and add `"test:watch": "vitest"`. [L1]
3. **Test directory**: Create `test/` directory mirroring `src/` structure: `test/helpers/`, `test/repositories/`, `test/routes/`. [L7]

### Database & Config

4. **Test config**: Create `config.test.json` in the project root with a `todo_test` realm pointing to a dedicated test database (e.g., `postgresql://postgres:postgress@localhost:5433/sync_server_test`). Include dummy SMTP settings (nodemailer will be mocked). [L5]
5. **Config resolution**: Configure Vitest to resolve `config.json` imports to `config.test.json` when `NODE_ENV=test` (via `resolve.alias` or equivalent mechanism). [L5]
6. **Schema provisioning**: Create `test/globalSetup.ts` that connects to the test database and executes the schema before any test file runs. [L10]  
   - The existing `database_postgres_script.sql` uses plain `CREATE TABLE` (not `IF NOT EXISTS`). Running it twice fails. The globalSetup must either: (a) execute `DROP TABLE IF EXISTS ... CASCADE` for each table before `CREATE TABLE`, or (b) maintain a test-specific schema script with `CREATE TABLE IF NOT EXISTS`.  
   - Approach (a) is recommended — it keeps a single source of truth for the schema and ensures a clean slate each test run.
7. **Per-suite cleanup**: Each test suite deletes relevant rows in `beforeEach` or `afterEach` to reset database state. [L4]

### Testability Refactoring

8. **Singleton reset**: Add a `static reset()` method to `DatabaseRepository`, `UserRepository`, `SyncRepository`, and `AuthenticationRepository`. `DatabaseRepository.reset()` clears all pools and sets instance to null. The others set instance to null. [L3]  
9. **Export Express app factory**: Refactor `src/main.ts` to export a `createApp()` function that returns the configured Express `app` without calling `app.listen()`. Move `app.listen()` into a separate `startServer()` call or a `if (require.main === module)` guard. This allows route tests to import the configured app without triggering a real server start. [Finding 2]

### Test Infrastructure Files

10. **Fixture helpers**: Create `test/fixtures.ts` with async functions: `createTestUser(realm)`, `createTestClient(realm, userId)`, `createTestToken(realm, clientId)`, `createTestSyncData(realm, userId, ...)`. Each function returns the created object and registers IDs for cleanup. [L8]
11. **Vitest config**: Create `vitest.config.ts` (or `.js`) with `globalSetup`, `testMatch`, `alias` for config.json, and `environment: 'node'`. [L1]
12. **Supertest**: Add `supertest` and `@types/supertest` as devDependencies for route-level HTTP assertions against the Express app without a real port. [Finding 4]

### Mocking

13. **Nodemailer mock**: In email client tests, use `vi.mock('nodemailer')` to replace `createTransport` and `sendMail` with fakes. Verify `sendMail` receives correct args and errors propagate. [L9]  
    - Transport singleton verification (`transport created once`) depends on Spec 0006's implementation (which adds module-level transport). Mark this assertion as `test.todo` until Spec 0006 is implemented. [Finding 3]

### Test File Stubs

14. **Create test stubs for all 9 Specs**: Each Spec gets a corresponding test file under `test/` with `describe` blocks for each requirement, initially marked `test.todo` or with basic assertions that will be filled in during implementation. At minimum: [L6]
    - `test/utils.test.ts` — covers Spec 0002 (encryptPassword)
    - `test/repositories/database_repository.test.ts` — covers Spec 0003 and Spec 0008 (realm validation, pool config)
    - `test/repositories/authentication_repository.test.ts` — covers Spec 0001
    - `test/repositories/user_repository.test.ts` — covers Spec 0002
    - `test/repositories/sync_repository.test.ts` — covers Spec 0004
    - `test/repositories/chunk_processor.test.ts` — covers Spec 0005
    - `test/helpers/email_client.test.ts` — covers Spec 0006
    - `test/routes/api.test.ts` — covers Spec 0007 (rate limiting, security headers, error handler, body validation)
    - `test/routes/sync.test.ts` — covers Spec 0009 (duplicate code extraction)
    - `test/helpers/logger.test.ts` — covers Spec 0009 (logger dedup)
    - `test/config.test.ts` (not `helpers/`) — covers Spec 0008 (config singleton, pool config shape)

## Technical Decisions

- **Vitest over Jest**: Vitest is faster, has built-in TypeScript/ESBuild support, and uses the same `describe`/`it`/`expect` API. `vi.mock()` handles CommonJS modules correctly when used with `deps.interopDefaultInCjs`. [L1]
- **Config resolution via alias**: Vitest `resolve.alias` maps exactly two unique import paths to the absolute path of `config.test.json`: `../config.json` (used by `src/main.ts`) and `../../config.json` (used by all files under `src/helpers/`, `src/middleware/`, `src/repositories/`, `src/routes/`). This works without modifying any source file. [L5]
- **Fixture registry pattern**: `fixtures.ts` maintains an internal `Map<string, Set<string>>` of (realm, id) pairs for cleanup. Each `create*` function registers IDs. A `cleanupAll(realm)` function deletes them in reverse insertion order. Called in `afterEach`. [L8]
- **Schema provisioning via DROP + CREATE**: The globalSetup executes `DROP TABLE IF EXISTS ... CASCADE` for each table before running `CREATE TABLE`, ensuring a clean slate on every test run without requiring `IF NOT EXISTS` in the schema script. [L10]

## Testing Strategy

**Test Seam**: The primary seam is the Postgres database — all repository tests run against a real instance. The secondary seam is Vitest's `vi.mock` for nodemailer (email tests) and filesystem operations (chunk processor tests use temp directories).

- **Database tests**: Use `DatabaseRepository.reset()` in `beforeEach`. Each test inserts its own data via fixtures, performs the operation, asserts the result, and cleans up in `afterEach`.
- **Route tests**: Import the configured Express app from the exported `createApp()` function (see Req 9). Use `supertest` to make HTTP assertions without a real port: `request(app).post('/login/default').send(payload)`. [Finding 2]
- **Chunk processor tests**: Override `TEMP_UPLOADS` env var to point to `fs.mkdtempSync()`. Clean up the temp directory in `afterAll`.
- **Email tests**: `vi.mock('nodemailer')` returns a `createTransport` spy. Test that `sendMail` is called with correct args and errors propagate. Transport-singleton verification (`transport created exactly once`) depends on Spec 0006 and is marked `test.todo` in this phase.

## Out of Scope

- Writing the actual test assertions for the 9 fix Specs — that work belongs to each Spec's implementation. This Spec only creates the infrastructure and file stubs.
- Migrating the existing `test/registration.ts` smoke test — it can remain as-is or be removed later.
- CI/CD pipeline configuration (GitHub Actions, etc.) — out of scope unless requested.
- Code coverage thresholds or coverage reporting configuration.

## Blocking Questions

- What is the exact test database name and connection string to hardcode in `config.test.json`? The placeholder above assumes `sync_server_test` on localhost:5433. Confirm or provide the target connection string.

## Open Questions

- Chunk processor tests use `fs.mkdtempSync` for temp directories — should the cleanup logic handle macOS `/tmp` cleanup behavior (system may clear `/tmp` on reboot)? Accept risk as tests are stateless.

## Dependencies

- **Email transport-singleton tests** (Req 13) depend on Spec 0006, which introduces the module-level transport. These assertions are `test.todo` until Spec 0006 is implemented. [Finding 3]
- **Spec 0006 (Email Client)** depends on Spec 0008 (Config singleton) if the consolidated config module changes how SMTP credentials are read.
- **Route tests** (Req 14) depend on the `createApp()` export from Req 9, which must be implemented before route test stubs can be verified.

## Follow-Ups

- After the test foundation is verified (tests run and pass), each of the 9 Specs (0001–0009) should be implemented in dependency order, starting with Spec 0003 (Database Layer) since many other Specs depend on database correctness.
