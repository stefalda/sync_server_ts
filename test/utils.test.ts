import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { encryptPassword } from '../src/helpers/utils';
import { DatabaseRepository } from '../src/repositories/database_repository';

describe('Spec 0002 — Password & PIN Security (utils)', () => {
  beforeAll(() => {
    DatabaseRepository.reset();
  });

  afterAll(() => {
    DatabaseRepository.reset();
  });

  test.todo('encryptPassword uses scrypt or bcrypt instead of SHA-512');
  test.todo('encryptPassword returns a hex string');
  test.todo('encryptPassword produces different output for different salts');
  test.todo('encryptPassword with same password and salt produces consistent output');
});
