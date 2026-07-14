---
type: Spec
title: Configuration & Server Bootstrap Quality
---

## Problem

Server bootstrap and configuration loading have eight quality and security issues. Realm isolation is bypassed for unknown realms via a "default" pool fallback. Config is iterated with `for...in` without `hasOwnProperty`, risking prototype pollution. Config is loaded independently in four different files. The PostgreSQL pool uses all default parameters (max 10 connections, no idle timeout, no connection timeout). There is no `/healthz` endpoint for container orchestrators. Import styles are mixed (CJS/ESM), `setMaxListeners` is undocumented, and `morganStream` is unused.

## Proposed Outcome

Configuration is loaded once and shared, realm names are validated, the database pool is tuned, a health endpoint exists, and server bootstrap code is clean. Findings M1, L3, L11, L12, L16, L19, L20, L6 are resolved. [L1]

## User Stories

1. As a system operator, requests to unknown realms return 404 instead of silently using a default pool.
2. As a system operator, the PostgreSQL pool has configured connection limits and timeouts.
3. As a system operator, a `/healthz` or `/ready` endpoint reports server health for load balancers.
4. As a developer, configuration is loaded once and shared across modules.

## Requirements

1. **Realm validation**: Before falling back to `pools.get("default")!` in `src/repositories/database_repository.ts:17-22`, validate the realm against the configured realm keys. Return 404 for unknown realms. [L1]
2. **Config iteration**: Replace `for (let realm in configJson.db.realms)` with `for (const realm of Object.keys(configJson.db.realms))` in `src/main.ts:54`. [L1]
3. **Consolidate config loading**: Create a shared config module or singleton that loads `config.json` once and exports the parsed object. Remove direct `require('config.json')` calls from `src/middleware/authorization.ts:4`, `src/helpers/email_client.ts:5`, `src/repositories/user_repository.ts:2`. [L1]  
   - The singleton must be importable synchronously, because `authorization.ts` evaluates `export const useJWT = configJson.server.authentication === 'jwt'` at module load time.
4. **Pool configuration**: Add `max`, `idleTimeoutMillis`, and `connectionTimeoutMillis` to the `Pool` constructor options at `src/repositories/database_repository.ts:36`. Read values from config. [L1]  
   - **Backward-compatible config format**: Realms in `db.realms` are currently plain connection strings (`"default": "postgresql://..."`). Support both the existing string format and a new object format:  
     ```
     "default": { "connectionString": "postgresql://...", "pool": { "max": 20, "idleTimeoutMillis": 30000, "connectionTimeoutMillis": 2000 } }
     ```  
   - If the realm value is a string, treat it as a connection string with default pool params. If it is an object, read `connectionString` and optional `pool` settings. Update both `config.json` and `config_sample.json` to show the object format.
5. **Health endpoint**: Add `GET /healthz` or `GET /ready` to `src/routes/base.ts` that returns 200 with `{ status: "ok" }`. [L1]
6. **Import consistency**: Standardize all imports in `src/main.ts` to a single style. [L1]  
   - Since `tsconfig.json` sets `"module": "CommonJS"`, use the TypeScript CJS-compatible form `import ... = require(...)` for all imports, or use the `import * as` form consistently (TypeScript compiles both to CJS).  
   - Remove the bare `const compression = require('compression')` and `import morgan = require('morgan')` mixed forms. Pick one form and apply it to all three dependencies: `cors`, `compression`, `morgan`.
7. **Document setMaxListeners**: Add a comment explaining why `process.setMaxListeners(50)` is needed at `src/main.ts:60`, or remove it if it is no longer needed. [L1]
8. **Remove unused morganStream**: Remove the `morganStream` variable from `src/main.ts:23-25` and its associated commented-out `app.use(morgan(...))` line. [L1]

## Technical Decisions

- Create `src/helpers/config.ts` as a shared config singleton module that exports typed config. All other modules import from it. [L1]
- For pool config, add `db.realms[realm].pool` section to the config schema with `max`, `idleTimeoutMillis`, `connectionTimeoutMillis`. [L1]
- Use ESM-style imports (`import * as`) consistently, matching the project's TypeScript configuration. [L1]

## Testing Strategy

**Test Seam**: The config loading function can be tested by pointing at test config files. The pool creation can be tested with mock config.

- Unit-test that config singleton returns the same object on repeated imports
- Unit-test that unknown realm names return 404 error (or are rejected)
- Integration-test that `GET /healthz` returns 200
- Unit-test that pool is created with config-specified parameters

## Out of Scope

- Database error propagation (covered by Spec 0003)
- API rate limiting (covered by Spec 0007)
- Security headers (covered by Spec 0007)
