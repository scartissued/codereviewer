# CodeReviewer

An AI powered GitHub App that automatically reviews pull requests. When a PR is opened or updated, CodeReviewer fetches the diff, builds a size bounded prompt, and sends it to an LLM to generate actionable code review feedback.

## How It Works

1. A pull request is **opened** or **synchronized** (new commits pushed) on a repository where the app is installed.
2. GitHub sends a webhook to the CodeReviewer server.
3. The server fetches the changed files and their patches via the GitHub API.
4. The diff is sent to an LLM (via the [Vercel AI SDK](https://ai-sdk.dev)) which returns a structured review summary, findings with severity, file, line, message, and suggestion.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript (ES2022 / ESM) |
| Framework | Express |
| GitHub Integration | [@octokit/app](https://github.com/octokit/app.js) |
| AI | [Vercel AI SDK](https://ai-sdk.dev) |
| Validation | [Zod](https://zod.dev) |
| Security | Helmet, CORS, HPP, express-rate-limit |
| Code Quality | Husky + Commitlint (conventional commits) |

## Prerequisites

- **Node.js** ≥ 18
- **npm**
- An **AI Gateway API key** (for the Vercel AI SDK / LLM provider)
- A **GitHub App** (see below)

## Creating a GitHub App

CodeReviewer is a **GitHub App**. It receives webhook events whenever a pull request is opened or updated, which is what triggers the entire review pipeline. Without a GitHub App, the server has nothing to respond to.

You need to create your own GitHub App and install it on the repositories you want reviewed.

### 1. Register a new GitHub App

Go to **[GitHub → Settings → Developer settings → GitHub Apps → New GitHub App](https://github.com/settings/apps/new)** and fill in:

| Field | Value |
|---|---|
| **App name** | Anything you like (e.g. `my-code-reviewer`) |
| **Homepage URL** | Your server URL or repo URL |
| **Webhook URL** | `https://<your-domain>/api/v1/github/webhooks` |
| **Webhook secret** | A strong random string (you'll use this as `GITHUB_WEBHOOK_SECRET`) |

### 2. Set permissions

Under **Repository permissions**, grant:

| Permission | Access |
|---|---|
| **Pull requests** | Read & Write |
| **Contents** | Read |

### 3. Subscribe to events

Under **Subscribe to events**, check:

- ✅ **Pull request**

### 4. Generate a private key

After creating the app, scroll to **Private keys** and click **Generate a private key**. A `.pem` file will download you'll paste its contents into `GITHUB_PRIVATE_KEY`.

### 5. Install the app

Go to your app's public page and click **Install**. Choose the repositories (or all repositories) you want CodeReviewer to watch.

### Resources

- [Creating a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app)
- [GitHub App permissions reference](https://docs.github.com/en/rest/overview/permissions-required-for-github-apps)
- [Webhook events and payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads#pull_request)

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/codereviewer.git
cd codereviewer
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `NODE_ENV` | `development`, `production`, or `test` | `development` |
| `PORT` | Server port | `3000` |
| `CORS_ORIGINS` | Comma-separated allowed origins, or `*` for all | `*` |
| `RATE_LIMIT_MAX` | Max requests per 15-min window | `100` |
| `TRUST_PROXY` | Set to `true` if behind a reverse proxy | `false` |
| `GITHUB_APP_ID` | Your GitHub App's ID | — |
| `GITHUB_CLIENT_ID` | OAuth client ID from the GitHub App | — |
| `GITHUB_CLIENT_SECRET` | OAuth client secret | — |
| `GITHUB_WEBHOOK_SECRET` | Secret used to verify webhook signatures | — |
| `GITHUB_PRIVATE_KEY` | GitHub App private key (PEM). Use `\n` for newlines. | — |
| `GITHUB_REDIRECT_URL` | OAuth redirect URL | — |
| `AI_GATEWAY_API_KEY` | API key for the AI / LLM provider | — |


### 4. Run in development

```bash
npm run dev
```

This uses `tsx watch` for hot-reloading. The server starts at `http://localhost:3000` by default.

### 5. Build & run for production

```bash
npm run build   # Compiles TypeScript → dist/
npm start       # Runs the compiled output
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/healthz` | Health check returns `{ status: "ok" }` |
| `POST` | `/api/v1/github/webhooks` | GitHub webhook receiver (handled by Octokit) |

## Exposing Webhooks Locally

For local development, use a tunneling tool so GitHub can reach your machine:

```bash
# Using ngrok
ngrok http 3000
```

Then set your GitHub App's webhook URL to the tunnel URL + `/api/v1/github/webhooks`.

## License

[MIT](LICENSE)