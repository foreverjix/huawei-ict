package com.mindflow.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicLong;

@Entity
@Table(name = "llm_setting")
public class LlmSetting {

    private static final AtomicLong ID_SEQ = new AtomicLong(System.currentTimeMillis());

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private Long id;

    public static long nextId() {
        return ID_SEQ.incrementAndGet();
    }

    @Column(name = "visitor_id", length = 36, unique = true)
    private String visitorId;

    @Column(name = "base_url", length = 300, nullable = false)
    private String baseUrl;

    @Lob
    @Column(name = "api_key")
    private String apiKey;

    @Column(name = "model", length = 120, nullable = false)
    private String model;

    @Column(name = "skill_code", length = 40)
    private String skillCode;

    @Lob
    @Column(name = "custom_prompt")
    private String customPrompt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getVisitorId() {
        return visitorId;
    }

    public void setVisitorId(String visitorId) {
        this.visitorId = visitorId;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getSkillCode() {
        return skillCode;
    }

    public void setSkillCode(String skillCode) {
        this.skillCode = skillCode;
    }

    public String getCustomPrompt() {
        return customPrompt;
    }

    public void setCustomPrompt(String customPrompt) {
        this.customPrompt = customPrompt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}