package com.mindflow.service;

import com.mindflow.dto.LlmSettingsDto;
import com.mindflow.dto.LlmSettingsRequest;
import com.mindflow.entity.LlmSetting;
import com.mindflow.repository.LlmSettingRepository;
import jakarta.annotation.Resource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class LlmSettingService {

    private static final long SETTING_ID = 1L;

    @Value("${mindflow.llm.default-base-url:https://api.deepseek.com/v1}")
    private String defaultBaseUrl;

    @Value("${mindflow.llm.default-model:deepseek-chat}")
    private String defaultModel;

    @Value("${MINDFLOW_LLM_API_KEY:}")
    private String envApiKey;

    @Resource
    private LlmSettingRepository settingRepository;

    @Resource
    private SkillRegistry skillRegistry;

    @Transactional
    public LlmSetting getEntity() {
        return settingRepository.findById(SETTING_ID).orElseGet(() -> {
            LlmSetting setting = new LlmSetting();
            setting.setId(SETTING_ID);
            setting.setBaseUrl(defaultBaseUrl);
            setting.setModel(defaultModel);
            setting.setSkillCode("summary");
            setting.setUpdatedAt(Instant.now());
            return settingRepository.save(setting);
        });
    }

    public LlmSetting effective() {
        LlmSetting source = getEntity();
        LlmSetting copy = new LlmSetting();
        copy.setId(source.getId());
        copy.setBaseUrl(firstNonBlank(source.getBaseUrl(), defaultBaseUrl));
        copy.setModel(firstNonBlank(source.getModel(), defaultModel));
        copy.setApiKey(firstNonBlank(source.getApiKey(), envApiKey));
        copy.setSkillCode(source.getSkillCode());
        copy.setCustomPrompt(source.getCustomPrompt());
        copy.setUpdatedAt(source.getUpdatedAt());
        return copy;
    }

    private String firstNonBlank(String value, String fallback) {
        if (value != null && !value.isBlank()) {
            return value;
        }
        return fallback;
    }

    @Transactional
    public LlmSettingsDto getDto() {
        return toDto(effective());
    }

    @Transactional
    public LlmSettingsDto update(LlmSettingsRequest request) {
        LlmSetting setting = getEntity();

        if (request.baseUrl() != null && !request.baseUrl().isBlank()) {
            String baseUrl = request.baseUrl().trim();
            UrlGuard.requireSafe(baseUrl);
            setting.setBaseUrl(baseUrl);
        }

        if (request.model() != null && !request.model().isBlank()) {
            setting.setModel(request.model().trim());
        }

        if (request.skillCode() != null && !request.skillCode().isBlank()) {
            String skillCode = request.skillCode().trim();
            if (!skillRegistry.contains(skillCode)) {
                throw new IllegalArgumentException("未知 Skill: " + skillCode);
            }
            setting.setSkillCode(skillCode);
        }

        if (request.customPrompt() != null) {
            setting.setCustomPrompt(request.customPrompt().trim());
        }

        String apiKey = request.apiKey();
        if (apiKey != null && !apiKey.isBlank()) {
            if ("__CLEAR__".equals(apiKey.trim())) {
                setting.setApiKey(null);
            } else {
                setting.setApiKey(apiKey.trim());
            }
        }

        setting.setUpdatedAt(Instant.now());
        settingRepository.save(setting);
        return toDto(setting);
    }

    public LlmSettingsDto toDto(LlmSetting setting) {
        String apiKey = setting.getApiKey();
        boolean hasApiKey = apiKey != null && !apiKey.isBlank();
        return new LlmSettingsDto(
                setting.getBaseUrl(),
                setting.getModel(),
                setting.getSkillCode(),
                setting.getCustomPrompt(),
                hasApiKey,
                hasApiKey ? mask(apiKey) : null
        );
    }

    private String mask(String apiKey) {
        if (apiKey.length() <= 8) {
            return "••••";
        }
        return "••••" + apiKey.substring(apiKey.length() - 4);
    }
}