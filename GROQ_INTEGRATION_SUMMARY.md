# GROQ API Integration & Enhanced Suggestion Codes

## 🎯 Overview

Successfully integrated GROQ LLM API for AI-powered PR analysis with context-aware suggestion codes.

- ✅ **GROQ Integration**: Enabled for enhanced analysis
- ✅ **Suggestion Codes**: Expanded from 8 to 11 contextual codes
- ✅ **Test Recommendations**: AI-generated via LLM
- ✅ **Security Detection**: Pattern-based code execution detection
- ✅ **Graceful Fallback**: Works without GROQ if API unavailable

---

## 🏗️ Architecture

### New Class: GroqAnalysisService.java

Located: `backend-java/src/main/java/com/gatekeeper/api/GroqAnalysisService.java`

**Responsibilities:**
- HTTP communication with GROQ API
- Prompt engineering for PR analysis
- Response parsing and formatting
- Error handling & graceful fallback

**Public Methods:**
```java
String generateEnhancedExplanation(String decision, double risk, String diff, List<String> files)
String generateEnhancedSuggestionDescription(String code, String explanation)
List<String> generateTestRecommendations(List<String> changedFiles, String diff)
```

**Key Features:**
- Uses `mixtral-8x7b-32768` model
- Max 150 tokens per request
- Gracefully returns null if GROQ_API_KEY not set

### Updated: AnalyzeController.java

**Changes:**
1. Added `GroqAnalysisService groqService` instance
2. Enhanced `generateSuggestionCode()` to accept more context:
   - Now takes: `decision`, `risk`, `files`, `diff`
   - Pattern detection for credentials, code execution
   - File type analysis for build/config changes

3. Updated `analyze()` method:
   - Uses GROQ for test recommendations
   - Uses GROQ for enhanced explanations
   - Fallback to rule-based if GROQ unavailable

---

## 🔐 Environment Configuration

### docker-compose.yml

```yaml
backend:
  environment:
    - GATEKEEPER_API_KEY=changeme
    - GROQ_API_KEY=${GROQ_API_KEY}    # NEW
```

### .env File

```dotenv
GROQ_API_KEY=XXX
```

---

## 🎯 Enhanced Suggestion Codes (11 Total)

### BLOCK Codes (Risk - Critical)

| Code | Risk | Trigger | Message |
|------|------|---------|---------|
| `BLOCK_CRITICAL_SECURITY` | >= 0.9 | Very high risk | Immediate escalation - critical threat |
| `BLOCK_CREDENTIAL_EXPOSURE` | ANY | Contains: password, secret, apikey | Credentials exposed - immediate action |
| `BLOCK_DANGEROUS_EXEC` | ANY | Contains: runtime.exec, system.exit | Dangerous execution - review required |
| `BLOCK_HIGH_SECURITY_RISK` | >= 0.8 | High risk without specific pattern | High risk - manual review needed |
| `BLOCK_DANGEROUS_OPERATIONS` | < 0.8 | BLOCK decision | Dangerous ops - security review |

### WARN Codes (Risk - Moderate)

| Code | Risk | Trigger | Message |
|------|------|---------|---------|
| `WARN_MODERATE_RISK_REVIEW` | >= 0.5 | Moderate risk | Additional review and testing required |
| `WARN_BUILD_CONFIG_CHANGES` | >= 0.4 | pom.xml, docker, kubernetes | Build config changes - deployment review |
| `WARN_CONFIG_CHANGES_REVIEW` | >= 0.4 | Config files changed | Config audit - deployment review needed |
| `WARN_ENHANCED_TESTING_NEEDED` | < 0.4 | WARN decision | Testing requirements - coverage needed |

### ALLOW Codes (Risk - Low)

| Code | Risk | Trigger | Message |
|------|------|---------|---------|
| `ALLOW_WITH_TESTING_REQUIRED` | >= 0.1 | Low-moderate risk | Approved - testing recommended |
| `ALLOW_LOW_RISK_SAFE` | < 0.1 | Very low risk | Safe to merge |

---

## 🤖 GROQ Integration Details

### API Configuration

- **Endpoint**: https://api.groq.com/openai/v1/chat/completions
- **Model**: mixtral-8x7b-32768
- **Max Tokens**: 150 per request
- **Authentication**: Bearer token

### GROQ Use Cases

**1. Enhanced Explanations**
- Input: Decision, risk score, diff, files
- Output: 2-3 sentence technical analysis
- Example: "This PR adds database migration with transaction handling. Moderate risk due to schema changes."

**2. Test Recommendations**
- Input: Changed files, code diff
- Output: List of 3 specific tests
- Example: ["Add integration tests for new API endpoint", "Test database rollback scenarios"]

