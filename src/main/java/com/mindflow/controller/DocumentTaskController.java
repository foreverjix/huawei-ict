package com.mindflow.controller;

import com.mindflow.dto.DocumentTaskContentDto;
import com.mindflow.dto.DocumentTaskListDto;
import com.mindflow.service.DocumentTaskService;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/documents/{documentId}/tasks")
public class DocumentTaskController {

    @Resource
    private DocumentTaskService taskService;

    @PostMapping
    public DocumentTaskListDto generate(@PathVariable String documentId) {
        return taskService.generate(documentId);
    }

    @GetMapping
    public DocumentTaskListDto list(@PathVariable String documentId) {
        return taskService.list(documentId);
    }

    @GetMapping("/{taskId}")
    public DocumentTaskContentDto content(@PathVariable String documentId, @PathVariable String taskId) {
        return taskService.content(documentId, taskId);
    }

    @PostMapping("/{taskId}/complete")
    public DocumentTaskListDto complete(@PathVariable String documentId, @PathVariable String taskId) {
        return taskService.complete(documentId, taskId);
    }
}