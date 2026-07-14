import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { DatabaseRepository } from '../../src/repositories/database_repository';
import { clearCreatedIds } from '../fixtures';
import { createApp } from '../../src/main';

describe('Spec 0001 — H10: Email enumeration', () => {
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

  test('password forgotten with unregistered email returns 200 (not 500)', async () => {
    const res = await request(app)
      .post('/password/todo_test/forgotten')
      .send({ email: 'nonexistent@test.com' });
    // Should return 200 with generic message, not 500
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('code');
  });
});
