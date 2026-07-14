import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { DatabaseRepository } from '../../src/repositories/database_repository';
import { UserRepository } from '../../src/repositories/user_repository';
import { createTestUser, clearCreatedIds, getTestRealm } from '../fixtures';

const TEST_REALM = getTestRealm();

describe('Spec 0002 — Password & PIN Security (user_repository)', () => {
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

  test.todo('PIN generation uses crypto.randomInt instead of Math.random');
  test.todo('generatePin uses UPSERT instead of DELETE+INSERT');
  test.todo('changePassword throws new Error(...) instead of throw "string"');
  test.todo('FROM users uses Tables.User constant');
});
