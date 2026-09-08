package com.rupiksha.aeps.provider.fingpay.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rupiksha.aeps.entity.AepsTransactionEngine;
import com.rupiksha.aeps.enums.TransactionWorkflowState;
import com.rupiksha.aeps.provider.fingpay.dto.CdoRequest;
import com.rupiksha.aeps.provider.fingpay.dto.CdoResponse;
import com.rupiksha.aeps.provider.fingpay.entity.AepsKyc;
import com.rupiksha.aeps.provider.fingpay.entity.FingpayTransaction;
import com.rupiksha.aeps.provider.fingpay.repository.AepsKycRepository;
import com.rupiksha.aeps.provider.fingpay.repository.FingUserRepository;
import com.rupiksha.aeps.provider.fingpay.repository.FingpayTransactionRepository;
import com.rupiksha.aeps.provider.fingpay.util.FingpayEncryptionUtil;
import com.rupiksha.aeps.repository.AepsTransactionEngineRepository;
import com.rupiksha.backend.domain.User;
import com.rupiksha.backend.domain.WalletTransactionContext;
import com.rupiksha.backend.service.WalletService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import javax.crypto.SecretKey;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

@Service
@RequiredArgsConstructor
@Slf4j
public class CashDepositOtpService {

    private final FingpayEncryptionUtil encryptionUtil;
    private final FingpayTransactionRepository txnRepo;
    private final AepsTransactionEngineRepository engineTxnRepo;
    private final AepsKycRepository aepsKycRepo;
    private final FingUserRepository fingUserRepo;
    private final WalletService walletService;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    @Value("${fingpay.cd.otp.generate-url:https://fingpayap.tapits.in/fpaepsservice/api/CashDeposit/merchant/generate/otp}")
    private String cdoGenerateUrl;

    @Value("${fingpay.cd.otp.validate-url:https://fingpayap.tapits.in/fpaepsservice/api/CashDeposit/merchant/validate/otp}")
    private String cdoValidateUrl;

    @Value("${fingpay.cd.otp.txn-url:https://fingpayap.tapits.in/fpaepsservice/api/CashDeposit/merchant/transaction}")
    private String cdoTxnUrl;

    @Value("${fingpay.cd.otp.ack-url:https://fingpayap.tapits.in/fpaepsservice//api/CashDeposit/otp/merchant/acknowledgement}")
    private String cdoAckUrl;

    @Value("${fingpay.cd.otp.status-url:https://fingpayap.tapits.in/fpaepsweb/api/auth/merchantInfo/statusCheck/cashDepositWithOtp}")
    private String cdoStatusUrl;

    @Value("${fingpay.device.imei}")
    private String deviceImei;

    @Value("${fingpay.supermerchant.id:1}")
    private String superMerchantId;

    @Value("${fingpay.security.key}")
    private String securityKey;

