package com.rupiksha.aeps.provider.fingpay.service;

import com.rupiksha.aeps.provider.fingpay.dto.CashWithdrawalRequest;
import com.rupiksha.aeps.provider.fingpay.dto.CashWithdrawalResponse;
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
public class CashWithdrawalService {

    private final FingpayEncryptionUtil encryptionUtil;
    private final FingpayTransactionRepository txnRepo;
    private final FingBankRepository bankRepo;
    private final AepsKycRepository aepsKycRepo;
    private final FingUserRepository userRepo;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    @Value("${fingpay.cw.url}")
    private String cwUrl;

    @Value("${fingpay.device.imei}")
    private String deviceImei;

    @Value("${fingpay.supermerchant.id}")
    private String superMerchantId;

    public CashWithdrawalResponse process(CashWithdrawalRequest req) {

        String txnId = "CW" + System.currentTimeMillis();
        String maskedAadhaar = "XXXXXXXX" + req.getAadhar()
                .substring(req.getAadhar().length() - 4);

        try {
            // 1. Bank IIN resolve
            FingBank bank = bankRepo.findById(req.getBankId())
                    .orElseThrow(() -> new RuntimeException("INVALID BANK CODE: " + req.getBankId()));

            // 2. Merchant outlet + pin resolve
            AepsKyc kyc = (req.getUid() != null) ? aepsKycRepo.findByUid(req.getUid()).orElse(null) : null;
            if (kyc == null && req.getMerchantUserName() != null && !req.getMerchantUserName().isBlank()) {
                kyc = aepsKycRepo.findByOutlet(req.getMerchantUserName().trim())
                        .or(() -> aepsKycRepo.findByMerchantId(req.getMerchantUserName().trim()))
                        .orElse(null);
            }

            String merchantUserName = (req.getMerchantUserName() != null && !req.getMerchantUserName().isBlank()) 
                    ? req.getMerchantUserName().trim().toUpperCase() 
                    : null;
            String rawPin = (req.getMerchantPin() != null && !req.getMerchantPin().isBlank()) 
                    ? req.getMerchantPin().trim() 
                    : null;

            if (kyc != null) {
                if (merchantUserName == null || merchantUserName.isBlank()) {
                    merchantUserName = (kyc.getOutlet() != null && !kyc.getOutlet().isBlank()) 
                            ? kyc.getOutlet().trim().toUpperCase() 
                            : (kyc.getMerchantId() != null ? kyc.getMerchantId().trim().toUpperCase() : null);
                }
                if (rawPin == null || rawPin.isBlank()) {
                    rawPin = kyc.getMpin();
                }
            }

            if (rawPin == null || rawPin.isBlank()) {
                if (req.getUid() != null) {
                    FingUser fu = userRepo.findById(req.getUid()).orElse(null);
                    if (fu != null) {
                        rawPin = fu.getPin();
                    }
                }
            }

            if (merchantUserName == null || merchantUserName.isBlank()) {
                merchantUserName = String.valueOf(req.getUid());
            }
            if (rawPin == null || rawPin.isBlank()) {
                rawPin = "1234";
            }

            // 3. captureResponse — as-is from RD service
            Map<String, Object> captureResponse = new LinkedHashMap<>();
            captureResponse.put("errCode", req.getErrorCode() != null ? req.getErrorCode() : "0");
            captureResponse.put("errInfo", req.getErrorInfo() != null ? req.getErrorInfo() : "Capture Success");
            captureResponse.put("fCount", req.getFCount() != null ? req.getFCount() : "1");
            captureResponse.put("fType", req.getFType() != null ? req.getFType() : "0");
            captureResponse.put("iCount", "0");
            captureResponse.put("iType", "0");
            captureResponse.put("pCount", "0");
            captureResponse.put("pType", "0");
            captureResponse.put("nmPoints", req.getNmPoints() != null ? req.getNmPoints() : "0");
            captureResponse.put("qScore", req.getQScore() != null ? req.getQScore() : "100");
            captureResponse.put("dpID", req.getDpId() != null ? req.getDpId() : "");
            captureResponse.put("rdsID", req.getRdsId() != null ? req.getRdsId() : "");
            captureResponse.put("rdsVer", req.getRdsVer() != null ? req.getRdsVer() : "");
            captureResponse.put("dc", req.getDc() != null ? req.getDc() : "");
            captureResponse.put("mi", req.getMi() != null ? req.getMi() : "");
            captureResponse.put("mc", req.getMc() != null ? req.getMc() : "");
            captureResponse.put("ci", req.getCi() != null ? req.getCi() : "");
            captureResponse.put("sessionKey", req.getSessionKey() != null ? req.getSessionKey() : "");
            captureResponse.put("hmac", req.getHmac() != null ? req.getHmac() : "");
            captureResponse.put("PidDatatype", req.getPidType() != null ? req.getPidType() : "X");
            captureResponse.put("Piddata", req.getPidData() != null ? req.getPidData() : "");

            // 4. cardnumberORUID per Fingpay 1.20 documentation
            Map<String, Object> cardOrUID = new LinkedHashMap<>();
            cardOrUID.put("nationalBankIdentificationNumber", bank.getIinno());
            
            boolean isVirtualId = (req.getAadhar() != null && req.getAadhar().length() == 16) ||
                    (req.getVirtualId() != null && !req.getVirtualId().isBlank());
            
            if (isVirtualId) {
                String vid = (req.getVirtualId() != null && !req.getVirtualId().isBlank()) 
                        ? req.getVirtualId() 
                        : req.getAadhar();
                cardOrUID.put("indicatorforUID", 2);
                cardOrUID.put("adhaarNumber", "999999999999");
                cardOrUID.put("virtualId", vid);
            } else {
                cardOrUID.put("indicatorforUID", 0);
                cardOrUID.put("adhaarNumber", req.getAadhar());
            }

            // Parse coordinates
            double latVal = 28.6139;
            double logVal = 77.2090;
            try {
                if (req.getLat() != null && !req.getLat().isBlank()) latVal = Double.parseDouble(req.getLat());
                if (req.getLog() != null && !req.getLog().isBlank()) logVal = Double.parseDouble(req.getLog());
            } catch (Exception e) {
                log.warn("Coordinate parse warning: {}", e.getMessage());
            }

            // 5. Main JSON payload per Fingpay documentation
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("merchantTranId", txnId);
            payload.put("languageCode", "en");
            payload.put("latitude", latVal);
            payload.put("longitude", logVal);
            payload.put("mobileNumber", req.getMobile());
            payload.put("paymentType", "B");
            payload.put("requestRemarks", req.getRequestRemarks() != null && !req.getRequestRemarks().isBlank() ? req.getRequestRemarks() : "CW");
            payload.put("transactionAmount", req.getAmount());
            payload.put("timestamp", encryptionUtil.timestamp());
            payload.put("transactionType", "CW");
            payload.put("merchantUserName", merchantUserName);
            payload.put("merchantPin", md5(rawPin));
            payload.put("subMerchantId", "");
            payload.put("superMerchantId", superMerchantId);
            if (req.getTxnOtpRequestId() != null && !req.getTxnOtpRequestId().isBlank()) {
                payload.put("txnOtpRequestId", req.getTxnOtpRequestId().trim());
            }
            payload.put("cardnumberORUID", cardOrUID);
            payload.put("captureResponse", captureResponse);

            String plainJson = objectMapper.writeValueAsString(payload);
            log.info("Fingpay CW Plain Request (sensitive masked): txnId={}, mobile={}, amount={}, bankIIN={}",
                    txnId, req.getMobile(), req.getAmount(), bank.getIinno());

            // 6. Encrypt — Session key + RSA eskey + AES body + SHA-256 hash
            SecretKey sessionKey = encryptionUtil.generateSessionKey();
            String eskey = encryptionUtil.encryptSessionKey(sessionKey);
            String encryptedBody = encryptionUtil.encryptBody(plainJson, sessionKey);
            String hash = encryptionUtil.generateHash(plainJson);

            // Determine device IMEI / Serial header
            String activeImei = deviceImei;
            if (req.getDeviceId() != null && !req.getDeviceId().isBlank() && 
                    !req.getDeviceId().equalsIgnoreCase("unknown") && 
                    !req.getDeviceId().equalsIgnoreCase("WEB-SCANNER-001")) {
                activeImei = req.getDeviceId().trim();
            }

            // 7. Headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.TEXT_PLAIN);
            headers.set("trnTimestamp", encryptionUtil.timestamp());
            headers.set("hash", hash);
            headers.set("deviceIMEI", activeImei);
            headers.set("eskey", eskey);

            // 8. API call to Fingpay
            HttpEntity<String> entity = new HttpEntity<>(encryptedBody, headers);
            ResponseEntity<String> httpResp = restTemplate.exchange(
                    cwUrl, HttpMethod.POST, entity, String.class);

            log.info("Fingpay CW Raw Response for txnId {}: {}", txnId, httpResp.getBody());

            // 9. Parse response
            JsonNode root = objectMapper.readTree(httpResp.getBody());
            JsonNode data = root.path("data");

            // 10. Success condition — API docs: bankRRN present AND responseCode == "00"
            boolean success = isSuccess(root, data);

            // 11. Save transaction
            FingpayTransaction txn = buildTxn(req, txnId, maskedAadhaar, plainJson,
                    httpResp.getBody(), success, root, data);
            txnRepo.save(txn);

            // 12. Build response
            return buildResponse(success, txnId, maskedAadhaar, root, data, txn);

        } catch (Exception e) {
            log.error("CW error uid={} txnId={} msg={}", req.getUid(), txnId, e.getMessage(), e);
            CashWithdrawalResponse resp = new CashWithdrawalResponse();
            resp.setStatus("ERROR");
            resp.setMessage("Internal error: " + e.getMessage() + " (Ref: " + txnId + ")");
            resp.setTxnId(txnId);
            return resp;
        }
    }

