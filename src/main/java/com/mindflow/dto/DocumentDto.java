package com.mindflow.dto;

import java.time.Instant;

public record DocumentDto(
        String id,
        String name,
        String contentType,
        long sizeBytes,
        int textChars,
        String status,
        Instant uploadedAt,
        boolean analyzable
) {
}