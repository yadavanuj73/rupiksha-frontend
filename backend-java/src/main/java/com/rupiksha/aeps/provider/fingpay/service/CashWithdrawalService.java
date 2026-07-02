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
    private final AepsTransactionRepository txnRepo;
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
                    .orElseThrow(() -> new RuntimeException("INVALID BANK CODE"));

            // 2. Merchant outlet + pin resolve (PHP jaisa)
            AepsKyc kyc = aepsKycRepo.findByUid(req.getUid())
                    .orElseThrow(() -> new RuntimeException("AepsKyc not found for uid: " + req.getUid()));

            String merchantUserName = kyc.getOutlet();
            String rawPin = (kyc.getMpin() != null)
                    ? kyc.getMpin()
                    : userRepo.findById(req.getUid())
                    .orElseThrow(() -> new RuntimeException("FingUser not found"))
                    .getPin();

            // 3. captureResponse — as-is from RD service, kuch mat badlo
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

            // 4. cardnumberORUID
            Map<String, Object> cardOrUID = new LinkedHashMap<>();
            cardOrUID.put("nationalBankIdentificationNumber", bank.getIinno());
            cardOrUID.put("indicatorforUID", "0");
            cardOrUID.put("adhaarNumber", req.getAadhar());

            // 5. Main payload
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("merchantTranId", txnId);
            payload.put("languageCode", "en");
            payload.put("latitude", req.getLat());
            payload.put("longitude", req.getLog());
            payload.put("mobileNumber", req.getMobile());
            payload.put("paymentType", "B");
            payload.put("requestRemarks", "CW");
            payload.put("transactionAmount", req.getAmount());
            payload.put("timestamp", encryptionUtil.timestamp());
            payload.put("transactionType", "CW");
            payload.put("merchantUserName", merchantUserName);
            payload.put("merchantPin", md5(rawPin));
            payload.put("subMerchantId", "");
            payload.put("superMerchantId", superMerchantId);
            payload.put("cardnumberORUID", cardOrUID);
            payload.put("captureResponse", captureResponse);

            String plainJson = objectMapper.writeValueAsString(payload);
            log.debug("CW plain JSON: {}", plainJson);

            // 6. Encrypt — Java endpoint requires full encryption
            SecretKey sessionKey = encryptionUtil.generateSessionKey();
            String eskey = encryptionUtil.encryptSessionKey(sessionKey);
            String encryptedBody = encryptionUtil.encryptBody(plainJson, sessionKey);
            String hash = encryptionUtil.generateHash(plainJson);

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
                    cwUrl, HttpMethod.POST, entity, String.class);
            log.debug("CW raw response: {}", httpResp.getBody());

            // 9. Parse response
            JsonNode root = objectMapper.readTree(httpResp.getBody());
            JsonNode data = root.path("data");

            // 10. Success condition — API docs: bankRRN present AND responseCode == "00"
            boolean success = isSuccess(root, data);

            // 11. Save transaction
            AepsTransaction txn = buildTxn(req, txnId, maskedAadhaar, plainJson,
                    httpResp.getBody(), success, root, data);
            txnRepo.save(txn);

            // 12. Build response
            return buildResponse(success, txnId, maskedAadhaar, root, data, txn);

        } catch (Exception e) {
            log.error("CW error uid={} txnId={} msg={}", req.getUid(), txnId, e.getMessage(), e);
            CashWithdrawalResponse resp = new CashWithdrawalResponse();
            resp.setStatus("ERROR");
            resp.setMessage("Internal error. Ref: " + txnId);
            return resp;
        }
    }

    // API docs note: success only when bankRRN present AND responseCode == "00"
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

    private AepsTransaction buildTxn(CashWithdrawalRequest req, String txnId,
                                     String maskedAadhaar, String plainJson, String rawResponse,
                                     boolean success, JsonNode root, JsonNode data) {

        AepsTransaction txn = new AepsTransaction();
        txn.setUid(req.getUid());
        txn.setType("CW");
        txn.setAadhar(maskedAadhaar);
        txn.setMobile(req.getMobile());
        txn.setBank(req.getBankId());
        txn.setTxnamount(req.getAmount());
        txn.setRequest(plainJson);
        txn.setResponse(rawResponse);

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
            txn.setMessage(root.path("message").asText("Transaction Failed"));
        }
        return txn;
    }

    private CashWithdrawalResponse buildResponse(boolean success, String txnId,
                                                 String maskedAadhaar, JsonNode root, JsonNode data, AepsTransaction txn) {

        CashWithdrawalResponse resp = new CashWithdrawalResponse();
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