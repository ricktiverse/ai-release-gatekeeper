package com.gatekeeper.api;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Service to integrate GROQ LLM for enhanced code analysis
 * Uses GROQ API to generate contextual analysis and improvement suggestions
 */
public class GroqAnalysisService {
    private static final String GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
    private final String apiKey;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public GroqAnalysisService(String apiKey) {
        this.apiKey = apiKey;
        this.httpClient = HttpClient.newHttpClient();
    }

    /**
     * Generate enhanced explanation for PR analysis using GROQ
     * @param decision BLOCK/WARN/ALLOW
     * @param riskScore 0.0 to 1.0
     * @param diff Code changes
     * @param changedFiles List of changed files
     * @return Enhanced explanation from GROQ
     */
    public String generateEnhancedExplanation(String decision, double riskScore, String diff, List<String> changedFiles) {
        if (apiKey == null || apiKey.isBlank()) {
            return null; // GROQ not configured
        }

        try {
            String prompt = buildAnalysisPrompt(decision, riskScore, diff, changedFiles);
            String response = callGroqAPI(prompt);
            return response;
        } catch (Exception e) {
            System.err.println("GROQ API error in generateEnhancedExplanation: " + e.getMessage());
            e.printStackTrace();
            return null;
        }
    }

    /**
     * Generate enhanced suggestion code description using GROQ
     * @param code Suggestion code
     * @param explanation Base explanation
     * @return Enhanced description
     */
    public String generateEnhancedSuggestionDescription(String code, String explanation) {
        if (apiKey == null || apiKey.isBlank()) {
            return null;
        }

        try {
            String prompt = String.format(
                "Given the PR analysis suggestion code '%s' and explanation '%s', provide a concise, actionable recommendation (max 100 chars) for developers. Be direct and specific.",
                code, explanation
            );
            return callGroqAPI(prompt);
        } catch (Exception e) {
            System.err.println("GROQ API error in generateEnhancedSuggestionDescription: " + e.getMessage());
            e.printStackTrace();
            return null;
        }
    }

    /**
     * Generate suggestion code category based on GROQ analysis of the diff
     * Helps categorize PR patterns for better UI display
     * @param decision BLOCK/WARN/ALLOW
     * @param risk Risk score (0.0 to 1.0)
     * @param diff Code changes
     * @param changedFiles List of changed files
     * @return Suggestion code category string
     */
    public String generateSuggestionCodeFromAnalysis(String decision, double risk, String diff, List<String> changedFiles) {
        if (apiKey == null || apiKey.isBlank()) {
            return null; // Return null to let controller use default logic
        }

        try {
            // Analyze diff for specific patterns
            String lowerDiff = diff.toLowerCase();
            
            // Quick heuristic-based detection for common patterns
            if ("BLOCK".equals(decision)) {
                if (lowerDiff.contains("password") || lowerDiff.contains("secret") || lowerDiff.contains("apikey")) {
                    return "BLOCK_CREDENTIAL_EXPOSURE";
                }
                if (lowerDiff.contains("runtime.exec") || lowerDiff.contains("system.exit")) {
                    return "BLOCK_DANGEROUS_EXEC";
                }
                if (risk >= 0.9) {
                    return "BLOCK_CRITICAL_SECURITY";
                }
                if (risk >= 0.8) {
                    return "BLOCK_HIGH_SECURITY_RISK";
                }
                return "BLOCK_DANGEROUS_OPERATIONS";
            }
            
            if ("WARN".equals(decision)) {
                boolean hasConfigFiles = changedFiles != null && changedFiles.stream()
                    .anyMatch(f -> f.toLowerCase().matches(".*(properties|yml|yaml|xml|config)$"));
                boolean hasBuildChanges = changedFiles != null && changedFiles.stream()
                    .anyMatch(f -> f.toLowerCase().matches(".*(pom|gradle|build|docker|kubernetes).*"));
                
                if (hasBuildChanges) {
                    return "WARN_BUILD_CONFIG_CHANGES";
                }
                if (hasConfigFiles) {
                    return "WARN_CONFIG_CHANGES_REVIEW";
                }
                if (risk >= 0.5) {
                    return "WARN_MODERATE_RISK_REVIEW";
                }
                return "WARN_ENHANCED_TESTING_NEEDED";
            }
            
            // ALLOW decision
            if (risk >= 0.1) {
                return "ALLOW_WITH_TESTING_REQUIRED";
            }
            return "ALLOW_LOW_RISK_SAFE";
            
        } catch (Exception e) {
            System.err.println("GROQ suggestion code analysis error: " + e.getMessage());
            return null; // Return null for fallback
        }
    }

