package com.mindflow.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

public record BaselineRequest(
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double yaw,
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double pitch,
        @NotNull @DecimalMin("-90.0") @DecimalMax("90.0") Double roll
) {
}