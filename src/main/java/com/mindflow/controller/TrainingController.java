package com.mindflow.controller;

import com.mindflow.dto.TrainingPlanRequest;
import com.mindflow.dto.TrainingPlanResponse;
import com.mindflow.dto.TrainingReviewRequest;
import com.mindflow.dto.TrainingReviewResponse;
import com.mindflow.service.TrainingPlanService;
import com.mindflow.service.TrainingReviewService;
import jakarta.annotation.Resource;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/training")
public class TrainingController {

    @Resource
    private TrainingReviewService reviewService;

    @Resource
    private TrainingPlanService planService;

    @PostMapping("/review")
    public TrainingReviewResponse review(@Valid @RequestBody TrainingReviewRequest request) {
        return reviewService.review(request);
    }

    @PostMapping("/plan")
    public TrainingPlanResponse plan(@Valid @RequestBody(required = false) TrainingPlanRequest request) {
        return planService.plan(request == null ? TrainingPlanRequest.empty() : request);
    }
}