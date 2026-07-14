import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Spec 0009 — Maintainability (logger)', () => {
  test('M3: console.log is removed from winston printf format function', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../src/helpers/logger.ts'),
      'utf-8'
    );
    // Find lines containing console.log that are NOT inside comments
    const consoleLogLines = src.split('\n').filter(l =>
      l.includes('console.log') && !l.trim().startsWith('//')
    );
    expect(consoleLogLines).toHaveLength(0);
    // The printf callback should still return the formatted message
    const callbackStart = src.indexOf('winston.format.printf');
    const callbackEnd = src.indexOf('});', callbackStart) + 3;
    const callbackBody = src.slice(callbackStart, Math.min(callbackEnd, callbackStart + 1000));
    expect(callbackBody).toContain('return msg');
  });
});
