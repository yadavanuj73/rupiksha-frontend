package com.rupiksha.aeps.util;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class AepsUtil {

    private static final Pattern JSON_AADHAAR_PATTERN = Pattern.compile(
            "(?i)\"(adharNumber|adhar_number|aadhaar|aadhaarNumber|aadharNumber)\"\\s*:\\s*\"(\\d{12})\""
    );

    private static final Pattern JSON_SENSITIVE_FIELD_PATTERN = Pattern.compile(
            "(?i)\"(pidData|pid_data|password|apiToken|apiKey|secret|encryptionKey|passphrase)\"\\s*:\\s*\"([^\"]+)\""
    );

    private static final Pattern XML_SENSITIVE_ELEMENT_PATTERN = Pattern.compile(
            "(?i)<(PidData|Data|SessionKey|Hmac)([^>]*)>([^<]+)</\\1>"
    );

    /**
     * Masks sensitive payload information (Aadhaar, Biometrics, Credentials) for logging.
     * Prevents data leaks while leaving standard execution details readable.
     */
    public static String maskSensitiveData(String source) {
        if (source == null || source.isBlank()) {
            return source;
        }

        String result = source;

        // 1. Mask JSON Aadhaar (Keep only last 4 digits visible)
        Matcher jsonAadhaarMatcher = JSON_AADHAAR_PATTERN.matcher(result);
        StringBuffer sbAadhaar = new StringBuffer();
        while (jsonAadhaarMatcher.find()) {
            String field = jsonAadhaarMatcher.group(1);
            String number = jsonAadhaarMatcher.group(2);
            String maskedNumber = "********" + number.substring(8);
            jsonAadhaarMatcher.appendReplacement(sbAadhaar, "\"" + field + "\":\"" + maskedNumber + "\"");
        }
        jsonAadhaarMatcher.appendTail(sbAadhaar);
        result = sbAadhaar.toString();

        // 2. Mask JSON sensitive credential strings
        Matcher jsonSensitiveMatcher = JSON_SENSITIVE_FIELD_PATTERN.matcher(result);
        StringBuffer sbSensitive = new StringBuffer();
        while (jsonSensitiveMatcher.find()) {
            String field = jsonSensitiveMatcher.group(1);
            jsonSensitiveMatcher.appendReplacement(sbSensitive, "\"" + field + "\":\"[MASKED]\"");
        }
        jsonSensitiveMatcher.appendTail(sbSensitive);
        result = sbSensitive.toString();

        // 3. Mask XML sensitive tags (PidData, SessionKey, etc.)
        Matcher xmlSensitiveMatcher = XML_SENSITIVE_ELEMENT_PATTERN.matcher(result);
        StringBuffer sbXml = new StringBuffer();
        while (xmlSensitiveMatcher.find()) {
            String tag = xmlSensitiveMatcher.group(1);
            String attrs = xmlSensitiveMatcher.group(2);
            xmlSensitiveMatcher.appendReplacement(sbXml, "<" + tag + attrs + ">[MASKED]</" + tag + ">");
        }
        xmlSensitiveMatcher.appendTail(sbXml);
        result = sbXml.toString();

        return result;
    }

    /**
     * Standard mask for plain text Aadhaar numbers.
     */
    public static String maskAadhaar(String aadhaar) {
        if (aadhaar == null || aadhaar.length() < 12) {
            return aadhaar;
        }
        return "********" + aadhaar.substring(8);
    }
}
