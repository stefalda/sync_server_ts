import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DatabaseRepository } from '../../src/repositories/database_repository';
import { clearCreatedIds } from '../fixtures';
import { createApp } from '../../src/main';

describe('Spec 0007 — API Layer Hardening', () => {
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

  test.todo('body limit is reduced from 50MB to 10-20MB');
  test.todo('rate limiting returns 429 after exceeded limit');
  test.todo('security headers (X-Content-Type-Options, X-Frame-Options) are present');
  test.todo('async route errors return 500 JSON instead of crashing');
  test.todo('missing required body fields return 400 with validation error');
});
