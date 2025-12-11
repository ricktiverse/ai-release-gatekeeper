package com.gatekeeper.api;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api")
public class AnalyzeController {
    private final GroqAnalysisService groqService;

    public AnalyzeController() {
        String groqApiKey = System.getenv("GROQ_API_KEY");
        this.groqService = groqApiKey != null ? new GroqAnalysisService(groqApiKey) : null;
    }

    record AnalyzeRequest(String prNumber, String author, List<String> changedFiles, String diff) {}
    record AnalyzeResponse(String prNumber, double riskScore, String riskLevel, String decision, String prStatus, List<String> missingTests, List<String> suggestedTests, String summary, String explanation, String suggestionCode, List<String> spellingSuggestions, String groqSuggestion, String errorMessage, long analysisTimestamp) {}

    @PostMapping("/analyze")
    public ResponseEntity<AnalyzeResponse> analyze(@RequestBody AnalyzeRequest req, @RequestHeader(value = "X-API-KEY", required = false) String apiKey) {
        // Simple API key check (in production use proper auth)
        String required = System.getenv("GATEKEEPER_API_KEY");
        if (required != null && !required.isBlank() && (apiKey == null || !apiKey.equals(required))) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String diff = req.diff() == null ? "" : req.diff();
        List<String> changedFiles = req.changedFiles() == null ? new ArrayList<>() : req.changedFiles();
        double risk = computeRisk(diff, changedFiles);
        String decision = classify(risk, diff, changedFiles);
        List<String> missing = findMissingTests(diff, changedFiles);
        
        // Use GROQ service safely if available
        List<String> suggested;
        String explanation;
        List<String> spellingSuggestions = Collections.emptyList();
        String groqSuggestion = null;
        
        if (groqService != null) {
            suggested = groqService.generateTestRecommendations(changedFiles, diff);
            String groqExplanation = groqService.generateEnhancedExplanation(decision, risk, diff, changedFiles);
            explanation = groqExplanation != null ? groqExplanation : explain(risk, diff, changedFiles);
            
            // Get spelling suggestions
            try {
                spellingSuggestions = groqService.generateSpellingSuggestions(diff);
                if (spellingSuggestions == null) spellingSuggestions = Collections.emptyList();
            } catch (Exception e) {
                spellingSuggestions = Collections.emptyList();
            }
            
            // Get GROQ suggestion
            String suggestionCode = generateSuggestionCode(decision, risk, changedFiles, diff);
            if (spellingSuggestions.isEmpty() || "BLOCK".equals(suggestionCode)) {
                // Only override if no spelling issues found
                if (spellingSuggestions.isEmpty()) {
                    try {
                        groqSuggestion = groqService.generateEnhancedSuggestionDescription(suggestionCode, explanation);
                    } catch (Exception e) {
                        // Silently ignore GROQ errors
                    }
                }
            }
        } else {
            // Fallback when GROQ not available
            suggested = suggestTests(missing, changedFiles);
            explanation = explain(risk, diff, changedFiles);
        }
        
        String summary = generateSummary(req, changedFiles);
        
        // Generate suggestion code - used for UI categorization and display
        // Suggestion codes help users understand the type of review needed
        String suggestionCode = null;
        
        // Try GROQ-based code generation first (more context-aware)
        if (groqService != null) {
            suggestionCode = groqService.generateSuggestionCodeFromAnalysis(decision, risk, diff, changedFiles);
        }
        
        // Fall back to rule-based generation if GROQ unavailable or returned null
        if (suggestionCode == null) {
            suggestionCode = generateSuggestionCode(decision, risk, changedFiles, diff);
        }
        
        // If spelling issues found, escalate suggestion code
        if (!spellingSuggestions.isEmpty() && !"BLOCK".equals(suggestionCode)) {
            suggestionCode = "WARN_SPELLING_ERRORS";
        }
        
        String errorMessage = null; // No errors if we reached here
        long analysisTimestamp = System.currentTimeMillis();
        
        // Generate risk level and PR status
        String riskLevel = getRiskLevel(risk);
        String prStatus = getPRStatus(decision, risk);

        AnalyzeResponse resp = new AnalyzeResponse(req.prNumber(), risk, riskLevel, decision, prStatus, missing, suggested, summary, explanation, suggestionCode, spellingSuggestions, groqSuggestion, errorMessage, analysisTimestamp);
        return ResponseEntity.ok(resp);
    }
    
    private String getRiskLevel(double risk) {
        if (risk >= 0.90) return "CRITICAL";
        if (risk >= 0.75) return "HIGH";
        if (risk >= 0.35) return "MEDIUM";
        if (risk >= 0.10) return "LOW";
        return "MINIMAL";
    }
    
