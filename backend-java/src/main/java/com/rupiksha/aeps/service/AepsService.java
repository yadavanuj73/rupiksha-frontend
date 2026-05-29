package com.rupiksha.aeps.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rupiksha.aeps.dto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AepsService {

    private final RestTemplate aepsRestTemplate;
    private final ObjectMapper objectMapper;
    private final EncryptionService encryptionService;

    @Value("${levin.aeps.base-url}")
    private String baseUrl;

    @Value("${levin.aeps.api-token}")
    private String apiToken;

    @Value("${levin.aeps.user-id}")
    private String userId;

    public AepsOnboardingResponse onboard(AepsOnboardingRequest request) {
        try {
            String url = baseUrl + "/aeps-onboarding";
            
            log.info("========== AEPS ONBOARDING START ==========");
            log.info("Base URL: {}", baseUrl);
            log.info("Full URL: {}", url);
            log.info("API Token: {}...", apiToken != null && apiToken.length() > 10 ? apiToken.substring(0, 10) : "MISSING");
            log.info("User ID: {}", userId);
            
            LevinAepsRequest levinRequest = new LevinAepsRequest();

            levinRequest.setApiToken(apiToken);
            levinRequest.setUserId(userId);

            String agentId = generateAgentId(request.getAeps_mobile());
            levinRequest.setAeps_agent_id(agentId);

            levinRequest.setFname(request.getFname());
            levinRequest.setMiddlename(request.getMiddlename());
            levinRequest.setLname(request.getLname());
            levinRequest.setPan_card(request.getPan_card());
            levinRequest.setAadhar_number(request.getAadhar_number());
            levinRequest.setPinCode(request.getPinCode());
            levinRequest.setAddress(request.getAddress());
            levinRequest.setAeps_mobile(request.getAeps_mobile());
            levinRequest.setState(request.getState());
            levinRequest.setShop_name(request.getShop_name());
            levinRequest.setCity(request.getCity());
            levinRequest.setLatitude(request.getLatitude());
            levinRequest.setLongitude(request.getLongitude());
            levinRequest.setEmail(request.getEmail());
            levinRequest.setAd1(request.getAd1());
            levinRequest.setAd2(request.getAd2());
            levinRequest.setAd3(request.getAd3());
            levinRequest.setAd4(request.getAd4());

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

            HttpEntity<LevinAepsRequest> entity = new HttpEntity<>(levinRequest, headers);

            log.info("AEPS Request: {}", objectMapper.writeValueAsString(levinRequest));
            log.info("Sending request to Levin API...");

            ResponseEntity<AepsOnboardingResponse> response = aepsRestTemplate.exchange(
                    url, HttpMethod.POST, entity, AepsOnboardingResponse.class);

            log.info("AEPS Response Status: {}", response.getStatusCode());
            log.info("AEPS Response: {}", response.getBody());
            log.info("========== AEPS ONBOARDING END ==========");

            return response.getBody();

        } catch (org.springframework.web.client.ResourceAccessException e) {
            log.error("========== NETWORK/CONNECTION ERROR ==========");
            log.error("Cannot connect to Levin API. This could be:");
            log.error("1. Wrong base URL (current: {})", baseUrl);
            log.error("2. Levin API is down");
            log.error("3. Network/firewall blocking the connection");
            log.error("4. SSL certificate issue");
            log.error("Error details: {}", e.getMessage());
            log.error("========================================");
            
            AepsOnboardingResponse error = new AepsOnboardingResponse();
            error.setStatusId(2);
            error.setMessage("AEPS Onboarding Failed : Cannot connect to Levin API. Please check base URL and network connectivity.");
            return error;
        } catch (Exception e) {
            log.error("AEPS Onboarding Error", e);
            AepsOnboardingResponse error = new AepsOnboardingResponse();
            error.setStatusId(2);
            error.setMessage("AEPS Onboarding Failed : " + e.getMessage());
            return error;
        }
    }

    private String generateAgentId(String mobile) {
        return "RUP0" + mobile + (System.currentTimeMillis() % 10000);
    }

    public AepsKycResponse aepsKyc(AepsKycRequest request) {
        try {
            String url = baseUrl + "/aeps-kyc";
            LevinAepsKycRequest levinRequest = new LevinAepsKycRequest();

            levinRequest.setApiToken(apiToken);
            levinRequest.setUserId(userId);
            levinRequest.setAadharNumber(request.getAadharNumber());
            levinRequest.setAepsAgentId(request.getAepsAgentId());
            levinRequest.setMerchantId(request.getMerchantId());
            levinRequest.setRdpiData(request.getRdpiData());
            levinRequest.setBiometricType(request.getBiometricType());
            levinRequest.setMobile(request.getMobile());
            levinRequest.setAd1(request.getAd1());
            levinRequest.setAd2(request.getAd2());
            levinRequest.setAd3(request.getAd3());
            levinRequest.setAd4(request.getAd4());

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

            log.info("AEPS KYC Request: {}", objectMapper.writeValueAsString(levinRequest));

            HttpEntity<LevinAepsKycRequest> entity = new HttpEntity<>(levinRequest, headers);

            ResponseEntity<AepsKycResponse> response = aepsRestTemplate.exchange(
                    url, HttpMethod.POST, entity, AepsKycResponse.class);

            log.info("AEPS KYC Response: {}", response.getBody());

            return response.getBody();

        } catch (Exception e) {
            log.error("AEPS KYC Error", e);
            AepsKycResponse error = new AepsKycResponse();
            error.setStatusId(2);
            error.setMessage("KYC Failed : " + e.getMessage());
            return error;
        }
    }

    public AepsKycOtpVerifyResponse verifyKycOtp(AepsKycOtpVerifyRequest request) {
        try {
            String url = baseUrl + "/aeps-kyc-otp-verify";
            LevinKycOtpVerifyRequest levinRequest = new LevinKycOtpVerifyRequest();

            levinRequest.setApiToken(apiToken);
            levinRequest.setUserId(userId);
            levinRequest.setVerifyKycOtp(request.getVerifyKycOtp());
            levinRequest.setEmail(request.getEmail());
            levinRequest.setContactNumber(request.getContactNumber());
            levinRequest.setKycRefId(request.getKycRefId());
            levinRequest.setClientRefId(request.getClientRefId());
            levinRequest.setAepsAgentId(request.getAepsAgentId());
            levinRequest.setMerchantId(request.getMerchantId());

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<LevinKycOtpVerifyRequest> entity = new HttpEntity<>(levinRequest, headers);

            ResponseEntity<AepsKycOtpVerifyResponse> response = aepsRestTemplate.exchange(
                    url, HttpMethod.POST, entity, AepsKycOtpVerifyResponse.class);

            return response.getBody();

        } catch (Exception e) {
            AepsKycOtpVerifyResponse error = new AepsKycOtpVerifyResponse();
            error.setStatusId(2);
            error.setMessage("OTP Verify Failed : " + e.getMessage());
            return error;
        }
    }

    public AepsTwoFaResponse aepsTwoFa(AepsTwoFaRequest request) {
        try {
            String url = baseUrl + "/aeps-twofector";
            LevinAepsTwoFaRequest levinRequest = new LevinAepsTwoFaRequest();

            levinRequest.setApiToken(apiToken);
            levinRequest.setUserId(userId);
            levinRequest.setAepsMethod("167");

            String clientId = generateClientId(request.getMobileNumber());

            levinRequest.setMobileNumber(request.getMobileNumber());
            levinRequest.setAdharNumber(request.getAdharNumber());
            levinRequest.setClientId(clientId);
            levinRequest.setAepsAgentId(request.getAepsAgentId());
            levinRequest.setMerchantId(request.getMerchantId());
            levinRequest.setLatitude(request.getLatitude());
            levinRequest.setLongitude(request.getLongitude());
            levinRequest.setBiometricType(request.getBiometricType());

            Map<String, String> pidDataMap = new LinkedHashMap<>();
            pidDataMap.put("adhar_number", request.getAdharNumber());
            pidDataMap.put("pidata", request.getPidData());

            String rdPidJson = objectMapper.writeValueAsString(pidDataMap);
            String encryptedRdPid = encryptionService.encrypt(rdPidJson).replaceAll("\\s+", "");

            levinRequest.setRdPidData(encryptedRdPid);

            log.info("AEPS 2FA ClientId : {}", clientId);
            log.info("RdPidData JSON : {}", rdPidJson);
            log.info("Encrypted RdPidData : {}", encryptedRdPid);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

            HttpEntity<LevinAepsTwoFaRequest> entity = new HttpEntity<>(levinRequest, headers);

            log.info("AEPS 2FA Request Sent");

            ResponseEntity<String> response = aepsRestTemplate.exchange(
                    url, HttpMethod.POST, entity, String.class);

            log.info("RAW AEPS 2FA Response : {}", response.getBody());

            AepsTwoFaResponse finalResponse = objectMapper.readValue(response.getBody(), AepsTwoFaResponse.class);

            log.info("Parsed AEPS 2FA Response : {}", finalResponse);

            return finalResponse;

        } catch (Exception e) {
            log.error("AEPS 2FA Error", e);
            AepsTwoFaResponse error = new AepsTwoFaResponse();
            error.setStatusId(2);
            error.setMessage("AEPS 2FA Failed : " + e.getMessage());
            return error;
        }
    }

    private String generateClientId(String mobile) {
        return "RUP0" + mobile + (System.currentTimeMillis() % 10000);
    }

    public AepsTransactionResponse aepsTransaction(AepsTransactionRequest request) {
        try {
            String url = baseUrl + "/aeps-transaction";
            LevinAepsTransactionRequest levinRequest = new LevinAepsTransactionRequest();

            if (request.getMobileNumber() == null || request.getAdharNumber() == null ||
                    request.getPidData() == null || request.getAepsMethod() == null) {
                throw new RuntimeException("Required fields missing (mobile/aadhar/pidData/method)");
            }

            levinRequest.setApiToken(apiToken);
            levinRequest.setUserId(userId);
            levinRequest.setAepsMethod(request.getAepsMethod());

            String clientId = generateClientId(request.getMobileNumber());

            levinRequest.setMobileNumber(request.getMobileNumber());
            levinRequest.setAdharNumber(request.getAdharNumber());
            levinRequest.setClientId(clientId);

            if ("152".equals(request.getAepsMethod())) {
                levinRequest.setAmount("1");
            } else {
                levinRequest.setAmount(request.getAmount());
            }

            levinRequest.setCustomerMobileNumber(request.getCustomerMobileNumber());
            levinRequest.setAepsBankName(request.getAepsBankName());
            levinRequest.setAepsBankCode(request.getAepsBankCode());
            levinRequest.setLatitude(request.getLatitude());
            levinRequest.setLongitude(request.getLongitude());
            levinRequest.setBiometricType(request.getBiometricType());
            levinRequest.setName(request.getName());
            levinRequest.setPinCode(request.getPinCode());
            levinRequest.setAddress(request.getAddress());
            levinRequest.setShopName(request.getShopName());
            levinRequest.setCity(request.getCity());
            levinRequest.setState(request.getState());
            levinRequest.setFtype("2");

            Map<String, String> pidDataMap = new LinkedHashMap<>();
            pidDataMap.put("adhar_number", request.getAdharNumber());
            pidDataMap.put("pidata", request.getPidData());

            String rdPidJson = objectMapper.writeValueAsString(pidDataMap);
            String encryptedRdPid = encryptionService.encrypt(rdPidJson);

            levinRequest.setRdPidData(encryptedRdPid);

            String maskedAadhar = request.getAdharNumber().replaceAll("\\d(?=\\d{4})", "*");

            log.info("=========== AEPS TRANSACTION ===========");
            log.info("ClientId : {}", clientId);
            log.info("Mobile : {}", request.getMobileNumber());
            log.info("Aadhar : {}", maskedAadhar);
            log.info("Bank : {}", request.getAepsBankName());
            log.info("Method : {}", request.getAepsMethod());

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<LevinAepsTransactionRequest> entity = new HttpEntity<>(levinRequest, headers);

            log.info("AEPS Transaction Request Sent");

            ResponseEntity<String> response = aepsRestTemplate.exchange(
                    url, HttpMethod.POST, entity, String.class);

            log.info("RAW AEPS TXN Response : {}", response.getBody());

            AepsTransactionResponse finalResponse = objectMapper.readValue(response.getBody(), AepsTransactionResponse.class);

            log.info("Parsed AEPS TXN Response : {}", finalResponse);

            return finalResponse;

        } catch (Exception e) {
            log.error("AEPS Transaction Error", e);
            AepsTransactionResponse error = new AepsTransactionResponse();
            error.setStatusId(0);
            error.setStatus("FAILED");
            error.setErrorCode("INTERNAL_ERROR");
            error.setMessage("AEPS Transaction Failed : " + e.getMessage());
            return error;
        }
    }

    public AepsTransactionStatusResponse transactionStatus(AepsTransactionStatusRequest request) {
        try {
            String url = baseUrl + "/aeps-transaction-status";
            LevinAepsTransactionStatusRequest levinRequest = new LevinAepsTransactionStatusRequest();

            levinRequest.setApiToken(apiToken);
            levinRequest.setUserId(userId);
            levinRequest.setClientId(request.getClientId());

            log.info("AEPS STATUS URL : {}", url);
            log.info("AEPS STATUS REQUEST : {}", levinRequest);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

            HttpEntity<LevinAepsTransactionStatusRequest> entity = new HttpEntity<>(levinRequest, headers);

            ResponseEntity<String> response = aepsRestTemplate.exchange(
                    url, HttpMethod.POST, entity, String.class);

            log.info("RAW AEPS STATUS RESPONSE : {}", response.getBody());

            AepsTransactionStatusResponse finalResponse = objectMapper.readValue(response.getBody(), AepsTransactionStatusResponse.class);

            log.info("Parsed STATUS RESPONSE : {}", finalResponse);

            return finalResponse;

        } catch (Exception e) {
            log.error("AEPS Status Error", e);
            AepsTransactionStatusResponse error = new AepsTransactionStatusResponse();
            error.setStatusId(2);
            error.setMessage("Status Failed : " + e.getMessage());
            return error;
        }
    }
}
