package com.mindflow.service;

import com.mindflow.dto.SessionSummary;
import com.mindflow.entity.BehaviorEvent;
import com.mindflow.entity.BehaviorEventType;
import com.mindflow.entity.MonitorSession;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

@Service
public class MetricsService {

    private static final Set<BehaviorEventType> DISTRACTION_TYPES = EnumSet.of(
            BehaviorEventType.HEAD_TURN_LEFT,
            BehaviorEventType.HEAD_TURN_RIGHT,
            BehaviorEventType.HEAD_TILT,
            BehaviorEventType.HEAD_DOWN,
            BehaviorEventType.LEAN_IN
    );

    @Resource
    private BehaviorEventService eventService;

    @Resource
    private SessionService sessionService;

    @Transactional
    public SessionSummary summary(String sessionId) {
        MonitorSession session = sessionService.requireSession(sessionId);
        List<BehaviorEvent> events = eventService.listBySession(sessionId);

        Instant end = session.getEndedAt() != null ? session.getEndedAt() : Instant.now();
        long totalMs = Math.max(1L, Duration.between(session.getStartedAt(), end).toMillis());

        long distractedMs = mergeDistractionMillis(events, session.getStartedAt(), end);
        double focusRatio = round4(1d - Math.min(1d, (double) distractedMs / totalMs));

        if (session.getEndedAt() != null) {
            sessionService.updateFocusRatio(sessionId, focusRatio);
        }

        List<SessionSummary.TimelineItem> timeline = new ArrayList<>(events.size());
        for (BehaviorEvent event : events) {
            timeline.add(new SessionSummary.TimelineItem(
                    event.getType().name(),
                    event.getStartedAt(),
                    event.getEndedAt(),
                    event.getConfidence()
            ));
        }

        return new SessionSummary(
                sessionId,
                Math.max(0L, totalMs / 1000),
                count(events, BehaviorEventType.YAWN),
                count(events, BehaviorEventType.MOUTH_OPEN),
                count(events, BehaviorEventType.HEAD_TURN_LEFT) + count(events, BehaviorEventType.HEAD_TURN_RIGHT),
                count(events, BehaviorEventType.HEAD_DOWN),
                count(events, BehaviorEventType.LEAN_IN),
                focusRatio,
                timeline
        );
    }

    private long count(List<BehaviorEvent> events, BehaviorEventType type) {
        return events.stream().filter(event -> event.getType() == type).count();
    }

    private long mergeDistractionMillis(List<BehaviorEvent> events, Instant sessionStart, Instant sessionEnd) {
        List<BehaviorEvent> distraction = events.stream()
                .filter(event -> DISTRACTION_TYPES.contains(event.getType()))
                .sorted(Comparator.comparing(BehaviorEvent::getStartedAt))
                .toList();

        long total = 0L;
        Instant windowStart = null;
        Instant windowEnd = null;

        for (BehaviorEvent event : distraction) {
            Instant start = max(event.getStartedAt(), sessionStart);
            Instant end = min(event.getEndedAt(), sessionEnd);
            if (!end.isAfter(start)) continue;

            if (windowStart == null) {
                windowStart = start;
                windowEnd = end;
            } else if (start.isAfter(windowEnd)) {
                total += Duration.between(windowStart, windowEnd).toMillis();
                windowStart = start;
                windowEnd = end;
            } else if (end.isAfter(windowEnd)) {
                windowEnd = end;
            }
        }
        if (windowStart != null) {
            total += Duration.between(windowStart, windowEnd).toMillis();
        }
        return total;
    }

    private Instant max(Instant a, Instant b) {
        return a.isAfter(b) ? a : b;
    }

    private Instant min(Instant a, Instant b) {
        return a.isBefore(b) ? a : b;
    }

    private double round4(double value) {
        return Math.round(value * 10000d) / 10000d;
    }
}