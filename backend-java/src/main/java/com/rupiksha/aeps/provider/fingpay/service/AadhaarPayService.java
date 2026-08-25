package com.rupiksha.aeps.provider.fingpay.service;

import com.rupiksha.aeps.provider.fingpay.dto.AadhaarPayRequest;
import com.rupiksha.aeps.provider.fingpay.dto.AadhaarPayResponse;
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
public class AadhaarPayService {

    private final FingpayEncryptionUtil encryptionUtil;
    private final FingpayTransactionRepository txnRepo;
    private final FingBankRepository bankRepo;
    private final AepsKycRepository aepsKycRepo;
    private final FingUserRepository userRepo;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    @Value("${fingpay.ap.url}")
    private String apUrl;

    @Value("${fingpay.device.imei}")
    private String deviceImei;

    @Value("${fingpay.supermerchant.id}")
    private String superMerchantId;

    public AadhaarPayResponse process(AadhaarPayRequest req) {

        String txnId = "AP" + System.currentTimeMillis();
        String maskedAadhaar = "XXXXXXXX" + req.getAadhar()
                .substring(req.getAadhar().length() - 4);

        try {
            // Bank IIN resolve
            FingBank bank = bankRepo.findById(req.getBankId())
                    .orElseThrow(() -> new RuntimeException("INVALID BANK CODE"));

            // Merchant credentials
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

            // Aadhaar Pay ke liye Aadhaar Pay bank list se IIN aata hai
            Map<String, Object> cardOrUID = new LinkedHashMap<>();
            cardOrUID.put("nationalBankIdentificationNumber", bank.getIinno());
            cardOrUID.put("indicatorforUID", "0");
            cardOrUID.put("adhaarNumber", req.getAadhar());

            // PHP code dekha — AP mein serviceType: "AP" extra field hai
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("merchantTranId", txnId);
            payload.put("languageCode", "en");
            payload.put("latitude", req.getLat());
            payload.put("longitude", req.getLog());
            payload.put("mobileNumber", req.getMobile());
            payload.put("paymentType", "B");
            payload.put("requestRemarks", "M");
            payload.put("transactionAmount", req.getAmount());
            payload.put("timestamp", encryptionUtil.timestamp());
            payload.put("transactionType", "M");
            payload.put("serviceType", "AP");
            payload.put("merchantUserName", merchantUserName);
            payload.put("merchantPin", md5(rawPin));
            payload.put("superMerchantId", superMerchantId);
            if (req.getTxnOtpRequestId() != null && !req.getTxnOtpRequestId().isBlank()) {
                payload.put("txnOtpRequestId", req.getTxnOtpRequestId().trim());
            }
            payload.put("cardnumberORUID", cardOrUID);
            payload.put("captureResponse", captureResponse);

            String plainJson = objectMapper.writeValueAsString(payload);

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
                    apUrl, HttpMethod.POST, entity, String.class);

            JsonNode root = objectMapper.readTree(httpResp.getBody());
            JsonNode data = root.path("data");

            // Success: bankRRN present AND responseCode == "00"
            boolean success = isSuccess(root, data);

            FingpayTransaction txn = new FingpayTransaction();
            txn.setUid(req.getUid());
            txn.setType("AP");
            txn.setAadhar(maskedAadhaar);
            txn.setMobile(req.getMobile());
            txn.setBank(req.getBankId());
            txn.setTxnamount(req.getAmount());
            txn.setRequest(plainJson);
            txn.setResponse(httpResp.getBody());

            AadhaarPayResponse resp = new AadhaarPayResponse();
            resp.setMaskedAadhaar(maskedAadhaar);

            if (success) {
                txn.setTxnid(data.path("merchantTransactionId").asText(txnId));
                txn.setFtxnin(data.path("fpTransactionId").asText(
                        data.path("FingpayTransactionId").asText(txnId)));
                txn.setAmount(data.path("balanceAmount").asDouble(0));
                txn.setRrn(data.path("bankRRN").asText("NA"));
                txn.setStatus("SUCCESS");
                txn.setMessage(root.path("message").asText("Transaction Successful"));
                txnRepo.save(txn);

                resp.setStatus("SUCCESS");
                resp.setMessage(txn.getMessage());
                resp.setTxnId(txn.getTxnid());
                resp.setFpTxnId(txn.getFtxnin());
                resp.setBankRRN(txn.getRrn());
                resp.setTransactionAmount(data.path("transactionAmount").asDouble(0));
                resp.setBalanceAmount(txn.getAmount());
                resp.setResponseCode(data.path("responseCode").asText());

            } else {
                txn.setTxnid(txnId);
                txn.setFtxnin(txnId);
                txn.setAmount(0.0);
                txn.setRrn("TEMP" + (long) (Math.random() * 9000000000L + 1000000000L));
                txn.setStatus("FAILED");
                txn.setMessage(root.path("message").asText("Transaction Failed"));
                txnRepo.save(txn);

                resp.setStatus("FAILED");
                resp.setMessage(txn.getMessage());
                resp.setTxnId(txnId);
            }

            return resp;

        } catch (Exception e) {
            log.error("AP error uid={} txnId={} msg={}", req.getUid(), txnId, e.getMessage(), e);
            AadhaarPayResponse resp = new AadhaarPayResponse();
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