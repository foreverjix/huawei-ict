package com.mindflow.service;

import com.mindflow.dto.BaselineRequest;
import com.mindflow.dto.SessionCreateResponse;
import com.mindflow.entity.MonitorSession;
import com.mindflow.repository.MonitorSessionRepository;
import jakarta.annotation.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.NoSuchElementException;
import java.util.UUID;

@Service
public class SessionService {

    @Resource
    private MonitorSessionRepository sessionRepository;

    @Transactional
    public SessionCreateResponse create() {
        MonitorSession session = new MonitorSession();
        session.setId(UUID.randomUUID().toString());
        session.setStartedAt(Instant.now());
        sessionRepository.save(session);
        return new SessionCreateResponse(session.getId(), true, session.getStartedAt());
    }

    @Transactional
    public void saveBaseline(String sessionId, BaselineRequest request) {
        MonitorSession session = requireOpenSession(sessionId);
        session.setBaselineYaw(request.yaw());
        session.setBaselinePitch(request.pitch());
        session.setBaselineRoll(request.roll());
        sessionRepository.save(session);
    }

    @Transactional
    public void close(String sessionId) {
        MonitorSession session = requireSession(sessionId);
        if (!session.isClosed()) {
            session.setEndedAt(Instant.now());
            sessionRepository.save(session);
        }
    }

    @Transactional(readOnly = true)
    public MonitorSession requireSession(String sessionId) {
        return sessionRepository.findById(sessionId)
                .orElseThrow(() -> new NoSuchElementException("会话不存在: " + sessionId));
    }

    @Transactional(readOnly = true)
    public MonitorSession requireOpenSession(String sessionId) {
        MonitorSession session = requireSession(sessionId);
        if (session.isClosed()) {
            throw new IllegalStateException("会话已结束: " + sessionId);
        }
        return session;
    }

    @Transactional
    public void updateFocusRatio(String sessionId, double focusRatio) {
        MonitorSession session = requireSession(sessionId);
        session.setFocusRatio(focusRatio);
        sessionRepository.save(session);
    }
}