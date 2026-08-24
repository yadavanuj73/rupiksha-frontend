package com.rupiksha.aeps.provider.fingpay.service;

import com.rupiksha.aeps.provider.fingpay.dto.BalanceInquiryRequest;
import com.rupiksha.aeps.provider.fingpay.dto.BalanceInquiryResponse;
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
public class BalanceInquiryService {

    private final FingpayEncryptionUtil encryptionUtil;
    private final FingpayTransactionRepository txnRepo;
    private final FingBankRepository bankRepo;
    private final AepsKycRepository aepsKycRepo;
    private final FingUserRepository userRepo;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    @Value("${fingpay.bi.url:https://fingpayap.tapits.in/fpaepsservice/api/balanceInquiry/merchant/getBalance}")
    private String biUrl;

    @Value("${fingpay.device.imei:10068311}")
    private String deviceImei;

    @Value("${fingpay.supermerchant.id:1407}")
    private String superMerchantId;

    public BalanceInquiryResponse process(BalanceInquiryRequest req) {

        String txnId = "BE" + System.currentTimeMillis();
        String maskedAadhaar = (req.getAadhar() != null && req.getAadhar().length() >= 4)
                ? "XXXXXXXX" + req.getAadhar().substring(req.getAadhar().length() - 4)
                : "XXXXXXXXXXXX";

        try {
            // 1. Bank IIN resolve
            FingBank bank = bankRepo.findById(req.getBankId())
                    .orElseThrow(() -> new RuntimeException("INVALID BANK CODE: " + req.getBankId()));

            // 2. Merchant credentials
            AepsKyc kyc = aepsKycRepo.findByUid(req.getUid()).orElse(null);
            String merchantUserName = null;
            String rawPin = null;

            if (kyc != null && kyc.getOutlet() != null && !kyc.getOutlet().isBlank()) {
                merchantUserName = kyc.getOutlet();
                rawPin = kyc.getMpin();
            }

            if (rawPin == null || rawPin.isBlank()) {
                FingUser fu = userRepo.findById(req.getUid()).orElse(null);
                if (fu != null) {
                    rawPin = fu.getPin();
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
            captureResponse.put("errInfo", req.getErrorInfo() != null ? req.getErrorInfo() : "Image Capture Success");
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

            // 4. cardnumberORUID per Fingpay documentation
            Map<String, Object> cardOrUID = new LinkedHashMap<>();
            cardOrUID.put("nationalBankIdentificationNumber", bank.getIinno());

            boolean isVirtualId = (req.getAadhar() != null && req.getAadhar().length() == 16) ||
                    (req.getVirtualId() != null && !req.getVirtualId().isBlank());

            if (isVirtualId) {
                String vid = (req.getVirtualId() != null && !req.getVirtualId().isBlank())
                        ? req.getVirtualId()
                        : req.getAadhar();
                cardOrUID.put("indicatorforUID", 1);
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

            // 5. Main JSON payload per Fingpay Balance Inquiry documentation
            // (Note: uses merchantTransactionId for Balance Inquiry)
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("merchantTransactionId", txnId);
            payload.put("languageCode", "en");
            payload.put("latitude", latVal);
            payload.put("longitude", logVal);
            payload.put("mobileNumber", req.getMobile());
            payload.put("paymentType", "B");
            payload.put("requestRemarks", req.getRequestRemarks() != null && !req.getRequestRemarks().isBlank() ? req.getRequestRemarks() : "BE");
            payload.put("timestamp", encryptionUtil.timestamp());
            payload.put("transactionType", "BE");
            payload.put("merchantUserName", merchantUserName);
            payload.put("merchantPin", md5(rawPin));
            payload.put("subMerchantId", "");
            payload.put("superMerchantId", superMerchantId);
            payload.put("cardnumberORUID", cardOrUID);
            payload.put("captureResponse", captureResponse);

            String plainJson = objectMapper.writeValueAsString(payload);
            log.info("Fingpay Balance Inquiry Plain Request: txnId={}, mobile={}, bankIIN={}",
                    txnId, req.getMobile(), bank.getIinno());

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
                    biUrl, HttpMethod.POST, entity, String.class);

            log.info("Fingpay Balance Inquiry Raw Response for txnId {}: {}", txnId, httpResp.getBody());

            // 9. Parse response
            JsonNode root = objectMapper.readTree(httpResp.getBody());
            JsonNode data = root.path("data");

            // 10. Success condition per Fingpay doc: bankRRN present AND responseCode == "00"
            boolean success = isSuccess(root, data);

            // 11. Save transaction
            FingpayTransaction txn = buildTxn(req, txnId, maskedAadhaar, plainJson,
                    httpResp.getBody(), success, root, data);
            txnRepo.save(txn);

            // 12. Build response
            return buildResponse(success, txnId, maskedAadhaar, root, data, txn);

        } catch (Exception e) {
            log.error("Balance Inquiry error uid={} txnId={} msg={}", req.getUid(), txnId, e.getMessage(), e);
            BalanceInquiryResponse resp = new BalanceInquiryResponse();
            resp.setStatus("ERROR");
            resp.setMessage("Internal error: " + e.getMessage() + " (Ref: " + txnId + ")");
            resp.setTxnId(txnId);
            return resp;
        }
    }

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

    private FingpayTransaction buildTxn(BalanceInquiryRequest req, String txnId,
                                        String maskedAadhaar, String plainJson, String rawResponse,
                                        boolean success, JsonNode root, JsonNode data) {

        FingpayTransaction txn = new FingpayTransaction();
        txn.setUid(req.getUid());
        txn.setType("BE");
        txn.setAadhar(maskedAadhaar);
        txn.setMobile(req.getMobile());
        txn.setBank(req.getBankId());
        txn.setTxnamount(0.0);
        txn.setRequest(plainJson);
        txn.setResponse(rawResponse);

        if (success) {
            txn.setTxnid(data.path("merchantTxnId").asText(data.path("merchantTransactionId").asText(txnId)));
            txn.setFtxnin(data.path("fpTransactionId").asText(
                    data.path("FingpayTransactionId").asText(txnId)));
            txn.setAmount(data.path("balanceAmount").asDouble(0));
            txn.setRrn(data.path("bankRRN").asText("NA"));
            txn.setStatus("SUCCESS");
            txn.setMessage(root.path("message").asText("Balance Inquiry Successful"));
        } else {
            txn.setTxnid(txnId);
            txn.setFtxnin(data != null && !data.isMissingNode() ? data.path("fpTransactionId").asText(data.path("FingpayTransactionId").asText(txnId)) : txnId);
            txn.setAmount(0.0);
            String rrn = data != null && !data.isMissingNode() ? data.path("bankRRN").asText("") : "";
            txn.setRrn(!rrn.isEmpty() ? rrn : "NA");
            txn.setStatus("FAILED");

            String msg = root.path("message").asText("");
            if (data != null && !data.isMissingNode()) {
                if (data.path("errorMessage").asText("").length() > 0) {
                    msg = data.path("errorMessage").asText();
                } else if (data.path("errInfo").asText("").length() > 0) {
                    msg = data.path("errInfo").asText();
                }
            }
            txn.setMessage(!msg.isEmpty() ? msg : "Balance Inquiry Failed");
        }
        return txn;
    }

    private BalanceInquiryResponse buildResponse(boolean success, String txnId,
                                                 String maskedAadhaar, JsonNode root, JsonNode data, FingpayTransaction txn) {

        BalanceInquiryResponse resp = new BalanceInquiryResponse();
        resp.setMaskedAadhaar(maskedAadhaar);

        if (success) {
            resp.setStatus("SUCCESS");
            resp.setMessage(txn.getMessage());
            resp.setTxnId(txn.getTxnid());
            resp.setFpTxnId(txn.getFtxnin());
            resp.setBankRRN(txn.getRrn());
            resp.setBalanceAmount(data.path("balanceAmount").asDouble(0));
            resp.setResponseCode(data.path("responseCode").asText("00"));
            resp.setTerminalId(data.path("terminalId").asText(""));
            resp.setRequestTransactionTime(data.path("requestTransactionTime").asText(""));
        } else {
            resp.setStatus("FAILED");
            resp.setMessage(txn.getMessage());
            resp.setTxnId(txnId);
            if (data != null && !data.isMissingNode()) {
                resp.setFpTxnId(data.path("fpTransactionId").asText(data.path("FingpayTransactionId").asText("")));
                resp.setBankRRN(data.path("bankRRN").asText(""));
                resp.setResponseCode(data.path("responseCode").asText(data.path("errorCode").asText("")));
                resp.setBalanceAmount(data.path("balanceAmount").asDouble(0));
                resp.setTerminalId(data.path("terminalId").asText(""));
                resp.setRequestTransactionTime(data.path("requestTransactionTime").asText(""));
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