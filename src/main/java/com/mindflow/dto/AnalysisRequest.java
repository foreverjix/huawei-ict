package com.mindflow.dto;

import jakarta.validation.constraints.Size;

public record AnalysisRequest(
        @Size(max = 40) String skillCode,
        @Size(max = 4000) String prompt
) {
}