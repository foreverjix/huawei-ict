package com.mindflow.web;

/**
 * 当前请求携带的模型 API Key。只用于本次请求，不落库、不持久化。
 */
public final class LlmKeyContext {

    private static final ThreadLocal<String> CURRENT = new ThreadLocal<>();

    private LlmKeyContext() {
    }

    public static void set(String apiKey) {
        CURRENT.set(apiKey);
    }

    public static String get() {
        return CURRENT.get();
    }

    public static void clear() {
        CURRENT.remove();
    }
}