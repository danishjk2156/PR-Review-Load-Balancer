const router = require('express').Router();
const config = require('../config');
const { verifySignature } = require('../utils/webhook-verify');
const { handlePROpened, handleReviewSubmitted, handlePRClosed } = require('../services/webhook-handlers');

router.post('/github', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'];

  // Always verify signature — use raw body buffer for accurate HMAC
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
  const isValid = verifySignature(rawBody, signature, config.github.webhookSecret);

  if (!isValid) {
    console.warn('❌ HMAC Signature Mismatch! Invalid webhook signature.');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Parse the payload from raw body
  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  const action = payload.action;
  const prNumber = payload.pull_request?.number;

  console.log(`🔔 Webhook received: event=${event}, action=${action || 'N/A'}`);

  try {
    switch (event) {
      case 'pull_request':
        if (action === 'opened' || action === 'synchronize') {
          console.log(`📥 Processing PR #${prNumber} (${action}): "${payload.pull_request?.title}"`);
          await handlePROpened(payload);
        } else if (action === 'closed') {
          console.log(`📥 Processing PR #${prNumber} closed (merged=${payload.pull_request?.merged})`);
          await handlePRClosed(payload);
        } else {
          console.log(`ℹ️ Ignored PR action: ${action}`);
        }
        break;
      case 'pull_request_review':
        if (action === 'submitted') {
          console.log(`📥 Processing Review submitted: PR #${payload.pull_request.number} by ${payload.review.user.login}`);
          await handleReviewSubmitted(payload);
        }
        break;
      default:
        console.log(`ℹ️ Ignored event: ${event}.${action}`);
        break;
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('❌ Webhook processing error:', err);
    res.status(500).json({ error: 'Processing failed' });
  }
});

module.exports = router;