    // API docs note: success only when bankRRN present AND responseCode == "00"
    private boolean isSuccess(JsonNode root, JsonNode data) {
        String s = root.path("status").asText("");
        boolean statusFlag = "true".equalsIgnoreCase(s)
                || "SUCCESS".equalsIgnoreCase(s)
                || root.path("status").asBoolean(false);

        if (!statusFlag || data == null || data.isMissingNode() || data.isNull()) return false;

        String rrn = data.path("bankRRN").asText("");
        String rc = data.path("responseCode").asText("");
        if (rc.isEmpty()) {
            rc = data.path("errorCode").asText("");
        }
        return !rrn.isEmpty() && "00".equals(rc);
    }

    private FingpayTransaction buildTxn(CashWithdrawalRequest req, String txnId,
                                      String maskedAadhaar, String plainJson, String rawResponse,
                                      boolean success, JsonNode root, JsonNode data) {

        FingpayTransaction txn = new FingpayTransaction();
        txn.setUid(req.getUid());
        txn.setType("CW");
        txn.setAadhar(maskedAadhaar);
        txn.setMobile(req.getMobile());
        txn.setBank(req.getBankId());
        txn.setTxnamount(req.getAmount());
        txn.setRequest(plainJson);
        txn.setResponse(rawResponse);

        if (success) {
            txn.setTxnid(data.path("merchantTxnId").asText(data.path("merchantTransactionId").asText(txnId)));
            txn.setFtxnin(data.path("fpTransactionId").asText(
                    data.path("FingpayTransactionId").asText(txnId)));
            txn.setAmount(data.path("balanceAmount").asDouble(0));
            txn.setRrn(data.path("bankRRN").asText("NA"));
            txn.setStatus("SUCCESS");
            txn.setMessage(root.path("message").asText("Transaction Successful"));
        } else {
            txn.setTxnid(txnId);
            txn.setFtxnin(data != null && !data.isMissingNode() ? data.path("fpTransactionId").asText(txnId) : txnId);
            txn.setAmount(0.0);
            String rrn = data != null && !data.isMissingNode() ? data.path("bankRRN").asText("") : "";
            txn.setRrn(!rrn.isEmpty() ? rrn : "NA");
            txn.setStatus("FAILED");
            
            String msg = root.path("message").asText("");
            if (data != null && !data.isMissingNode() && data.path("errorMessage").asText("").length() > 0) {
                msg = data.path("errorMessage").asText();
            }
            txn.setMessage(!msg.isEmpty() ? msg : "Transaction Failed");
        }
        return txn;
    }

