package com.example.Rupiksha.Fingpay.service;

import com.example.Rupiksha.Fingpay.dto.MiniStatementEntry;
import com.example.Rupiksha.Fingpay.dto.MiniStatementRequest;
import com.example.Rupiksha.Fingpay.dto.MiniStatementResponse;
import com.example.Rupiksha.Fingpay.entity.*;
import com.example.Rupiksha.Fingpay.repository.*;
import com.example.Rupiksha.Fingpay.util.FingpayEncryptionUtil;
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
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class MiniStatementService {

    private final FingpayEncryptionUtil encryptionUtil;
    private final AepsTransactionRepository txnRepo;
    private final FingBankRepository bankRepo;
    private final AepsKycRepository aepsKycRepo;
    private final UserRepository userRepo;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    @Value("${fingpay.ms.url}")
    private String msUrl;

    @Value("${fingpay.device.imei}")
    private String deviceImei;

    @Value("${fingpay.supermerchant.id}")
    private String superMerchantId;

    public MiniStatementResponse process(MiniStatementRequest req) {

        String txnId = "MS" + System.currentTimeMillis();
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
                    .orElseThrow(() -> new RuntimeException("User not found"))
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

            // MS payload — merchantTranId use hota hai (BI ki tarah merchantTransactionId nahi)
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("merchantTranId", txnId);
            payload.put("languageCode", "en");
            payload.put("latitude", req.getLat());
            payload.put("longitude", req.getLog());
            payload.put("mobileNumber", req.getMobile());
            payload.put("paymentType", "B");
            payload.put("requestRemarks", "MS");
            payload.put("timestamp", encryptionUtil.timestamp());
            payload.put("transactionType", "MS");
            payload.put("merchantUserName", merchantUserName);
            payload.put("merchantPin", md5(rawPin));
            payload.put("subMerchantId", "");
            payload.put("superMerchantId", superMerchantId);
            payload.put("cardnumberORUID", cardOrUID);
            payload.put("captureResponse", captureResponse);

            String plainJson = objectMapper.writeValueAsString(payload);
            log.debug("MS plain JSON: {}", plainJson);

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
                    msUrl, HttpMethod.POST, entity, String.class);
            log.debug("MS raw response: {}", httpResp.getBody());

            JsonNode root = objectMapper.readTree(httpResp.getBody());
            JsonNode data = root.path("data");

            boolean success = root.path("status").asBoolean(false)
                    || "true".equalsIgnoreCase(root.path("status").asText())
                    || "SUCCESS".equalsIgnoreCase(root.path("status").asText());

            // Save transaction
            AepsTransaction txn = new AepsTransaction();
            txn.setUid(req.getUid());
            txn.setType("MSI");
            txn.setAadhar(maskedAadhaar);
            txn.setMobile(req.getMobile());
            txn.setBank(req.getBankId());
            txn.setTxnamount(0.0);
            txn.setRequest(plainJson);
            txn.setResponse(httpResp.getBody());

            MiniStatementResponse resp = new MiniStatementResponse();
            resp.setMaskedAadhaar(maskedAadhaar);

            if (success) {
                txn.setTxnid(txnId);
                txn.setFtxnin(data.path("fpTransactionId").asText(txnId));
                txn.setAmount(data.path("balanceAmount").asDouble(0));
                txn.setRrn(data.path("bankRRN").asText("NA"));
                txn.setStatus("SUCCESS");
                txn.setMessage(root.path("message").asText("Mini Statement Successful"));
                txnRepo.save(txn);

                // Parse mini statement
                List<MiniStatementEntry> entries = parseMiniStatement(data);

                resp.setStatus("SUCCESS");
                resp.setMessage(txn.getMessage());
                resp.setTxnId(txnId);
                resp.setFpTxnId(txn.getFtxnin());
                resp.setBankRRN(txn.getRrn());
                resp.setBalanceAmount(txn.getAmount());
                resp.setMiniStatement(entries);

            } else {
                txn.setTxnid(txnId);
                txn.setFtxnin(txnId);
                txn.setAmount(0.0);
                txn.setRrn("NA");
                txn.setStatus("FAILED");
                txn.setMessage(root.path("message").asText("Mini Statement Failed"));
                txnRepo.save(txn);

                resp.setStatus("FAILED");
                resp.setMessage(txn.getMessage());
                resp.setTxnId(txnId);
                resp.setMiniStatement(new ArrayList<>());
            }

            return resp;

        } catch (Exception e) {
            log.error("MS error uid={} txnId={} msg={}", req.getUid(), txnId, e.getMessage(), e);
            MiniStatementResponse resp = new MiniStatementResponse();
            resp.setStatus("ERROR");
            resp.setMessage("Internal error. Ref: " + txnId);
            return resp;
        }
    }

    /**
     * miniOffusFlag true  → miniOffusStatementStructureModel parse karo (raw string format)
     * miniOffusFlag false → miniStatementStructureModel directly use karo
     */
    private List<MiniStatementEntry> parseMiniStatement(JsonNode data) {
        List<MiniStatementEntry> entries = new ArrayList<>();

        boolean miniOffusFlag = data.path("miniOffusFlag").asBoolean(false);

        if (miniOffusFlag) {
            // Raw string format: "9:/6: PI/063054493194/ D     113.00"
            JsonNode offusList = data.path("miniOffusStatementStructureModel");
            Pattern pattern = Pattern.compile(
                    "(\\d+):/(\\d+):\\s*PI/(\\d+)/\\s*([CD])\\s+([\\d.]+)");
            String today = LocalDateTime.now()
                    .format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));

            for (JsonNode node : offusList) {
                String line = node.asText();
                Matcher m = pattern.matcher(line);
                if (m.find()) {
                    MiniStatementEntry entry = new MiniStatementEntry();
                    entry.setDate(today);
                    entry.setTxnType("D".equals(m.group(4)) ? "Dr" : "Cr");
                    entry.setAmount(m.group(5));
                    entry.setNarration("PI/" + m.group(3));
                    entries.add(entry);
                }
            }
        } else {
            // Structured format
            JsonNode list = data.path("miniStatementStructureModel");
            for (JsonNode node : list) {
                MiniStatementEntry entry = new MiniStatementEntry();
                entry.setDate(node.path("date").asText());
                entry.setTxnType(node.path("txnType").asText());
                entry.setAmount(node.path("amount").asText());
                entry.setNarration(node.path("narration").asText());
                entries.add(entry);
            }
        }

        return entries;
    }

    private String md5(String input) throws Exception {
        MessageDigest md = MessageDigest.getInstance("MD5");
        byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        for (byte b : hash) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}