    private String getPRStatus(String decision, double risk) {
        if ("BLOCK".equals(decision)) {
            return "❌ BLOCKED - Manual review required before merge";
        } else if ("WARN".equals(decision)) {
            return "⚠️ NEEDS REVIEW - Proceed with caution";
        } else {
            if (risk >= 0.10) {
                return "✅ APPROVED - Additional testing recommended";
            }
            return "✅ APPROVED - Safe to merge";
        }
    }

    private double computeRisk(String diff, List<String> files) {
        if (diff==null || diff.isBlank()) return 0.0;
        int lines = diff.split("\n").length;
        // Risk based on lines changed: base risk calculation
        double base = Math.min(1.0, lines / 200.0);
        
        // Penalize dangerous keywords in diff
        String lower = diff.toLowerCase();
        if (lower.contains("system.exit") || lower.contains("runtime.getruntime") || lower.contains("exec(") || lower.contains("password")) {
            return Math.max(0.75, base + 0.5);
        }
        
        // Analyze changed file types for risk
        if (files != null && !files.isEmpty()) {
            for (String file : files) {
                String fileLower = file.toLowerCase();
                // High-risk file types
                if (fileLower.endsWith(".properties") || fileLower.endsWith(".yml") || fileLower.endsWith(".yaml") || fileLower.endsWith(".xml")) {
                    base += 0.1;
                }
                // Config files
                if (fileLower.contains("pom.xml") || fileLower.contains("build.gradle") || fileLower.contains("dockerfile")) {
                    base += 0.15;
                }
                // Security-related files
                if (fileLower.contains("security") || fileLower.contains("auth") || fileLower.contains("password") || fileLower.contains("secret")) {
                    base += 0.2;
                }
            }
        }
        return Math.min(1.0, base);
    }

    private String classify(double risk, String diff, List<String> files) {
        // Enhanced classification based on risk and file types
        if (risk >= 0.75) return "BLOCK";
        if (risk >= 0.35) return "WARN";
        
        // Check if only test/doc files changed (lower risk)
        if (files != null && !files.isEmpty()) {
            boolean onlyTestsAndDocs = files.stream().allMatch(f -> 
                f.toLowerCase().matches(".*\\.(test\\.js|spec\\.js|test\\.java|spec\\.java|md|txt|doc)$"));
            if (onlyTestsAndDocs && risk < 0.1) return "ALLOW";
        }
        
        return "ALLOW";
    }

    private List<String> findMissingTests(String diff, List<String> files) {
        List<String> res = new ArrayList<>();
        if ((diff==null || diff.isBlank()) && (files == null || files.isEmpty())) return res;
        
        // Check for new public methods or endpoints in the diff
        if (diff != null && !diff.isBlank()) {
            Pattern methodPat = Pattern.compile("public (static )?[\\w<>\\[\\]]+\\s+\\w+\\s*\\(");
            var m = methodPat.matcher(diff);
            int count = 0;
            while (m.find()) count++;
            if (count>0) res.add("Unit tests for new/changed public methods ("+count+" found)");
            if (diff.contains("TODO") || diff.contains("FIXME")) res.add("Address TODO/FIXME and add tests");
            if (diff.contains("new endpoint") || diff.contains("@GetMapping") || diff.contains("@PostMapping")) res.add("Integration tests for new endpoints");
        }
        
        // Analyze changed files for test coverage needs
        if (files != null && !files.isEmpty()) {
            boolean hasMainCode = files.stream().anyMatch(f -> f.toLowerCase().matches(".*src/main/.*\\.java$"));
            boolean hasTests = files.stream().anyMatch(f -> f.toLowerCase().matches(".*src/test/.*\\.java$"));
            boolean hasControllers = files.stream().anyMatch(f -> f.toLowerCase().contains("controller"));
            boolean hasServices = files.stream().anyMatch(f -> f.toLowerCase().contains("service"));
            
            if (hasMainCode && !hasTests) {
                res.add("Test files are missing for modified source code");
            }
            if (hasControllers) {
                res.add("Integration tests for API endpoints");
            }
            if (hasServices) {
                res.add("Unit tests for service layer changes");
            }
        }
        
        return res;
    }

    private List<String> suggestTests(List<String> missing, List<String> files) {
        List<String> s = new ArrayList<>();
        for (String m : missing) {
            if (m.contains("Unit tests")) s.add("Create JUnit tests covering edge cases and null inputs");
            if (m.contains("Integration tests")) s.add("Add integration tests that call the endpoint and verify response code and payload");
            if (m.contains("TODO")) s.add("Add unit tests for the functionality marked TODO");
        }
        if (s.isEmpty()) s.add("Add/verify unit tests for changed functionality");
        return s;
    }

