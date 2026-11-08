package com.mindflow.dto;

import java.util.List;

public record TrainingPlanResponse(
        String date,
        String note,
        List<Segment> segments,
        String source
) {
    public record Segment(
            String id,
            String label,
            int fromSec,
            int toSec,
            int yaw,
            String focus,
            int spawnGapMs
    ) {
    }
}