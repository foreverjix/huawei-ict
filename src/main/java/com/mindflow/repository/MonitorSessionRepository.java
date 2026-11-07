package com.mindflow.repository;

import com.mindflow.entity.MonitorSession;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MonitorSessionRepository extends JpaRepository<MonitorSession, String> {
}