package com.rupiksha.aeps.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "bustto.payout")
public class PayoutProperties {
    private String baseUrl = "https://admin.bustto.com";
    private String apiKey;
    private String jwtSecret;
    private String aesKey;
    private String merchantId;
    private String merchantName;
    private String merchantEmail;
    private String payoutUrl = "/api/merchant/external/payout/";
    private String statusUrl = "/api/merchant/external/payout-status/";
    private String pennyLessUrl = "/api/merchant/external/v1/bank-verification/penny-less/";
    private String pennyDropUrl = "/api/merchant/external/v1/bank-verification/penny-drop/";
    private String verificationStatusUrl = "/api/merchant/external/v1/bank-verification/";
    private String walletBalanceUrl = "/api/merchant/external/merchant-wallet-balance/";
    private boolean enabled = true;
    // BuckBox mandates AES encryption. Set BUSTTO_ENCRYPTION_ENABLED=false ONLY for debugging.
    private boolean encryptionEnabled = true;

    public String getFullPayoutUrl() {
        return normalizeUrl(payoutUrl);
    }

    public String getFullStatusUrl(String transactionId) {
        String base = normalizeUrl(statusUrl);
        if (!base.endsWith("/")) {
            base += "/";
        }
        return base + transactionId;
    }

    public String getFullPennyLessUrl() {
        return normalizeUrl(pennyLessUrl);
    }

    public String getFullPennyDropUrl() {
        return normalizeUrl(pennyDropUrl);
    }

    public String getFullWalletBalanceUrl() {
        return normalizeUrl(walletBalanceUrl);
    }

    private String normalizeUrl(String path) {
        if (path == null) return baseUrl;
        if (path.startsWith("http://") || path.startsWith("https://")) {
            return path;
        }
        String cleanBase = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        String cleanPath = path.startsWith("/") ? path : "/" + path;
        return cleanBase + cleanPath;
    }
}
