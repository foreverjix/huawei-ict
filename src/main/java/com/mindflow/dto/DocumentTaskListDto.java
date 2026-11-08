package com.mindflow.dto;

import java.util.List;

public record DocumentTaskListDto(
        String documentId,
        int total,
        int completed,
        String source,
        List<DocumentTaskItem> tasks
) {
}