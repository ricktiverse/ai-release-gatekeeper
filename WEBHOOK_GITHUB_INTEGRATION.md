# GitHub Token Integration for AI Gatekeeper Webhook

## Overview

The webhook service now supports fetching Pull Request (PR) details directly from GitHub using a GitHub token. This allows the gatekeeper to analyze complete PR diffs and metadata for more accurate security analysis.

## Configuration

### Environment Variables

The webhook requires the following environment variables:

- **GITHUB_TOKEN** - GitHub Personal Access Token for API access
- **GATEKEEPER_URL** - URL of the Gatekeeper backend service
- **GATEKEEPER_API_KEY** - API key for authenticating with Gatekeeper

### Setting Up GitHub Token

1. **Generate a GitHub Personal Access Token**:
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Click "Generate new token"
   - Select scopes: `repo` (full control of private repositories)
   - Copy the token

2. **Add to .env file**:
   ```bash
   GITHUB_TOKEN=github_pat_xxxxxxxxxxxxx
   ```

3. **Docker Compose will automatically pass it** to the webhook service via:
   ```yaml
   - GITHUB_TOKEN=${GITHUB_TOKEN}
   ```

## Features

### 1. PR Details Fetching
When a webhook receives a GitHub Pull Request event, it:
- Extracts PR metadata (number, author, repository)
- Fetches the full diff from GitHub API using the token
- Retrieves detailed PR information (changed files count, etc.)

### 2. GitHub API Integration
The webhook provides two main API integration functions:

#### `fetchGitHubPRDetails(owner, repo, prNumber)`
- Fetches comprehensive PR metadata from GitHub
- Returns PR object with full details
- Requires GITHUB_TOKEN

#### `fetchGitHubPRDiff(owner, repo, prNumber)`
- Fetches the full PR diff in unified format
- Returns the complete code diff for analysis
- Requires GITHUB_TOKEN

### 3. Error Handling
- Gracefully handles missing GITHUB_TOKEN (logs warning)
- Handles GitHub API errors (status codes, timeouts)
- Falls back to webhook payload data if GitHub API fails

## API Endpoints

### POST /webhook
Receives GitHub webhook events and sends to Gatekeeper for analysis

**Headers**:
```
Content-Type: application/json
X-GitHub-Event: pull_request
```

**Payload** (GitHub PR webhook format):
```json
{
  "action": "opened",
  "pull_request": {
    "number": 123,
    "title": "Fix security issue",
    "user": { "login": "developer1" },
    "changed_files": 5,
    "body": "Description of changes"
  },
  "repository": {
    "name": "myapp",
    "owner": { "login": "myorg" }
  }
}
```

**Response**:
```json
{
  "ok": true,
  "gatekeeper": {
    "decision": "ALLOW|BLOCK|REVIEW",
    "riskScore": 0.65,
    "summary": "Analysis summary",
    "suggestedTests": ["test1", "test2"]
  }
}
```

### GET /health
Health check endpoint to verify webhook service status

**Response**:
```json
{
  "status": "ok",
  "service": "webhook",
  "githubTokenConfigured": true,
  "gatekeeperUrl": "http://backend:8080/api/analyze"
}
```

## Testing

### Using PowerShell (Windows)
```powershell
.\test-webhook.ps1
```

### Using Bash (Linux/Mac)
```bash
bash test-webhook.sh
```

### Using curl
```bash
curl -X POST http://localhost:3001/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -d '{
    "action": "opened",
    "pull_request": {
      "number": 123,
      "user": { "login": "dev1" },
      "changed_files": 3,
      "body": "PR description"
    },
    "repository": {
      "name": "repo",
      "owner": { "login": "org" }
    }
  }'
```

## GitHub Webhook Setup

To set up GitHub webhooks for your repository:

1. Go to Repository Settings → Webhooks
2. Click "Add webhook"
3. **Payload URL**: `https://your-domain.com/webhook`
4. **Content type**: `application/json`
5. **Events**: Select "Pull requests"
6. Click "Add webhook"

## Data Flow

```
GitHub Event
    ↓
Webhook Service (port 3001)
    ├─ Parse webhook payload
    ├─ Extract owner/repo/PR number
    ├─ (Optional) Fetch full PR diff from GitHub API using token
    ├─ (Optional) Fetch PR metadata from GitHub API
    ↓
Send to Gatekeeper Backend
    ├ owner, repo, prNumber
    ├ author, changedFiles
    └─ diff (full code changes)
    ↓
Gatekeeper Analysis
    ├─ Analyze code diff
    ├─ Calculate risk score
    ├─ Generate decision (ALLOW/BLOCK/REVIEW)
    └─ Suggest tests
    ↓
Response to Webhook
    ↓
(Optional) Post status to GitHub
```

## Security Considerations

- Keep your GITHUB_TOKEN private and never commit it to version control
- Use environment variables or secrets management
- The token is only used for reading PR data (no write permissions needed)
- Consider using a service account with minimal permissions

## Troubleshooting

### GitHub API returns 401
- Check GITHUB_TOKEN is valid and not expired
- Verify token has `repo` scope

### GitHub API returns 404
- Verify owner, repo, and PR number are correct
- Check if the repository is accessible with the token

### No diff fetched
- Check webhook payload contains repository information
- Verify GITHUB_TOKEN is configured
- Check Docker logs: `docker logs webhook-1`

## Docker Compose Integration

The webhook service is configured in `docker-compose.yml`:

```yaml
webhook:
  build: ./webhook-node
  ports:
    - "3001:3001"
  environment:
    - GATEKEEPER_URL=http://backend:8080/api/analyze
    - GATEKEEPER_API_KEY=changeme
    - GITHUB_TOKEN=${GITHUB_TOKEN}
  depends_on:
    - backend
```

Start services with:
```bash
docker-compose up --build -d
```

The GITHUB_TOKEN from your `.env` file will be automatically passed to the webhook service.