    private String generateSummary(AnalyzeRequest req, List<String> changedFiles) {
        StringBuilder sb = new StringBuilder();
        sb.append("PR #").append(req.prNumber()).append(" by ").append(req.author()).append(". ");
        
        int fileCount = changedFiles == null ? 0 : changedFiles.size();
        sb.append("Changed files: ").append(fileCount).append(". ");
        
        // Analyze file types changed
        if (changedFiles != null && !changedFiles.isEmpty()) {
            boolean hasTests = changedFiles.stream().anyMatch(f -> f.toLowerCase().contains("test"));
            boolean hasConfig = changedFiles.stream().anyMatch(f -> f.toLowerCase().matches(".*(properties|yml|yaml|xml)$"));
            boolean hasDocs = changedFiles.stream().anyMatch(f -> f.toLowerCase().matches(".*\\.(md|txt)$"));
            
            List<String> categories = new ArrayList<>();
            if (hasTests) categories.add("tests");
            if (hasConfig) categories.add("config");
            if (hasDocs) categories.add("docs");
            if (changedFiles.stream().anyMatch(f -> f.toLowerCase().endsWith(".java"))) categories.add("source code");
            
            if (!categories.isEmpty()) {
                sb.append("Contains: ").append(String.join(", ", categories)).append(". ");
            }
        }
        
        sb.append("Analysis completed by Gatekeeper.");
        return sb.toString();
    }

    private String explain(double risk, String diff, List<String> files) {
        if (risk >= 0.75) {
            return "High risk: Large changes or dangerous operations detected. Requires manual security review.";
        }
        if (risk >= 0.35) {
            return "Medium risk: Moderate changes detected. Additional testing and code review recommended.";
        }
        
        // Low risk - provide specific feedback based on changes
        if (files != null && !files.isEmpty()) {
            boolean onlyDocsAndTests = files.stream().allMatch(f -> 
                f.toLowerCase().matches(".*(test|spec|\\.md|\\.txt|readme).*"));
            if (onlyDocsAndTests) {
                return "Low risk: Only documentation and test files modified.";
            }
            
            boolean hasSecurityFiles = files.stream().anyMatch(f -> 
                f.toLowerCase().matches(".*(security|auth|password|secret|crypto|ssl).*"));
            if (hasSecurityFiles) {
                return "Low risk: Small changes in security-related files. Verify implementation details.";
            }
        }
        
        return "Low risk: Small changes or documentation-only updates.";
    }

    private String generateSuggestionCode(String decision, double risk, List<String> files, String diff) {
        // Generate context-aware suggestion codes based on decision, risk, and file analysis
        // These codes are displayed prominently in the UI to help developers quickly understand the review category
        // Code Format: <DECISION>_<CATEGORY> where DECISION is BLOCK/WARN/ALLOW
        // 
        // UI Display:
        // - BLOCK codes: Displayed in red (#d32f2f) - requires immediate action
        // - WARN codes: Displayed in orange (#f57c00) - requires additional review
        // - ALLOW codes: Displayed in green (#388e3c) - safe for merge
        //
        // Suggestion codes also trigger specific descriptive messages in the dashboard
        // and influence the PR status display (❌ BLOCKED, ⚠️ NEEDS REVIEW, ✅ APPROVED)
        
        if ("BLOCK".equals(decision)) {
            if (risk >= 0.9) return "BLOCK_CRITICAL_SECURITY";
            if (risk >= 0.8) {
                // Check for specific security issues
                String lower = diff.toLowerCase();
                if (lower.contains("password") || lower.contains("secret") || lower.contains("apikey")) {
                    return "BLOCK_CREDENTIAL_EXPOSURE";
                }
                if (lower.contains("runtime.exec") || lower.contains("system.exit")) {
                    return "BLOCK_DANGEROUS_EXEC";
                }
                return "BLOCK_HIGH_SECURITY_RISK";
            }
            return "BLOCK_DANGEROUS_OPERATIONS";
        }
        
        if ("WARN".equals(decision)) {
            if (risk >= 0.5) {
                // Check if config files changed
                boolean hasConfigFiles = files != null && files.stream()
                    .anyMatch(f -> f.toLowerCase().matches(".*(properties|yml|yaml|xml|config)$"));
                if (hasConfigFiles) return "WARN_CONFIG_CHANGES_REVIEW";
                return "WARN_MODERATE_RISK_REVIEW";
            }
            if (risk >= 0.4) {
                // Architecture/structure changes
                boolean hasArchChanges = files != null && files.stream()
                    .anyMatch(f -> f.toLowerCase().matches(".*(pom|gradle|build|docker|kubernetes).*"));
                if (hasArchChanges) return "WARN_BUILD_CONFIG_CHANGES";
                return "WARN_CONFIG_CHANGES_REVIEW";
            }
            return "WARN_ENHANCED_TESTING_NEEDED";
        }
        
        // ALLOW decision
        if (risk >= 0.1) return "ALLOW_WITH_TESTING_REQUIRED";
        return "ALLOW_LOW_RISK_SAFE";
    }
}
