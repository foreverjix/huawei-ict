package com.mindflow.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public record TrainingPlanRequest(
        @Min(0) @Max(99999) int left,
        @Min(0) @Max(99999) int right,
        @Min(0) @Max(90) double leftPeak,
        @Min(0) @Max(90) double rightPeak,
        @Min(0) @Max(99999) int standard,
        @Min(0) @Max(99999) int missed
) {
    public static TrainingPlanRequest empty() {
        return new TrainingPlanRequest(0, 0, 0, 0, 0, 0);
    }
}