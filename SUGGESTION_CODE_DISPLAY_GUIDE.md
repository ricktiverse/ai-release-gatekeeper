# Suggestion Code Display Guide

## Overview

The Gatekeeper system now provides **context-aware suggestion codes** that are prominently displayed in the dashboard UI. These codes help developers quickly understand the type of code review needed and the severity level of the PR.

## Architecture

### Backend Generation (GroqAnalysisService + AnalyzeController)

**GroqAnalysisService.java**
- `generateSuggestionCodeFromAnalysis()` - Generates codes using GROQ-aware pattern detection
- Analyzes diffs for security patterns (credentials, dangerous execution)
- File-type analysis for risk categorization
- Returns null if GROQ unavailable, allowing fallback to rule-based system

**AnalyzeController.java**
- `generateSuggestionCode()` - Rule-based code generation with comprehensive UI documentation
- Enhanced comments explaining how codes map to UI display colors and PR status
- Fallback mechanism: GROQ → Rule-based → Error handling
- Spelling error escalation: Overrides normal codes if typos detected

### Frontend Display (App.jsx)

**Dashboard Integration**
- `getSuggestionCodeColor()` - Maps code prefix to display color:
  - BLOCK → Red (#d32f2f)
  - WARN → Orange (#f57c00)
  - ALLOW → Green (#388e3c)
  - Default → Blue (#1976d2)

- `getSuggestionCodeBgColor()` - Maps to background colors for contrast
- `getSuggestionCodeDescription()` - Provides human-readable descriptions
- PR Header display with colored badge

## Suggestion Code Categories

### BLOCK Codes (Requires Immediate Action)

| Code | Risk Score | Trigger | UI Color | Description |
|------|-----------|---------|----------|-------------|
| `BLOCK_CRITICAL_SECURITY` | ≥ 0.90 | Extremely high risk | Red | Immediate escalation required - critical security threat detected |
| `BLOCK_CREDENTIAL_EXPOSURE` | ≥ 0.80 | Contains: password, secret, apikey | Red | Credentials exposed - immediate security action required |
| `BLOCK_DANGEROUS_EXEC` | ≥ 0.80 | Contains: Runtime.exec, System.exit | Red | Dangerous code execution detected - manual review mandatory |
| `BLOCK_HIGH_SECURITY_RISK` | ≥ 0.80 | General high risk | Red | High risk - requires manual review and escalation |
| `BLOCK_DANGEROUS_OPERATIONS` | 0.75-0.80 | Multiple risk factors | Red | Dangerous operations detected - security review needed |

**PR Status**: ❌ BLOCKED - Manual review required before merge

### WARN Codes (Requires Additional Review)

| Code | Risk Score | Trigger | UI Color | Description |
|------|-----------|---------|----------|-------------|
| `WARN_MODERATE_RISK_REVIEW` | ≥ 0.50 | No specific file pattern | Orange | Moderate risk - additional code review and testing required |
| `WARN_BUILD_CONFIG_CHANGES` | ≥ 0.40 | pom.xml, gradle, Dockerfile, kubernetes | Orange | Build configuration changes - deployment review needed |
| `WARN_CONFIG_CHANGES_REVIEW` | ≥ 0.35 | .properties, .yml, .yaml, .xml files | Orange | Configuration changes detected - audit and deployment review needed |
| `WARN_ENHANCED_TESTING_NEEDED` | 0.35-0.40 | General moderate risk | Orange | Enhanced testing requirements - additional test coverage recommended |
| `WARN_SPELLING_ERRORS` | Any | Detected by GROQ spelling check | Orange | Spelling mistakes detected in code or comments; please fix typos and documentation |

**PR Status**: ⚠️ NEEDS REVIEW - Proceed with caution

### ALLOW Codes (Safe to Merge)

| Code | Risk Score | Trigger | UI Color | Description |
|------|-----------|---------|----------|-------------|
| `ALLOW_WITH_TESTING_REQUIRED` | 0.10-0.35 | Low but not minimal risk | Green | Approved - testing recommended before merge |
| `ALLOW_LOW_RISK_SAFE` | < 0.10 | Minimal risk | Green | Low risk - safe to merge |

**PR Status**: ✅ APPROVED - Safe to merge

## Integration Points

### 1. API Response
Every `/api/analyze` response includes:
```json
{
  "prNumber": "PR-123",
  "decision": "WARN",
  "riskLevel": "MEDIUM",
  "riskScore": 0.45,
  "suggestionCode": "WARN_CONFIG_CHANGES_REVIEW",
  "prStatus": "⚠️ NEEDS REVIEW - Proceed with caution",
  "spellingSuggestions": [],
  "groqSuggestion": "..."
}
```

### 2. Dashboard Display
- **PR Header**: Shows suggestion code badge with appropriate color
- **Risk Level**: Displays classification (CRITICAL/HIGH/MEDIUM/LOW/MINIMAL)
- **PR Status**: Shows emoji-based status message
- **Suggestion Description**: Hover or expand to see detailed explanation

### 3. Color Coding System
```
BLOCK codes   → Red (#d32f2f) background (#ffebee)
WARN codes    → Orange (#f57c00) background (#fff3e0)
ALLOW codes   → Green (#388e3c) background (#e8f5e9)
Default codes → Blue (#1976d2) background (#e3f2fd)
```

## Example Flows

### Flow 1: Dangerous Code (High Risk)
```
Input: Runtime.exec() + password in diff
↓
Risk Calculation: 0.85 (HIGH)
↓
Decision: BLOCK
↓
GROQ Analysis: Detects dangerous execution pattern
↓
Suggestion Code: BLOCK_DANGEROUS_EXEC
↓
UI Display: Red badge, "❌ BLOCKED", Dangerous code execution detected
```

### Flow 2: Configuration Changes (Medium Risk)
```
Input: Modified pom.xml + application.yml
↓
Risk Calculation: 0.45 (MEDIUM)
↓
Decision: WARN
↓
File Analysis: Detects build config files
↓
Suggestion Code: WARN_BUILD_CONFIG_CHANGES
↓
UI Display: Orange badge, "⚠️ NEEDS REVIEW", Build configuration changes
```

### Flow 3: Documentation Only (Low Risk)
```
Input: Updated README.md + docs/API.md
↓
Risk Calculation: 0.02 (MINIMAL)
↓
Decision: ALLOW
↓
Pattern Match: Only docs files changed
↓
Suggestion Code: ALLOW_LOW_RISK_SAFE
↓
UI Display: Green badge, "✅ APPROVED", Low risk - safe to merge
```

## Error Handling

### GROQ Service Unavailable
- Fallback to rule-based `generateSuggestionCode()`
- No interruption to analysis
- Returns appropriate code based on risk and file patterns

### API Key Missing
- GROQ methods return null
- System gracefully falls back to rule-based generation
- All API endpoints continue to function

### Spelling Detection
- If GROQ detects spelling errors, code escalates to `WARN_SPELLING_ERRORS`
- Takes precedence over other WARN codes
- Ensures typos are caught and addressed

## Testing Suggestion Codes

### Test Case 1: Security Blocking
```powershell
$body = @{
    prNumber = "TEST-BLOCK-001"
    author = "test-user"
    changedFiles = @("SecurityModule.java")
    diff = "Runtime.getRuntime().exec(cmd); password = 'secret123';"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:8081/api/analyze" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"; "X-API-KEY"="changeme"} `
  -Body $body
```

**Expected Response**:
- decision: BLOCK
- riskLevel: HIGH
- suggestionCode: BLOCK_DANGEROUS_EXEC (or BLOCK_CREDENTIAL_EXPOSURE)
- prStatus: ❌ BLOCKED - Manual review required before merge

### Test Case 2: Configuration Warning
```powershell
$body = @{
    prNumber = "TEST-WARN-001"
    author = "test-user"
    changedFiles = @("pom.xml", "application.yml")
    diff = "new dependency; db migration script"
} | ConvertTo-Json
```

**Expected Response**:
- decision: WARN
- riskLevel: MEDIUM
- suggestionCode: WARN_BUILD_CONFIG_CHANGES
- prStatus: ⚠️ NEEDS REVIEW - Proceed with caution

### Test Case 3: Safe Documentation
```powershell
$body = @{
    prNumber = "TEST-ALLOW-001"
    author = "test-user"
    changedFiles = @("README.md", "docs/API.md")
    diff = "## New Documentation Section"
} | ConvertTo-Json
```

**Expected Response**:
- decision: ALLOW
- riskLevel: MINIMAL
- suggestionCode: ALLOW_LOW_RISK_SAFE
- prStatus: ✅ APPROVED - Safe to merge

## Future Enhancements

1. **Custom Codes**: Allow projects to define custom suggestion codes
2. **Webhook Integration**: Trigger different workflows based on suggestion codes
3. **Historical Tracking**: Store and analyze trends in suggestion codes
4. **Pattern Learning**: Use historical data to improve code generation accuracy
5. **Multi-language Support**: Extend beyond Java for Python, JavaScript, etc.

## Performance Notes

- Suggestion code generation: < 10ms (rule-based)
- GROQ integration: ~500-1000ms (when available)
- Total API response time: ~1-2 seconds with GROQ, ~200-300ms without
- Fallback mechanism ensures consistent performance

## References

- **Backend Service**: `GroqAnalysisService.java` - Core GROQ integration
- **API Controller**: `AnalyzeController.java` - REST endpoint and code generation
- **Frontend**: `App.jsx` - Dashboard display and styling
- **Color Mapping**: `getSuggestionCodeColor()`, `getSuggestionCodeBgColor()`
- **Descriptions**: `getSuggestionCodeDescription()` - User-facing explanations
