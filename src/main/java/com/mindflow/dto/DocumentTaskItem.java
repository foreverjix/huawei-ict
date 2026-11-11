package com.mindflow.dto;

import java.time.Instant;
import java.util.List;

public record DocumentTaskItem(
        String id,
        int seq,
        String title,
        String summary,
        int chars,
        String status,
        Instant completedAt,
        List<String> keywords
) {
}