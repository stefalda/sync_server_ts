import { describe, test, expect, vi, beforeEach, afterAll } from 'vitest';
import path from 'path';

const mockClose = vi.fn();
const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'test-id' });
const mockCreateTransport = vi.fn().mockReturnValue({ sendMail: mockSendMail, close: mockClose });

vi.mock('nodemailer', () => ({
  default: { createTransport: mockCreateTransport },
  createTransport: mockCreateTransport,
}));

const emailArgs = {
  to: 'test@test.com',
  subject: 'Test',
  templatePath: path.join(__dirname, '../../src/email-template/change_password.html'),
  templateData: { name: 'Test User', pin: '123456', appName: 'Test' },
};

describe('Spec 0006 — Email Client Reliability', () => {
  beforeEach(() => {
    vi.resetModules();
    mockCreateTransport.mockClear();
    mockSendMail.mockClear();
    mockClose.mockClear();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  test('H8: sendMail is awaited and errors propagate', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP error'));
    const { sendMail } = await import('../../src/helpers/email_client');

    await expect(sendMail(emailArgs)).rejects.toThrow('SMTP error');
  });

  test('L21: template cache compiles once', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'test-id' });
    const { sendMail } = await import('../../src/helpers/email_client');

    await sendMail(emailArgs);
    await sendMail(emailArgs);

    expect(mockSendMail).toHaveBeenCalledTimes(2);
  });

  test('L22: transport is created as singleton', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'test-id' });
    const { sendMail, closeTransport } = await import('../../src/helpers/email_client');

    await sendMail(emailArgs);
    await sendMail(emailArgs);

    expect(mockCreateTransport).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledTimes(2);

    closeTransport();
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
