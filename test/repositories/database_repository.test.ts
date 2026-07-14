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

  test.todo('query with valid SQL returns rows');
  test.todo('query with no results returns null');
  test.todo('query rethrows database errors instead of returning undefined');
  test.todo('query uses $1 style placeholders, not ?');
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

  test.todo('unknown realm returns error instead of falling back to default pool');
  test.todo('pool is created with configured connection parameters');
});
