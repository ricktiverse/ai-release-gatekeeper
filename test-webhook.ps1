# Test webhook with GitHub PR webhook payload

$payload = @{
    action = "opened"
    pull_request = @{
        number = 123
        title = "Fix security vulnerability in authentication"
        user = @{
            login = "developer1"
        }
        changed_files = 3
        body = "This PR fixes a critical security issue in the login flow"
    }
    repository = @{
        name = "myapp"
        owner = @{
            login = "myorg"
        }
    }
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "http://localhost:3001/webhook" `
    -Method POST `
    -Headers @{
        "Content-Type" = "application/json"
        "X-GitHub-Event" = "pull_request"
    } `
    -Body $payload `
    -UseBasicParsing

Write-Host "Response Status:" $response.StatusCode
Write-Host "Response Body:"
$response.Content | ConvertFrom-Json | ConvertTo-Json
