package com.mindflow.dto;

import java.util.List;

public record DocumentTaskContentDto(
        String id,
        int seq,
        String title,
        String summary,
        String status,
        String content,
        List<String> keywords
) {
}