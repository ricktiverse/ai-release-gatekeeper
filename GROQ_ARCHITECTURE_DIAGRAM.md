# GROQ Integration - Visual Overview

## System Architecture with GROQ

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         GitHub                                           │
│                    Pull Request Event                                    │
└────────────────────────────────────┬──────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Webhook Service (Node.js)                            │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ • Parse webhook payload                                          │  │
│  │ • Extract changed files & diff                                   │  │
│  │ • Fetch PR details from GitHub API                              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────┬──────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              Backend Service (Spring Boot + Java)                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              AnalyzeController                                    │  │
│  ├──────────────────────────────────────────────────────────────────┤  │
│  │ 1. computeRisk()                 → Calculate risk score (0-1)   │  │
│  │ 2. classify()                    → Decision (BLOCK/WARN/ALLOW)  │  │
│  │ 3. findMissingTests()            → Test coverage gaps           │  │
│  │                                                                   │  │
│  │ ┌─ If GROQ_API_KEY configured ─────────────────────────────┐   │  │
│  │ │                                                            │   │  │
│  │ │  4. GroqAnalysisService.generateEnhancedExplanation()     │   │  │
│  │ │     └─ AI-generated: 2-3 sentence analysis              │   │  │
│  │ │                                                            │   │  │
│  │ │  5. GroqAnalysisService.generateTestRecommendations()     │   │  │
│  │ │     └─ AI-generated: 3 specific test suggestions         │   │  │
│  │ │                                                            │   │  │
│  │ │  6. generateSuggestionCode() [Enhanced]                   │   │  │
│  │ │     ├─ Pattern detection:                                 │   │  │
│  │ │     │  ├─ Credentials: "password", "secret", "apikey"    │   │  │
│  │ │     │  ├─ Execution: "runtime.exec", "system.exit"       │   │  │
│  │ │     │  └─ Config: pom.xml, docker, kubernetes            │   │  │
│  │ │     └─ Returns one of 11 contextual codes               │   │  │
│  │ │                                                            │   │  │
│  │ └────────────────────────────────────────────────────────────┘   │  │
│  │                                                                   │  │
│  │ ┌─ Else (GROQ unavailable) ──────────────────────────────────┐   │  │
│  │ │                                                             │   │  │
│  │ │  4. explain()                    → Template explanation   │   │  │
│  │ │  5. suggestTests()               → Rule-based tests       │   │  │
│  │ │  6. generateSuggestionCode()     → 8 original codes       │   │  │
│  │ │                                                             │   │  │
│  │ └─────────────────────────────────────────────────────────────┘   │  │
│  │                                                                   │  │
│  │ 7. Return AnalyzeResponse (10 fields):                          │  │
│  │    ├─ prNumber, riskScore, decision                            │  │
│  │    ├─ missingTests, suggestedTests                             │  │
│  │    ├─ summary, explanation                                     │  │
│  │    ├─ suggestionCode (11 options)                              │  │
│  │    ├─ errorMessage, analysisTimestamp                          │  │
│  │    └─ ✨ All fields enhanced with context awareness!           │  │
│  │                                                                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────┬──────────────────────────────────────┘
                                     │
                      ┌──────────────┴──────────────┐
                      │                             │
                      ▼                             ▼
        ┌──────────────────────────┐    ┌──────────────────────────┐
        │   GROQ API (Optional)    │    │  Fallback (Rule-Based)   │
        ├──────────────────────────┤    ├──────────────────────────┤
        │ • mixtral-8x7b-32768     │    │ • Standard analysis      │
        │ • 150 token limit        │    │ • Template explanations  │
        │ • Low latency            │    │ • Rule-based suggestions │
        └──────────────────────────┘    └──────────────────────────┘
                      │                             │
                      └──────────────┬──────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              Webhook In-Memory Buffer (Node.js)                         │
│  ├─ Stores last 20 analyses                                           │  │
│  ├─ Request payload + Response                                        │  │
│  └─ Exposed via /results endpoint                                     │  │
└────────────────────────────────────┬──────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              React Dashboard (Vite)                                      │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  PR Card Layout:                                                 │  │
│  │  ┌──────────────────────────────────────────────────────────┐   │  │
│  │  │ PR #42 | Decision Badge (Red/Orange/Green)              │   │  │
│  │  │ Author: alice | Risk: 0.82                              │   │  │
│  │  └──────────────────────────────────────────────────────────┘   │  │
│  │                                                                   │  │
│  │  Summary & Assessment:                                           │  │
│  │  • Analysis Summary                                              │  │
│  │  • Assessment Explanation                                        │  │
│  │                                                                   │  │
│  │  ✨ NEW - Metadata Section:                                      │  │
│  │  ├─ Action Code Badge                                           │  │
│  │  │  BLOCK_CREDENTIAL_EXPOSURE                                   │  │
│  │  │  "Credentials exposed - immediate action"                    │  │
│  │  │                                                               │  │
│  │  ├─ Analysis Timestamp                                          │  │
│  │  │  "12/10/2025, 3:45:23 PM"                                    │  │
│  │  │                                                               │  │
│  │  └─ Error Message (if present)                                  │  │
│  │     ⚠️  "GitHub API error..."                                   │  │
│  │                                                                   │  │
│  │  Expandable Details:                                             │  │
│  │  • Changed Files (scrollable)                                    │  │
│  │  • ⚠️ Missing Test Coverage (red)                                │  │
│  │  • ✓ Recommended Tests (blue)                                    │  │
│  │  • Full Diff Preview (monospace, not truncated)                 │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Suggestion Code Decision Tree

