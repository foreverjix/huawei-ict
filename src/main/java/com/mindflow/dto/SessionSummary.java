package com.mindflow.dto;

import java.time.Instant;
import java.util.List;

public record SessionSummary(
        String sessionId,
        long durationSec,
        long yawnCount,
        long mouthOpenCount,
        long headTurnCount,
        long headDownCount,
        long leanInCount,
        double focusRatio,
        List<TimelineItem> timeline
) {
    public record TimelineItem(
            String type,
            Instant startedAt,
            Instant endedAt,
            double confidence
    ) {
    }
}