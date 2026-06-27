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
}
