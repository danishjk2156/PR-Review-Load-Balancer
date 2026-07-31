const router = require('express').Router();
const config = require('../config');
const { verifySignature } = require('../utils/webhook-verify');
const { handlePROpened, handleReviewSubmitted } = require('../services/webhook-handlers');

router.post('/github', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'];

  // req.body is a raw Buffer here (see express.raw() in index.js)
  if (!verifySignature(req.body, signature, config.github.webhookSecret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const payload = JSON.parse(req.body.toString());

  try {
    switch (event) {
      case 'pull_request':
        if (payload.action === 'opened') {
          await handlePROpened(payload);
        }
        break;
      case 'pull_request_review':
        if (payload.action === 'submitted') {
          await handleReviewSubmitted(payload);
        }
        break;
      default:
        // Ignore events we don't handle
        break;
    }
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: 'Processing failed' });
  }
});

module.exports = router;
