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
    private final AepsTransactionRepository txnRepo;
    private final FingBankRepository bankRepo;
    private final AepsKycRepository aepsKycRepo;
    private final FingUserRepository userRepo;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    @Value("${fingpay.bi.url}")
    private String biUrl;

    @Value("${fingpay.device.imei}")
    private String deviceImei;

    @Value("${fingpay.supermerchant.id}")
    private String superMerchantId;

    public BalanceInquiryResponse process(BalanceInquiryRequest req) {

        // Balance inquiry ke liye txnId alag prefix
        String txnId = "BE" + System.currentTimeMillis();
        String maskedAadhaar = "XXXXXXXX" + req.getAadhar()
                .substring(req.getAadhar().length() - 4);

        try {
            // Bank IIN resolve
            FingBank bank = bankRepo.findById(req.getBankId())
                    .orElseThrow(() -> new RuntimeException("INVALID BANK CODE"));

            // Merchant credentials
            AepsKyc kyc = aepsKycRepo.findByUid(req.getUid())
                    .orElseThrow(() -> new RuntimeException("AepsKyc not found for uid: " + req.getUid()));

            String merchantUserName = kyc.getOutlet();
            String rawPin = (kyc.getMpin() != null)
                    ? kyc.getMpin()
                    : userRepo.findById(req.getUid())
                    .orElseThrow(() -> new RuntimeException("FingUser not found"))
                    .getPin();

            // captureResponse — as-is from RD service
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

            Map<String, Object> cardOrUID = new LinkedHashMap<>();
            cardOrUID.put("nationalBankIdentificationNumber", bank.getIinno());
            cardOrUID.put("indicatorforUID", "0");
            cardOrUID.put("adhaarNumber", req.getAadhar());

            // Balance inquiry mein merchantTransactionId use hota hai (CW mein merchantTranId tha)
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("merchantTransactionId", txnId);
            payload.put("languageCode", "en");
            payload.put("latitude", req.getLat());
            payload.put("longitude", req.getLog());
            payload.put("mobileNumber", req.getMobile());
            payload.put("paymentType", "B");
            payload.put("requestRemarks", "BE");
            payload.put("timestamp", encryptionUtil.timestamp());
            payload.put("transactionType", "BE");
            payload.put("merchantUserName", merchantUserName);
            payload.put("merchantPin", md5(rawPin));
            payload.put("subMerchantId", "");
            payload.put("superMerchantId", superMerchantId);
            payload.put("cardnumberORUID", cardOrUID);
            payload.put("captureResponse", captureResponse);

            String plainJson = objectMapper.writeValueAsString(payload);
            log.debug("BI plain JSON: {}", plainJson);

            // Encrypt
            SecretKey sessionKey = encryptionUtil.generateSessionKey();
            String eskey = encryptionUtil.encryptSessionKey(sessionKey);
            String encryptedBody = encryptionUtil.encryptBody(plainJson, sessionKey);
            String hash = encryptionUtil.generateHash(plainJson);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.TEXT_PLAIN);
            headers.set("trnTimestamp", encryptionUtil.timestamp());
            headers.set("hash", hash);
            headers.set("deviceIMEI", deviceImei);
            headers.set("eskey", eskey);

            HttpEntity<String> entity = new HttpEntity<>(encryptedBody, headers);
            ResponseEntity<String> httpResp = restTemplate.exchange(
                    biUrl, HttpMethod.POST, entity, String.class);
            log.debug("BI raw response: {}", httpResp.getBody());

            JsonNode root = objectMapper.readTree(httpResp.getBody());
            JsonNode data = root.path("data");

            // Success: bankRRN present AND responseCode == "00"
            boolean success = isSuccess(root, data);

            // Save transaction
            AepsTransaction txn = new AepsTransaction();
            txn.setUid(req.getUid());
            txn.setType("BE");
            txn.setAadhar(maskedAadhaar);
            txn.setMobile(req.getMobile());
            txn.setBank(req.getBankId());
            txn.setTxnamount(0.0); // BI mein amount nahi hota
            txn.setRequest(plainJson);
            txn.setResponse(httpResp.getBody());

            BalanceInquiryResponse resp = new BalanceInquiryResponse();
            resp.setMaskedAadhaar(maskedAadhaar);

            if (success) {
                txn.setTxnid(data.path("merchantTxnId").asText(txnId));
                txn.setFtxnin(data.path("fpTransactionId").asText(
                        data.path("FingpayTransactionId").asText(txnId)));
                txn.setAmount(data.path("balanceAmount").asDouble(0));
                txn.setRrn(data.path("bankRRN").asText("NA"));
                txn.setStatus("SUCCESS");
                txn.setMessage(root.path("message").asText("Balance Inquiry Successful"));
                txnRepo.save(txn);

                resp.setStatus("SUCCESS");
                resp.setMessage(txn.getMessage());
                resp.setTxnId(txn.getTxnid());
                resp.setFpTxnId(txn.getFtxnin());
                resp.setBankRRN(txn.getRrn());
                resp.setBalanceAmount(txn.getAmount());
                resp.setResponseCode(data.path("responseCode").asText());

            } else {
                txn.setTxnid(txnId);
                txn.setFtxnin(txnId);
                txn.setAmount(0.0);
                txn.setRrn("NA");
                txn.setStatus("FAILED");
                txn.setMessage(root.path("message").asText("Balance Inquiry Failed"));
                txnRepo.save(txn);

                resp.setStatus("FAILED");
                resp.setMessage(txn.getMessage());
                resp.setTxnId(txnId);
            }

            return resp;

        } catch (Exception e) {
            log.error("BI error uid={} txnId={} msg={}", req.getUid(), txnId, e.getMessage(), e);
            BalanceInquiryResponse resp = new BalanceInquiryResponse();
            resp.setStatus("ERROR");
            resp.setMessage("Internal error. Ref: " + txnId);
            return resp;
        }
    }

    private boolean isSuccess(JsonNode root, JsonNode data) {
        String s = root.path("status").asText("");
        boolean flag = "true".equalsIgnoreCase(s)
                || "SUCCESS".equalsIgnoreCase(s)
                || root.path("status").asBoolean(false);
        if (!flag || data.isMissingNode()) return false;
        return !data.path("bankRRN").asText("").isEmpty()
                && "00".equals(data.path("responseCode").asText(""));
    }

    private String md5(String input) throws Exception {
        MessageDigest md = MessageDigest.getInstance("MD5");
        byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        for (byte b : hash) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}