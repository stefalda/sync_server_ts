import { describe, test, expect, vi, beforeAll, afterAll } from 'vitest';

vi.mock('nodemailer', () => {
  const sendMail = vi.fn().mockResolvedValue({ messageId: 'test-id' });
  const createTransport = vi.fn().mockReturnValue({ sendMail });
  return { default: { createTransport }, createTransport };
});

describe('Spec 0006 — Email Client Reliability', () => {
  beforeAll(() => {
    // nodemailer is mocked via vi.mock above
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  test.todo('sendMail is awaited (not fire-and-forget)');
  test.todo('errors propagate to caller instead of being silently caught');
  test.todo('transport is created as module-level singleton (Spec 0006)');
  test.todo('compiled handlebars templates are cached');
  test.todo('SMTP transport is not created per email (reused)');
});
