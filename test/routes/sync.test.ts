import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Spec 0009 — Maintainability (sync routes)', () => {
  test('L18: duplicate chunk processing code is extracted into a shared function', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../src/routes/sync.ts'),
      'utf-8'
    );
    // The shared function processSyncChunk should exist
    expect(src).toContain('async function processSyncChunk');
    // Both push and pull handlers should call it (not inline the logic)
    const pullSection = src.split('router.post(\'/pull')[1]?.split('router.post')[0] || '';
    const pushSection = src.split('router.post(\'/push')[1]?.split('router.post')[0] || '';
    // The chunk_processor.processChunk calls should be in the shared function, not in handlers
    expect(pullSection).not.toContain('chunk_processor.processChunk');
    expect(pushSection).not.toContain('chunk_processor.processChunk');
    // Both should call processSyncChunk instead
    expect(pullSection).toContain('processSyncChunk');
    expect(pushSection).toContain('processSyncChunk');
  });

  test('L18: shared function accepts HTTP status code parameter (206 vs 200)', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../src/routes/sync.ts'),
      'utf-8'
    );
    // The shared function should accept inProgressStatus parameter
    const funcMatch = src.match(/async function processSyncChunk[\s\S]*?\)\s*{/);
    expect(funcMatch).not.toBeNull();
    expect(funcMatch![0]).toContain('inProgressStatus');

    // Pull should pass 206, push should pass 200
    const pullSection = src.split('router.post(\'/pull')[1]?.split('router.post')[0] || '';
    expect(pullSection).toContain('206');
    const pushSection = src.split('router.post(\'/push')[1]?.split('router.post')[0] || '';
    expect(pushSection).toContain('200');
  });
});
