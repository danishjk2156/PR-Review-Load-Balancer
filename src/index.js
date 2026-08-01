const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const passport = require('passport');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const cors = require('cors');
const config = require('./config');
const db = require('../db');

// Passport strategy setup
require('./auth-strategy');

const app = express();

// Enable CORS for frontend
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

// Raw body needed for webhook signature verification — must come before express.json()
app.use('/api/webhooks', express.raw({ type: '*/*' }));
app.use(express.json());

// Sessions backed by Postgres
app.use(session({
  store: new PgSession({ pool: db.pool, tableName: 'session' }),
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    secure: config.nodeEnv === 'production',
  },
}));

app.use(passport.initialize());
app.use(passport.session());

// Swagger UI Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/team', require('./routes/team'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/assignments', require('./routes/assignments'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(config.port, () => {
  console.log(`PR Review Load Balancer running on port ${config.port}`);
  console.log(`Swagger UI interactive docs available at http://localhost:${config.port}/api-docs`);
});

module.exports = app;
