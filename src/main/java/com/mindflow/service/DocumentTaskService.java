package com.mindflow.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mindflow.dto.DocumentTaskContentDto;
import com.mindflow.dto.DocumentTaskItem;
import com.mindflow.dto.DocumentTaskListDto;
import com.mindflow.entity.DocumentTask;
import com.mindflow.entity.LlmSetting;
import com.mindflow.entity.MindflowDocument;
import com.mindflow.repository.DocumentTaskRepository;
import com.mindflow.repository.MindflowDocumentRepository;
import com.mindflow.web.VisitorContext;
import jakarta.annotation.Resource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.UUID;

@Service
public class DocumentTaskService {

    private static final Logger log = LoggerFactory.getLogger(DocumentTaskService.class);

    private static final int CHARS_PER_TASK = 600;
    private static final int MAX_TASKS = 6;

    private static final Set<String> STOP_WORDS = Set.of(
            "这个", "一个", "我们", "可以", "因为", "所以", "但是", "如果", "以及", "通过",
            "进行", "使用", "其中", "这些", "那些", "已经", "没有", "就是", "不是", "一种",
            "本文", "本章", "这种", "那么", "然后", "而且", "并且", "或者", "由于", "对于",
            "根据", "表示", "认为", "提出", "需要", "能够", "具有", "之间", "以后", "之后"
    );

    private static final String SYSTEM_PROMPT = String.join("\n",
            "你是阅读任务拆解助手。输入是一份文档按顺序切好的若干段落，每段给出开头片段。",
            "请为每一段起一个中文小标题（不超过 12 字）和一句说明（不超过 30 字，说明这一段要读到什么）。",
            "只输出 JSON 数组，不要 markdown、不要解释，元素顺序必须与段落顺序一致：",
            "[{\"seq\":1,\"title\":\"...\",\"summary\":\"...\"}]");

    @Resource
    private MindflowDocumentRepository documentRepository;

    @Resource
    private DocumentTaskRepository taskRepository;

    @Resource
    private LlmSettingService settingService;

    @Resource
    private LlmAnalysisService llmAnalysisService;

    @Resource
    private ObjectMapper objectMapper;

    public DocumentTaskListDto list(String documentId) {
        requireDocument(documentId);
        List<DocumentTask> tasks = taskRepository.findByDocumentIdOrderBySeqNoAsc(documentId);
        return toList(documentId, tasks, tasks.isEmpty() ? "empty" : "cached");
    }

    @Transactional
    public DocumentTaskListDto generate(String documentId) {
        MindflowDocument document = requireDocument(documentId);
        List<DocumentTask> existing = taskRepository.findByDocumentIdOrderBySeqNoAsc(documentId);
        if (!existing.isEmpty()) {
            return toList(documentId, existing, "cached");
        }

        String text = document.getTextContent();
        if (text == null || text.isBlank()) {
            throw new IllegalStateException("该文档没有可阅读的文本");
        }

        List<int[]> ranges = splitRanges(text);
        List<String> titles = new ArrayList<>();
        List<String> summaries = new ArrayList<>();
        boolean ai = fillTitles(text, ranges, titles, summaries);

        Instant now = Instant.now();
        List<DocumentTask> tasks = new ArrayList<>(ranges.size());
        for (int index = 0; index < ranges.size(); index++) {
            int[] range = ranges.get(index);
            DocumentTask task = new DocumentTask();
            task.setId(UUID.randomUUID().toString());
            task.setDocumentId(documentId);
            task.setSeqNo(index + 1);
            task.setTitle(titles.get(index));
            task.setSummary(summaries.get(index));
            task.setKeywords(String.join(",", extractKeywords(text, range[0], range[1])));
            task.setStartOffset(range[0]);
            task.setEndOffset(range[1]);
            task.setStatus(index == 0 ? "READY" : "LOCKED");
            task.setCreatedAt(now);
            tasks.add(task);
        }
        taskRepository.saveAll(tasks);
        return toList(documentId, tasks, ai ? "ai" : "default");
    }

    @Transactional
    public DocumentTaskListDto complete(String documentId, String taskId) {
        requireDocument(documentId);
        List<DocumentTask> tasks = taskRepository.findByDocumentIdOrderBySeqNoAsc(documentId);
        DocumentTask target = tasks.stream()
                .filter(task -> task.getId().equals(taskId))
                .findFirst()
                .orElseThrow(() -> new NoSuchElementException("任务不存在: " + taskId));

        // 读完只是进入「待收集」，要到下潜里把这一段的关键词收齐才算完成
        if ("READY".equals(target.getStatus())) {
            target.setStatus("COLLECTING");
            target.setCompletedAt(Instant.now());
            taskRepository.save(target);
        }
        return toList(documentId, taskRepository.findByDocumentIdOrderBySeqNoAsc(documentId), "cached");
    }

