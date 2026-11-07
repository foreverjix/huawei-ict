package com.mindflow.controller;

import com.mindflow.dto.BaselineRequest;
import com.mindflow.dto.SessionCreateResponse;
import com.mindflow.dto.SessionSummary;
import com.mindflow.service.MetricsService;
import com.mindflow.service.SessionService;
import jakarta.annotation.Resource;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/sessions")
public class SessionController {

    @Resource
    private SessionService sessionService;

    @Resource
    private MetricsService metricsService;

    @PostMapping
    public SessionCreateResponse create() {
        return sessionService.create();
    }

    @PostMapping("/{sessionId}/baseline")
    public void saveBaseline(@PathVariable String sessionId, @Valid @RequestBody BaselineRequest request) {
        sessionService.saveBaseline(sessionId, request);
    }

    @PostMapping("/{sessionId}/close")
    public void close(@PathVariable String sessionId) {
        sessionService.close(sessionId);
    }

    @GetMapping("/{sessionId}/summary")
    public SessionSummary summary(@PathVariable String sessionId) {
        return metricsService.summary(sessionId);
    }
}