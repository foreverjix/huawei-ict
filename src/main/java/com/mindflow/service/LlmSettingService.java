package com.mindflow.service;

import com.mindflow.dto.LlmSettingsDto;
import com.mindflow.dto.LlmSettingsRequest;
import com.mindflow.entity.LlmSetting;
import com.mindflow.repository.LlmSettingRepository;
import com.mindflow.web.LlmKeyContext;
import com.mindflow.web.VisitorContext;
import jakarta.annotation.Resource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class LlmSettingService {

    @Value("${mindflow.llm.default-base-url:https://api.deepseek.com/v1}")
    private String defaultBaseUrl;

    @Value("${mindflow.llm.default-model:deepseek-chat}")
    private String defaultModel;

    @Resource
    private LlmSettingRepository settingRepository;

    @Resource
    private SkillRegistry skillRegistry;

    @Transactional
    public LlmSetting getEntity() {
        String visitorId = VisitorContext.require();
        LlmSetting setting = settingRepository.findByVisitorId(visitorId).orElseGet(() -> {
            LlmSetting created = new LlmSetting();
            created.setId(LlmSetting.nextId());
            created.setVisitorId(visitorId);
            created.setBaseUrl(defaultBaseUrl);
            created.setModel(defaultModel);
            created.setSkillCode("summary");
            created.setUpdatedAt(Instant.now());
            return settingRepository.save(created);
        });
        // Key 改存浏览器本地，历史库里残留的明文一律抹掉
        if (setting.getApiKey() != null) {
            setting.setApiKey(null);
            setting.setUpdatedAt(Instant.now());
            settingRepository.save(setting);
        }
        return setting;
    }

    public LlmSetting effective() {
        LlmSetting source = getEntity();
        LlmSetting copy = new LlmSetting();
        copy.setId(source.getId());
        copy.setVisitorId(source.getVisitorId());
        copy.setBaseUrl(firstNonBlank(source.getBaseUrl(), defaultBaseUrl));
        copy.setModel(firstNonBlank(source.getModel(), defaultModel));
        copy.setApiKey(LlmKeyContext.get());
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

        // API Key 由浏览器本地保存，服务端不再接收、不再落库
        setting.setApiKey(null);
        setting.setUpdatedAt(Instant.now());
        settingRepository.save(setting);
        return toDto(setting);
    }

    public LlmSettingsDto toDto(LlmSetting setting) {
        String apiKey = LlmKeyContext.get();
        boolean hasApiKey = apiKey != null && !apiKey.isBlank();
        return new LlmSettingsDto(
                setting.getBaseUrl(),
                setting.getModel(),
                setting.getSkillCode(),
                setting.getCustomPrompt(),
                hasApiKey,
                null
        );
    }
}