    @Transactional
    public DocumentTaskListDto collect(String documentId, String taskId) {
        requireDocument(documentId);
        List<DocumentTask> tasks = taskRepository.findByDocumentIdOrderBySeqNoAsc(documentId);
        DocumentTask target = tasks.stream()
                .filter(task -> task.getId().equals(taskId))
                .findFirst()
                .orElseThrow(() -> new NoSuchElementException("任务不存在: " + taskId));

        if ("COLLECTING".equals(target.getStatus())) {
            target.setStatus("DONE");
            taskRepository.save(target);
            unlockNext(tasks, target.getSeqNo());
        }
        return toList(documentId, taskRepository.findByDocumentIdOrderBySeqNoAsc(documentId), "cached");
    }

    public DocumentTaskContentDto content(String documentId, String taskId) {
        MindflowDocument document = requireDocument(documentId);
        DocumentTask task = taskRepository.findByDocumentIdAndId(documentId, taskId)
                .orElseThrow(() -> new NoSuchElementException("任务不存在: " + taskId));
        if ("LOCKED".equals(task.getStatus())) {
            throw new IllegalStateException("这一段还没有解锁");
        }
        String text = document.getTextContent() == null ? "" : document.getTextContent();
        int start = Math.min(Math.max(0, task.getStartOffset()), text.length());
        int end = Math.min(Math.max(start, task.getEndOffset()), text.length());
        return new DocumentTaskContentDto(
                task.getId(),
                task.getSeqNo(),
                task.getTitle(),
                task.getSummary(),
                task.getStatus(),
                text.substring(start, end),
                parseKeywords(task.getKeywords()));
    }

    private void unlockNext(List<DocumentTask> tasks, int currentSeq) {
        for (DocumentTask task : tasks) {
            if (task.getSeqNo() == currentSeq + 1 && "LOCKED".equals(task.getStatus())) {
                task.setStatus("READY");
                taskRepository.save(task);
                return;
            }
        }
    }

    private boolean fillTitles(String text, List<int[]> ranges, List<String> titles, List<String> summaries) {
        try {
            LlmSetting setting = settingService.effective();
            String apiKey = setting.getApiKey();
            if (apiKey == null || apiKey.isBlank()) {
                fallbackTitles(text, ranges, titles, summaries);
                return false;
            }
            String reply = llmAnalysisService.complete(
                    SYSTEM_PROMPT, buildUserPrompt(text, ranges), 500, 12_000);
            return parseTitles(reply, ranges.size(), titles, summaries);
        } catch (Exception exception) {
            log.warn("AI 任务标题生成失败，回退默认标题: {}", exception.getMessage());
            fallbackTitles(text, ranges, titles, summaries);
            return false;
        }
    }

    private String buildUserPrompt(String text, List<int[]> ranges) {
        StringBuilder builder = new StringBuilder();
        for (int index = 0; index < ranges.size(); index++) {
            int[] range = ranges.get(index);
            int end = Math.min(range[1], range[0] + 200);
            builder.append("【第 ").append(index + 1).append(" 段】")
                    .append(text, range[0], end)
                    .append('\n');
        }
        return builder.toString();
    }

    private boolean parseTitles(String reply, int expected, List<String> titles, List<String> summaries) {
        if (reply == null) {
            return false;
        }
        int start = reply.indexOf('[');
        int end = reply.lastIndexOf(']');
        if (start < 0 || end <= start) {
            return false;
        }
        try {
            JsonNode root = objectMapper.readTree(reply.substring(start, end + 1));
            if (!root.isArray() || root.size() < expected) {
                return false;
            }
            for (int index = 0; index < expected; index++) {
                JsonNode node = root.path(index);
                String title = node.path("title").asText("").trim();
                String summary = node.path("summary").asText("").trim();
                titles.add(limit(title, 12, "第 " + (index + 1) + " 段"));
                summaries.add(limit(summary, 30, ""));
            }
            return true;
        } catch (Exception exception) {
            return false;
        }
    }

    private void fallbackTitles(String text, List<int[]> ranges, List<String> titles, List<String> summaries) {
        for (int index = 0; index < ranges.size(); index++) {
            int[] range = ranges.get(index);
            String snippet = text.substring(range[0], Math.min(range[1], range[0] + 80))
                    .replaceAll("\\s+", " ")
                    .trim();
            titles.add("第 " + (index + 1) + " 段");
            summaries.add(limit(snippet, 30, ""));
        }
    }