    /**
     * Leg 1: Generate OTP for Cash Deposit
     */
    public CdoResponse generateOtp(CdoRequest req, User mainUser) {
        log.info("CDO Generate OTP for mobile={}, acc={}, amount={}", req.getMobileNumber(), req.getAccountNumber(), req.getAmount());

        long uidLong = mainUser.getId().getMostSignificantBits() & Long.MAX_VALUE;
        AepsKyc kyc = resolveKyc(uidLong);
        String merchantPin = resolvePin(uidLong, kyc);

        // Pre-validate wallet balance
        var wallet = walletService.getBalance(mainUser.getId().toString());
        if (req.getAmount() != null && wallet.balance().compareTo(req.getAmount()) < 0) {
            return CdoResponse.builder()
                    .success(false)
                    .status("FAILED")
                    .message("Insufficient wallet balance for AEPS Cash Deposit. Current balance: ₹" + wallet.balance() + ", Deposit amount: ₹" + req.getAmount())
                    .build();
        }

        String merchantTranId = (req.getMerchantTranId() != null && !req.getMerchantTranId().isBlank())
                ? req.getMerchantTranId()
                : "CDO" + System.currentTimeMillis() + (int)(Math.random() * 900 + 100);

        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            try {
                payload.put("superMerchantId", Integer.parseInt(superMerchantId));
            } catch (Exception e) {
                payload.put("superMerchantId", superMerchantId);
            }
            payload.put("merchantUserName", kyc.getOutlet());
            payload.put("merchantPin", md5(merchantPin));
            payload.put("subMerchantId", "");
            payload.put("secretKey", securityKey);
            payload.put("mobileNumber", req.getMobileNumber());
            payload.put("iin", req.getIin());
            payload.put("transactionType", "CDO");
            payload.put("latitude", parseDouble(req.getLatitude(), 28.6119669));
            payload.put("longitude", parseDouble(req.getLongitude(), 77.4275416));
            payload.put("requestRemarks", req.getRequestRemarks() != null && !req.getRequestRemarks().isBlank() ? req.getRequestRemarks() : ("Cash Deposit: " + req.getMobileNumber()));
            payload.put("merchantTranId", merchantTranId);
            payload.put("accountNumber", req.getAccountNumber());
            payload.put("amount", req.getAmount() != null ? req.getAmount().doubleValue() : 0.0);
            payload.put("fingpayTransactionId", "");
            payload.put("otp", "");
            payload.put("cdPkId", 0);
            payload.put("paymentType", "B");

            ResponseEntity<String> httpResp = executeEncryptedCall(cdoGenerateUrl, payload, req.getDeviceId());
            JsonNode root = objectMapper.readTree(httpResp.getBody());
            boolean status = root.path("status").asBoolean(false) || "SUCCESS".equalsIgnoreCase(root.path("status").asText(""));
            JsonNode data = root.path("data");

            CdoResponse resp = parseCdoResponse(root, data, merchantTranId, req.getAmount());
            resp.setSuccess(status);
            return resp;

        } catch (Exception e) {
            log.error("CDO Generate OTP failed: {}", e.getMessage(), e);
            return CdoResponse.builder()
                    .success(false)
                    .status("FAILED")
                    .message("Failed to generate OTP: " + e.getMessage())
                    .merchantTranId(merchantTranId)
                    .build();
        }
    }

    /**
     * Leg 2: Validate OTP & Fetch Beneficiary Details
     */
    public CdoResponse validateOtp(CdoRequest req, User mainUser) {
        log.info("CDO Validate OTP for txnId={}, otp={}, pkid={}", req.getFingpayTransactionId(), req.getOtp(), req.getCdPkId());

        long uidLong = mainUser.getId().getMostSignificantBits() & Long.MAX_VALUE;
        AepsKyc kyc = resolveKyc(uidLong);
        String merchantPin = resolvePin(uidLong, kyc);

        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            try {
                payload.put("superMerchantId", Integer.parseInt(superMerchantId));
            } catch (Exception e) {
                payload.put("superMerchantId", superMerchantId);
            }
            payload.put("merchantUserName", kyc.getOutlet());
            payload.put("merchantPin", md5(merchantPin));
            payload.put("subMerchantId", "");
            payload.put("secretKey", securityKey);
            payload.put("mobileNumber", req.getMobileNumber());
            payload.put("iin", req.getIin());
            payload.put("transactionType", "CDO");
            payload.put("latitude", parseDouble(req.getLatitude(), 28.6119669));
            payload.put("longitude", parseDouble(req.getLongitude(), 77.4275416));
            payload.put("requestRemarks", req.getRequestRemarks() != null && !req.getRequestRemarks().isBlank() ? req.getRequestRemarks() : ("Cash Deposit: " + req.getMobileNumber()));
            payload.put("merchantTranId", req.getMerchantTranId());
            payload.put("accountNumber", req.getAccountNumber());
            payload.put("amount", req.getAmount() != null ? req.getAmount().doubleValue() : 0.0);
            payload.put("fingpayTransactionId", req.getFingpayTransactionId() != null ? req.getFingpayTransactionId() : "");
            payload.put("otp", req.getOtp() != null ? req.getOtp() : "");
            payload.put("cdPkId", req.getCdPkId() != null ? req.getCdPkId() : 0);
            payload.put("paymentType", "B");

            ResponseEntity<String> httpResp = executeEncryptedCall(cdoValidateUrl, payload, req.getDeviceId());
            JsonNode root = objectMapper.readTree(httpResp.getBody());
            boolean status = root.path("status").asBoolean(false) || "SUCCESS".equalsIgnoreCase(root.path("status").asText(""));
            JsonNode data = root.path("data");

            CdoResponse resp = parseCdoResponse(root, data, req.getMerchantTranId(), req.getAmount());
            resp.setSuccess(status);
            return resp;

        } catch (Exception e) {
            log.error("CDO Validate OTP failed: {}", e.getMessage(), e);
            return CdoResponse.builder()
                    .success(false)
                    .status("FAILED")
                    .message("Failed to validate OTP: " + e.getMessage())
                    .merchantTranId(req.getMerchantTranId())
                    .build();
        }
    }

    /**
     * Leg 3: Execute Cash Deposit Transaction with OTP
     */
    public CdoResponse executeTransaction(CdoRequest req, User mainUser) {
        log.info("CDO Execute Transaction for merchantTranId={}, amount={}, acc={}", 
                req.getMerchantTranId(), req.getAmount(), req.getAccountNumber());

        BigDecimal amount = req.getAmount() != null ? req.getAmount() : BigDecimal.ZERO;
        String merchantTranId = (req.getMerchantTranId() != null && !req.getMerchantTranId().isBlank())
                ? req.getMerchantTranId()
                : "CDO" + System.currentTimeMillis();

        // 1. Strict Wallet Balance Check
        var wallet = walletService.getBalance(mainUser.getId().toString());
        if (wallet.balance().compareTo(amount) < 0) {
            return CdoResponse.builder()
                    .success(false)
                    .status("FAILED")
                    .message("Insufficient wallet balance for AEPS Cash Deposit. Available: ₹" + wallet.balance() + ", Required: ₹" + amount)
                    .merchantTranId(merchantTranId)
                    .build();
        }

        // 2. Debit Retailer Wallet before Provider Call
        boolean walletDebited = false;
        try {
            log.info("Debiting wallet for AEPS CDO: {}, user: {}, amount: {}", merchantTranId, mainUser.getId(), amount);
            walletService.debitForService(
                    mainUser.getId(),
                    amount,
                    "AEPS Cash Deposit (OTP) - " + merchantTranId,
                    WalletTransactionContext.AEPS_DEPOSIT,
                    "AEPS",
                    "127.0.0.1",
                    merchantTranId
            );
            walletDebited = true;
            log.info("Successfully debited wallet for AEPS CDO: {}", merchantTranId);
        } catch (Exception we) {
            log.error("Failed to debit wallet for AEPS CDO {}: {}", merchantTranId, we.getMessage());
            return CdoResponse.builder()
                    .success(false)
                    .status("FAILED")
                    .message("Wallet debit failed: " + we.getMessage())
                    .merchantTranId(merchantTranId)
                    .build();
        }

        // 3. Persist initial AepsTransactionEngine record
        AepsTransactionEngine engineTxn = AepsTransactionEngine.builder()
                .transactionId(merchantTranId)
                .referenceNumber("REF" + System.currentTimeMillis())
                .provider("fingpay")
                .serviceType("CASH_DEPOSIT")
                .merchantId(mainUser.getAepsMerchantId() != null ? mainUser.getAepsMerchantId() : ("MER" + mainUser.getMobile()))
                .userId(mainUser.getId())
                .amount(amount)
                .status("STARTED")
                .workflowState(TransactionWorkflowState.STARTED.name())
                .initiatedAt(LocalDateTime.now())
                .correlationId("CORR" + UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase())
                .createdBy(mainUser.getUsername())
                .updatedBy(mainUser.getUsername())
                .build();
        engineTxn = engineTxnRepo.save(engineTxn);

        long uidLong = mainUser.getId().getMostSignificantBits() & Long.MAX_VALUE;
        AepsKyc kyc = resolveKyc(uidLong);
        String merchantPin = resolvePin(uidLong, kyc);

        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            try {
                payload.put("superMerchantId", Integer.parseInt(superMerchantId));
            } catch (Exception e) {
                payload.put("superMerchantId", superMerchantId);
            }
            payload.put("merchantUserName", kyc.getOutlet());
            payload.put("merchantPin", md5(merchantPin));
            payload.put("subMerchantId", "");
            payload.put("secretKey", securityKey);
            payload.put("mobileNumber", req.getMobileNumber());
            payload.put("iin", req.getIin());
            payload.put("transactionType", "CDO");
            payload.put("latitude", parseDouble(req.getLatitude(), 28.6119669));
            payload.put("longitude", parseDouble(req.getLongitude(), 77.4275416));
            payload.put("requestRemarks", req.getRequestRemarks() != null && !req.getRequestRemarks().isBlank() ? req.getRequestRemarks() : ("Cash Deposit: " + req.getMobileNumber()));
            payload.put("merchantTranId", merchantTranId);
            payload.put("accountNumber", req.getAccountNumber());
            payload.put("amount", amount.doubleValue());
            payload.put("fingpayTransactionId", req.getFingpayTransactionId() != null ? req.getFingpayTransactionId() : "");
            payload.put("otp", req.getOtp() != null ? req.getOtp() : "");
            payload.put("cdPkId", req.getCdPkId() != null ? req.getCdPkId() : 0);
            payload.put("paymentType", "B");

            ResponseEntity<String> httpResp = executeEncryptedCall(cdoTxnUrl, payload, req.getDeviceId());
            JsonNode root = objectMapper.readTree(httpResp.getBody());
            JsonNode data = root.path("data");

            boolean isSuccess = isSuccess(root, data);
            CdoResponse resp = parseCdoResponse(root, data, merchantTranId, amount);
            resp.setSuccess(isSuccess);

            // Update Engine Txn
            engineTxn.setStatus(isSuccess ? "SUCCESS" : "FAILED");
            engineTxn.setWorkflowState(isSuccess ? TransactionWorkflowState.SUCCESS.name() : TransactionWorkflowState.FAILED.name());
            engineTxn.setProviderReference(resp.getFingpayTransactionId());
            engineTxn.setProviderStatus(isSuccess ? "SUCCESS" : "FAILED");
            engineTxn.setProviderMessage(resp.getResponseMessage() != null ? resp.getResponseMessage() : resp.getMessage());
            engineTxn.setCompletedAt(LocalDateTime.now());
            engineTxnRepo.save(engineTxn);

            // Save FingpayTransaction
            FingpayTransaction fTxn = new FingpayTransaction();
            fTxn.setUid(uidLong);
            fTxn.setType("CD");
            fTxn.setAadhar("ACC: " + req.getAccountNumber());
            fTxn.setMobile(req.getMobileNumber());
            fTxn.setBank(1L);
            fTxn.setTxnamount(amount.doubleValue());
            fTxn.setTxnid(merchantTranId);
            fTxn.setFtxnin(resp.getFingpayTransactionId() != null ? resp.getFingpayTransactionId() : merchantTranId);
            fTxn.setAmount(resp.getBalanceAmount() != null ? resp.getBalanceAmount() : 0.0);
            fTxn.setRrn(resp.getBankRrn() != null ? resp.getBankRrn() : "NA");
            fTxn.setStatus(isSuccess ? "SUCCESS" : "FAILED");
            fTxn.setMessage(resp.getMessage());
            fTxn.setCreatedAt(LocalDateTime.now());
            txnRepo.save(fTxn);

            // Send Acknowledgement (Section 2a)
            sendAcknowledgementAsync(merchantTranId, resp.getFingpayTransactionId(), isSuccess, resp.getBankRrn(), resp.getResponseCode());

            // If failed, refund wallet
            if (!isSuccess && walletDebited) {
                try {
                    log.info("Refunding wallet for failed AEPS CDO: {}, user: {}, amount: {}", merchantTranId, mainUser.getId(), amount);
                    walletService.refundForService(
                            mainUser.getId(),
                            amount,
                            "AEPS Cash Deposit (OTP) Reversal - " + merchantTranId,
                            merchantTranId,
                            WalletTransactionContext.REVERSAL,
                            "AEPS",
                            "127.0.0.1",
                            "REF-" + merchantTranId
                    );
                    log.info("Successfully refunded wallet for failed AEPS CDO: {}", merchantTranId);
                } catch (Exception rfe) {
                    log.error("Failed to refund wallet for failed CDO {}: {}", merchantTranId, rfe.getMessage(), rfe);
                }
            }

            return resp;

        } catch (Exception e) {
            log.error("CDO Execution error txnId={}: {}", merchantTranId, e.getMessage(), e);

            // Refund wallet if debited
            if (walletDebited) {
                try {
                    walletService.refundForService(
                            mainUser.getId(),
                            amount,
                            "AEPS Cash Deposit (OTP) Reversal - " + merchantTranId,
                            merchantTranId,
                            WalletTransactionContext.REVERSAL,
                            "AEPS",
                            "127.0.0.1",
                            "REF-" + merchantTranId
                    );
                } catch (Exception rfe) {
                    log.error("Failed to refund wallet on exception: {}", rfe.getMessage());
                }
            }

            engineTxn.setStatus("FAILED");
            engineTxn.setWorkflowState(TransactionWorkflowState.FAILED.name());
            engineTxn.setProviderMessage("Error: " + e.getMessage());
            engineTxn.setCompletedAt(LocalDateTime.now());
            engineTxnRepo.save(engineTxn);

            return CdoResponse.builder()
                    .success(false)
                    .status("FAILED")
                    .message("Transaction failed: " + e.getMessage())
                    .merchantTranId(merchantTranId)
                    .build();
        }
    }

    private boolean isSuccess(JsonNode root, JsonNode data) {
        String s = root.path("status").asText("");
        boolean statusFlag = "true".equalsIgnoreCase(s)
                || "SUCCESS".equalsIgnoreCase(s)
                || root.path("status").asBoolean(false);

        if (!statusFlag || data.isMissingNode()) return false;

        String rrn = data.path("bankRrn").asText(data.path("bankRRN").asText(""));
        String rc = data.path("responseCode").asText("");
        return !rrn.isEmpty() && ("00".equals(rc) || "91".equals(rc) || "52".equals(rc) || "08".equals(rc));
    }

    private void sendAcknowledgementAsync(String merchantTranId, String fingpayTxnId, boolean ackStatus, String rrn, String responseCode) {
        try {
            if (cdoAckUrl == null || cdoAckUrl.isBlank()) return;

            Map<String, Object> ackPayload = new LinkedHashMap<>();
            ackPayload.put("merchantTransactionId", merchantTranId);
            ackPayload.put("fingpayTransactionId", fingpayTxnId != null ? fingpayTxnId : merchantTranId);
            ackPayload.put("acknowledgementStatus", ackStatus);
            ackPayload.put("rrn", rrn != null ? rrn : "NA");
            ackPayload.put("responseCode", responseCode != null ? responseCode : (ackStatus ? "00" : "99"));

            HttpHeaders ackHeaders = new HttpHeaders();
            ackHeaders.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<String> ackEntity = new HttpEntity<>(objectMapper.writeValueAsString(ackPayload), ackHeaders);

            CompletableFuture.runAsync(() -> {
                try {
                    ResponseEntity<String> ackResp = restTemplate.exchange(cdoAckUrl, HttpMethod.POST, ackEntity, String.class);
                    log.info("Fingpay CDO Acknowledgement sent for txn {}: status={}, resp={}", 
                            merchantTranId, ackResp.getStatusCode(), ackResp.getBody());
                } catch (Exception ex) {
                    log.warn("Fingpay CDO Acknowledgement failed for txn {}: {}", merchantTranId, ex.getMessage());
                }
            });
        } catch (Exception e) {
            log.warn("Failed to schedule CDO Acknowledgement for txn {}: {}", merchantTranId, e.getMessage());
        }
    }

    private ResponseEntity<String> executeEncryptedCall(String targetUrl, Map<String, Object> payload, String deviceId) throws Exception {
        String plainJson = objectMapper.writeValueAsString(payload);

        SecretKey sessionKey = encryptionUtil.generateSessionKey();
        String eskey = encryptionUtil.encryptSessionKey(sessionKey);
        String encryptedBody = encryptionUtil.encryptBody(plainJson, sessionKey);
        String hash = encryptionUtil.generateHash(plainJson + securityKey);

        String effectiveImei = (deviceId != null && !deviceId.isBlank())
                ? deviceId.trim()
                : deviceImei;

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.TEXT_PLAIN);
        headers.set("trnTimestamp", encryptionUtil.timestamp());
        headers.set("hash", hash);
        headers.set("deviceIMEI", effectiveImei);
        headers.set("eskey", eskey);

        HttpEntity<String> entity = new HttpEntity<>(encryptedBody, headers);
        return restTemplate.exchange(targetUrl, HttpMethod.POST, entity, String.class);
    }

    private CdoResponse parseCdoResponse(JsonNode root, JsonNode data, String merchantTranId, BigDecimal amount) {
        CdoResponse resp = new CdoResponse();
        resp.setStatus(root.path("status").asText(""));
        resp.setMessage(root.path("message").asText(""));
        resp.setStatusCode(root.path("statusCode").asLong(0));
        resp.setMerchantTranId(merchantTranId);
        resp.setAmount(amount);

        if (data.isArray() && data.size() > 0) {
            data = data.get(0);
        }

        if (!data.isMissingNode() && !data.isNull()) {
            resp.setFingpayTransactionId(data.path("fingpayTransactionId").asText(data.path("fpTransactionId").asText("")));
            resp.setCdPkId(data.path("cdPkId").asInt(0));
            resp.setBankRrn(data.path("bankRrn").asText(data.path("bankRRN").asText("")));
            resp.setFpRrn(data.path("fpRrn").asText(""));
            resp.setStan(data.path("stan").asText(""));
            resp.setResponseCode(data.path("responseCode").asText(""));
            resp.setResponseMessage(data.path("responseMessage").asText(""));
            resp.setAccountNumber(data.path("accountNumber").asText(""));
            resp.setMobileNumber(data.path("mobileNumber").asText(""));
            resp.setBeneficiaryName(data.path("beneficiaryName").asText(null));
            resp.setTransactionTimestamp(data.path("transactionTimestamp").asText(""));
            resp.setBalanceAmount(data.path("balanceAmount").asDouble(0.0));
        }

        return resp;
    }

    private AepsKyc resolveKyc(long uidLong) {
        return aepsKycRepo.findByUid(uidLong)
                .orElseThrow(() -> new RuntimeException("AepsKyc not found for merchant"));
    }

    private String resolvePin(long uidLong, AepsKyc kyc) {
        return (kyc.getMpin() != null)
                ? kyc.getMpin()
                : fingUserRepo.findById(uidLong)
                .orElseThrow(() -> new RuntimeException("FingUser not found"))
                .getPin();
    }

    private double parseDouble(String val, double defaultVal) {
        if (val == null || val.isBlank()) return defaultVal;
        try {
            return Double.parseDouble(val);
        } catch (Exception e) {
            return defaultVal;
        }
    }

    private String md5(String input) throws Exception {
        MessageDigest md = MessageDigest.getInstance("MD5");
        byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        for (byte b : hash) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
