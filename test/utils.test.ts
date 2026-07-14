import { describe, test, expect } from 'vitest';
import { encryptPassword } from '../src/helpers/utils';

describe('Spec 0002 — H5: Password hashing with scrypt', () => {
  test('encryptPassword produces a hex string', () => {
    const result = encryptPassword('testPass123', 'somesalt');
    // scryptSync produces a buffer, toString('hex') gives a hex string
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    // scrypt with keylen 64 produces 128 hex chars (64 bytes × 2)
    expect(result).toHaveLength(128);
  });

  test('encryptPassword produces consistent output for same password and salt', () => {
    const result1 = encryptPassword('testPass123', 'somesalt');
    const result2 = encryptPassword('testPass123', 'somesalt');
    expect(result1).toBe(result2);
  });

  test('encryptPassword produces different output for different salts', () => {
    const result1 = encryptPassword('testPass123', 'salt1');
    const result2 = encryptPassword('testPass123', 'salt2');
    expect(result1).not.toBe(result2);
  });

  test('encryptPassword produces different output for different passwords', () => {
    const result1 = encryptPassword('password1', 'somesalt');
    const result2 = encryptPassword('password2', 'somesalt');
    expect(result1).not.toBe(result2);
  });
});
