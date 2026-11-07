package com.mindflow.dto;

import java.time.Instant;

public record SessionCreateResponse(String sessionId, boolean baselineRequired, Instant startedAt) {
}