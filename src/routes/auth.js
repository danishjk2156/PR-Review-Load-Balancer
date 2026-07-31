const router = require('express').Router();
const passport = require('passport');

// Redirect to GitHub OAuth
router.get('/github', passport.authenticate('github', { scope: ['repo'] }));

// GitHub OAuth callback
router.get('/github/callback',
  passport.authenticate('github', { failureRedirect: '/auth/failed' }),
  (req, res) => {
    // In production, redirect to frontend URL
    res.json({ message: 'Authenticated', user: req.user.username });
  }
);

// Current user
router.get('/me', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  const { id, username, avatar_url, team_id, active } = req.user;
  res.json({ id, username, avatar_url, team_id, active });
});

// Logout
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ message: 'Logged out' });
  });
});

// OAuth failure
router.get('/failed', (req, res) => {
  res.status(401).json({ error: 'GitHub authentication failed' });
});

module.exports = router;
