package com.mindflow.service;

import com.mindflow.dto.TrainingReviewRequest;
import com.mindflow.dto.TrainingReviewResponse;
import com.mindflow.entity.LlmSetting;
import jakarta.annotation.Resource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class TrainingReviewService {

    private static final Logger log = LoggerFactory.getLogger(TrainingReviewService.class);

    private static final String SYSTEM_PROMPT = String.join("\n",
            "你是办公族颈部活动训练的助理。",
            "根据一组 90 秒训练数据，用两句话给出点评和一条具体建议。",
            "要求：总共不超过 80 字；不诊断疾病；不承诺疗效；建议只涉及动作层面（幅度、速度、左右对称、时长）。",
            "只输出正文，不要列表、不要 markdown、不要引号。");

    @Resource
    private LlmSettingService settingService;

    @Resource
    private LlmAnalysisService llmAnalysisService;

    public TrainingReviewResponse review(TrainingReviewRequest request) {
        String fallback = template(request);
        try {
            LlmSetting setting = settingService.effective();
            String apiKey = setting.getApiKey();
            if (apiKey == null || apiKey.isBlank()) {
                return new TrainingReviewResponse(fallback, "template");
            }
            String reply = llmAnalysisService.complete(
                    SYSTEM_PROMPT, buildUserPrompt(request), 220, 6_000);
            String cleaned = clean(reply);
            if (cleaned.isBlank()) {
                return new TrainingReviewResponse(fallback, "template");
            }
            return new TrainingReviewResponse(cleaned, "ai");
        } catch (Exception exception) {
            log.warn("AI 组末点评失败，回退模板: {}", exception.getMessage());
            return new TrainingReviewResponse(fallback, "template");
        }
    }

    private String buildUserPrompt(TrainingReviewRequest request) {
        int total = request.left() + request.right();
        int diff = Math.abs(request.left() - request.right());
        int diffPercent = total == 0 ? 0 : Math.round(diff * 100f / total);
        return "本组数据："
                + "向左转头 " + request.left() + " 次，峰值 " + Math.round(request.leftPeak()) + " 度；"
                + "向右转头 " + request.right() + " 次，峰值 " + Math.round(request.rightPeak()) + " 度；"
                + "动作到位 " + request.standard() + " 次，漏掉 " + request.missed() + " 条；"
                + "左右差值占比 " + diffPercent + "%。";
    }

    private String template(TrainingReviewRequest request) {
        int total = request.left() + request.right();
        if (total == 0) {
            return "本组没有完成动作。下一组先坐直，再跟着鱼的方向慢慢转头。";
        }
        int diff = Math.abs(request.left() - request.right());
        if ((double) diff / total > 0.2) {
            String weak = request.left() > request.right() ? "右侧" : "左侧";
            int gap = diff;
            return "本组" + weak + "比另一侧少 " + gap + " 次。下一组先做 3 次慢速"
                    + weak + "转头，把幅度做满再回正。";
        }
        if (request.missed() > request.standard()) {
            return "本组漏掉的鱼偏多。下一组把转头速度放慢一点，到位再张嘴。";
        }
        return "本组左右配平、节奏稳定。保持这个幅度，下一组继续匀速转头即可。";
    }

    private String clean(String reply) {
        if (reply == null) {
            return "";
        }
        String text = reply.replaceAll("[\\r\\n]+", " ").replaceAll("\\s{2,}", " ").trim();
        if (text.length() > 140) {
            text = text.substring(0, 140);
        }
        return text;
    }
}