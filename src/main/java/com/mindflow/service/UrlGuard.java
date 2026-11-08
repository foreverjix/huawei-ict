package com.mindflow.service;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Locale;

/**
 * 校验模型服务 Base URL，阻止服务端被诱导去请求本机、内网或云元数据地址。
 */
public final class UrlGuard {

    private UrlGuard() {
    }

    public static void requireSafe(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) {
            throw new IllegalArgumentException("Base URL 不能为空");
        }
        URI uri;
        try {
            uri = URI.create(baseUrl.trim());
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Base URL 格式不正确");
        }
        String scheme = uri.getScheme();
        if (scheme == null
                || (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme))) {
            throw new IllegalArgumentException("Base URL 必须以 http:// 或 https:// 开头");
        }
        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            throw new IllegalArgumentException("Base URL 缺少主机名");
        }
        if (isBlocked(host)) {
            throw new IllegalArgumentException("Base URL 不允许指向本机或内网地址");
        }
    }

    private static boolean isBlocked(String host) {
        String name = host.toLowerCase(Locale.ROOT);
        if (name.equals("localhost") || name.endsWith(".localhost")) {
            return true;
        }
        if (name.equals("0.0.0.0") || name.equals("::") || name.equals("::1")) {
            return true;
        }
        try {
            for (InetAddress address : InetAddress.getAllByName(name)) {
                if (address.isAnyLocalAddress()
                        || address.isLoopbackAddress()
                        || address.isLinkLocalAddress()
                        || address.isSiteLocalAddress()) {
                    return true;
                }
            }
        } catch (UnknownHostException exception) {
            return false;
        }
        return false;
    }
}