**3. Suggestion Descriptions**
- Input: Code, base explanation
- Output: Actionable recommendation (max 100 chars)
- Example: "Review database migration for edge cases"

---

## 🔄 Response Flow

```
GitHub Webhook
    ↓
Webhook Service (Node.js)
    ↓
Backend AnalyzeController
    ├─ computeRisk()
    ├─ classify()
    ├─ findMissingTests()
    ├─ [IF GROQ] → AI-generated recommendations
    └─ [ELSE] → Rule-based fallback
    ↓
AnalyzeResponse (with all fields)
    ├─ prNumber, riskScore, decision
    ├─ missingTests
    ├─ suggestedTests (AI or rule-based)
    ├─ summary
    ├─ explanation (LLM or template)
    ├─ suggestionCode (Context-aware)
    ├─ errorMessage, analysisTimestamp
    ↓
Webhook Buffer
    ↓
React Dashboard (displays all fields with enhanced styling)
```

---

## 💾 Fallback Behavior

If `GROQ_API_KEY` not set or API unreachable:

✓ Service continues to function  
✓ Uses original rule-based analysis  
✓ No crashes or errors  
✓ Suggestion codes still generated (rule-based)  
✓ Explanations use templates  

---

## 📊 Example Response with GROQ

```json
{
  "prNumber": "42",
  "riskScore": 0.82,
  "decision": "BLOCK",
  "missingTests": [
    "Unit tests for new/changed public methods (3 found)"
  ],
  "suggestedTests": [
    "Add integration tests for new API endpoint with various request types",
    "Test error handling with invalid credentials",
    "Add unit tests for transaction rollback scenarios"
  ],
  "summary": "PR #42 by alice. Changed files: 5. Contains: source code, tests.",
  "explanation": "This PR adds authentication logic with password handling. High risk due to credential exposure patterns detected. Manual security review required before merge.",
  "suggestionCode": "BLOCK_CREDENTIAL_EXPOSURE",
  "errorMessage": null,
  "analysisTimestamp": 1733938755123
}
```

---

## 🧪 Testing GROQ Integration

### 1. Verify Setup
```bash
echo $GROQ_API_KEY
docker-compose logs backend | grep GROQ
```

### 2. Test Credential Detection
```bash
POST /api/analyze
Body: {
  "prNumber": "TEST-001",
  "changedFiles": ["src/main/java/Security.java"],
  "diff": "private String password = config.get('API_PASSWORD')"
}

Expected: suggestionCode = "BLOCK_CREDENTIAL_EXPOSURE"
```

### 3. Test Build Config Changes
```bash
POST /api/analyze
Body: {
  "prNumber": "TEST-002",
  "changedFiles": ["pom.xml", "Dockerfile"],
  "diff": "..."
}

Expected: suggestionCode = "WARN_BUILD_CONFIG_CHANGES"
```

### 4. Test Fallback (No GROQ)
```bash
# Unset GROQ_API_KEY, restart backend
docker-compose restart backend

POST /api/analyze
# Should still work with rule-based codes
```

---

## ✅ Deployment Checklist

- ✓ GroqAnalysisService.java created with full implementation
- ✓ AnalyzeController.java updated with GROQ integration
- ✓ Suggestion codes enhanced (8 → 11)
- ✓ Context-aware detection (credentials, exec, config)
- ✓ docker-compose.yml updated with GROQ_API_KEY
- ✓ Dashboard descriptions updated for all codes
- ✓ Fallback behavior tested
- ✓ Error handling implemented
- ✓ JSON escaping for prompt safety

### Build & Deploy

```bash
# Full rebuild
docker-compose down
docker-compose build --no-cache backend
docker-compose up -d

# Test
curl -X POST http://localhost:8081/api/analyze \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: changeme" \
  -d '{...}'
```

---

## 🎨 Dashboard Updates

Updated suggestion code descriptions in React:

- `BLOCK_CREDENTIAL_EXPOSURE`: "Credentials exposed - immediate action"
- `BLOCK_DANGEROUS_EXEC`: "Dangerous execution - review mandatory"
- `WARN_BUILD_CONFIG_CHANGES`: "Build config - deployment review needed"

All codes display with:
- Color-coded badges (red/orange/green)
- Full descriptions
- Contextual guidance
- Formatted timestamps

---

## 📝 Summary

This integration provides:

1. **AI-Powered Analysis**: GROQ LLM generates contextual recommendations
2. **Enhanced Security**: Detects credentials, dangerous operations, config changes
3. **Better Test Coverage**: AI-generated test suggestions
4. **Graceful Degradation**: Works with or without GROQ API
5. **Improved UX**: 11 specific suggestion codes with clear actions

The system is **production-ready** with full error handling and backward compatibility.
