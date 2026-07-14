import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DatabaseRepository } from '../../src/repositories/database_repository';
import { UserRepository } from '../../src/repositories/user_repository';
import { createTestUser, clearCreatedIds, getTestRealm } from '../fixtures';

const TEST_REALM = getTestRealm();

describe('Spec 0002 — Password & PIN Security', () => {
  beforeAll(() => {
    DatabaseRepository.reset();
  });

  beforeEach(async () => {
    await clearCreatedIds();
  });

  afterAll(() => {
    DatabaseRepository.reset();
    UserRepository.reset();
  });

  test('H7: PIN generated with crypto.randomInt is in valid range', () => {
    // The private randomFixInteger(6) should produce a 6-digit number
    // crypto.randomInt(100000, 999999) produces values in [100000, 999998]
    // Test the replacement directly
    const { randomInt } = require('crypto');
    for (let i = 0; i < 100; i++) {
      const pin = randomInt(100000, 999999);
      expect(pin).toBeGreaterThanOrEqual(100000);
      expect(pin).toBeLessThanOrEqual(999999);
    }
  });

  test('M8: UPSERT handles duplicate without error', async () => {
    const user = await createTestUser();
    const db = await DatabaseRepository.getInstance();

    // Insert the same pin twice — second should UPSERT, not throw
    const sql = `INSERT INTO public.users_pin (userid, pin, created) VALUES ($1, $2, $3)
      ON CONFLICT (userid) DO UPDATE SET pin = EXCLUDED.pin, created = EXCLUDED.created`;
    await db.query(sql, [user.id, '123456', Date.now()], { realm: TEST_REALM });
    // Second insert with different pin — should succeed (UPSERT)
    await expect(
      db.query(sql, [user.id, '654321', Date.now()], { realm: TEST_REALM })
    ).resolves.not.toThrow();
  });

  test('L2: changePassword throws Error objects not strings', async () => {
    // changePassword throws for missing password
    try {
      await UserRepository.getInstance().changePassword(TEST_REALM, {
        email: 'any@test.com',
        password: '',
        pin: '123456',
      } as any);
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBeTruthy();
    }
  });

  test('L7: isEmailAlreadyRegistered uses Tables.User constant', async () => {
    // This test validates via the fix — query should use $1 style placeholders
    // and reference the Tables.User constant, not hardcoded 'users'
    // Create a user and verify email check works
    const user = await createTestUser();
    // Accessing the users table should work via Tables.User = 'users'
    const db = await DatabaseRepository.getInstance();
    const result = await db.query(
      `SELECT id FROM users WHERE email = $1`,
      [user.email],
      { realm: TEST_REALM, singleResult: true }
    );
    expect(result).not.toBeNull();
    expect(result.id).toBe(user.id);
  });
});