    private CashWithdrawalResponse buildResponse(boolean success, String txnId,
                                                 String maskedAadhaar, JsonNode root, JsonNode data, FingpayTransaction txn) {

        CashWithdrawalResponse resp = new CashWithdrawalResponse();
        resp.setMaskedAadhaar(maskedAadhaar);

        if (success) {
            resp.setStatus("SUCCESS");
            resp.setMessage(txn.getMessage());
            resp.setTxnId(txn.getTxnid());
            resp.setFpTxnId(txn.getFtxnin());
            resp.setBankRRN(txn.getRrn());
            resp.setTransactionAmount(data.path("transactionAmount").asDouble(txn.getTxnamount()));
            resp.setBalanceAmount(data.path("balanceAmount").asDouble(0));
            resp.setResponseCode(data.path("responseCode").asText("00"));
        } else {
            resp.setStatus("FAILED");
            resp.setMessage(txn.getMessage());
            resp.setTxnId(txnId);
            if (data != null && !data.isMissingNode()) {
                resp.setFpTxnId(data.path("fpTransactionId").asText(""));
                resp.setBankRRN(data.path("bankRRN").asText(""));
                resp.setResponseCode(data.path("responseCode").asText(data.path("errorCode").asText("")));
                resp.setBalanceAmount(data.path("balanceAmount").asDouble(0));
                resp.setTransactionAmount(data.path("transactionAmount").asDouble(0));
            }
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