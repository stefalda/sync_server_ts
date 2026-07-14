import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Spec 0008 — Configuration & Bootstrap', () => {
  test('L3: config iteration uses Object.keys (not for...in without hasOwnProperty)', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../src/main.ts'),
      'utf-8'
    );
    // The realm iteration should use Object.keys() instead of for...in
    expect(src).toContain('Object.keys(configJson.db.realms)');
    // Should not use bare for...in on realms
    const realmLoopLines = src.split('\n').filter(l => l.includes('configJson.db.realms'));
    const hasForIn = realmLoopLines.some(l => /for\s*\(/.test(l) && /in\s+/.test(l) && !l.includes('Object.keys'));
    expect(hasForIn).toBe(false);
  });

  test('L16: config is loaded from a shared location (main.ts imports config)', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../src/main.ts'),
      'utf-8'
    );
    // main.ts should import config.json
    expect(src).toContain("config.json");
  });
});
