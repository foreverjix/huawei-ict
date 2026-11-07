package com.mindflow.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.mindflow.dto.LlmTestResult;
import com.mindflow.entity.LlmSetting;
import jakarta.annotation.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;


import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class LlmAnalysisService {

    private static final int MAX_DOC_CHARS = 40_000;
    private static final int MAX_RESULT_TOKENS = 1600;

    @Resource
    private LlmSettingService settingService;

    @Resource
    private SkillRegistry skillRegistry;

    public record Outcome(String skillCode, String skillName, String model, String result, long durationMs) {
    }

    public Outcome analyze(String documentName, String text, String skillCode, String customPrompt) {
        LlmSetting setting = settingService.getEntity();
        requireApiKey(setting);

        String code = skillCode == null || skillCode.isBlank() ? "summary" : skillCode;
        SkillRegistry.Skill skill = skillRegistry.require(code);

        String custom = customPrompt;
        if (custom == null || custom.isBlank()) {
            custom = setting.getCustomPrompt();
        }
        if ("custom".equals(skill.code()) && (custom == null || custom.isBlank())) {
            throw new IllegalArgumentException("自定义 Skill 需要填写 Prompt");
        }

        String systemPrompt = buildSystemPrompt(skill.systemPrompt(), custom);
        String userPrompt = buildUserPrompt(documentName, text);

        long startedAt = System.currentTimeMillis();
        String result = call(setting, systemPrompt, userPrompt, MAX_RESULT_TOKENS);
        long durationMs = System.currentTimeMillis() - startedAt;
        return new Outcome(skill.code(), skill.name(), setting.getModel(), result, durationMs);
    }

    public LlmTestResult test() {
        LlmSetting setting = settingService.getEntity();
        requireApiKey(setting);

        long startedAt = System.currentTimeMillis();
        String reply = call(setting, "你是连通性测试助手。", "只回复 OK 两个字母。", 8);
        long durationMs = System.currentTimeMillis() - startedAt;
        String message = reply == null || reply.isBlank() ? "模型已响应" : "模型响应：" + reply.trim();
        return new LlmTestResult(true, setting.getModel(), message, durationMs);
    }

    private void requireApiKey(LlmSetting setting) {
        String apiKey = setting.getApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalStateException("尚未配置 API Key，请到设置页填写");
        }
    }

    private String buildSystemPrompt(String basePrompt, String customPrompt) {
        StringBuilder builder = new StringBuilder(basePrompt);
        if (customPrompt != null && !customPrompt.isBlank()) {
            builder.append("\n\n用户自定义要求：").append(customPrompt.trim());
        }
        return builder.toString();
    }

    private String buildUserPrompt(String documentName, String text) {
        String body = text == null ? "" : text;
        boolean truncated = body.length() > MAX_DOC_CHARS;
        if (truncated) {
            body = body.substring(0, MAX_DOC_CHARS);
        }
        return "【文档名】" + documentName
                + "\n【文档正文" + (truncated ? "（内容过长，已截断）" : "") + "】\n" + body;
    }

    private String call(LlmSetting setting, String systemPrompt, String userPrompt, int maxTokens) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", setting.getModel());
        payload.put("temperature", 0.2);
        payload.put("max_tokens", maxTokens);
        payload.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", userPrompt)
        ));

        try {
            JsonNode response = restClient().post()
                    .uri(endpoint(setting.getBaseUrl()))
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + setting.getApiKey())
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .body(JsonNode.class);

            if (response == null) {
                throw new IllegalStateException("模型服务返回空响应");
            }

            JsonNode choice = response.path("choices").path(0);
            JsonNode content = choice.path("message").path("content");
            String text = readContent(content);
            if (text.isBlank()) {
                String finishReason = choice.path("finish_reason").asText("");
                throw new IllegalStateException("模型返回内容为空" + (finishReason.isBlank() ? "" : "（" + finishReason + "）"));
            }
            return text;
        } catch (RestClientResponseException exception) {
            throw new IllegalStateException(describe(exception));
        } catch (ResourceAccessException exception) {
            throw new IllegalStateException("无法连接模型服务，请检查 Base URL 与网络");
        }
    }

    private String readContent(JsonNode content) {
        if (content.isArray()) {
            StringBuilder builder = new StringBuilder();
            for (JsonNode part : content) {
                builder.append(part.path("text").asText(""));
            }
            return builder.toString().trim();
        }
        return content.asText("").trim();
    }

    private RestClient restClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(120_000);
        return RestClient.builder().requestFactory(factory).build();
    }

    private String endpoint(String baseUrl) {
        String url = baseUrl == null ? "" : baseUrl.trim();
        while (url.endsWith("/")) {
            url = url.substring(0, url.length() - 1);
        }
        if (url.endsWith("/chat/completions")) {
            return url;
        }
        if (url.matches(".*/v\\d+$")) {
            return url + "/chat/completions";
        }
        return url + "/v1/chat/completions";
    }

    private String describe(RestClientResponseException exception) {
        int status = exception.getStatusCode().value();
        if (status == 401 || status == 403) {
            return "API Key 无效或无权限（HTTP " + status + "）";
        }
        if (status == 429) {
            return "模型服务限流，请稍后重试";
        }
        String body = exception.getResponseBodyAsString();
        if (body != null && body.length() > 300) {
            body = body.substring(0, 300);
        }
        return "模型服务返回 HTTP " + status + (body == null || body.isBlank() ? "" : "：" + body);
    }
}