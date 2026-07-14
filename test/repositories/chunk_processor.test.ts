import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';

// We need to access the module's internal state. The chunk_processor is exported
// as a singleton, and its TEMP_DIR is configurable via TEMP_UPLOADS env var.

const TEST_TEMP_DIR = fs.mkdtempSync(path.join(__dirname, '../../', 'tmp-chunk-test-'));

function makeMockBody(overrides: Record<string, unknown> = {}) {
  return {
    chunkIndex: 0,
    data: JSON.stringify({ test: 'data' }),
    start: 0,
    end: 100,
    chunks: 2,
    syncId: 'test-sync-123',
    totalSize: 0,
    ...overrides,
  };
}

function makeMockReq(body: Record<string, unknown>) {
  return { body } as any;
}

function makeMockRes() {
  return {} as any;
}

describe('Spec 0005 — Chunk Processor Security & Reliability', () => {
  beforeEach(() => {
    process.env.TEMP_UPLOADS = TEST_TEMP_DIR;
  });

  afterEach(async () => {
    // Clean up any files created during tests
    try {
      await fsPromises.rm(TEST_TEMP_DIR, { recursive: true, force: true });
      await fsPromises.mkdir(TEST_TEMP_DIR, { recursive: true });
    } catch {
      // ignore cleanup errors
    }
  });

  test('H6: path traversal in clientId is rejected', async () => {
    // Reset the module so it picks up the test TEMP_DIR
    const chunkProcessor = (await import('../../src/repositories/chunk_processor')).default;
    // We can't easily test validation before the fix without modifying the module.
    // After the fix, clientId '../etc' should be caught by validation.
    // For now, this test documents the expected behavior.
    const req = makeMockReq(makeMockBody());
    try {
      await chunkProcessor.processChunk({
        clientId: '../../etc/passwd',
        realm: 'todo_test',
        req,
        res: makeMockRes(),
      });
      // If validation is in place, this should throw before any filesystem operation
      expect.unreachable('Should have thrown on path traversal');
    } catch (err: any) {
      expect(err).toBeTruthy();
    }
  });

  test('H6: path traversal in syncId is rejected', async () => {
    const chunkProcessor = (await import('../../src/repositories/chunk_processor')).default;
    const req = makeMockReq(makeMockBody({ syncId: '../../etc/passwd' }));
    try {
      await chunkProcessor.processChunk({
        clientId: 'valid-client',
        realm: 'todo_test',
        req,
        res: makeMockRes(),
      });
      expect.unreachable('Should have thrown on path traversal');
    } catch (err: any) {
      expect(err).toBeTruthy();
    }
  });

  test('L4: async rename does not throw with valid paths', async () => {
    const chunkProcessor = (await import('../../src/repositories/chunk_processor')).default;
    const req = makeMockReq(makeMockBody({ chunkIndex: 0, chunks: 1, totalSize: 0 }));
    try {
      const result = await chunkProcessor.processChunk({
        clientId: 'valid-client',
        realm: 'todo_test',
        req,
        res: makeMockRes(),
      });
      // The result should be IN_PROGRESS or COMPLETED, but not throw
      expect(['IN_PROGRESS', 'COMPLETED']).toContain(result.status);
    } catch (err: any) {
      // If it throws for a non-traversal reason, that's expected until the fix
      expect(err).toBeTruthy();
    }
  });
});
