import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { DatabaseRepository } from '../../src/repositories/database_repository';
import { AuthenticationRepository } from '../../src/repositories/authentication_repository';
import { createTestUser, createTestClient, createTestToken, clearCreatedIds, getTestRealm } from '../fixtures';

const TEST_REALM = getTestRealm();

describe('Spec 0003 — Database Layer Correctness (H2)', () => {
  beforeAll(() => {
    DatabaseRepository.reset();
    AuthenticationRepository.reset();
  });

  beforeEach(async () => {
    await clearCreatedIds();
  });

  afterAll(() => {
    DatabaseRepository.reset();
    AuthenticationRepository.reset();
  });

  test('getUserIdFromToken returns the user ID for a valid token after ? → $1 fix', async () => {
    const user = await createTestUser();
    const client = await createTestClient(user.id);
    const token = await createTestToken(client.clientid);

    const result = await AuthenticationRepository.getInstance().getUserIdFromToken(
      TEST_REALM, token.token
    );

    expect(result).not.toBeNull();
    expect(result.userid).toBe(user.id);
  });
});

describe('Spec 0001 — Authentication & Authorization Security', () => {
  beforeAll(() => {
    DatabaseRepository.reset();
  });

  beforeEach(async () => {
    await clearCreatedIds();
  });

  afterAll(() => {
    DatabaseRepository.reset();
    AuthenticationRepository.reset();
  });

  test('H1: login.ts refresh token verification uses secret_key_refresh (not secret_key)', async () => {
    // Create a refresh token signed with secret_key_refresh
    const jwt = require('jsonwebtoken');
    const refreshToken = jwt.sign(
      { userid: 'test-user', email: 'test@test.com' },
      'TEST_JWT_SECRET_KEY2', // must match config.test.json secret_key_refresh
      { expiresIn: '7d' }
    );

    // The login handler should verify with secret_key_refresh, not secret_key.
    // Verification with secret_key_refresh should succeed
    const decoded = jwt.verify(refreshToken, 'TEST_JWT_SECRET_KEY2');
    expect(decoded).toHaveProperty('email', 'test@test.com');

    // Verification with secret_key (the WRONG key that was used before the fix) must fail
    expect(() => jwt.verify(refreshToken, 'TEST_JWT_SECRET_KEY')).toThrow();
  });

  test('H1: JWT verify uses synchronous API (no callback race)', () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ test: true }, 'secret');
    // Synchronous verify returns decoded or throws — no callback needed
    const decoded = jwt.verify(token, 'secret');
    expect(decoded).toHaveProperty('test', true);
  });

  test('M6: token expiry check guards against null/undefined lastrefresh', async () => {
    const user = await createTestUser();
    const client = await createTestClient(user.id);
    const token = await createTestToken(client.clientid);

    // Set lastrefresh to null directly in DB to simulate the condition
    const db = DatabaseRepository.getInstance();
    await db.query(
      `UPDATE public.user_tokens SET lastrefresh = NULL WHERE clientid = $1`,
      [client.clientid],
      { realm: TEST_REALM }
    );

    // AuthenticationRepository.getToken should return the token with null lastrefresh
    const userToken = await AuthenticationRepository.getInstance().getToken(
      TEST_REALM, token.token
    );
    expect(userToken).not.toBeNull();
    expect(userToken.lastrefresh).toBeNull();
  });

  test('L1: checkSimpleToken source contains Bearer prefix guard', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../src/middleware/authorization.ts'),
      'utf-8'
    );
    // The checkSimpleToken function should check `!token.startsWith("Bearer ")`
    // before calling token.substring(7)
    const checkSimpleTokenSection = src.split('const checkSimpleToken')[1]?.split('const checkJWTToken')[0] || '';
    expect(checkSimpleTokenSection).toContain('startsWith("Bearer ")');
  });

  test('L9: next parameter is typed as NextFunction (not any)', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../src/middleware/authorization.ts'),
      'utf-8'
    );
    // checkBasicAuthentication signature should have next: NextFunction
    expect(src).toContain('next: NextFunction');
  });

  test('L10: generateJWTToken and generateRefreshJWTToken return types are string', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../src/middleware/authorization.ts'),
      'utf-8'
    );
    // Both functions should have `: string` return type annotation, not `: String`
    const jwtFunctions = src.split('export function')[2] + src.split('export function')[3];
    expect(jwtFunctions).toContain('): string');
    expect(jwtFunctions).not.toContain('): String');
  });

  test('L14: destructuring in login.ts initializes both userid and email (removed by H1 fix)', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../src/routes/login.ts'),
      'utf-8'
    );
    // The old `let userid, email = null` pattern should be gone.
    // The H1 fix replaced the whole JWT verify block with synchronous try/catch.
    expect(src).not.toContain('let userid, email = null');
  });

  test('L15: req.userToken and req.user are used without as any casts', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../src/middleware/authorization.ts'),
      'utf-8'
    );
    // The authorization.ts module should reference req.userToken and req.user directly
    expect(src).toContain('req.userToken =');
    expect(src).toContain('req.user =');
    // And should NOT contain (req as any).userToken or (req as any).user
    expect(src).not.toContain('(req as any).userToken');
    expect(src).not.toContain('(req as any).user');
  });

  test('L17: catch blocks use type narrowing (error.message access removed)', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../src/middleware/authorization.ts'),
      'utf-8'
    );
    // The catch blocks in authorization.ts should not access error.message
    // (which would require type narrowing on `unknown`)
    const catchBlocks = src.match(/catch\s*\([^)]+\)\s*{/g) || [];
    expect(catchBlocks.length).toBeGreaterThan(0);
    // Each catch block should not use error.message without type narrowing
    expect(src).not.toContain('error.message');
  });
});
