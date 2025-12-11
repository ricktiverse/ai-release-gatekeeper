const express = require('express');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Simple CORS for dashboard access
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-KEY');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// In-memory buffer of recent analyses
const recentAnalyses = [];
const MAX_ANALYSES = 20;

const GATEKEEPER_URL = process.env.GATEKEEPER_URL || 'http://localhost:8080/api/analyze';
const API_KEY = process.env.GATEKEEPER_API_KEY || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

/**
 * Fetch PR details from GitHub API
 */
async function fetchGitHubPRDetails(owner, repo, prNumber) {
  if (!GITHUB_TOKEN) {
    console.warn('GITHUB_TOKEN not set, skipping GitHub API calls');
    return null;
  }

  try {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
    const resp = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ai-gatekeeper-webhook'
      }
    });

    if (!resp.ok) {
      console.error(`GitHub API error: ${resp.status} ${resp.statusText}`);
      return null;
    }

    return await resp.json();
  } catch (err) {
    console.error('Error fetching PR details from GitHub:', err.message);
    return null;
  }
}

/**
 * Fetch PR diff from GitHub API
 */
async function fetchGitHubPRDiff(owner, repo, prNumber) {
  if (!GITHUB_TOKEN) {
    return '';
  }

  try {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
    const resp = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3.diff',
        'User-Agent': 'ai-gatekeeper-webhook'
      }
    });

    if (!resp.ok) {
      console.error(`GitHub API diff error: ${resp.status} ${resp.statusText}`);
      return '';
    }

    return await resp.text();
  } catch (err) {
    console.error('Error fetching PR diff from GitHub:', err.message);
    return '';
  }
}

app.post('/webhook', async (req, res) => {
  try {
    // Accept GitHub Pull Request webhook payload
    const event = req.headers['x-github-event'] || 'unknown';
    const payload = req.body;
    let pr = payload.pull_request || payload;
    const prNumber = pr.number ? pr.number.toString() : 'unknown';
    const author = pr.user ? pr.user.login : 'unknown';
    
    // Extract repository info from webhook payload
    const repo = payload.repository || {};
    const owner = repo.owner ? repo.owner.login : 'unknown';
    const repoName = repo.name || 'unknown';
    
    // Normalize changed files to an array of strings to satisfy backend contract
    let changed_files = [];
    if (Array.isArray(pr.files)) {
      changed_files = pr.files.map(f => (typeof f === 'string' ? f : JSON.stringify(f)));
    } else if (typeof pr.changed_files === 'number') {
      changed_files = [`${pr.changed_files} files changed`];
    }

    let diff = pr.body || '';

    // Fetch full PR details and diff from GitHub API if token is available
    if (GITHUB_TOKEN && owner !== 'unknown' && repoName !== 'unknown' && prNumber !== 'unknown') {
      console.log(`Fetching PR details from GitHub: ${owner}/${repoName}#${prNumber}`);
      
      // Fetch PR details
      const prDetails = await fetchGitHubPRDiff(owner, repoName, prNumber);
      if (prDetails) {
        diff = prDetails;
        console.log(`Fetched PR diff (${diff.length} bytes)`);
      }

      // You can also fetch additional details if needed
      const fullPRData = await fetchGitHubPRDetails(owner, repoName, prNumber);
      if (fullPRData) {
        if (typeof fullPRData.changed_files === 'number') {
          changed_files = [`${fullPRData.changed_files} files changed`];
        } else if (Array.isArray(fullPRData.changed_files)) {
          changed_files = fullPRData.changed_files.map(f => f.toString());
        }
        console.log(`Fetched PR details: ${changed_files} files changed`);
      }
    }

    const analyzePayload = {
      prNumber,
      author,
      repository: `${owner}/${repoName}`,
      changedFiles: changed_files,
      diff
    };

    console.log(`Analyzing PR #${prNumber} from ${author} in ${owner}/${repoName}`);
    const resp = await fetch(GATEKEEPER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': API_KEY
      },
      body: JSON.stringify(analyzePayload)
    });

    const data = await resp.json();
    console.log('Gatekeeper response:', data);

    // Store in recent analyses buffer
    recentAnalyses.unshift({
      receivedAt: new Date().toISOString(),
      request: analyzePayload,
      gatekeeper: data
    });
    if (recentAnalyses.length > MAX_ANALYSES) recentAnalyses.pop();

    // In production you'd call GitHub Statuses/Checks API here using GITHUB_TOKEN
    res.status(200).json({ ok: true, gatekeeper: data });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

const port = process.env.PORT || 3001;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'webhook',
    githubTokenConfigured: !!GITHUB_TOKEN,
    gatekeeperUrl: GATEKEEPER_URL
  });
});

// Recent analyses endpoint for dashboard
app.get('/results', (req, res) => {
  res.json({ items: recentAnalyses });
});

app.listen(port, () => console.log('Webhook service listening on', port));
