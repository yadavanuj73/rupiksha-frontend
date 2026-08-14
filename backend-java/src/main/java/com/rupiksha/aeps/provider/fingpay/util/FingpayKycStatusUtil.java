package com.rupiksha.aeps.provider.fingpay.util;

public final class FingpayKycStatusUtil {

    private FingpayKycStatusUtil() {
    }

    public static boolean isBankEkycAlreadyCompleted(String message) {
        String normalized = normalize(message);
        return normalized.contains("already completed bank ekyc")
                || (normalized.contains("already completed") && normalized.contains("bank ekyc"))
                || (normalized.contains("bank ekyc") && normalized.contains("proceed with your transactions"));
    }

    public static boolean isBankEkycRequired(String message) {
        String normalized = normalize(message);
        return !normalized.contains("already completed")
                && normalized.contains("bank ekyc")
                && (normalized.contains("complete")
                || normalized.contains("required")
                || normalized.contains("enable transactions"));
    }

    private static String normalize(String message) {
        if (message == null) {
            return "";
        }
        return message.toLowerCase().replaceAll("[^a-z0-9]+", " ").trim();
    }
}
