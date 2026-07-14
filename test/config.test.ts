import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseRepository } from '../src/repositories/database_repository';

describe('Spec 0008 — Configuration & Bootstrap (config singleton, pool config shape)', () => {
  beforeAll(() => {
    DatabaseRepository.reset();
  });

  afterAll(() => {
    DatabaseRepository.reset();
  });

  test.todo('config is loaded once and shared via a singleton module');
  test.todo('pool is created with configured max, idleTimeoutMillis, connectionTimeoutMillis');
});
