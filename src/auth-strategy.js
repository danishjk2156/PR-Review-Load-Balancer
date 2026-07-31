const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const config = require('./config');
const db = require('../db');

passport.use(new GitHubStrategy({
    clientID: config.github.clientId,
    clientSecret: config.github.clientSecret,
    callbackURL: config.github.callbackUrl,
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const result = await db.query(
        `INSERT INTO users (github_id, username, avatar_url, access_token)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (github_id)
         DO UPDATE SET username = $2, avatar_url = $3, access_token = $4, updated_at = NOW()
         RETURNING *`,
        [profile.id, profile.username, profile._json.avatar_url, accessToken]
      );
      done(null, result.rows[0]);
    } catch (err) {
      done(err);
    }
  }
));

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    done(null, result.rows[0] || null);
  } catch (err) {
    done(err);
  }
});
