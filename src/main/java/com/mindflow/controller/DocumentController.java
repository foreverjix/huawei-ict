package com.mindflow.controller;

import com.mindflow.dto.AnalysisRequest;
import com.mindflow.dto.AnalysisResult;
import com.mindflow.dto.DocumentDto;
import com.mindflow.service.DocumentService;
import jakarta.annotation.Resource;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/v1/documents")
public class DocumentController {

    @Resource
    private DocumentService documentService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public DocumentDto upload(@RequestParam("file") MultipartFile file) {
        return documentService.store(file);
    }

    @GetMapping
    public List<DocumentDto> list() {
        return documentService.list();
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable String id) {
        documentService.delete(id);
    }

    @PostMapping("/{id}/analysis")
    public AnalysisResult analyze(@PathVariable String id,
                                  @RequestBody(required = false) AnalysisRequest request) {
        return documentService.analyze(id, request);
    }

    @GetMapping("/{id}/analysis")
    public List<AnalysisResult> history(@PathVariable String id) {
        return documentService.history(id);
    }
}