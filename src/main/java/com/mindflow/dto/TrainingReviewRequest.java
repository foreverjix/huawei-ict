package com.mindflow.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record TrainingReviewRequest(
        @Min(0) @Max(999) int left,
        @Min(0) @Max(999) int right,
        @Min(0) @Max(90) double leftPeak,
        @Min(0) @Max(90) double rightPeak,
        @Min(0) @Max(999) int standard,
        @Min(0) @Max(999) int missed
) {
}