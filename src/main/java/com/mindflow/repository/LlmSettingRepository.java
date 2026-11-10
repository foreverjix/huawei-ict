package com.mindflow.repository;

import com.mindflow.entity.LlmSetting;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface LlmSettingRepository extends JpaRepository<LlmSetting, Long> {
    Optional<LlmSetting> findByVisitorId(String visitorId);
}