```
                         AnalyzeResponse
                                │
                                ▼
                         Risk Score & Decision
                                │
                    ┌───────────┼───────────┐
                    │           │           │
                    ▼           ▼           ▼
                  BLOCK        WARN        ALLOW
                    │           │           │
        ┌───────────┼──────┐    │    ┌──────┼──────┐
        │           │      │    │    │             │
        ▼           ▼      ▼    ▼    ▼             ▼
    [Patterns]  [Risk≥0.8] [Rest] [Rest]  [Risk≥0.1] [Rest]
        │           │       │      │         │         │
        │           │       │      │         │         │
    ┌───┴───────────┴───┬───┘      │    ┌────┘         │
    │                   │          │    │              │
    ▼                   ▼          ▼    ▼              ▼
┌────────────┐  ┌──────────────┐  │ ┌──────────────┐  │
│ Credentials│  │ No Specific  │  │ │ ALLOW_WITH   │  │
│ Exposed    │  │ Pattern      │  │ │ TESTING_REQ  │  │
│            │  │              │  │ │              │  │
│BLOCK_      │  │BLOCK_HIGH_   │  │ └──────────────┘  │
│CREDENTIAL_ │  │SECURITY_     │  │                   │
│EXPOSURE    │  │RISK          │  │                   │
└────────────┘  └──────────────┘  │                   │
                                   │                   │
                     ┌─────────────┴────┐              │
                     │                  │              │
                     ▼                  ▼              ▼
                ┌─────────┐        ┌─────────┐   ┌─────────────┐
                │ Config  │        │ Default │   │ALLOW_LOW_   │
                │ Files?  │        │ BLOCK   │   │RISK_SAFE    │
                └────┬────┘        └─────────┘   └─────────────┘
                     │
            ┌────────┴─────────┐
            │                  │
            ▼                  ▼
      [YES]                [NO]
            │                  │
      ┌─────┘                  └──────┐
      │                               │
      ▼                               ▼
┌──────────────────┐        ┌────────────────────┐
│WARN_CONFIG_      │        │BLOCK_DANGEROUS_    │
│CHANGES_REVIEW    │        │OPERATIONS          │
└──────────────────┘        └────────────────────┘


Risk >= 0.5?
    ├─ NO → WARN_ENHANCED_TESTING_NEEDED
    └─ YES → Config files?
             ├─ YES → WARN_BUILD_CONFIG_CHANGES
             └─ NO → WARN_MODERATE_RISK_REVIEW
```

---

## GROQ API Request/Response Flow

### Request Structure

```json
{
  "model": "mixtral-8x7b-32768",
  "messages": [
    {
      "role": "user",
      "content": "Analyze this PR: Files: src/main/java/Security.java... Decision: BLOCK Risk: 0.82... Provide concise technical analysis (2-3 sentences)"
    }
  ],
  "max_tokens": 150
}
```

### Response Structure

```json
{
  "choices": [
    {
      "message": {
        "content": "This PR adds authentication with password handling. High risk due to credential exposure patterns. Manual review required."
      }
    }
  ]
}
```

---

## 11 Suggestion Codes & Actions

### By Priority Level

**🔴 CRITICAL (Immediate Action)**
1. `BLOCK_CRITICAL_SECURITY` - Escalate to security team
2. `BLOCK_CREDENTIAL_EXPOSURE` - Reject & rewrite
3. `BLOCK_DANGEROUS_EXEC` - Code review mandatory

**🔴 HIGH (Block Merge)**
4. `BLOCK_HIGH_SECURITY_RISK` - Escalate to tech lead
5. `BLOCK_DANGEROUS_OPERATIONS` - Security verification needed

**🟠 MODERATE (Extra Review)**
6. `WARN_MODERATE_RISK_REVIEW` - Standard code review
7. `WARN_BUILD_CONFIG_CHANGES` - Deployment review
8. `WARN_CONFIG_CHANGES_REVIEW` - Configuration audit

**🟠 LOW (Testing Needed)**
9. `WARN_ENHANCED_TESTING_NEEDED` - Add unit tests

**🟢 SAFE (Approved)**
10. `ALLOW_WITH_TESTING_REQUIRED` - Merge with testing
11. `ALLOW_LOW_RISK_SAFE` - Direct merge

---

## Data Flow: Backend to Dashboard

