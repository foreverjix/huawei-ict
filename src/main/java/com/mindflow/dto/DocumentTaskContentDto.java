package com.mindflow.dto;

public record DocumentTaskContentDto(
        String id,
        int seq,
        String title,
        String summary,
        String status,
        String content
) {
}