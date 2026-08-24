package com.rupiksha.aeps.provider;

import com.rupiksha.aeps.client.AepsClient;
import com.rupiksha.aeps.config.AepsProperties;
import com.rupiksha.aeps.dto.request.AepsKycRequest;
import com.rupiksha.aeps.dto.request.AepsOtpVerifyRequest;
import com.rupiksha.aeps.dto.request.AepsDailyAuthRequest;
import com.rupiksha.aeps.dto.response.AepsKycResponse;
import com.rupiksha.aeps.dto.response.ProviderKycResult;
import com.rupiksha.aeps.dto.request.OnboardingRequest;
import com.rupiksha.aeps.dto.response.OnboardingResponse;
import com.rupiksha.aeps.exception.AepsException;
import com.rupiksha.aeps.exception.ProviderException;
import com.rupiksha.aeps.dto.TransactionContext;
import com.rupiksha.aeps.dto.TransactionResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class LevinProvider implements AepsProvider {



    private final AepsClient aepsClient;
    private final AepsProperties aepsProperties;

    @Override
    public String getProviderName() {
        return "levin";
    }

    @Override
    public boolean testConnection() {
        try {
            AepsProperties.ProviderConfig config = getLevinConfig();
            return config.getBaseUrl() != null && !config.getBaseUrl().isBlank();
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public OnboardingResponse onboard(OnboardingRequest request) {
        log.info("LevinProvider initiating agent onboarding for mobile: {}", request.getAepsMobile());
        AepsProperties.ProviderConfig config = getLevinConfig();

        String url = config.getBaseUrl() + "/aeps-onboarding";

        // Generate an agent ID matching RUP0 + mobile + 4 digit random sequence
        String agentId = "RUP0" + request.getAepsMobile() + (System.currentTimeMillis() % 10000);

        // Setup payload mapping including snake_case & camelCase redundancies as expected by Levin API
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("api_token",      config.getApiToken());
        payload.put("user_id",        config.getUserId());
        payload.put("fname",          request.getFname());
        payload.put("middlename",     request.getMiddlename() != null ? request.getMiddlename() : "");
        payload.put("lname",          request.getLname());
        payload.put("pan_card",       request.getPanCard());
        payload.put("aadhar_number",  request.getAadharNumber());
        payload.put("aeps_mobile",    request.getAepsMobile());
        payload.put("email",          request.getEmail());
        payload.put("aeps_agent_id",  agentId);
        payload.put("shop_name",      request.getShopName());
        payload.put("pin_code",       request.getPinCode());
        payload.put("address",        request.getAddress());
        payload.put("city",           request.getCity());
        payload.put("state",          request.getState());
        payload.put("latitude",       request.getLatitude());
        payload.put("longitude",      request.getLongitude());

        // camelCase variants validated by Levin API
        payload.put("shopName",       request.getShopName());
        payload.put("shopAddress",    request.getAddress());
        payload.put("shopCity",       request.getCity());
        payload.put("permanentCity",  request.getCity());
        payload.put("shopState",      request.getState());
        payload.put("shopPinCode",    request.getPinCode());
        payload.put("shopLatitude",   request.getLatitude());
        payload.put("shopLongitude",  request.getLongitude());
        payload.put("ad1",            request.getAddress());
        payload.put("ad2",            "");
        payload.put("ad3",            "");
        payload.put("ad4",            "");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

        try {
            ResponseEntity<OnboardingResponse> response = aepsClient.post(
                    url, payload, headers, OnboardingResponse.class
            );

            OnboardingResponse body = response.getBody();
            if (body == null) {
                throw new ProviderException("Empty response body from Levin onboarding API");
            }

            log.info("LevinProvider onboarding response statusId: [{}], message: [{}]",
                    body.getStatusId(), body.getMessage());

            // Re-populate agentId if Levin didn't return one (some fallback cases use generated ID)
            if (body.getAgentId() == null || body.getAgentId().isBlank()) {
                body.setAgentId(agentId);
            }

            return body;
        } catch (Exception e) {
            log.error("LevinProvider onboarding failed: {}", e.getMessage(), e);
            throw new ProviderException("Levin onboarding execution failed: " + e.getMessage(), e);
        }
    }

    @Override
    public ProviderKycResult kyc(AepsKycRequest request) {
        log.info("LevinProvider initiating agent biometric KYC for agentId: {}, mobile: {}", 
                request.getAepsAgentId(), request.getMobile());
        AepsProperties.ProviderConfig config = getLevinConfig();

        String url = config.getBaseUrl() + "/aeps-kyc";

        // Delegate transformation to mapper (Base64 encoding is applied here inside the provider package)
        Map<String, Object> payload = com.rupiksha.aeps.provider.mapper.LevinRequestMapper.mapToKycPayload(
                request, config.getApiToken(), config.getUserId()
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

        try {
            ResponseEntity<AepsKycResponse> response = aepsClient.post(
                    url, payload, headers, AepsKycResponse.class
            );

            AepsKycResponse body = response.getBody();
            if (body == null) {
                throw new ProviderException("Empty response body from Levin biometric KYC API");
            }

            log.info("LevinProvider biometric KYC response statusId: [{}], message: [{}], refid: [{}], txnid: [{}]",
                    body.getStatusId(), body.getMessage(), body.getRefid(), body.getTxnid());

            // Map Levin response attributes to provider-independent result
            return com.rupiksha.aeps.provider.mapper.LevinResponseMapper.mapToKycResult(body);
        } catch (Exception e) {
            log.error("LevinProvider biometric KYC failed: {}", e.getMessage(), e);
            throw new ProviderException("Levin biometric KYC execution failed: " + e.getMessage(), e);
        }
    }

    @Override
    public ProviderKycResult verifyOtp(AepsOtpVerifyRequest request) {
        log.info("LevinProvider verifying AEPS KYC OTP for contact: {}", request.getContactNumber());
        AepsProperties.ProviderConfig config = getLevinConfig();

        String url = config.getBaseUrl() + "/aeps-kyc-otp-verify";

        Map<String, Object> payload = com.rupiksha.aeps.provider.mapper.LevinRequestMapper.mapToOtpVerifyPayload(
                request, config.getApiToken(), config.getUserId()
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

        try {
            ResponseEntity<AepsKycResponse> response = aepsClient.post(
                    url, payload, headers, AepsKycResponse.class
            );

            AepsKycResponse body = response.getBody();
            if (body == null) {
                throw new ProviderException("Empty response body from Levin AEPS OTP verification API");
            }

            log.info("LevinProvider AEPS OTP verification response statusId: [{}], message: [{}]",
                    body.getStatusId(), body.getMessage());

            return com.rupiksha.aeps.provider.mapper.LevinResponseMapper.mapToOtpVerifyResult(body);
        } catch (Exception e) {
            log.error("LevinProvider AEPS OTP verification failed: {}", e.getMessage(), e);
            throw new ProviderException("Levin AEPS OTP verification execution failed: " + e.getMessage(), e);
        }
    }

    @Override
    public ProviderKycResult dailyAuthenticate(AepsDailyAuthRequest request) {
        log.info("LevinProvider initiating Daily 2FA authentication for mobile: {}", request.getMobileNumber());
        AepsProperties.ProviderConfig config = getLevinConfig();

        String url = config.getBaseUrl() + "/aeps-twofa";

        Map<String, Object> payload = com.rupiksha.aeps.provider.mapper.LevinRequestMapper.mapToDailyAuthPayload(
                request, config.getApiToken(), config.getUserId()
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

        try {
            ResponseEntity<AepsKycResponse> response = aepsClient.post(
                    url, payload, headers, AepsKycResponse.class
            );

            AepsKycResponse body = response.getBody();
            if (body == null) {
                throw new ProviderException("Empty response body from Levin Daily 2FA API");
            }

            log.info("LevinProvider Daily 2FA authentication response statusId: [{}], message: [{}], txnid: [{}]",
                    body.getStatusId(), body.getMessage(), body.getTxnid());

            return com.rupiksha.aeps.provider.mapper.LevinResponseMapper.mapToDailyAuthResult(body);
        } catch (Exception e) {
            log.error("LevinProvider Daily 2FA authentication failed: {}", e.getMessage(), e);
            throw new ProviderException("Levin Daily 2FA execution failed: " + e.getMessage(), e);
        }
    }

    @Override
    public TransactionResult executeTransaction(TransactionContext context) {
        log.info("LevinProvider initiating AEPS transaction execution for serviceType: {}, transactionId: {}", 
                context.getServiceType(), context.getRequest().getTransactionId());
        
        AepsProperties.ProviderConfig config = getLevinConfig();
        
        Map<String, Object> payload = com.rupiksha.aeps.provider.mapper.LevinRequestMapper.mapToTransactionPayload(
                context, config.getApiToken(), config.getUserId()
        );
        
        String maskedPayload = com.rupiksha.aeps.util.AepsUtil.maskSensitiveData(payload.toString());
        log.info("LevinProvider mapped transaction payload (masked): {}", maskedPayload);
        
        String url = config.getBaseUrl() + "/aeps-transaction";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

        try {
            @SuppressWarnings("rawtypes")
            ResponseEntity<Map> response = aepsClient.post(
                    url, payload, headers, Map.class
            );

            @SuppressWarnings("unchecked")
            Map<String, Object> body = (Map<String, Object>) response.getBody();
            if (body == null) {
                throw new ProviderException("Empty response body from Levin transaction API");
            }

            log.info("LevinProvider transaction response: {}", body);
            return com.rupiksha.aeps.provider.mapper.LevinResponseMapper.mapMapToTransactionResult(body, context);
        } catch (org.springframework.web.client.HttpStatusCodeException ex) {
            log.warn("LevinProvider HTTP exception [{}]: {}", ex.getStatusCode(), ex.getResponseBodyAsString());
            try {
                com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                @SuppressWarnings("unchecked")
                Map<String, Object> errorMap = mapper.readValue(ex.getResponseBodyAsString(), Map.class);
                if (errorMap != null && !errorMap.isEmpty()) {
                    return com.rupiksha.aeps.provider.mapper.LevinResponseMapper.mapMapToTransactionResult(errorMap, context);
                }
            } catch (Exception parseEx) {
                log.warn("Failed to parse Levin error response JSON: {}", parseEx.getMessage());
            }
            return TransactionResult.builder()
                    .transactionId(context.getRequest().getTransactionId())
                    .referenceNumber(context.getCorrelationId())
                    .status("FAILED")
                    .workflowState(com.rupiksha.aeps.enums.TransactionWorkflowState.FAILED)
                    .responseCode(String.valueOf(ex.getStatusCode().value()))
                    .responseMessage(ex.getStatusText() != null && !ex.getStatusText().isBlank() ? ex.getStatusText() : "Transaction failed at provider")
                    .amount(context.getRequest().getAmount())
                    .providerName("levin")
                    .completedTime(java.time.LocalDateTime.now())
                    .build();
        } catch (Exception e) {
            log.error("LevinProvider transaction execution failed: {}", e.getMessage(), e);
            return TransactionResult.builder()
                    .transactionId(context.getRequest().getTransactionId())
                    .referenceNumber(context.getCorrelationId())
                    .status("FAILED")
                    .workflowState(com.rupiksha.aeps.enums.TransactionWorkflowState.FAILED)
                    .responseCode("99")
                    .responseMessage(e.getMessage() != null ? e.getMessage() : "Levin transaction execution failed")
                    .amount(context.getRequest().getAmount())
                    .providerName("levin")
                    .completedTime(java.time.LocalDateTime.now())
                    .build();
        }
    }

    private AepsProperties.ProviderConfig getLevinConfig() {
        AepsProperties.ProviderConfig config = aepsProperties.getProviders().get("levin");
        if (config == null || config.getBaseUrl() == null || config.getApiToken() == null) {
            throw new AepsException("Levin AEPS provider configuration is missing or incomplete.");
        }
        return config;
    }
}