    /**
     * Generate test recommendations using GROQ
     * @param changedFiles Files that changed
     * @param diff Code diff
     * @return List of test recommendations
     */
    public List<String> generateTestRecommendations(List<String> changedFiles, String diff) {
        if (apiKey == null || apiKey.isBlank()) {
            return Collections.emptyList();
        }

        try {
            String files = String.join(", ", changedFiles);
            String prompt = String.format(
                "Analyze these changed files: %s\n\nDiff:\n%s\n\nGenerate 3 specific test recommendations (one per line, starting with '-'). Be concise.",
                files, diff.substring(0, Math.min(500, diff.length()))
            );
            String response = callGroqAPI(prompt);
            return parseTestRecommendations(response);
        } catch (Exception e) {
            System.err.println("GROQ API error: " + e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * Detect spelling mistakes in the provided diff using GROQ and return suggestions.
     * Each suggestion line should be formatted as: "original -> suggestion"
     */
    public List<String> generateSpellingSuggestions(String diff) {
        if (apiKey == null || apiKey.isBlank() || diff == null || diff.isBlank()) {
            return Collections.emptyList();
        }

        try {
            String prompt = String.format(
                "Find up to 5 likely spelling mistakes or obvious typos in the following code or text diff and provide suggested corrections.\n\nDiff:\n%s\n\nRespond with one item per line in the format 'original -> suggestion'. If none, reply 'NONE'.",
                diff.substring(0, Math.min(1200, diff.length()))
            );
            String response = callGroqAPI(prompt);
            if (response == null) return Collections.emptyList();
            response = response.trim();
            if (response.equalsIgnoreCase("none")) return Collections.emptyList();
            List<String> out = new ArrayList<>();
            for (String line : response.split("\n")) {
                String l = line.trim();
                if (l.isEmpty()) continue;
                // Normalize lines like '- original -> suggestion' or '1. original -> suggestion'
                l = l.replaceAll("^[\\d\\.\\)\\s-]+", "").trim();
                out.add(l);
                if (out.size() >= 5) break;
            }
            return out;
        } catch (Exception e) {
            System.err.println("GROQ spelling API error: " + e.getMessage());
            return Collections.emptyList();
        }
    }

    private String buildAnalysisPrompt(String decision, double riskScore, String diff, List<String> changedFiles) {
        String files = String.join(", ", changedFiles);
        return String.format(
            "Analyze this PR:\n\n" +
            "Files: %s\n" +
            "Decision: %s\n" +
            "Risk Score: %.2f\n\n" +
            "Diff:\n%s\n\n" +
            "Provide a concise technical analysis (2-3 sentences) highlighting the main risks or positive aspects. Be specific.",
            files, decision, riskScore, diff.substring(0, Math.min(800, diff.length()))
        );
    }

    private String callGroqAPI(String prompt) throws Exception {
        // Using llama-3.3-70b-versatile - latest supported GROQ model as of Dec 2025
        String requestBody = String.format(
            "{\"model\":\"llama-3.3-70b-versatile\",\"messages\":[{\"role\":\"user\",\"content\":\"%s\"}],\"max_tokens\":150}",
            escapeJson(prompt)
        );

        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(GROQ_API_URL))
            .header("Authorization", "Bearer " + apiKey)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(requestBody))
            .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() == 200) {
            JsonNode json = objectMapper.readTree(response.body());
            return json.get("choices").get(0).get("message").get("content").asText().trim();
        } else {
            System.err.println("GROQ API error: " + response.statusCode());
            System.err.println("Response: " + response.body());
            System.err.println("Request body: " + requestBody);
            return null;
        }
    }

    private List<String> parseTestRecommendations(String response) {
        if (response == null) return Collections.emptyList();
        
        List<String> recommendations = new ArrayList<>();
        for (String line : response.split("\n")) {
            line = line.trim();
            if (line.startsWith("-")) {
                recommendations.add(line.substring(1).trim());
            } else if (!line.isEmpty() && !line.matches(".*[0-9]\\.|#.*")) {
                recommendations.add(line);
            }
        }
        return recommendations.stream().limit(3).toList();
    }

    private String escapeJson(String str) {
        if (str == null) return "";
        return str.replace("\\", "\\\\")    // Escape backslash first
                 .replace("\"", "\\\"")    // Escape quotes
                 .replace("\n", "\\n")     // Escape newlines
                 .replace("\r", "\\r")     // Escape carriage returns
                 .replace("\t", "\\t")     // Escape tabs
                 .replace("\b", "\\b")     // Escape backspace
                 .replace("\f", "\\f");    // Escape form feed
    }
}
