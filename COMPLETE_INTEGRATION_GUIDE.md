# AI Release Gatekeeper - Complete Integration Guide

## 📋 Project Overview

This is a comprehensive security analysis system for GitHub Pull Requests that uses AI to evaluate code changes and determine release readiness.

### Services

| Service | Port | Technology | Status |
|---------|------|-----------|--------|
| **Backend** | 8081 | Java 21 + Spring Boot 3.2 | ✅ Running |
| **Webhook** | 3001 | Node.js | ✅ Running |
| **Dashboard** | 5173 | React + Vite | ✅ Running |

## 🚀 Getting Started

### Prerequisites
- Docker & Docker Compose
- GitHub account with Personal Access Token
- Environment variables configured

### Quick Start

1. **Clone/Navigate to project**:
```bash
cd ai_release_gatekeeper_full_project
```

2. **Configure .env**:
```bash
# Backend
GATEKEEPER_API_KEY=mysecretkey123
GROQ_API_KEY=your_groq_api_key

# GitHub
GITHUB_TOKEN=github_pat_xxxxxxxxxxxxx
GATEKEEPER_URL=http://localhost:8080/api/analyze
```

3. **Start all services**:
```bash
docker-compose up --build -d
```

4. **Verify services**:
```bash
# Health checks
curl http://localhost:3001/health          # Webhook
curl http://localhost:8081/actuator/health # Backend
```

## 📊 Dashboard

Access the AI Gatekeeper Dashboard:
- **URL**: http://localhost:5173/
- **Features**:
  - View PR analysis results
  - Risk scores and decisions
  - Suggested tests
  - Mock data integration

## 🔗 GitHub Webhook Integration

### Setup GitHub Webhook

1. **Go to Repository Settings**:
   - Settings → Webhooks → Add webhook

2. **Configure**:
   - **Payload URL**: `https://your-domain.com:3001/webhook`
   - **Content type**: `application/json`
   - **Events**: Pull requests
   - **Active**: ✓ Checked

3. **Test**:
```powershell
# Test webhook
.\test-webhook.ps1

# Check logs
docker logs ai_release_gatekeeper_full_project-webhook-1
```

## 📡 API Endpoints

### Webhook Service (Port 3001)

#### POST /webhook
Receives GitHub PR webhook events

**Headers**:
```
Content-Type: application/json
X-GitHub-Event: pull_request
```

**Response**:
```json
{
  "ok": true,
  "gatekeeper": {
    "decision": "ALLOW",
    "riskScore": 0.25,
    "summary": "PR analysis summary",
    "suggestedTests": ["test1", "test2"]
  }
}
```

#### GET /health
Health check endpoint

**Response**:
```json
{
  "status": "ok",
  "service": "webhook",
  "githubTokenConfigured": true,
  "gatekeeperUrl": "http://backend:8080/api/analyze"
}
```

### Backend Service (Port 8081)

#### POST /api/analyze
Analyze PR for security risks

**Payload**:
```json
{
  "prNumber": "123",
  "author": "developer1",
  "repository": "owner/repo",
  "changedFiles": 5,
  "diff": "full code diff"
}
```

**Response**:
```json
{
  "decision": "ALLOW|BLOCK|REVIEW",
  "riskScore": 0.65,
  "summary": "Analysis results",
  "suggestedTests": ["test1", "test2"]
}
```

#### GET /actuator/health
Spring Boot health check

## 🧪 Testing

### Test Webhook with Sample PR

**PowerShell**:
```powershell
$payload = @{
    action = "opened"
    pull_request = @{
        number = 123
        title = "Fix security vulnerability"
        user = @{ login = "developer1" }
        changed_files = 3
        body = "PR description"
    }
    repository = @{
        name = "myapp"
        owner = @{ login = "myorg" }
    }
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3001/webhook" `
    -Method POST `
    -Headers @{
        "Content-Type" = "application/json"
        "X-GitHub-Event" = "pull_request"
    } `
    -Body $payload `
    -UseBasicParsing
```

**Bash**:
```bash
bash test-webhook.sh
```

## 📝 Configuration

### Environment Variables

**Required**:
- `GITHUB_TOKEN` - GitHub Personal Access Token
- `GATEKEEPER_API_KEY` - Backend API key
- `GROQ_API_KEY` - AI analysis API key

**Optional**:
- `GATEKEEPER_URL` - Gatekeeper backend URL (default: http://localhost:8080/api/analyze)
- `PORT` - Webhook service port (default: 3001)

### Docker Compose Overrides

Edit `docker-compose.yml` to customize:
```yaml
webhook:
  environment:
    - PORT=3001
    - GATEKEEPER_URL=http://backend:8080/api/analyze
    - GATEKEEPER_API_KEY=changeme
    - GITHUB_TOKEN=${GITHUB_TOKEN}
```

## 🔍 Monitoring & Logs

### View Service Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker logs ai_release_gatekeeper_full_project-webhook-1 -f
docker logs ai_release_gatekeeper_full_project-backend-1 -f
docker logs ai_release_gatekeeper_full_project-dashboard-1 -f
```

### Expected Log Output

**Webhook Service**:
```
Webhook service listening on 3001
Fetching PR details from GitHub: owner/repo#123
Fetched PR diff (1234 bytes)
Analyzing PR #123 from developer1
Gatekeeper response: { decision: 'ALLOW', riskScore: 0.25 }
```

**Backend Service**:
```
Started GatekeeperApplication in 1.466 seconds (process running for 1.808)
Received PR analysis request for PR #123
Analysis complete: decision=ALLOW, riskScore=0.25
```

**Dashboard Service**:
```
Mock API for dashboard running on 3000
VITE v5.4.21 ready in 113 ms
Local: http://localhost:5173/
```

## 🛠️ Troubleshooting

### Issue: Cannot connect to webhook
**Solution**: Ensure port 3001 is open and webhook container is running
```bash
docker ps | grep webhook
```

### Issue: GitHub token not working
**Solution**: Verify token has `repo` scope
1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Check scopes include `repo`
3. Regenerate if necessary

### Issue: Dashboard not loading
**Solution**: Check mock server and Vite are both running
```bash
docker logs ai_release_gatekeeper_full_project-dashboard-1
```

### Issue: Backend analysis not working
**Solution**: Check API key is correct
```bash
curl -X POST http://localhost:8081/api/analyze \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: mysecretkey123" \
  -d '{"prNumber":"1","author":"test","changedFiles":1,"diff":""}'
```

## 📚 Additional Resources

- **Webhook Integration**: See `WEBHOOK_GITHUB_INTEGRATION.md`
- **Integration Summary**: See `GITHUB_INTEGRATION_SUMMARY.md`
- **GitHub API Docs**: https://docs.github.com/en/rest
- **Docker Compose Docs**: https://docs.docker.com/compose/

## 🔐 Security Best Practices

✅ **DO**:
- Store GITHUB_TOKEN in `.env` (add to `.gitignore`)
- Use environment variables for sensitive data
- Keep token permissions minimal
- Rotate tokens regularly
- Monitor webhook logs for errors

❌ **DON'T**:
- Commit tokens to git repository
- Share tokens in messages/chat
- Use same token for multiple services
- Log tokens in output
- Use admin-level tokens

## 📞 Support

For issues or questions:
1. Check logs: `docker-compose logs -f`
2. Review documentation in project
3. Test endpoints with provided test scripts
4. Verify environment variables are set

---

**Happy Securing!** 🚀
