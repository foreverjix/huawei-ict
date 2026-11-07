package com.mindflow.controller;

import com.mindflow.dto.LlmSettingsDto;
import com.mindflow.dto.LlmSettingsRequest;
import com.mindflow.dto.LlmTestResult;
import com.mindflow.dto.SkillDto;
import com.mindflow.service.LlmAnalysisService;
import com.mindflow.service.LlmSettingService;
import com.mindflow.service.SkillRegistry;
import jakarta.annotation.Resource;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class LlmController {

    @Resource
    private LlmSettingService settingService;

    @Resource
    private LlmAnalysisService analysisService;

    @Resource
    private SkillRegistry skillRegistry;

    @GetMapping("/llm/settings")
    public LlmSettingsDto settings() {
        return settingService.getDto();
    }

    @PutMapping("/llm/settings")
    public LlmSettingsDto update(@Valid @RequestBody LlmSettingsRequest request) {
        return settingService.update(request);
    }

    @PostMapping("/llm/test")
    public LlmTestResult test() {
        return analysisService.test();
    }

    @GetMapping("/skills")
    public List<SkillDto> skills() {
        return skillRegistry.list();
    }
}