    private String limit(String value, int maxLength, String fallback) {
        String text = value == null ? "" : value.trim();
        if (text.isEmpty()) {
            return fallback;
        }
        return text.length() > maxLength ? text.substring(0, maxLength) : text;
    }

    private List<String> parseKeywords(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        List<String> words = new ArrayList<>();
        for (String part : value.split(",")) {
            String word = part.trim();
            if (!word.isEmpty()) {
                words.add(word);
            }
        }
        return words;
    }

    private List<String> extractKeywords(String text, int start, int end) {
        int limit = Math.min(end, start + 600);
        if (start >= text.length() || limit <= start) {
            return List.of();
        }

        String segment = text.substring(start, limit).replaceAll("[\\s\\p{Punct}]+", " ");
        Map<String, Integer> freq = new LinkedHashMap<>();
        for (int length = 2; length <= 4; length++) {
            for (int index = 0; index + length <= segment.length(); index++) {
                String word = segment.substring(index, index + length);
                if (!word.matches("[\\u4e00-\\u9fa5]{" + length + "}")) {
                    continue;
                }
                if (STOP_WORDS.contains(word)) {
                    continue;
                }
                freq.merge(word, 1, Integer::sum);
            }
        }

        List<String> candidates = new ArrayList<>();
        freq.forEach((word, count) -> {
            if (count >= 2) {
                candidates.add(word);
            }
        });
        candidates.sort((left, right) -> {
            int diff = freq.get(right) - freq.get(left);
            return diff != 0 ? diff : left.length() - right.length();
        });

        List<String> picked = new ArrayList<>();
        for (String candidate : candidates) {
            boolean covered = picked.stream().anyMatch(existing -> existing.contains(candidate));
            if (covered) {
                continue;
            }
            picked.add(candidate);
            if (picked.size() >= 3) {
                break;
            }
        }

        if (picked.size() < 3) {
            String head = segment.trim();
            if (!head.isEmpty()) {
                String fallback = head.length() > 12 ? head.substring(0, 12).trim() : head;
                if (!fallback.isEmpty() && picked.stream().noneMatch(existing -> existing.contains(fallback))) {
                    picked.add(fallback);
                }
            }
        }

        return picked.size() > 3 ? new ArrayList<>(picked.subList(0, 3)) : picked;
    }

    private List<int[]> splitRanges(String text) {
        int length = text.length();
        int count = Math.max(1, Math.min(MAX_TASKS, (int) Math.ceil((double) length / CHARS_PER_TASK)));
        List<int[]> ranges = new ArrayList<>(count);
        int start = 0;
        for (int index = 0; index < count; index++) {
            int remain = count - index;
            if (remain == 1) {
                ranges.add(new int[]{start, length});
                break;
            }
            int target = start + (length - start) / remain;
            int end = findBreak(text, target, start, length);
            if (end <= start) {
                end = Math.min(length, start + CHARS_PER_TASK);
            }
            ranges.add(new int[]{start, end});
            start = end;
        }
        return ranges;
    }

    private int findBreak(String text, int target, int start, int length) {
        int window = 240;
        for (int delta = 0; delta <= window; delta++) {
            int pos = target + delta;
            if (pos > start && pos < length && text.charAt(pos - 1) == '\n') {
                return pos;
            }
        }
        for (int delta = 1; delta <= window; delta++) {
            int pos = target - delta;
            if (pos > start && pos < length && text.charAt(pos - 1) == '\n') {
                return pos;
            }
        }
        for (int delta = 0; delta <= window; delta++) {
            int pos = target + delta;
            if (pos > start && pos < length && "。！？；".indexOf(text.charAt(pos - 1)) >= 0) {
                return pos;
            }
        }
        return target;
    }

    private MindflowDocument requireDocument(String documentId) {
        return documentRepository.findByIdAndOwnerId(documentId, VisitorContext.require())
                .orElseThrow(() -> new NoSuchElementException("文档不存在: " + documentId));
    }

    private DocumentTaskListDto toList(String documentId, List<DocumentTask> tasks, String source) {
        List<DocumentTaskItem> items = tasks.stream()
                .map(task -> new DocumentTaskItem(
                        task.getId(),
                        task.getSeqNo(),
                        task.getTitle(),
                        task.getSummary(),
                        Math.max(0, task.getEndOffset() - task.getStartOffset()),
                        task.getStatus(),
                        task.getCompletedAt(),
                        parseKeywords(task.getKeywords())))
                .toList();
        int completed = (int) tasks.stream().filter(task -> "DONE".equals(task.getStatus())).count();
        return new DocumentTaskListDto(documentId, items.size(), completed, source, items);
    }
}