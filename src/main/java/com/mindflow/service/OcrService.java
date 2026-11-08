package com.mindflow.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.nio.file.Path;
import java.util.Base64;

@Service
public class OcrService {

    private static final Logger log = LoggerFactory.getLogger(OcrService.class);

    @Value("${mindflow.ocr.enabled:false}")
    private boolean enabled;

    @Value("${mindflow.ocr.endpoint:}")
    private String endpoint;

    @Value("${mindflow.ocr.region:cn-north-4}")
    private String region;

    @Value("${mindflow.ocr.project-id:}")
    private String projectId;

    @Value("${mindflow.ocr.ak:}")
    private String ak;

    @Value("${mindflow.ocr.sk:}")
    private String sk;

    @Value("${mindflow.ocr.max-pages:10}")
    private int maxPages;

    @Value("${mindflow.ocr.dpi:150}")
    private int dpi;

    public boolean isConfigured() {
        return enabled && notBlank(ak) && notBlank(sk) && notBlank(projectId);
    }

    public String tryRecognize(Path pdfPath) {
        if (!isConfigured()) {
            return "";
        }
        try {
            return recognize(pdfPath);
        } catch (Exception exception) {
            log.warn("OCR 识别失败，回退为空文本: {}", exception.getMessage());
            return "";
        }
    }

    private String recognize(Path pdfPath) throws IOException {
        try (PDDocument pdf = PDDocument.load(pdfPath.toFile())) {
            if (pdf.isEncrypted()) {
                return "";
            }
            int pages = Math.min(pdf.getNumberOfPages(), Math.max(1, maxPages));
            PDFRenderer renderer = new PDFRenderer(pdf);
            StringBuilder text = new StringBuilder();
            for (int page = 0; page < pages; page++) {
                BufferedImage image = renderer.renderImageWithDPI(page, Math.max(72, dpi));
                String pageText = recognizePage(image);
                if (!pageText.isBlank()) {
                    text.append(pageText).append('\n');
                }
            }
            return text.toString().trim();
        }
    }

    private String recognizePage(BufferedImage image) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        ImageIO.write(image, "png", buffer);
        String body = "{\"image\":\""
                + Base64.getEncoder().encodeToString(buffer.toByteArray())
                + "\"}";

        URI uri = URI.create(ocrUrl());
        HuaweiCloudSigner.Signed signed = HuaweiCloudSigner.sign(ak, sk, "POST", uri, body);

        JsonNode response = RestClient.create().post()
                .uri(uri)
                .header(HttpHeaders.AUTHORIZATION, signed.authorization())
                .header("X-Sdk-Date", signed.sdkDate())
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(JsonNode.class);

        if (response == null) {
            return "";
        }
        return response.path("result").path("text").asText("").trim();
    }

    private String ocrUrl() {
        String base = notBlank(endpoint)
                ? endpoint.trim()
                : "https://ocr." + region.trim() + ".myhuaweicloud.com";
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return base + "/v2/" + projectId.trim() + "/ocr/general-text";
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }
}