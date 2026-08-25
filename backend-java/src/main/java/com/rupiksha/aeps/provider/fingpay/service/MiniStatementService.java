package com.rupiksha.aeps.provider.fingpay.service;

import com.rupiksha.aeps.provider.fingpay.dto.MiniStatementEntry;
import com.rupiksha.aeps.provider.fingpay.dto.MiniStatementRequest;
import com.rupiksha.aeps.provider.fingpay.dto.MiniStatementResponse;
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
    private final FingpayTransactionRepository txnRepo;
    private final FingBankRepository bankRepo;
    private final AepsKycRepository aepsKycRepo;
    private final FingUserRepository userRepo;
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
        String maskedAadhaar = (req.getAadhar() != null && req.getAadhar().length() >= 4)
                ? "XXXXXXXX" + req.getAadhar().substring(req.getAadhar().length() - 4)
                : "XXXXXXXXXXXX";

        try {
            // 1. Bank IIN resolve
            FingBank bank = bankRepo.findById(req.getBankId())
                    .orElseThrow(() -> new RuntimeException("INVALID BANK CODE: " + req.getBankId()));

            // 2. Merchant credentials resolution
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

            // 4. cardnumberORUID per Fingpay Mini Statement documentation
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

            // 5. Parse coordinates
            double latVal = 28.6139;
            double logVal = 77.2090;
            try {
                if (req.getLat() != null && !req.getLat().isBlank()) latVal = Double.parseDouble(req.getLat());
                if (req.getLog() != null && !req.getLog().isBlank()) logVal = Double.parseDouble(req.getLog());
            } catch (Exception e) {
                log.warn("Coordinate parse warning: {}", e.getMessage());
            }

            // 6. MS payload — uses merchantTranId per Fingpay MS doc
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("merchantTranId", txnId);
            payload.put("languageCode", "en");
            payload.put("latitude", latVal);
            payload.put("longitude", logVal);
            payload.put("mobileNumber", req.getMobile());
            payload.put("paymentType", "B");
            payload.put("requestRemarks", req.getRequestRemarks() != null && !req.getRequestRemarks().isBlank() ? req.getRequestRemarks() : "MS");
            payload.put("timestamp", encryptionUtil.timestamp());
            payload.put("transactionType", "MS");
            payload.put("merchantUserName", merchantUserName);
            payload.put("merchantPin", md5(rawPin));
            payload.put("subMerchantId", "");
            payload.put("superMerchantId", superMerchantId);
            payload.put("cardnumberORUID", cardOrUID);
            payload.put("captureResponse", captureResponse);

            String plainJson = objectMapper.writeValueAsString(payload);
            log.info("Fingpay Mini Statement Plain Request: txnId={}, mobile={}, bankIIN={}",
                    txnId, req.getMobile(), bank.getIinno());

            // 7. Encrypt — Session key + RSA eskey + AES body + SHA-256 hash
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

            // 8. Headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.TEXT_PLAIN);
            headers.set("trnTimestamp", encryptionUtil.timestamp());
            headers.set("hash", hash);
            headers.set("deviceIMEI", activeImei);
            headers.set("eskey", eskey);

            // 9. API call to Fingpay
            HttpEntity<String> entity = new HttpEntity<>(encryptedBody, headers);
            ResponseEntity<String> httpResp = restTemplate.exchange(
                    msUrl, HttpMethod.POST, entity, String.class);

            log.info("Fingpay Mini Statement Raw Response for txnId {}: {}", txnId, httpResp.getBody());

            // 10. Parse response
            JsonNode root = objectMapper.readTree(httpResp.getBody());
            JsonNode data = root.path("data");

            boolean success = isSuccess(root, data);

            // 11. Save transaction
            FingpayTransaction txn = new FingpayTransaction();
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
                String fpTxnId = data.path("fpTransactionId").asText(txnId);
                String bankRrn = data.path("bankRRN").asText("NA");
                double bal = data.path("balanceAmount").asDouble(0.0);
                String respMsg = root.path("message").asText("Mini Statement Successful");
                String respCode = data.path("responseCode").asText("00");

                txn.setTxnid(txnId);
                txn.setFtxnin(fpTxnId);
                txn.setAmount(bal);
                txn.setRrn(bankRrn);
                txn.setStatus("SUCCESS");
                txn.setMessage(respMsg);
                txnRepo.save(txn);

                // Parse mini statement entries
                List<MiniStatementEntry> entries = parseMiniStatement(data);

                resp.setStatus("SUCCESS");
                resp.setMessage(respMsg);
                resp.setTxnId(txnId);
                resp.setFpTxnId(fpTxnId);
                resp.setBankRRN(bankRrn);
                resp.setBalanceAmount(bal);
                resp.setMiniStatement(entries);
                resp.setResponseCode(respCode);

            } else {
                String errMsg = root.path("message").asText("Mini Statement Failed");
                if (data.hasNonNull("errorMessage") && !data.path("errorMessage").asText().isBlank()) {
                    errMsg = data.path("errorMessage").asText();
                }
                String respCode = data.path("responseCode").asText(data.path("errorCode").asText("99"));

                txn.setTxnid(txnId);
                txn.setFtxnin(txnId);
                txn.setAmount(0.0);
                txn.setRrn("NA");
                txn.setStatus("FAILED");
                txn.setMessage(errMsg);
                txnRepo.save(txn);

                resp.setStatus("FAILED");
                resp.setMessage(errMsg);
                resp.setTxnId(txnId);
                resp.setMiniStatement(new ArrayList<>());
                resp.setResponseCode(respCode);
            }

            return resp;

        } catch (Exception e) {
            log.error("MS error uid={} txnId={} msg={}", req.getUid(), txnId, e.getMessage(), e);
            MiniStatementResponse resp = new MiniStatementResponse();
            resp.setStatus("ERROR");
            resp.setMessage("Internal error: " + e.getMessage() + " (Ref: " + txnId + ")");
            resp.setTxnId(txnId);
            resp.setMiniStatement(new ArrayList<>());
            return resp;
        }
    }

    private boolean isSuccess(JsonNode root, JsonNode data) {
        String s = root.path("status").asText("");
        boolean statusFlag = "true".equalsIgnoreCase(s)
                || "SUCCESS".equalsIgnoreCase(s)
                || root.path("status").asBoolean(false);

        if (!statusFlag) return false;
        if (data == null || data.isMissingNode() || data.isNull()) return false;

        String txnStatus = data.path("transactionStatus").asText("");
        if ("failed".equalsIgnoreCase(txnStatus) || "false".equalsIgnoreCase(txnStatus)) {
            return false;
        }

        return true;
    }

    /**
     * miniOffusFlag true  → miniOffusStatementStructureModel parse karo (raw string format)
     * miniOffusFlag false → miniStatementStructureModel directly use karo
     */
    private List<MiniStatementEntry> parseMiniStatement(JsonNode data) {
        List<MiniStatementEntry> entries = new ArrayList<>();

        boolean miniOffusFlag = data.path("miniOffusFlag").asBoolean(false);

        if (miniOffusFlag && data.hasNonNull("miniOffusStatementStructureModel")) {
            // Raw string format examples: 
            // "9:/6: PI/063054493194/ D     113.00"
            // "31/12/19 Cr 1.00 INF/INFT/021841"
            JsonNode offusList = data.path("miniOffusStatementStructureModel");
            Pattern pattern1 = Pattern.compile("(\\d+):/(\\d+):\\s*PI/(\\d+)/\\s*([CD])\\s+([\\d.]+)");
            Pattern pattern2 = Pattern.compile("(\\d{2}/\\d{2}/\\d{2,4})\\s+([CD]r?)\\s+([\\d.,]+)\\s+(.*)");
            String today = LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy"));

            for (JsonNode node : offusList) {
                String line = node.asText().trim();
                if (line.isEmpty()) continue;

                Matcher m1 = pattern1.matcher(line);
                if (m1.find()) {
                    MiniStatementEntry entry = new MiniStatementEntry();
                    entry.setDate(today);
                    entry.setTxnType("D".equalsIgnoreCase(m1.group(4)) ? "Dr" : "Cr");
                    entry.setAmount(m1.group(5).trim());
                    entry.setNarration("PI/" + m1.group(3));
                    entries.add(entry);
                    continue;
                }

                Matcher m2 = pattern2.matcher(line);
                if (m2.find()) {
                    MiniStatementEntry entry = new MiniStatementEntry();
                    entry.setDate(m2.group(1).trim());
                    entry.setTxnType(m2.group(2).toLowerCase().startsWith("c") ? "Cr" : "Dr");
                    entry.setAmount(m2.group(3).trim());
                    entry.setNarration(m2.group(4).trim());
                    entries.add(entry);
                    continue;
                }

                // Fallback for unparsed raw line
                MiniStatementEntry entry = new MiniStatementEntry();
                entry.setDate(today);
                entry.setTxnType(line.contains("Dr") || line.contains(" D ") ? "Dr" : "Cr");
                entry.setAmount("0.00");
                entry.setNarration(line);
                entries.add(entry);
            }
        } else if (data.hasNonNull("miniStatementStructureModel")) {
            // Structured format: [{date, txnType, amount, narration}]
            JsonNode list = data.path("miniStatementStructureModel");
            for (JsonNode node : list) {
                MiniStatementEntry entry = new MiniStatementEntry();
                entry.setDate(node.path("date").asText("").trim());
                String txnType = node.path("txnType").asText("").trim();
                entry.setTxnType(txnType.equalsIgnoreCase("c") || txnType.equalsIgnoreCase("cr") ? "Cr" : "Dr");
                entry.setAmount(node.path("amount").asText("").trim());
                entry.setNarration(node.path("narration").asText("").trim());
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