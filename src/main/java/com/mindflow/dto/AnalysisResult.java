package com.mindflow.dto;

import java.time.Instant;

public record AnalysisResult(
        String id,
        String documentId,
        String skillCode,
        String skillName,
        String model,
        String result,
        long durationMs,
        Instant createdAt
) {
}