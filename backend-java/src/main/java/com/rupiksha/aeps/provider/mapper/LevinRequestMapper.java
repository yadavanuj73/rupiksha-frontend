package com.rupiksha.aeps.provider.mapper;

import com.rupiksha.aeps.dto.request.AepsKycRequest;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

public class LevinRequestMapper {

    public static Map<String, Object> mapToKycPayload(AepsKycRequest request, String apiToken, String userId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("api_token",      apiToken);
        payload.put("user_id",        userId);
        payload.put("aeps_agent_id",  request.getAepsAgentId());
        payload.put("merchant_id",    request.getMerchantId());
        payload.put("aadhar_number",  request.getAadharNumber());
        
        // Base64 encode raw XML for Levin
        String base64PidXml = "";
        if (request.getPidXml() != null) {
            base64PidXml = Base64.getEncoder().encodeToString(
                    request.getPidXml().getBytes(StandardCharsets.UTF_8)
            );
        }
        payload.put("RdpiData",       base64PidXml);
        payload.put("biometricType",  request.getBiometricType());
        payload.put("mobile",         request.getMobile());
        
        return payload;
    }

    public static Map<String, Object> mapToOtpVerifyPayload(
            com.rupiksha.aeps.dto.request.AepsOtpVerifyRequest request, String apiToken, String userId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("api_token",      apiToken);
        payload.put("user_id",        userId);
        payload.put("verifyKycOtp",   request.getVerifyKycOtp());
        payload.put("email",          request.getEmail());
        payload.put("contactNumber",  request.getContactNumber());
        payload.put("kycRefId",       request.getKycRefId());
        payload.put("clientRefId",    request.getClientRefId());
        payload.put("aepsAgentId",    request.getAepsAgentId());
        payload.put("merchantId",     request.getMerchantId());
        return payload;
    }

    public static Map<String, Object> mapToDailyAuthPayload(
            com.rupiksha.aeps.dto.request.AepsDailyAuthRequest request, String apiToken, String userId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("api_token",      apiToken);
        payload.put("user_id",        userId);
        payload.put("mobileNumber",   request.getMobileNumber());
        payload.put("adharNumber",    request.getAdharNumber());
        
        // Base64 encode raw XML for Levin
        String base64PidXml = "";
        if (request.getPidXml() != null) {
            base64PidXml = Base64.getEncoder().encodeToString(
                    request.getPidXml().getBytes(StandardCharsets.UTF_8)
            );
        }
        payload.put("pidData",        base64PidXml);
        payload.put("merchantId",     request.getMerchantId());
        payload.put("latitude",       request.getLatitude());
        payload.put("longitude",      request.getLongitude());
        payload.put("biometricType",  request.getBiometricType());
        return payload;
    }

    public static Map<String, Object> mapToTransactionPayload(
            com.rupiksha.aeps.dto.TransactionContext context, String apiToken, String userId) {
        Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("api_token", apiToken);
        payload.put("user_id", userId);
        payload.put("aeps_agent_id", context.getMerchant().getAepsAgentId());
        payload.put("merchant_id", context.getMerchant().getAepsMerchantId());
        payload.put("mobile", context.getMerchant().getMobile());
        payload.put("adhar_number", context.getRequest().getAdhaarNumber());
        payload.put("amount", context.getRequest().getAmount());
        payload.put("iin", context.getRequest().getBankName());
        
        String base64PidXml = "";
        if (context.getRequest().getPidXml() != null) {
            base64PidXml = Base64.getEncoder().encodeToString(
                    context.getRequest().getPidXml().getBytes(StandardCharsets.UTF_8)
            );
        }
        payload.put("pidData", base64PidXml);
        payload.put("biometricType", context.getRequest().getBiometricType());
        
        // Method: 152 = Balance Inquiry, 188 = Cash Withdrawal / Aadhaar Pay, 177 = Mini Statement
        String method = "152";
        if ("CASH_WITHDRAWAL".equalsIgnoreCase(context.getServiceType()) || "AADHAAR_PAY".equalsIgnoreCase(context.getServiceType())) {
            method = "188";
        } else if ("MINI_STATEMENT".equalsIgnoreCase(context.getServiceType())) {
            method = "177";
        } else if ("BALANCE_INQUIRY".equalsIgnoreCase(context.getServiceType())) {
            method = "152";
        }
        payload.put("method", method);
        payload.put("service_type", context.getServiceType());
        payload.put("client_ref_id", context.getRequest().getTransactionId());
        payload.put("RdpiData", base64PidXml);
        payload.put("latitude", context.getRequest().getLatitude());
        payload.put("longitude", context.getRequest().getLongitude());
        payload.put("device_id", context.getRequest().getDeviceId());
        
        return payload;
    }
}

