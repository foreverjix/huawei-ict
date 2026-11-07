package com.mindflow.dto;

import com.mindflow.entity.BehaviorEventType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.Map;

public record BehaviorEventDto(
        @NotBlank @Size(max = 64) String clientEventId,
        @NotNull BehaviorEventType type,
        double confidence,
        @NotNull Instant startedAt,
        @NotNull Instant endedAt,
        Map<String, Object> meta
) {
}