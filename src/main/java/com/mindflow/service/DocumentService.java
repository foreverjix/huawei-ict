package com.mindflow.service;

import com.mindflow.dto.AnalysisRequest;
import com.mindflow.dto.AnalysisResult;
import com.mindflow.dto.DocumentDto;
import com.mindflow.entity.DocumentAnalysis;
import com.mindflow.entity.MindflowDocument;
import com.mindflow.repository.DocumentAnalysisRepository;
import com.mindflow.repository.DocumentTaskRepository;
import com.mindflow.repository.MindflowDocumentRepository;
import com.mindflow.web.VisitorContext;
import jakarta.annotation.Resource;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.UUID;

@Service
public class DocumentService {

    private static final Set<String> ALLOWED = Set.of("pdf", "txt", "md", "csv", "json");
    private static final long MAX_BYTES = 25L * 1024 * 1024;
    private static final int MAX_TEXT_CHARS = 200_000;
    private static final Map<String, Integer> FRAGMENT_LIMITS = Map.of(
            "summary", 4,
            "paper_review", 5,
            "key_points", 7,
            "terms", 10
    );

    @Resource
    private MindflowDocumentRepository documentRepository;

    @Resource
    private DocumentAnalysisRepository analysisRepository;

    @Resource
    private FileStorageService fileStorageService;

    @Resource
    private LlmAnalysisService llmAnalysisService;

    @Resource
    private OcrService ocrService;

    @Resource
    private DocumentTaskRepository taskRepository;

