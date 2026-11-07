package com.mindflow.service;

import com.mindflow.dto.SkillDto;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SkillRegistry {

    public record Skill(String code, String name, String description, String systemPrompt) {
    }

    private static final String BASE_RULE =
            "通用要求：只依据用户提供的文档内容作答，不要编造；信息不足时明确说明缺少什么。使用简体中文，结构清晰。";

    private static final List<Skill> SKILLS = List.of(
            new Skill(
                    "paper_review",
                    "论文精读",
                    "提炼研究问题、方法、实验与结论，并指出局限",
                    "你是一名严谨的论文审读助手。请按「研究问题 / 方法 / 关键实验与数据 / 结论 / 局限与可疑点」五段分析论文。"
                            + "引用原文中的关键表述，不要补充文档里没有的内容。" + BASE_RULE
            ),
            new Skill(
                    "summary",
                    "结构化摘要",
                    "按背景、方法、结果、结论输出摘要",
                    "你是一名文档摘要助手。请输出「背景 / 方法或做法 / 主要结果 / 结论」四段式摘要，每段不超过 120 字。" + BASE_RULE
            ),
            new Skill(
                    "key_points",
                    "核心要点",
                    "最多 7 条要点，适合快速浏览",
                    "你是一名要点提炼助手。请给出不超过 7 条核心要点，每条一句话；必要时标注对应章节或段落位置。" + BASE_RULE
            ),
            new Skill(
                    "terms",
                    "术语解释",
                    "解释文档中的关键术语与缩写",
                    "你是一名技术术语讲解助手。请列出文档中出现的 5-10 个关键术语或缩写，逐个给出简明解释，并说明它在本文中的具体含义。" + BASE_RULE
            ),
            new Skill(
                    "critique",
                    "批判性审阅",
                    "指出假设、证据强度、局限与可改进点",
                    "你是一名批判性审阅助手。请从「隐含假设 / 证据强度 / 方法与数据问题 / 可改进方向」四方面给出审阅意见，"
                            + "区分事实与你的推断。" + BASE_RULE
            ),
            new Skill(
                    "custom",
                    "自定义 Prompt",
                    "使用设置页填写的自定义分析要求",
                    "你是一名中文文档分析助手，请严格按用户的自定义要求完成分析。" + BASE_RULE
            )
    );

    public List<SkillDto> list() {
        return SKILLS.stream()
                .map(skill -> new SkillDto(skill.code(), skill.name(), skill.description()))
                .toList();
    }

    public Skill require(String code) {
        return SKILLS.stream()
                .filter(skill -> skill.code().equals(code))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("未知 Skill: " + code));
    }

    public boolean contains(String code) {
        return SKILLS.stream().anyMatch(skill -> skill.code().equals(code));
    }
}