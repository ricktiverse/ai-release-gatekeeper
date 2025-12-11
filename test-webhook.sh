#!/bin/bash
# Test webhook with GitHub PR webhook payload

# Example GitHub PR webhook payload
curl -X POST http://localhost:3001/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -d '{
    "action": "opened",
    "pull_request": {
      "number": 123,
      "title": "Fix security vulnerability in authentication",
      "user": {
        "login": "developer1"
      },
      "changed_files": 3,
      "body": "This PR fixes a critical security issue in the login flow"
    },
    "repository": {
      "name": "myapp",
      "owner": {
        "login": "myorg"
      }
    }
  }'
