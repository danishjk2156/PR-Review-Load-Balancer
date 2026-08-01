const crypto = require('crypto');

/**
 * Verifies GitHub webhook HMAC SHA-256 signature in constant time.
 * @param {Buffer|string} payload Raw request body
 * @param {string} signature Header value 'X-Hub-Signature-256'
 * @param {string} secret Configured GITHUB_WEBHOOK_SECRET
 * @returns {boolean} True if signature is valid
 */
function verifySignature(payload, signature, secret) {
  if (!signature || !secret || !payload) return false;

  const cleanSecret = String(secret).trim();
  const cleanSig = String(signature).trim();

  try {
    const expected = 'sha256=' + crypto
      .createHmac('sha256', cleanSecret)
      .update(payload)
      .digest('hex');

    const expectedBuffer = Buffer.from(expected);
    const signatureBuffer = Buffer.from(cleanSig);

    if (expectedBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
  } catch {
    return false;
  }
}

module.exports = { verifySignature };
