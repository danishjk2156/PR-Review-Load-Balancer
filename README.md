# ⚖️ PR Review Load Balancer

> An automated, load-aware GitHub pull request review assignment engine and team workload analytics service.

---

## 📌 Table of Contents
1. [What Problem Does This Solve?](#-what-problem-does-this-solve)
2. [End-to-End Workflow](#-end-to-end-workflow)
3. [System Architecture](#-system-architecture)
4. [Project Structure & Modules](#-project-structure--modules)
5. [API Routes Reference](#-api-routes-reference)
6. [The Load-Balancing Algorithm & SQL Engine](#-the-load-balancing-algorithm--sql-engine)
7. [Getting Started (Step-by-Step Setup)](#-getting-started-step-by-step-setup)
8. [Testing](#-testing)

---

## ❓ What Problem Does This Solve?

In software teams, PR review requests are often assigned randomly or sent to senior engineers by default. This causes:
- **Reviewer Bottlenecks**: High-performing engineers get overwhelmed with open reviews.
- **Delayed Merges**: PRs sit idle for days because busy reviewers don't have capacity.
- **Inequitable Workload**: Some team members have 5+ open reviews while others have zero.

**PR Review Load Balancer** solves this by:
1. Receiving GitHub webhooks whenever a pull request is opened.
2. Calculating the real-time load score of every eligible team member using a PostgreSQL window function.
3. Automatically picking the least-burdened reviewer and requesting their review via the GitHub API.
4. Flagging "stuck" PRs (open > 48 hours without a review) on a dashboard.

---

## 🔄 End-to-End Workflow

Here is how a Pull Request travels through the entire system:

```
[ Developer ] --(1. Opens PR on GitHub)--> [ GitHub API ]
                                                  |
                                                  | (2. Webhook: pull_request.opened)
                                                  v
                                     [ Express Server (/api/webhooks/github) ]
                                                  |
                                                  | (3. HMAC SHA-256 Signature Verification)
                                                  v
                                     [ Webhook Handler (services/webhook-handlers.js) ]
                                                  |
                                                  | (4. Upsert Repo & PR into Postgres)
                                                  v
                                     [ Assignment Engine (services/assignment.js) ]
                                                  |
                                                  | (5. Run SQL Load-Ranking Query)
                                                  v
                                     [ PostgreSQL View (review_load) ]
                                                  |
                                                  | (6. Pick Rank #1 Reviewer)
                                                  v
                                     [ GitHub REST API (Octokit) ]
                                                  |
                                                  | (7. Request Reviewer on GitHub)
                                                  v
                                       [ Developer Assigned on GitHub! ]
```

### Workflow Steps Explained for Beginners:

1. **PR Opened on GitHub**: A developer submits a new pull request on a repository.
2. **GitHub Webhook Triggered**: GitHub sends an HTTP `POST` request containing details of the PR to `/api/webhooks/github`.
3. **Security Validation**: The backend checks the secret signature (`X-Hub-Signature-256`) using a constant-time HMAC SHA-256 comparison to ensure the request actually came from GitHub.
4. **Database Storage**: The backend saves or updates the repository and pull request records in PostgreSQL.
5. **Workload Scoring**: The backend queries the database for all members of the PR author's team. It calculates a **Load Score** for each member based on:
   $$\text{Load Score} = (\text{Open Assigned Reviews} \times 2) + \text{Avg Turnaround Hours (Last 30 Days)}$$
6. **Candidate Selection**: The algorithm excludes:
   - The author of the PR (you can't review your own code).
   - Anyone marked as **Out of Office / PTO** (`active = false`).
   The developer with **Rank #1** (the lowest load score) is selected.
7. **Automated GitHub Assignment**: The backend makes an API call to GitHub (`octokit.rest.pulls.requestReviewers`) to officially request the chosen developer's review.
8. **Ongoing Lifecycle Sync**: When the reviewer submits their review on GitHub, a `pull_request_review.submitted` webhook fires, marking the assignment complete and lowering their load score for future assignments.

---

## 🏗️ System Architecture

- **Runtime**: Node.js + Express
- **Database**: PostgreSQL (relational integrity between users, repos, PRs, and review assignments)
- **Auth**: GitHub OAuth via Passport.js
- **GitHub Integration**: Octokit REST SDK + Webhooks
- **Sessions**: Express Session stored directly inside PostgreSQL (`connect-pg-simple`)

---

## 📂 Project Structure & Modules

```
prreviewloadbalancer/
├── db/                        # Database layer
│   ├── index.js               # PostgreSQL connection pool singleton
│   ├── schema.sql             # SQL table definitions, indexes & view
│   └── queries/
│       └── load-ranking.sql   # SQL Window function query for reviewer selection
│
├── src/                       # Application source code
│   ├── index.js               # Express application entry point
│   ├── config.js              # Environment variable loader
│   ├── auth-strategy.js       # Passport.js GitHub OAuth strategy
│   ├── middleware/
│   │   └── auth.js            # Route protection middleware (requireAuth)
│   ├── routes/
│   │   ├── auth.js            # OAuth login, callback, logout, /me routes
│   │   ├── webhooks.js        # GitHub webhook receiver endpoint
│   │   └── team.js            # Team analytics & stuck PR endpoints
│   ├── services/
│   │   ├── assignment.js      # Core balancing & review requesting engine
│   │   └── webhook-handlers.js# Ingestion logic for GitHub events
│   └── utils/
│       ├── balancer.js        # Pure load-scoring & candidate ranking logic
│       └── webhook-verify.js  # Timing-safe HMAC SHA-256 signature validator
│
├── tests/                     # Unit test suite (Jest)
│   ├── assignment.test.js     # Tests for load calculation & candidate selection
│   └── webhook-signature.test.js # Tests for security HMAC verification
│
├── .env.example               # Template for environment variables
├── package.json               # Node.js project manifest & dependencies
└── README.md                  # Project documentation
```

### Module Responsibilities:

| Module | File | Purpose |
|---|---|---|
| **Database Pool** | `db/index.js` | Manages reusable database connections via a `pg.Pool` instance. |
| **Schema & Views** | `db/schema.sql` | Defines the 5 core tables (`users`, `repos`, `pull_requests`, `review_assignments`, `session`) and the `review_load` dynamic view. |
| **Load Ranking Query** | `db/queries/load-ranking.sql` | Houses the resume-highlight SQL `RANK()` window function query. |
| **App Server** | `src/index.js` | Boots the Express server, mounts middleware (raw body parser for webhooks, JSON parser, Postgres sessions, Passport auth), and binds routes. |
| **Auth Strategy** | `src/auth-strategy.js` | Handles GitHub OAuth profile serialization and database upserts (`ON CONFLICT (github_id) DO UPDATE...`). |
| **Webhook Verifier** | `src/utils/webhook-verify.js` | Validates GitHub payload authenticity using `crypto.timingSafeEqual`. |
| **Balancer Logic** | `src/utils/balancer.js` | Pure function implementation of reviewer ranking for clean testing and fallback logic. |
| **Assignment Service**| `src/services/assignment.js` | Orchestrates fetching the top reviewer from Postgres and calling Octokit to request reviews on GitHub. |

---

## 🔌 API Routes Reference

### 1. Authentication Routes (`/auth`)

| Endpoint | Method | Access | Description |
|---|---|---|---|
| `/auth/github` | `GET` | Public | Redirects the user to GitHub to sign in. |
| `/auth/github/callback` | `GET` | Public | GitHub redirects back here after authentication. Saves/updates user details in PostgreSQL. |
| `/auth/me` | `GET` | Authenticated | Returns current logged-in user's profile (`id`, `username`, `avatar_url`, `team_id`, `active`). |
| `/auth/logout` | `POST` | Authenticated | Destroys the user's session and logs them out. |

### 2. Webhook Route (`/api/webhooks`)

| Endpoint | Method | Access | Description |
|---|---|---|---|
| `/api/webhooks/github` | `POST` | GitHub Webhook | Ingests `pull_request` and `pull_request_review` events from GitHub. Requires valid `X-Hub-Signature-256` header. |

**Supported Webhook Events:**
- `pull_request.opened` → Upserts repo & PR, runs assignment algorithm, requests reviewer on GitHub.
- `pull_request_review.submitted` → Updates assignment completion status (`approved`, `changes_requested`, `commented`), setting `completed_at = NOW()`.

### 3. Team & Analytics Routes (`/api/team`)

| Endpoint | Method | Access | Description |
|---|---|---|---|
| `/api/team/load` | `GET` | Authenticated | Returns real-time ranked workload for all members of the logged-in user's team. |
| `/api/team/stuck` | `GET` | Authenticated | Returns all open PRs for the user's team that have been open for > 48 hours without a completed review. |

### 4. Health Check Route

| Endpoint | Method | Access | Description |
|---|---|---|---|
| `/health` | `GET` | Public | Returns status `{ "status": "ok", "timestamp": "..." }`. Useful for monitoring uptime. |

---

## ⚡ The Load-Balancing Algorithm & SQL Engine

The core value of this project is avoiding naive round-robin assignments. Instead, it computes reviewer availability dynamically using PostgreSQL.

### 1. The Dynamic Load View (`review_load`)

Rather than maintaining redundant counters that drift out of sync, the database calculates load on-the-fly using a PostgreSQL `VIEW`:

```sql
CREATE OR REPLACE VIEW review_load AS
SELECT
  u.id AS reviewer_id,
  u.username,
  u.active,
  COUNT(ra.id) FILTER (WHERE ra.completed_at IS NULL) AS open_review_count,
  COALESCE(
    AVG(EXTRACT(EPOCH FROM (ra.completed_at - ra.assigned_at)) / 3600)
      FILTER (WHERE ra.completed_at IS NOT NULL AND ra.assigned_at > NOW() - INTERVAL '30 days'),
    0
  ) AS avg_turnaround_hours
FROM users u
LEFT JOIN review_assignments ra ON ra.reviewer_id = u.id
GROUP BY u.id, u.username, u.active;
```

### 2. The Load Ranking Query (`db/queries/load-ranking.sql`)

When a PR opens, the balancer runs this SQL window function query to pick the optimal reviewer:

```sql
SELECT
  reviewer_id,
  username,
  open_review_count,
  ROUND(avg_turnaround_hours::NUMERIC, 1) AS avg_turnaround_hours,
  (open_review_count * 2) + avg_turnaround_hours AS load_score,
  RANK() OVER (
    ORDER BY (open_review_count * 2) + avg_turnaround_hours ASC
  ) AS rank
FROM review_load
WHERE active = TRUE
  AND reviewer_id != $1   -- Exclude PR author
  AND reviewer_id IN (     -- Same team only
    SELECT id FROM users WHERE team_id = $2
  )
ORDER BY rank ASC;
```

---

## 🚀 Getting Started (Step-by-Step Setup)

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- A GitHub OAuth App (for authentication)

### Step 1: Clone the Repository
```bash
git clone https://github.com/your-username/prreviewloadbalancer.git
cd prreviewloadbalancer
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in `.env` with your values:
```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/pr_load_balancer
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
GITHUB_CALLBACK_URL=http://localhost:3000/auth/github/callback
GITHUB_WEBHOOK_SECRET=your_webhook_secret_key
GITHUB_TOKEN=your_personal_access_token_or_bot_token
SESSION_SECRET=super-secret-random-string
```

### Step 4: Setup PostgreSQL Database
Create the database and apply the schema:
```bash
createdb pr_load_balancer
psql -d pr_load_balancer -f db/schema.sql
```

### Step 5: Start the Server
```bash
# Production mode
npm start

# Development mode (auto-reload)
npm run dev
```
The server will run at `http://localhost:3000`. Test it by opening:
`http://localhost:3000/health`

---

## 🧪 Testing

The project includes unit tests for security validation and reviewer load ranking logic using Jest.

Run tests:
```bash
npm test
```

### What the tests cover:
- **`tests/webhook-signature.test.js`**:
  - Validates HMAC SHA-256 calculation.
  - Verifies rejection of tampered bodies, invalid signatures, missing headers, or mismatched buffer lengths.
- **`tests/assignment.test.js`**:
  - Verifies load score calculations.
  - Tests author self-assignment exclusion logic.
  - Verifies out-of-office (PTO) candidate exclusion.
  - Validates tie-breaking behavior.

---

## 📜 License
MIT License. Built as a portfolio project.
