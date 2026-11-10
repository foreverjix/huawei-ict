package com.mindflow.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * 没有账号体系时，用 HttpOnly Cookie 给每个浏览器分配一个不可猜测的访客 ID。
 * 文档归属这个 ID，从而实现访客之间的数据隔离。
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class VisitorIdentityFilter extends OncePerRequestFilter {

    public static final String COOKIE_NAME = "mindflow_visitor";
    public static final String LLM_KEY_HEADER = "X-Llm-Api-Key";

    private static final int MAX_AGE_SECONDS = 365 * 24 * 60 * 60;
    private static final Pattern UUID_PATTERN = Pattern.compile(
            "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String visitorId = resolveVisitor(request, response);
        String llmKey = request.getHeader(LLM_KEY_HEADER);
        VisitorContext.set(visitorId);
        LlmKeyContext.set(llmKey == null || llmKey.isBlank() ? null : llmKey.trim());
        try {
            filterChain.doFilter(request, response);
        } finally {
            VisitorContext.clear();
            LlmKeyContext.clear();
        }
    }

    private String resolveVisitor(HttpServletRequest request, HttpServletResponse response) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if (COOKIE_NAME.equals(cookie.getName())) {
                    String value = cookie.getValue();
                    if (value != null && UUID_PATTERN.matcher(value).matches()) {
                        return value;
                    }
                }
            }
        }

        String visitorId = UUID.randomUUID().toString();
        Cookie cookie = new Cookie(COOKIE_NAME, visitorId);
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge(MAX_AGE_SECONDS);
        cookie.setSecure(request.isSecure());
        cookie.setAttribute("SameSite", "Lax");
        response.addCookie(cookie);
        return visitorId;
    }
}