    public DocumentDto store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("请选择要上传的文件");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException("文件超过 25MB 上限");
        }

        String originalName = sanitizeName(file.getOriginalFilename());
        if (originalName.isBlank()) {
            throw new IllegalArgumentException("文件名无效");
        }

        String extension = extensionOf(originalName);
        if (!ALLOWED.contains(extension)) {
            throw new IllegalArgumentException("仅支持 PDF / TXT / MD / CSV / JSON 文件");
        }
        if ("pdf".equals(extension) && !looksLikePdf(file)) {
            throw new IllegalArgumentException("文件内容不是有效的 PDF");
        }

        String id = UUID.randomUUID().toString();
        String storedName = id + "." + extension;
        Path path = fileStorageService.store(file, storedName);

        String text = extractText(path, extension);
        if (text == null) {
            text = "";
        }
        text = text.trim();
        if (text.length() > MAX_TEXT_CHARS) {
            text = text.substring(0, MAX_TEXT_CHARS);
        }

        MindflowDocument document = new MindflowDocument();
        document.setId(id);
        document.setOwnerId(VisitorContext.require());
        document.setOriginalName(originalName);
        document.setStoredName(storedName);
        document.setContentType(file.getContentType());
        document.setSizeBytes(file.getSize());
        document.setSha256(sha256(path));
        document.setStoragePath(path.toAbsolutePath().toString());
        document.setTextContent(text);
        document.setTextChars(text.length());
        document.setStatus(text.isEmpty() ? "TEXT_UNAVAILABLE" : "READY");
        document.setUploadedAt(Instant.now());
        documentRepository.save(document);

        return toDto(document);
    }

    public List<DocumentDto> list() {
        return documentRepository.findByOwnerIdOrderByUploadedAtDesc(VisitorContext.require())
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Transactional
    public void delete(String id) {
        MindflowDocument document = require(id, VisitorContext.require());
        fileStorageService.delete(document.getStoragePath());
        taskRepository.deleteByDocumentId(id);
        analysisRepository.deleteByDocumentId(id);
        documentRepository.delete(document);
    }

    public AnalysisResult analyze(String id, AnalysisRequest request) {
        MindflowDocument document = require(id, VisitorContext.require());
        if (document.getTextChars() <= 0 || document.getTextContent() == null
                || document.getTextContent().isBlank()) {
            throw new IllegalStateException("该文档没有提取到文本，可能是扫描版 PDF 或不支持的内容");
        }

        String skillCode = request == null ? null : request.skillCode();
        String prompt = request == null ? null : request.prompt();

        LlmAnalysisService.Outcome outcome;
        try {
            outcome = llmAnalysisService.analyze(
                    document.getOriginalName(),
                    document.getTextContent(),
                    skillCode,
                    prompt
            );
        } catch (RuntimeException exception) {
            // 模型不可用时静默降级为本地分段，保证「分析 → 弹窗 → 下潜收集」链路不断
            outcome = localOutcome(document, skillCode);
        }

        DocumentAnalysis analysis = new DocumentAnalysis();
        analysis.setId(UUID.randomUUID().toString());
        analysis.setDocumentId(document.getId());
        analysis.setSkillCode(outcome.skillCode());
        analysis.setSkillName(outcome.skillName());
        analysis.setModel(outcome.model());
        analysis.setResultText(outcome.result());
        analysis.setDurationMs(outcome.durationMs());
        analysis.setCreatedAt(Instant.now());
        analysisRepository.save(analysis);

        return toResult(analysis);
    }

    private LlmAnalysisService.Outcome localOutcome(MindflowDocument document, String skillCode) {
        long startedAt = System.currentTimeMillis();
        String code = skillCode == null || skillCode.isBlank() ? "summary" : skillCode;
        int limit = FRAGMENT_LIMITS.getOrDefault(code, 6);
        List<String> blocks = splitLocalText(document.getTextContent(), limit);

        StringBuilder builder = new StringBuilder();
        for (int index = 0; index < blocks.size(); index++) {
            builder.append("**第 ").append(index + 1).append(" 段**\n");
            builder.append(blocks.get(index)).append("\n\n");
        }

        return new LlmAnalysisService.Outcome(
                code,
                "本地分段",
                "local",
                builder.toString().trim(),
                System.currentTimeMillis() - startedAt
        );
    }

    private List<String> splitLocalText(String text, int limit) {
        String normalized = text.replace("\r", "").trim();
        List<String> units = new ArrayList<>();
        for (String paragraph : normalized.split("\\n{2,}")) {
            String clean = paragraph.replaceAll("\\s+", " ").trim();
            if (clean.isEmpty()) {
                continue;
            }
            if (clean.length() > 220) {
                for (String sentence : clean.split("(?<=[。！？.!?；;])")) {
                    String piece = sentence.trim();
                    if (!piece.isEmpty()) {
                        units.add(piece);
                    }
                }
            } else {
                units.add(clean);
            }
        }
        if (units.isEmpty()) {
            units.add(normalized);
        }

        int per = Math.max(1, (int) Math.ceil((double) units.size() / limit));
        List<String> blocks = new ArrayList<>();
        for (int start = 0; start < units.size() && blocks.size() < limit; start += per) {
            StringBuilder block = new StringBuilder();
            for (int cursor = start; cursor < Math.min(units.size(), start + per); cursor++) {
                if (block.length() > 190) {
                    break;
                }
                if (block.length() > 0) {
                    block.append(' ');
                }
                block.append(units.get(cursor));
            }
            blocks.add(block.toString());
        }
        if (blocks.isEmpty()) {
            blocks.add(normalized.length() > 200 ? normalized.substring(0, 200) : normalized);
        }
        return blocks;
    }

    public List<AnalysisResult> history(String id) {
        require(id, VisitorContext.require());
        return analysisRepository.findByDocumentIdOrderByCreatedAtDesc(id)
                .stream()
                .map(this::toResult)
                .toList();
    }

    private MindflowDocument require(String id, String ownerId) {
        return documentRepository.findByIdAndOwnerId(id, ownerId)
                .orElseThrow(() -> new NoSuchElementException("文档不存在: " + id));
    }

    private DocumentDto toDto(MindflowDocument document) {
        return new DocumentDto(
                document.getId(),
                document.getOriginalName(),
                document.getContentType(),
                document.getSizeBytes(),
                document.getTextChars(),
                document.getStatus(),
                document.getUploadedAt(),
                document.getTextChars() > 0
        );
    }

    private AnalysisResult toResult(DocumentAnalysis analysis) {
        return new AnalysisResult(
                analysis.getId(),
                analysis.getDocumentId(),
                analysis.getSkillCode(),
                analysis.getSkillName(),
                analysis.getModel(),
                analysis.getResultText(),
                analysis.getDurationMs(),
                analysis.getCreatedAt()
        );
    }

    private String extractText(Path path, String extension) {
        if ("pdf".equals(extension)) {
            String embedded = extractPdfText(path);
            if (embedded != null && !embedded.isBlank()) {
                return embedded;
            }
            return ocrService.tryRecognize(path);
        }
        try {
            byte[] bytes = Files.readAllBytes(path);
            String text = new String(bytes, StandardCharsets.UTF_8);
            return text.indexOf('\u0000') >= 0 ? "" : text;
        } catch (IOException exception) {
            return "";
        }
    }

    private String extractPdfText(Path path) {
        try (PDDocument pdf = PDDocument.load(path.toFile())) {
            return new PDFTextStripper().getText(pdf);
        } catch (IOException exception) {
            return "";
        }
    }

    private String sha256(Path path) {
        try {
            byte[] bytes = Files.readAllBytes(path);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(bytes));
        } catch (IOException | NoSuchAlgorithmException exception) {
            return null;
        }
    }

    private boolean looksLikePdf(MultipartFile file) {
        try (InputStream input = file.getInputStream()) {
            byte[] head = input.readNBytes(4);
            return head.length == 4
                    && head[0] == '%'
                    && head[1] == 'P'
                    && head[2] == 'D'
                    && head[3] == 'F';
        } catch (IOException exception) {
            return false;
        }
    }

    private String sanitizeName(String rawName) {
        String name = rawName == null ? "" : rawName;
        name = name.replace('\\', '/');
        int slash = name.lastIndexOf('/');
        if (slash >= 0) {
            name = name.substring(slash + 1);
        }
        name = name.replace('\r', ' ')
                .replace('\n', ' ')
                .replace('\t', ' ')
                .replace('\u0000', ' ')
                .trim();
        if (name.length() > 255) {
            String extension = extensionOf(name);
            int keep = Math.max(1, 240 - extension.length());
            name = name.substring(0, keep) + "." + extension;
        }
        return name;
    }

    private String extensionOf(String name) {
        int dot = name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) {
            return "";
        }
        return name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
}