```
AnalyzeController
  ├─ riskScore: 0.82
  ├─ decision: "BLOCK"
  ├─ suggestionCode: "BLOCK_CREDENTIAL_EXPOSURE"
  ├─ explanation: "[GROQ-generated]"
  ├─ suggestedTests: ["[GROQ-generated test 1]", ...]
  └─ analysisTimestamp: 1733938755123
         │
         ├──> Webhook stores response in buffer
         │
         ├──> Dashboard fetches /results
         │
         ├──> fetchPRs() maps response:
         │    ├─ suggestionCode → displays badge
         │    ├─ explanation → displays text
         │    ├─ analysisTimestamp → formats date
         │    └─ suggestedTests → color-coded list
         │
         └──> React renders with styling:
              ├─ getSuggestionCodeColor() → #d32f2f (red)
              ├─ getSuggestionCodeBgColor() → #ffebee
              └─ formatTimestamp() → "12/10/2025 3:45 PM"
```

---

## Comparison: With vs Without GROQ

### Without GROQ

```
Input: PR with "password" in code
  ↓
computeRisk() → 0.82
classify() → BLOCK
generateSuggestionCode(BLOCK, 0.82) → "BLOCK_HIGH_SECURITY_RISK"
explain() → "High risk: Large changes or dangerous operations detected."
suggestTests() → Generic: "Unit tests for new/changed methods"

Output:
- suggestion_code: BLOCK_HIGH_SECURITY_RISK
- explanation: Generic template
- suggested_tests: Rule-based list
```

### With GROQ

```
Input: PR with "password" in code
  ↓
computeRisk() → 0.82
classify() → BLOCK
generateSuggestionCode(BLOCK, 0.82, files, diff) → Detects "password"
  → "BLOCK_CREDENTIAL_EXPOSURE"
generateEnhancedExplanation(BLOCK, 0.82, diff, files) → LLM:
  "This PR exposes database credentials in plaintext. Immediate action required."
generateTestRecommendations(files, diff) → LLM:
  ["Add unit tests for credential validation", ...]

Output:
- suggestion_code: BLOCK_CREDENTIAL_EXPOSURE (specific!)
- explanation: Context-aware, specific to issue
- suggested_tests: AI-generated, relevant tests
```

---

## Deployment Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Development                          │
│  ├─ .env: GROQ_API_KEY=gsk_...                          │
│  ├─ AnalyzeController.java (updated)                    │
│  ├─ GroqAnalysisService.java (new)                      │
│  ├─ docker-compose.yml (updated)                        │
│  └─ App.jsx (descriptions updated)                      │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
            ┌────────────────────────┐
            │  docker-compose build  │
            └────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
    ┌────────┐      ┌────────┐      ┌────────┐
    │Backend │      │Webhook │      │Dash    │
    │(Java)  │      │(Node)  │      │board   │
    │✓ GROQ  │      │        │      │(React) │
    └────────┘      └────────┘      └────────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
                         ▼
            ┌────────────────────────┐
            │  docker-compose up -d  │
            └────────────────────────┘
                         │
                         ▼
            ┌────────────────────────┐
            │  Services Running      │
            │  ✓ Backend:8081        │
            │  ✓ Webhook:3001        │
            │  ✓ Dashboard:5173      │
            │  ✓ GROQ Integration    │
            └────────────────────────┘
```

---

## Testing Scenarios

### Scenario 1: Credential Detection
```
Input: 
  files: ["src/main/java/Security.java"]
  diff: "private String apiPassword = 'secret123'"

Flow:
  computeRisk() → 0.82
  generateSuggestionCode() → Detects "password"
  
Output:
  suggestionCode: "BLOCK_CREDENTIAL_EXPOSURE"
  explanation: "[LLM]: This PR exposes credentials..."
  
Dashboard:
  🔴 BLOCK_CREDENTIAL_EXPOSURE
  Credentials exposed - immediate action required
```

### Scenario 2: Build Config Changes
```
Input:
  files: ["pom.xml", "Dockerfile"]
  diff: "maven version change..."

Flow:
  computeRisk() → 0.45
  classify() → WARN
  generateSuggestionCode() → Detects pom.xml
  
Output:
  suggestionCode: "WARN_BUILD_CONFIG_CHANGES"
  suggestedTests: [LLM-generated recommendations]
  
Dashboard:
  🟠 WARN_BUILD_CONFIG_CHANGES
  Build config changes - deployment review needed
```

### Scenario 3: No GROQ API
```
Input: [Any PR]

Flow:
  GROQ_API_KEY not set
  groqService = null
  
  computeRisk() → 0.72
  classify() → WARN
  suggestTests() → Rule-based fallback
  explain() → Template fallback
  generateSuggestionCode() → Rule-based fallback
  
Output:
  suggestionCode: "WARN_MODERATE_RISK_REVIEW"
  explanation: "Medium risk: Moderate changes detected..."
  suggestedTests: ["Add unit tests for changed functionality"]
  
Note: System still functions perfectly!
```

---

## Summary

```
┌─────────────────────────────────────────────┐
│  GROQ Integration Complete                  │
│                                             │
│  ✅ AI-Powered Analysis                     │
│  ✅ 11 Contextual Suggestion Codes          │
│  ✅ Pattern Detection (Credentials, Exec)  │
│  ✅ Enhanced Test Recommendations           │
│  ✅ Graceful Fallback                       │
│  ✅ Production Ready                        │
└─────────────────────────────────────────────┘
```
