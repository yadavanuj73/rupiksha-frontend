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

    @Value("${fingpay.device.imei}")
    private String deviceImei;

    @Value("${fingpay.supermerchant.id}")
    private String superMerchantId;

    @Value("${fingpay.security.key}")
    private String securityKey;

    public CashDepositResponse process(CashDepositRequest req, String transactionId) {
        String maskedAadhaar = "XXXXXXXX" + req.getAadhar().substring(req.getAadhar().length() - 4);

        try {
            // 1. Bank IIN resolve
            FingBank bank = bankRepo.findById(req.getBankId())
                    .orElseThrow(() -> new RuntimeException("INVALID BANK CODE"));

            // 2. Merchant outlet + pin resolve
            AepsKyc kyc = aepsKycRepo.findByUid(req.getUid())
                    .orElseThrow(() -> new RuntimeException("AepsKyc not found for uid: " + req.getUid()));

            String merchantUserName = kyc.getOutlet();
            String rawPin = (kyc.getMpin() != null)
                    ? kyc.getMpin()
                    : userRepo.findById(req.getUid())
                    .orElseThrow(() -> new RuntimeException("FingUser not found"))
                    .getPin();

            // 3. captureResponse (sensitive biometrics - do not log or store)
            Map<String, Object> captureResponse = new LinkedHashMap<>();
            captureResponse.put("errCode", req.getErrorCode());
            captureResponse.put("errInfo", req.getErrorInfo());
            captureResponse.put("fCount", req.getFCount());
            captureResponse.put("fType", req.getFType());
            captureResponse.put("iCount", "0");
            captureResponse.put("iType", "0");
            captureResponse.put("pCount", "0");
            captureResponse.put("pType", "0");
            captureResponse.put("nmPoints", req.getNmPoints());
            captureResponse.put("qScore", req.getQScore());
            captureResponse.put("dpID", req.getDpId());
            captureResponse.put("rdsID", req.getRdsId());
            captureResponse.put("rdsVer", req.getRdsVer());
            captureResponse.put("dc", req.getDc());
            captureResponse.put("mi", req.getMi());
            captureResponse.put("mc", req.getMc());
            captureResponse.put("ci", req.getCi());
            captureResponse.put("sessionKey", req.getSessionKey());
            captureResponse.put("hmac", req.getHmac());
            captureResponse.put("PidDatatype", req.getPidType());
            captureResponse.put("Piddata", req.getPidData());

            // 4. cardnumberORUID (handling VID automatically)
            Map<String, Object> cardOrUID = new LinkedHashMap<>();
            if (req.getAadhar().length() == 16) {
                cardOrUID.put("nationalBankIdentificationNumber", bank.getIinno());
                cardOrUID.put("indicatorforUID", "2");
                cardOrUID.put("adhaarNumber", "999999999999");
                cardOrUID.put("virtualId", req.getAadhar());
            } else {
                cardOrUID.put("nationalBankIdentificationNumber", bank.getIinno());
                cardOrUID.put("indicatorforUID", "0");
                cardOrUID.put("adhaarNumber", req.getAadhar());
            }

            // 5. Main payload
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("merchantTranId", transactionId);
            payload.put("languageCode", "en");
            payload.put("latitude", req.getLat());
            payload.put("longitude", req.getLog());
            payload.put("mobileNumber", req.getMobile());
            payload.put("paymentType", "B");
            payload.put("requestRemarks", "CD");
            payload.put("transactionAmount", req.getAmount());
            payload.put("timestamp", encryptionUtil.timestamp());
            payload.put("transactionType", "CD");
            payload.put("merchantUserName", merchantUserName);
            payload.put("merchantPin", md5(rawPin));
            payload.put("subMerchantId", "");
            payload.put("superMerchantId", superMerchantId);
            payload.put("cardnumberORUID", cardOrUID);
            payload.put("captureResponse", captureResponse);

            String plainJson = objectMapper.writeValueAsString(payload);

            // 6. Encrypt (sensitive session keys and payloads are not written to application logs)
            SecretKey sessionKey = encryptionUtil.generateSessionKey();
            String eskey = encryptionUtil.encryptSessionKey(sessionKey);
            String encryptedBody = encryptionUtil.encryptBody(plainJson, sessionKey);
            
            // Hash calculation: Base64(SHA256(JSON + securityKey))
            String hash = encryptionUtil.generateHash(plainJson + securityKey);

            // 7. Headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.TEXT_PLAIN);
            headers.set("trnTimestamp", encryptionUtil.timestamp());
            headers.set("hash", hash);
            headers.set("deviceIMEI", deviceImei);
            headers.set("eskey", eskey);

            // 8. API call
            HttpEntity<String> entity = new HttpEntity<>(encryptedBody, headers);
            ResponseEntity<String> httpResp = restTemplate.exchange(
                    cdUrl, HttpMethod.POST, entity, String.class);

            // 9. Parse response
            JsonNode root = objectMapper.readTree(httpResp.getBody());
            JsonNode data = root.path("data");

            // 10. Success condition
            boolean success = isSuccess(root, data);

            // 11. Save transaction to iaepstxn table (sensitive/biometric request details are excluded)
            FingpayTransaction txn = buildTxn(req, transactionId, maskedAadhaar, success, root, data);
            txnRepo.save(txn);

            // 12. Build sanitized response
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
            log.error("CD error uid={} txnId={} msg={}", req.getUid(), transactionId, e.getMessage(), e);
            CashDepositResponse resp = new CashDepositResponse();
            resp.setStatus("FAILED");
            resp.setMessage("Internal error. Ref: " + transactionId);
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
        String rc = data.path("responseCode").asText("");
        return !rrn.isEmpty() && "00".equals(rc);
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
