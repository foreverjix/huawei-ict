package com.mindflow.dto;

public record LlmTestResult(boolean ok, String model, String message, long durationMs) {
}