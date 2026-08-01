const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PR Review Load Balancer API',
      version: '1.0.0',
      description: 'An automated, load-aware GitHub pull request review assignment engine and team workload analytics API.',
      contact: {
        name: 'Developer API Support',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local Development Server',
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'connect.sid',
          description: 'Session cookie obtained via GitHub OAuth login',
        },
        githubWebhookSignature: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Hub-Signature-256',
          description: 'HMAC SHA-256 signature generated using GITHUB_WEBHOOK_SECRET',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            username: { type: 'string', example: 'danishjk2156' },
            avatar_url: { type: 'string', example: 'https://avatars.githubusercontent.com/u/12345' },
            team_id: { type: 'integer', example: 1, nullable: true },
            active: { type: 'boolean', example: true },
          },
        },
        ReviewerLoad: {
          type: 'object',
          properties: {
            reviewer_id: { type: 'integer', example: 2 },
            username: { type: 'string', example: 'alice' },
            open_review_count: { type: 'integer', example: 1 },
            avg_turnaround_hours: { type: 'number', example: 3.5 },
            load_score: { type: 'number', example: 5.5 },
            rank: { type: 'integer', example: 1 },
          },
        },
        StuckPR: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 101 },
            title: { type: 'string', example: 'Fix authentication edge case' },
            html_url: { type: 'string', example: 'https://github.com/org/repo/pull/12' },
            opened_at: { type: 'string', format: 'date-time' },
            hours_open: { type: 'number', example: 52.4 },
            author: { type: 'string', example: 'bob' },
          },
        },
      },
    },
    paths: {
      '/health': {
        get: {
          summary: 'Health check endpoint',
          description: 'Returns API service health status and current timestamp.',
          tags: ['Health'],
          responses: {
            200: {
              description: 'Service is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'ok' },
                      timestamp: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/auth/github': {
        get: {
          summary: 'Initiate GitHub OAuth login',
          description: 'Redirects client browser to GitHub for authentication.',
          tags: ['Authentication'],
          responses: {
            302: { description: 'Redirect to GitHub OAuth page' },
          },
        },
      },
      '/auth/github/callback': {
        get: {
          summary: 'GitHub OAuth callback URL',
          description: 'Handles token exchange, creates/updates user in database, and establishes session.',
          tags: ['Authentication'],
          responses: {
            200: { description: 'Successfully authenticated' },
            401: { description: 'Authentication failed' },
          },
        },
      },
      '/auth/me': {
        get: {
          summary: 'Get current authenticated user profile',
          description: 'Returns profile details of the currently signed-in user.',
          tags: ['Authentication'],
          security: [{ cookieAuth: [] }],
          responses: {
            200: {
              description: 'Current user profile',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/User' },
                },
              },
            },
            401: { description: 'Not authenticated' },
          },
        },
      },
      '/auth/logout': {
        post: {
          summary: 'Logout current user',
          description: 'Destroys the current user session.',
          tags: ['Authentication'],
          security: [{ cookieAuth: [] }],
          responses: {
            200: { description: 'Successfully logged out' },
          },
        },
      },
      '/api/webhooks/github': {
        post: {
          summary: 'GitHub Webhook Receiver',
          description: 'Ingests pull_request and pull_request_review events from GitHub after HMAC SHA-256 signature verification.',
          tags: ['Webhooks'],
          security: [{ githubWebhookSignature: [] }],
          parameters: [
            {
              in: 'header',
              name: 'X-GitHub-Event',
              required: true,
              schema: { type: 'string', example: 'pull_request' },
              description: 'GitHub event type',
            },
            {
              in: 'header',
              name: 'X-Hub-Signature-256',
              required: true,
              schema: { type: 'string', example: 'sha256=a1b2c3...' },
              description: 'HMAC SHA-256 signature',
            },
          ],
          responses: {
            200: { description: 'Webhook received and processed' },
            401: { description: 'Invalid HMAC signature' },
          },
        },
      },
      '/api/team/load': {
        get: {
          summary: 'Get ranked workload for current team',
          description: 'Returns team members ranked by weighted load score using the PostgreSQL window function.',
          tags: ['Team Analytics'],
          security: [{ cookieAuth: [] }],
          responses: {
            200: {
              description: 'Ranked list of team reviewers',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/ReviewerLoad' },
                  },
                },
              },
            },
            401: { description: 'Unauthorized' },
          },
        },
      },
      '/api/team/stuck': {
        get: {
          summary: 'Get stuck PRs open > 48 hours',
          description: 'Returns list of open PRs for the current team that have been waiting >48 hours without a completed review.',
          tags: ['Team Analytics'],
          security: [{ cookieAuth: [] }],
          responses: {
            200: {
              description: 'List of stuck PRs',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/StuckPR' },
                  },
                },
              },
            },
            401: { description: 'Unauthorized' },
          },
        },
      },
    },
  },
  apis: [],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
