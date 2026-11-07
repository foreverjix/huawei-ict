package com.mindflow.dto;

public record LlmSettingsDto(
        String baseUrl,
        String model,
        String skillCode,
        String customPrompt,
        boolean hasApiKey,
        String apiKeyHint
) {
}