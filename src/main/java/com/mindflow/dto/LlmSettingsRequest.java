package com.mindflow.dto;

import jakarta.validation.constraints.Size;

public record LlmSettingsRequest(
        @Size(max = 300) String baseUrl,
        @Size(max = 400) String apiKey,
        @Size(max = 120) String model,
        @Size(max = 40) String skillCode,
        @Size(max = 4000) String customPrompt
) {
}