package com.mindflow.web;

/**
 * 当前请求的访客身份。由 {@link VisitorIdentityFilter} 写入，请求结束后清理。
 */
public final class VisitorContext {

    private static final ThreadLocal<String> CURRENT = new ThreadLocal<>();

    private VisitorContext() {
    }

    public static void set(String visitorId) {
        CURRENT.set(visitorId);
    }

    public static String get() {
        return CURRENT.get();
    }

    public static String require() {
        String visitorId = CURRENT.get();
        if (visitorId == null || visitorId.isBlank()) {
            throw new IllegalStateException("缺少访客身份，请刷新页面后重试");
        }
        return visitorId;
    }

    public static void clear() {
        CURRENT.remove();
    }
}