const { verifySignature } = require('../src/utils/webhook-verify');
const crypto = require('crypto');

describe('Webhook Signature Verification', () => {
  const secret = 'test-webhook-secret';
  const payload = Buffer.from(JSON.stringify({ action: 'opened' }));

  function sign(body) {
    return 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
  }

  test('accepts valid signature', () => {
    const sig = sign(payload);
    expect(verifySignature(payload, sig, secret)).toBe(true);
  });

  test('rejects invalid signature', () => {
    expect(verifySignature(payload, 'sha256=badhex', secret)).toBe(false);
  });

  test('rejects missing signature', () => {
    expect(verifySignature(payload, null, secret)).toBe(false);
  });

  test('rejects missing secret', () => {
    const sig = sign(payload);
    expect(verifySignature(payload, sig, null)).toBe(false);
  });

  test('rejects tampered payload', () => {
    const sig = sign(payload);
    const tampered = Buffer.from(JSON.stringify({ action: 'closed' }));
    expect(verifySignature(tampered, sig, secret)).toBe(false);
  });
});
