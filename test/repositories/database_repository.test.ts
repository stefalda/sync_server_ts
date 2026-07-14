import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { DatabaseRepository } from '../../src/repositories/database_repository';
import { clearCreatedIds, getTestRealm } from '../fixtures';

const TEST_REALM = getTestRealm();

describe('Spec 0003 — Database Layer Correctness', () => {
  beforeAll(() => {
    DatabaseRepository.reset();
  });

  beforeEach(async () => {
    await clearCreatedIds();
  });

  afterAll(() => {
    DatabaseRepository.reset();
  });

  test('query with valid SQL returns rows', async () => {
    const db = DatabaseRepository.getInstance();
    const result = await db.query('SELECT 1 as value', [], { realm: TEST_REALM });
    expect(result).toEqual([{ value: 1 }]);
  });

  test('query with no results returns null', async () => {
    const db = DatabaseRepository.getInstance();
    const result = await db.query(
      'SELECT 1 as value WHERE 1 = 0', [], { realm: TEST_REALM }
    );
    expect(result).toBeNull();
  });

  test('query rethrows database errors instead of returning undefined', async () => {
    const db = DatabaseRepository.getInstance();
    await expect(
      db.query('INVALID SQL !!!', [], { realm: TEST_REALM })
    ).rejects.toThrow();
  });

  test('query works with $1 style placeholders', async () => {
    const db = DatabaseRepository.getInstance();
    const result = await db.query('SELECT $1 as value', ['hello'], { realm: TEST_REALM });
    expect(result).toEqual([{ value: 'hello' }]);
  });
});

describe('Spec 0008 — Configuration & Bootstrap (realm validation, pool config)', () => {
  beforeAll(() => {
    DatabaseRepository.reset();
  });

  beforeEach(async () => {
    await clearCreatedIds();
  });

  afterAll(() => {
    DatabaseRepository.reset();
  });

  test('M1: unknown realm throws instead of falling back to default pool', async () => {
    const db = DatabaseRepository.getInstance();
    // The config.test.json only has "todo_test" realm.
    // Querying with an unknown realm should throw, not silently use "default".
    await expect(
      db.query('SELECT 1', [], { realm: 'nonexistent_realm' })
    ).rejects.toThrow('Unknown realm');
  });

  test('L20: pool is created with configured connection string', async () => {
    // The config.test.json uses string format. Verify the pool works.
    const db = DatabaseRepository.getInstance();
    const result = await db.query('SELECT 1 as ok', [], { realm: 'todo_test' });
    expect(result).toEqual([{ ok: 1 }]);
  });
});
