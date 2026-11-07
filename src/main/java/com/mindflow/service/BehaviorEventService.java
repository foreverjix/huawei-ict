package com.mindflow.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mindflow.dto.BehaviorEventDto;
import com.mindflow.dto.EventIngestResult;
import com.mindflow.entity.BehaviorEvent;
import com.mindflow.repository.BehaviorEventRepository;
import jakarta.annotation.Resource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class BehaviorEventService {

    private static final Logger log = LoggerFactory.getLogger(BehaviorEventService.class);

    @Resource
    private BehaviorEventRepository eventRepository;

    @Resource
    private SessionService sessionService;

    @Resource
    private ObjectMapper objectMapper;

    @Transactional
    public EventIngestResult ingest(String sessionId, List<BehaviorEventDto> events) {
        sessionService.requireOpenSession(sessionId);

        int accepted = 0;
        int skipped = 0;

        for (BehaviorEventDto dto : events) {
            if (!isValidWindow(dto)) {
                skipped++;
                log.warn("丢弃时间窗非法的事件 session={} clientEventId={}", sessionId, dto.clientEventId());
                continue;
            }
            if (eventRepository.existsBySessionIdAndClientEventId(sessionId, dto.clientEventId())) {
                skipped++;
                continue;
            }
            eventRepository.save(toEntity(sessionId, dto));
            accepted++;
        }
        return new EventIngestResult(accepted, skipped);
    }

    @Transactional(readOnly = true)
    public List<BehaviorEvent> listBySession(String sessionId) {
        return eventRepository.findAllBySessionIdOrderByStartedAtAsc(sessionId);
    }

    private boolean isValidWindow(BehaviorEventDto dto) {
        return !dto.endedAt().isBefore(dto.startedAt());
    }

    private BehaviorEvent toEntity(String sessionId, BehaviorEventDto dto) {
        BehaviorEvent entity = new BehaviorEvent();
        entity.setSessionId(sessionId);
        entity.setClientEventId(dto.clientEventId());
        entity.setType(dto.type());
        entity.setConfidence(clamp(dto.confidence()));
        entity.setStartedAt(dto.startedAt());
        entity.setEndedAt(dto.endedAt());
        entity.setMetaJson(writeMeta(dto));
        return entity;
    }

    private double clamp(double value) {
        if (Double.isNaN(value)) return 0d;
        return Math.max(0d, Math.min(1d, value));
    }

    private String writeMeta(BehaviorEventDto dto) {
        if (dto.meta() == null || dto.meta().isEmpty()) return null;
        try {
            return objectMapper.writeValueAsString(dto.meta());
        } catch (JsonProcessingException e) {
            log.warn("meta 序列化失败，已忽略: {}", dto.clientEventId(), e);
            return null;
        }
    }
}