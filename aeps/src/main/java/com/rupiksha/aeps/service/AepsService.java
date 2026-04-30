package com.rupiksha.aeps.service;


import com.rupiksha.aeps.dto.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class AepsService {

    private final RestTemplate restTemplate;
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

            LevinAepsRequest levinRequest = new LevinAepsRequest();

            // Credentials
            levinRequest.setApiToken(apiToken);
            levinRequest.setUserId(userId);

            // Generate Agent ID
            String agentId = generateAgentId(request.getAeps_mobile());
            levinRequest.setAeps_agent_id(agentId);

            // Request Mapping
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

            HttpEntity<LevinAepsRequest> entity =
                    new HttpEntity<>(levinRequest, headers);

            log.info("AEPS Request: {}",
                    objectMapper.writeValueAsString(levinRequest));

            ResponseEntity<AepsOnboardingResponse> response =
                    restTemplate.exchange(
                            url,
                            HttpMethod.POST,
                            entity,
                            AepsOnboardingResponse.class
                    );

            log.info("AEPS Response: {}", response.getBody());

            return response.getBody();

        } catch (Exception e) {

            log.error("AEPS Onboarding Error", e);

            AepsOnboardingResponse error =
                    new AepsOnboardingResponse();

            error.setStatusId(2);
            error.setMessage("AEPS Onboarding Failed : " + e.getMessage());

            return error;
        }
    }

    // Agent ID Generator
    private String generateAgentId(String mobile){

        return "RUP0" + mobile +
                (System.currentTimeMillis() % 10000);
    }
    //***********************************************
    public AepsKycResponse aepsKyc(AepsKycRequest request){

        try {

            String url = baseUrl + "/aeps-kyc";

            LevinAepsKycRequest levinRequest = new LevinAepsKycRequest();

            // Credentials
            levinRequest.setApiToken(apiToken);
            levinRequest.setUserId(userId);

            // Request Mapping
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

            // Headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

            // Debug Log
            log.info("AEPS KYC Request: {}", objectMapper.writeValueAsString(levinRequest));

            HttpEntity<LevinAepsKycRequest> entity =
                    new HttpEntity<>(levinRequest, headers);

            ResponseEntity<AepsKycResponse> response =
                    restTemplate.exchange(
                            url,
                            HttpMethod.POST,
                            entity,
                            AepsKycResponse.class
                    );

            log.info("AEPS KYC Response: {}", response.getBody());

            return response.getBody();

        } catch (Exception e){

            log.error("AEPS KYC Error", e);

            AepsKycResponse error = new AepsKycResponse();
            error.setStatusId(2);
            error.setMessage("KYC Failed : " + e.getMessage());

            return error;
        }
    }
    //***********************************************
    public AepsKycOtpVerifyResponse verifyKycOtp(
            AepsKycOtpVerifyRequest request){

        try {

            String url = baseUrl + "/aeps-kyc-otp-verify";

            LevinKycOtpVerifyRequest levinRequest =
                    new LevinKycOtpVerifyRequest();

            // Credentials
            levinRequest.setApiToken(apiToken);
            levinRequest.setUserId(userId);

            // Mapping
            levinRequest.setVerifyKycOtp(request.getVerifyKycOtp());
            levinRequest.setEmail(request.getEmail());
            levinRequest.setContactNumber(request.getContactNumber());
            levinRequest.setKycRefId(request.getKycRefId());
            levinRequest.setClientRefId(request.getClientRefId());
            levinRequest.setAepsAgentId(request.getAepsAgentId());
            levinRequest.setMerchantId(request.getMerchantId());

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<LevinKycOtpVerifyRequest> entity =
                    new HttpEntity<>(levinRequest, headers);

            ResponseEntity<AepsKycOtpVerifyResponse> response =
                    restTemplate.exchange(
                            url,
                            HttpMethod.POST,
                            entity,
                            AepsKycOtpVerifyResponse.class
                    );

            return response.getBody();

        } catch (Exception e){

            AepsKycOtpVerifyResponse error =
                    new AepsKycOtpVerifyResponse();

            error.setStatusId(2);
            error.setMessage("OTP Verify Failed : " + e.getMessage());

            return error;
        }
    }
    //******************************************
    public AepsTwoFaResponse aepsTwoFa(AepsTwoFaRequest request) {

        try {

            String url = baseUrl + "/aeps-twofector";

            LevinAepsTwoFaRequest levinRequest =
                    new LevinAepsTwoFaRequest();

            // Credentials
            levinRequest.setApiToken(apiToken);
            levinRequest.setUserId(userId);
            levinRequest.setAepsMethod("167");

            // Generate Client ID
            String clientId =
                    generateClientId(request.getMobileNumber());

            // Request Mapping
            levinRequest.setMobileNumber(request.getMobileNumber());
            levinRequest.setAdharNumber(request.getAdharNumber());
            levinRequest.setClientId(clientId);
            levinRequest.setAepsAgentId(request.getAepsAgentId());
            levinRequest.setMerchantId(request.getMerchantId());
            levinRequest.setLatitude(request.getLatitude());
            levinRequest.setLongitude(request.getLongitude());
            levinRequest.setBiometricType(request.getBiometricType());

            // 🔐 Create RdPidData
            Map<String, String> pidDataMap = new LinkedHashMap<>();

            pidDataMap.put("adhar_number", request.getAdharNumber());
            pidDataMap.put("pidata", request.getPidData());

            String rdPidJson =
                    objectMapper.writeValueAsString(pidDataMap);

            String encryptedRdPid =
                    encryptionService.encrypt(rdPidJson)
                            .replaceAll("\\s+", "");

            levinRequest.setRdPidData(encryptedRdPid);

            // Debug Logs
            log.info("AEPS 2FA ClientId : {}", clientId);
            log.info("Aadhar Number : {}", request.getAdharNumber());
            log.info("RdPidData JSON : {}", rdPidJson);
            log.info("Encrypted RdPidData : {}", encryptedRdPid);
            log.info("Final Request : {}",
                    objectMapper.writeValueAsString(levinRequest));

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setAccept(
                    Collections.singletonList(
                            MediaType.APPLICATION_JSON
                    )
            );

            HttpEntity<LevinAepsTwoFaRequest> entity =
                    new HttpEntity<>(levinRequest, headers);

            log.info("AEPS 2FA Request Sent");

            // ✅ Get Raw Response
            ResponseEntity<String> response =
                    restTemplate.exchange(
                            url,
                            HttpMethod.POST,
                            entity,
                            String.class
                    );

            log.info("RAW AEPS 2FA Response : {}", response.getBody());

            // ✅ Convert to DTO
            AepsTwoFaResponse finalResponse =
                    objectMapper.readValue(
                            response.getBody(),
                            AepsTwoFaResponse.class
                    );

            log.info("Parsed AEPS 2FA Response : {}", finalResponse);

            return finalResponse;

        } catch (Exception e) {

            log.error("AEPS 2FA Error", e);

            AepsTwoFaResponse error =
                    new AepsTwoFaResponse();

            error.setStatusId(2);
            error.setMessage("AEPS 2FA Failed : " + e.getMessage());

            return error;
        }
    }


    // Client ID Generator
    private String generateClientId(String mobile){

        return "RUP0" + mobile +
                (System.currentTimeMillis() % 10000);
    } //*************************************
    public AepsTransactionResponse aepsTransaction(
            AepsTransactionRequest request) {

        try {

            String url = baseUrl + "/aeps-transaction";

            LevinAepsTransactionRequest levinRequest =
                    new LevinAepsTransactionRequest();

            // Validate Required Fields
            if (request.getMobileNumber() == null ||
                    request.getAdharNumber() == null ||
                    request.getPidData() == null ||
                    request.getAepsMethod() == null) {

                throw new RuntimeException(
                        "Required fields missing (mobile/aadhar/pidData/method)");
            }

            // Credentials
            levinRequest.setApiToken(apiToken);
            levinRequest.setUserId(userId);
            levinRequest.setAepsMethod(request.getAepsMethod());

            // Generate Client ID
            String clientId =
                    generateClientId(request.getMobileNumber());

            // Request Mapping
            levinRequest.setMobileNumber(request.getMobileNumber());
            levinRequest.setAdharNumber(request.getAdharNumber());
            levinRequest.setClientId(clientId);

            // Balance inquiry default amount
            if ("152".equals(request.getAepsMethod())) {
                levinRequest.setAmount("1");
            } else {
                levinRequest.setAmount(request.getAmount());
            }

            levinRequest.setCustomerMobileNumber(
                    request.getCustomerMobileNumber());

            levinRequest.setAepsBankName(
                    request.getAepsBankName());

            levinRequest.setAepsBankCode(
                    request.getAepsBankCode());

            levinRequest.setLatitude(request.getLatitude());
            levinRequest.setLongitude(request.getLongitude());
            levinRequest.setBiometricType(
                    request.getBiometricType());

            levinRequest.setName(request.getName());
            levinRequest.setPinCode(request.getPinCode());
            levinRequest.setAddress(request.getAddress());
            levinRequest.setShopName(request.getShopName());
            levinRequest.setCity(request.getCity());
            levinRequest.setState(request.getState());

            // Default ftype
            levinRequest.setFtype("2");

            // 🔐 Create RdPidData
            Map<String, String> pidDataMap =
                    new LinkedHashMap<>();

            pidDataMap.put("adhar_number",
                    request.getAdharNumber());

            pidDataMap.put("pidata",
                    request.getPidData());

            String rdPidJson =
                    objectMapper.writeValueAsString(pidDataMap);

            String encryptedRdPid =
                    encryptionService.encrypt(rdPidJson);

            levinRequest.setRdPidData(encryptedRdPid);

            // Mask Aadhaar for logs
            String maskedAadhar =
                    request.getAdharNumber()
                            .replaceAll("\\d(?=\\d{4})", "*");

            // Debug Logs
            log.info("=========== AEPS TRANSACTION ===========");
            log.info("ClientId : {}", clientId);
            log.info("Mobile : {}", request.getMobileNumber());
            log.info("Aadhar : {}", maskedAadhar);
            log.info("Bank : {}", request.getAepsBankName());
            log.info("Method : {}", request.getAepsMethod());

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<LevinAepsTransactionRequest> entity =
                    new HttpEntity<>(levinRequest, headers);

            log.info("AEPS Transaction Request Sent");

            ResponseEntity<String> response =
                    restTemplate.exchange(
                            url,
                            HttpMethod.POST,
                            entity,
                            String.class
                    );

            log.info("RAW AEPS TXN Response : {}",
                    response.getBody());

            AepsTransactionResponse finalResponse =
                    objectMapper.readValue(
                            response.getBody(),
                            AepsTransactionResponse.class
                    );

            log.info("Parsed AEPS TXN Response : {}",
                    finalResponse);

            return finalResponse;

        } catch (Exception e) {

            log.error("AEPS Transaction Error", e);

            AepsTransactionResponse error =
                    new AepsTransactionResponse();

            error.setStatusId(0);
            error.setStatus("FAILED");
            error.setErrorCode("INTERNAL_ERROR");
            error.setMessage(
                    "AEPS Transaction Failed : " +
                            e.getMessage());

            return error;
        }
    }//***********************************************
    public AepsTransactionStatusResponse transactionStatus(
            AepsTransactionStatusRequest request) {

        try {

            String url =
                    "https://api.levinfintech.com/api/levin/aeps-transaction-status";

            LevinAepsTransactionStatusRequest levinRequest =
                    new LevinAepsTransactionStatusRequest();

            levinRequest.setApiToken(apiToken);
            levinRequest.setUserId(userId);
            levinRequest.setClientId(request.getClientId());

            log.info("AEPS STATUS URL : {}", url);
            log.info("AEPS STATUS REQUEST : {}", levinRequest);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setAccept(
                    Collections.singletonList(MediaType.APPLICATION_JSON)
            );

            HttpEntity<LevinAepsTransactionStatusRequest> entity =
                    new HttpEntity<>(levinRequest, headers);

            ResponseEntity<String> response =
                    restTemplate.exchange(
                            url,
                            HttpMethod.POST,
                            entity,
                            String.class
                    );

            log.info("RAW AEPS STATUS RESPONSE : {}", response.getBody());

            AepsTransactionStatusResponse finalResponse =
                    objectMapper.readValue(
                            response.getBody(),
                            AepsTransactionStatusResponse.class
                    );

            log.info("Parsed STATUS RESPONSE : {}", finalResponse);

            return finalResponse;

        } catch (Exception e) {

            log.error("AEPS Status Error", e);

            AepsTransactionStatusResponse error =
                    new AepsTransactionStatusResponse();

            error.setStatusId(2);
            error.setMessage("Status Failed : " + e.getMessage());

            return error;
        }

   }}