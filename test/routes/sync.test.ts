import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DatabaseRepository } from '../../src/repositories/database_repository';
import { clearCreatedIds } from '../fixtures';
import { createApp } from '../../src/main';

describe('Spec 0009 — Maintainability (sync routes)', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    DatabaseRepository.reset();
    app = createApp();
  });

  beforeEach(async () => {
    await clearCreatedIds();
  });

  afterAll(() => {
    DatabaseRepository.reset();
  });

  test.todo('duplicate chunk processing code is extracted into a shared function');
  test.todo('shared function accepts HTTP status code parameter (206 vs 200)');
});
