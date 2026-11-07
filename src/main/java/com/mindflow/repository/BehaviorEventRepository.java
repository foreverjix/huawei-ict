package com.mindflow.repository;

import com.mindflow.entity.BehaviorEvent;
import com.mindflow.entity.BehaviorEventType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BehaviorEventRepository extends JpaRepository<BehaviorEvent, Long> {

    List<BehaviorEvent> findAllBySessionIdOrderByStartedAtAsc(String sessionId);

    boolean existsBySessionIdAndClientEventId(String sessionId, String clientEventId);

    long countBySessionIdAndType(String sessionId, BehaviorEventType type);

    void deleteAllBySessionId(String sessionId);
}