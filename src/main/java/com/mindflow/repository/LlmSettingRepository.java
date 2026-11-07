package com.mindflow.repository;

import com.mindflow.entity.LlmSetting;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LlmSettingRepository extends JpaRepository<LlmSetting, Long> {
}