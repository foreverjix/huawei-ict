package com.mindflow.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mindflow.dto.TrainingPlanRequest;
import com.mindflow.dto.TrainingPlanResponse;
import com.mindflow.entity.LlmSetting;
import jakarta.annotation.Resource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
public class TrainingPlanService {

    private static final Logger log = LoggerFactory.getLogger(TrainingPlanService.class);

    private static final String SYSTEM_PROMPT = String.join("\n",
            "你是办公族颈部活动训练的课程设计助理。",
            "根据用户最近的训练数据，安排一组 90 秒的三段式训练：热身 0-15 秒、主训 15-65 秒、放松 65-90 秒。",
            "只输出一个 JSON 对象，不要 markdown、不要解释。格式：",
            "{\"note\":\"一句话说明今天为什么这样安排\",\"segments\":[",
            "{\"id\":\"warmup\",\"yaw\":20,\"focus\":\"balanced\",\"spawnGapMs\":950},",
            "{\"id\":\"main\",\"yaw\":28,\"focus\":\"right\",\"spawnGapMs\":950},",
            "{\"id\":\"cool\",\"yaw\":15,\"focus\":\"balanced\",\"spawnGapMs\":950}]}",
            "约束：warmup 的 yaw 在 12-22，main 在 22-35，cool 在 10-20；",
            "focus 只能是 left、right、balanced；spawnGapMs 在 800-1300；note 不超过 40 字。");

    private static final List<TrainingPlanResponse.Segment> DEFAULTS = List.of(
            new TrainingPlanResponse.Segment("warmup", "热身", 0, 15, 20, "balanced", 950),
            new TrainingPlanResponse.Segment("main", "主训", 15, 65, 25, "balanced", 950),
            new TrainingPlanResponse.Segment("cool", "放松", 65, 90, 15, "balanced", 950));

    @Resource
    private LlmSettingService settingService;

    @Resource
    private LlmAnalysisService llmAnalysisService;

    @Resource
    private ObjectMapper objectMapper;

    private LocalDate cachedDate;
    private TrainingPlanResponse cached;

    public synchronized TrainingPlanResponse plan(TrainingPlanRequest request) {
        LocalDate today = LocalDate.now();
        if (cached != null && today.equals(cachedDate)) {
            return cached;
        }
        TrainingPlanResponse generated = generate(request);
        cached = generated;
        cachedDate = today;
        return generated;
    }

    private TrainingPlanResponse generate(TrainingPlanRequest request) {
        try {
            LlmSetting setting = settingService.effective();
            String apiKey = setting.getApiKey();
            if (apiKey == null || apiKey.isBlank()) {
                return defaultPlan("尚未配置模型，使用默认剧本");
            }
            String reply = llmAnalysisService.complete(
                    SYSTEM_PROMPT, buildUserPrompt(request), 420, 8_000);
            return parse(reply);
        } catch (Exception exception) {
            log.warn("AI 训练剧本生成失败，回退默认: {}", exception.getMessage());
            return defaultPlan("生成失败，使用默认剧本");
        }
    }

    private TrainingPlanResponse parse(String reply) throws Exception {
        if (reply == null) {
            return defaultPlan("模型未返回内容，使用默认剧本");
        }
        int start = reply.indexOf('{');
        int end = reply.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return defaultPlan("模型未返回有效 JSON，使用默认剧本");
        }
        JsonNode root = objectMapper.readTree(reply.substring(start, end + 1));

        List<TrainingPlanResponse.Segment> segments = new ArrayList<>(DEFAULTS.size());
        for (TrainingPlanResponse.Segment base : DEFAULTS) {
            segments.add(merge(root, base));
        }

        String note = root.path("note").asText("").trim();
        if (note.length() > 40) {
            note = note.substring(0, 40);
        }
        return new TrainingPlanResponse(LocalDate.now().toString(), note, segments, "ai");
    }

    private TrainingPlanResponse.Segment merge(JsonNode root, TrainingPlanResponse.Segment base) {
        JsonNode found = null;
        for (JsonNode node : root.path("segments")) {
            if (base.id().equals(node.path("id").asText())) {
                found = node;
                break;
            }
        }
        if (found == null) {
            return base;
        }
        int yaw = clamp(found.path("yaw").asInt(base.yaw()), minYaw(base.id()), maxYaw(base.id()));
        String focus = normalizeFocus(found.path("focus").asText("balanced"));
        int gap = clamp(found.path("spawnGapMs").asInt(base.spawnGapMs()), 800, 1300);
        return new TrainingPlanResponse.Segment(
                base.id(), base.label(), base.fromSec(), base.toSec(), yaw, focus, gap);
    }

    private int minYaw(String id) {
        return switch (id) {
            case "warmup" -> 12;
            case "main" -> 22;
            default -> 10;
        };
    }

    private int maxYaw(String id) {
        return switch (id) {
            case "warmup" -> 22;
            case "main" -> 35;
            default -> 20;
        };
    }

    private String normalizeFocus(String value) {
        String focus = value == null ? "" : value.trim().toLowerCase();
        if ("left".equals(focus) || "right".equals(focus)) {
            return focus;
        }
        return "balanced";
    }

    private int clamp(int value, int min, int max) {
        return Math.min(Math.max(value, min), max);
    }

    private String buildUserPrompt(TrainingPlanRequest request) {
        int total = request.left() + request.right();
        int diff = Math.abs(request.left() - request.right());
        int diffPercent = total == 0 ? 0 : Math.round(diff * 100f / total);
        return "最近五组汇总：向左 " + request.left() + " 次，向右 " + request.right() + " 次，"
                + "左峰值 " + Math.round(request.leftPeak()) + " 度，"
                + "右峰值 " + Math.round(request.rightPeak()) + " 度，"
                + "达标 " + request.standard() + " 次，漏掉 " + request.missed() + " 条，"
                + "左右差值占比 " + diffPercent + "%。";
    }

    private TrainingPlanResponse defaultPlan(String note) {
        return new TrainingPlanResponse(LocalDate.now().toString(), note, DEFAULTS, "default");
    }
}