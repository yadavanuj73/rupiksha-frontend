package com.rupiksha.aeps.provider.fingpay.service;

import com.rupiksha.aeps.provider.fingpay.dto.CashDepositRequest;
import com.rupiksha.aeps.provider.fingpay.dto.CashDepositResponse;
import com.rupiksha.aeps.provider.fingpay.entity.*;
import com.rupiksha.aeps.provider.fingpay.repository.*;
import com.rupiksha.aeps.provider.fingpay.util.FingpayEncryptionUtil;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class CashDepositService {

    private final FingpayEncryptionUtil encryptionUtil;
    private final FingpayTransactionRepository txnRepo;
    private final FingBankRepository bankRepo;
    private final AepsKycRepository aepsKycRepo;
    private final FingUserRepository userRepo;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    @Value("${fingpay.cd.url}")
    private String cdUrl;

    @Value("${fingpay.cd.ack-url:https://fingpayap.tapits.in/fpaepsservice/api/CashDeposit/merchant/deposit/acknowledgement}")
    private String cdAckUrl;

    @Value("${fingpay.device.imei}")
    private String deviceImei;

    @Value("${fingpay.supermerchant.id}")
    private String superMerchantId;

    @Value("${fingpay.security.key:${fingpay.api.secret:}}")
    private String securityKey;


    public CashDepositResponse process(CashDepositRequest req, String transactionId) {
        String maskedAadhaar = "XXXXXXXX" + req.getAadhar().substring(req.getAadhar().length() - 4);

        try {
            // 1. Bank IIN resolve
            FingBank bank = bankRepo.findById(req.getBankId())
                    .orElseThrow(() -> new RuntimeException("INVALID BANK CODE: " + req.getBankId()));

            // 2. Merchant outlet + pin resolve (null-safe, mirrors CashWithdrawalService)
            AepsKyc kyc = (req.getUid() != null) ? aepsKycRepo.findByUid(req.getUid()).orElse(null) : null;

            String merchantUserName = null;
            String rawPin = null;

            if (kyc != null) {
                merchantUserName = (kyc.getOutlet() != null && !kyc.getOutlet().isBlank())
                        ? kyc.getOutlet().trim().toUpperCase()
                        : (kyc.getMerchantId() != null ? kyc.getMerchantId().trim().toUpperCase() : null);
                rawPin = kyc.getMpin();
            }

            // Fallback: try FingUser table for pin
            if (rawPin == null || rawPin.isBlank()) {
                if (req.getUid() != null) {
                    FingUser fu = userRepo.findById(req.getUid()).orElse(null);
                    if (fu != null) rawPin = fu.getPin();
                }
            }

            // Final safe defaults
            if (merchantUserName == null || merchantUserName.isBlank()) {
                merchantUserName = String.valueOf(req.getUid());
            }
            if (rawPin == null || rawPin.isBlank()) {
                rawPin = "1234";
            }

            // 3. captureResponse — null-safe defaults for every field (mirrors CW)
            Map<String, Object> captureResponse = new LinkedHashMap<>();
            captureResponse.put("errCode",     req.getErrorCode()   != null ? req.getErrorCode()   : "0");
            captureResponse.put("errInfo",     req.getErrorInfo()   != null ? req.getErrorInfo()   : "Image Capture Success");
            captureResponse.put("fCount",      req.getFCount()      != null ? req.getFCount()      : "1");
            captureResponse.put("fType",       req.getFType()       != null ? req.getFType()       : "0");
            captureResponse.put("iCount",      "0");
            captureResponse.put("iType",       "0");
            captureResponse.put("pCount",      "0");
            captureResponse.put("pType",       "0");
            captureResponse.put("nmPoints",    req.getNmPoints()    != null ? req.getNmPoints()    : "46");
            captureResponse.put("qScore",      req.getQScore()      != null ? req.getQScore()      : "100");
            captureResponse.put("dpID",        req.getDpId()        != null ? req.getDpId()        : "");
            captureResponse.put("rdsID",       req.getRdsId()       != null ? req.getRdsId()       : "");
            captureResponse.put("rdsVer",      req.getRdsVer()      != null ? req.getRdsVer()      : "");
            captureResponse.put("dc",          req.getDc()          != null ? req.getDc()          : "");
            captureResponse.put("mi",          req.getMi()          != null ? req.getMi()          : "");
            captureResponse.put("mc",          req.getMc()          != null ? req.getMc()          : "");
            captureResponse.put("ci",          req.getCi()          != null ? req.getCi()          : "");
            captureResponse.put("sessionKey",  req.getSessionKey()  != null ? req.getSessionKey()  : "");
            captureResponse.put("hmac",        req.getHmac()        != null ? req.getHmac()        : "");
            captureResponse.put("PidDatatype", req.getPidType()     != null ? req.getPidType()     : "X");
            captureResponse.put("Piddata",     req.getPidData()     != null ? req.getPidData()     : "");

            // 4. cardnumberORUID (VID or Aadhaar)
            Map<String, Object> cardOrUID = new LinkedHashMap<>();
            if (req.getAadhar() != null && req.getAadhar().length() == 16) {
                cardOrUID.put("nationalBankIdentificationNumber", bank.getIinno());
                cardOrUID.put("indicatorforUID", 2);
                cardOrUID.put("adhaarNumber", "999999999999");
                cardOrUID.put("virtualId", req.getAadhar());
            } else {
                cardOrUID.put("nationalBankIdentificationNumber", bank.getIinno());
                cardOrUID.put("indicatorforUID", 0);
                cardOrUID.put("adhaarNumber", req.getAadhar());
            }

            // Parse coordinates safely
            double latVal = 28.6139, lonVal = 77.2090;
            try {
                if (req.getLat() != null && !req.getLat().isBlank()) latVal = Double.parseDouble(req.getLat());
                if (req.getLog() != null && !req.getLog().isBlank()) lonVal = Double.parseDouble(req.getLog());
            } catch (Exception e) {
                log.warn("CD coordinate parse warning: {}", e.getMessage());
            }

            // 5. Main payload (matches Fingpay CD API doc Section 1 exactly)
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("merchantTranId", transactionId);
            payload.put("languageCode", "en");
            payload.put("latitude", latVal);
            payload.put("longitude", lonVal);
            payload.put("mobileNumber", req.getMobile());
            payload.put("paymentType", "B");
            payload.put("requestRemarks", req.getRequestRemarks() != null && !req.getRequestRemarks().isBlank()
                    ? req.getRequestRemarks() : "CD");
            payload.put("transactionAmount", req.getAmount());
            String timestamp = encryptionUtil.timestamp();
            payload.put("timestamp", timestamp);
            payload.put("transactionType", "CD");
            payload.put("merchantUserName", merchantUserName);
            payload.put("merchantPin", md5(rawPin));
            payload.put("subMerchantId", "");
            payload.put("cardnumberORUID", cardOrUID);
            payload.put("captureResponse", captureResponse);

            String plainJson = objectMapper.writeValueAsString(payload);
            String secKey = (securityKey != null) ? securityKey.trim() : "";
            log.info("Fingpay CD request: txnId={}, mobile={}, amount={}, bankIIN={}, hasSecurityKey={}",
                    transactionId, req.getMobile(), req.getAmount(), bank.getIinno(), !secKey.isEmpty());

            // 6. Encrypt — hash = Base64(SHA256(JSON + securityKey)) per Fingpay API doc Section 1.
            SecretKey sessionKey = encryptionUtil.generateSessionKey();
            String eskey         = encryptionUtil.encryptSessionKey(sessionKey);
            String encryptedBody = encryptionUtil.encryptBody(plainJson, sessionKey);
            String hashInput     = secKey.isEmpty() ? plainJson : (plainJson + secKey);
            String hash          = encryptionUtil.generateHash(hashInput);

            // 7. Headers (SuperMerchantId sent in HTTP header per Fingpay Section 1)
            String effectiveImei = (req.getDeviceId() != null && !req.getDeviceId().isBlank()
                    && !req.getDeviceId().equalsIgnoreCase("unknown"))
                    ? req.getDeviceId().trim() : deviceImei;

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.TEXT_PLAIN);
            headers.set("trnTimestamp", timestamp);
            headers.set("hash", hash);
            headers.set("deviceIMEI", effectiveImei);
            headers.set("eskey", eskey);
            headers.set("superMerchantId", superMerchantId);

            // 8. API call
            HttpEntity<String> entity = new HttpEntity<>(encryptedBody, headers);
            ResponseEntity<String> httpResp = restTemplate.exchange(
                    cdUrl, HttpMethod.POST, entity, String.class);

            log.info("Fingpay CD raw response for txnId {}: {}", transactionId, httpResp.getBody());

            // 9. Parse response
            JsonNode root = objectMapper.readTree(httpResp.getBody());
            JsonNode data = root.path("data");

            // 10. Success condition
            boolean success = isSuccess(root, data);

            // 11. Save transaction to iaepstxn table
            FingpayTransaction txn = buildTxn(req, transactionId, maskedAadhaar, success, root, data);
            txnRepo.save(txn);

            // 12. Send Cash Deposit Acknowledgement (Fingpay Section 1c mandate)
            sendAcknowledgementAsync(transactionId, txn.getFtxnin(), success, txn.getRrn(),
                    data.isMissingNode() ? (success ? "00" : "99") : data.path("responseCode").asText(success ? "00" : "99"));

            // 13. Build sanitized response
            return buildResponse(success, transactionId, maskedAadhaar, root, data, txn);

        } catch (org.springframework.web.client.ResourceAccessException e) {
            log.error("CD timeout/network exception uid={} txnId={} msg={}", req.getUid(), transactionId, e.getMessage(), e);
            CashDepositResponse resp = new CashDepositResponse();
            resp.setStatus("PENDING");
            resp.setMessage("Network timeout / Ambiguous provider response. Check transaction status. Ref: " + transactionId);
            resp.setTxnId(transactionId);
            resp.setResponseCode("FP_TIMEOUT");
            return resp;
        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            if (e.getStatusCode().is5xxServerError()) {
                log.error("CD server 5xx exception uid={} txnId={} msg={}", req.getUid(), transactionId, e.getMessage(), e);
                CashDepositResponse resp = new CashDepositResponse();
                resp.setStatus("PENDING");
                resp.setMessage("Server error / Ambiguous response. Check transaction status. Ref: " + transactionId);
                resp.setTxnId(transactionId);
                resp.setResponseCode("FP_SERVER_ERROR");
                return resp;
            } else {
                log.error("CD client error uid={} txnId={} msg={}", req.getUid(), transactionId, e.getMessage(), e);
                CashDepositResponse resp = new CashDepositResponse();
                resp.setStatus("FAILED");
                resp.setMessage("Client request failed. Ref: " + transactionId);
                resp.setTxnId(transactionId);
                resp.setResponseCode("FP_CLIENT_ERROR");
                return resp;
            }
        } catch (Exception e) {
            log.error("CD error uid={} txnId={} cause={} msg={}", req.getUid(), transactionId, e.getClass().getSimpleName(), e.getMessage(), e);
            CashDepositResponse resp = new CashDepositResponse();
            resp.setStatus("FAILED");
            // Expose actual exception type and message for diagnosing production issues.
            // TODO: sanitize this before GA release.
            resp.setMessage("[CD-ERR:" + e.getClass().getSimpleName() + "] " + e.getMessage() + " (Ref: " + transactionId + ")");
            resp.setTxnId(transactionId);
            return resp;
        }
    }

    private boolean isSuccess(JsonNode root, JsonNode data) {
        String s = root.path("status").asText("");
        boolean statusFlag = "true".equalsIgnoreCase(s)
                || "SUCCESS".equalsIgnoreCase(s)
                || root.path("status").asBoolean(false);

        if (!statusFlag || data.isMissingNode()) return false;

        String rrn = data.path("bankRRN").asText("");
        String rc = data.path("responseCode").asText(data.path("statusCode").asText(""));
        
        // Success if 00, or deemed success on 91, 52, 08 as per Fingpay specification
        boolean isSuccessCode = "00".equals(rc) || "91".equals(rc) || "52".equals(rc) || "08".equals(rc);
        return !rrn.isEmpty() && isSuccessCode;
    }

    private void sendAcknowledgementAsync(String merchantTranId, String fingpayTxnId, boolean ackStatus, String rrn, String responseCode) {
        try {
            if (cdAckUrl == null || cdAckUrl.isBlank()) return;

            Map<String, Object> ackPayload = new LinkedHashMap<>();
            ackPayload.put("merchantTransactionId", merchantTranId);
            ackPayload.put("fingpayTransactionId", fingpayTxnId != null ? fingpayTxnId : merchantTranId);
            ackPayload.put("acknowledgementStatus", ackStatus);
            ackPayload.put("rrn", rrn != null ? rrn : "NA");
            ackPayload.put("responseCode", responseCode != null ? responseCode : (ackStatus ? "00" : "99"));

            HttpHeaders ackHeaders = new HttpHeaders();
            ackHeaders.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<String> ackEntity = new HttpEntity<>(objectMapper.writeValueAsString(ackPayload), ackHeaders);

            java.util.concurrent.CompletableFuture.runAsync(() -> {
                try {
                    ResponseEntity<String> ackResp = restTemplate.exchange(cdAckUrl, HttpMethod.POST, ackEntity, String.class);
                    log.info("Fingpay CD Acknowledgement sent for txn {}: status={}, resp={}", 
                            merchantTranId, ackResp.getStatusCode(), ackResp.getBody());
                } catch (Exception ex) {
                    log.warn("Fingpay CD Acknowledgement failed for txn {}: {}", merchantTranId, ex.getMessage());
                }
            });
        } catch (Exception e) {
            log.warn("Failed to schedule CD Acknowledgement for txn {}: {}", merchantTranId, e.getMessage());
        }
    }

    private FingpayTransaction buildTxn(CashDepositRequest req, String txnId,
                                         String maskedAadhaar, boolean success, JsonNode root, JsonNode data) {
        FingpayTransaction txn = new FingpayTransaction();
        txn.setUid(req.getUid());
        txn.setType("CD");
        txn.setAadhar(maskedAadhaar);
        txn.setMobile(req.getMobile());
        txn.setBank(req.getBankId());
        txn.setTxnamount(req.getAmount());
        txn.setCreatedAt(java.time.LocalDateTime.now());

        if (success) {
            txn.setTxnid(data.path("merchantTransactionId").asText(txnId));
            txn.setFtxnin(data.path("fpTransactionId").asText(
                    data.path("FingpayTransactionId").asText(txnId)));
            txn.setAmount(data.path("balanceAmount").asDouble(0));
            txn.setRrn(data.path("bankRRN").asText("NA"));
            txn.setStatus("SUCCESS");
            txn.setMessage(root.path("message").asText("Transaction Successful"));
        } else {
            txn.setTxnid(txnId);
            txn.setFtxnin(txnId);
            txn.setAmount(0.0);
            txn.setRrn("TEMP" + (long) (Math.random() * 9000000000L + 1000000000L));
            txn.setStatus("FAILED");
            
            // Check if there is an inner error message or response message
            String errMsg = data.path("responseMessage").asText("");
            if (errMsg.isEmpty()) {
                errMsg = root.path("message").asText("Transaction Failed");
            }
            txn.setMessage(errMsg);
        }
        return txn;
    }

    private CashDepositResponse buildResponse(boolean success, String txnId,
                                              String maskedAadhaar, JsonNode root, JsonNode data, FingpayTransaction txn) {
        CashDepositResponse resp = new CashDepositResponse();
        resp.setMaskedAadhaar(maskedAadhaar);

        if (success) {
            resp.setStatus("SUCCESS");
            resp.setMessage(txn.getMessage());
            resp.setTxnId(txn.getTxnid());
            resp.setFpTxnId(txn.getFtxnin());
            resp.setBankRRN(txn.getRrn());
            resp.setTransactionAmount(data.path("transactionAmount").asDouble(0));
            resp.setBalanceAmount(txn.getAmount());
            resp.setResponseCode(data.path("responseCode").asText());
        } else {
            resp.setStatus("FAILED");
            resp.setMessage(txn.getMessage());
            resp.setTxnId(txnId);
            resp.setResponseCode(data.path("responseCode").asText("FP009"));
        }
        return resp;
    }

    private String md5(String input) throws Exception {
        MessageDigest md = MessageDigest.getInstance("MD5");
        byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        for (byte b : hash) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
