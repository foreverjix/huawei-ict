package com.mindflow.service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;

final class HuaweiCloudSigner {

    private static final DateTimeFormatter SDK_DATE =
            DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC);

    private HuaweiCloudSigner() {
    }

    record Signed(String authorization, String sdkDate) {
    }

    static Signed sign(String ak, String sk, String method, URI uri, String body) {
        String host = uri.getHost();
        String path = uri.getRawPath() == null || uri.getRawPath().isEmpty() ? "/" : uri.getRawPath();
        String query = uri.getRawQuery() == null ? "" : uri.getRawQuery();
        String sdkDate = SDK_DATE.format(ZonedDateTime.now(ZoneOffset.UTC));

        String canonicalHeaders = "content-type:application/json\n"
                + "host:" + host + "\n"
                + "x-sdk-date:" + sdkDate + "\n";
        String signedHeaders = "content-type;host;x-sdk-date";

        String canonicalRequest = method + "\n"
                + path + "\n"
                + query + "\n"
                + canonicalHeaders + "\n"
                + signedHeaders + "\n"
                + sha256Hex(body == null ? "" : body);

        String stringToSign = "SDK-HMAC-SHA256\n" + sdkDate + "\n" + sha256Hex(canonicalRequest);
        String signature = hmacSha256Hex(sk, stringToSign);

        String authorization = "SDK-HMAC-SHA256 Access=" + ak
                + ", SignedHeaders=" + signedHeaders
                + ", Signature=" + signature;
        return new Signed(authorization, sdkDate);
    }

    private static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 不可用", exception);
        }
    }

    private static String hmacSha256Hex(String key, String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("HmacSHA256 不可用", exception);
        }
    }
}