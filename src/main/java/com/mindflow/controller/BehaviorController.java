package com.mindflow.controller;

import com.mindflow.dto.BehaviorEventDto;
import com.mindflow.dto.EventIngestResult;
import com.mindflow.service.BehaviorEventService;
import jakarta.annotation.Resource;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Validated
@RestController
@RequestMapping("/api/v1/sessions/{sessionId}/events")
public class BehaviorController {

    @Resource
    private BehaviorEventService eventService;

    @PostMapping
    public EventIngestResult ingest(@PathVariable String sessionId,
                                    @RequestBody @NotEmpty List<@Valid BehaviorEventDto> events) {
        return eventService.ingest(sessionId, events);
    }
}