package com.rupiksha.aeps.provider.fingpay.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rupiksha.aeps.dto.request.AepsDailyAuthRequest;
import com.rupiksha.aeps.dto.response.AepsWorkflowState;
import com.rupiksha.aeps.dto.response.ProviderKycResult;
import com.rupiksha.aeps.provider.fingpay.entity.AepsKyc;
import com.rupiksha.aeps.provider.fingpay.entity.Fingpay2faTxn;
import com.rupiksha.aeps.provider.fingpay.repository.AepsKycRepository;
import com.rupiksha.aeps.provider.fingpay.repository.FingUserRepository;
import com.rupiksha.aeps.provider.fingpay.repository.Fingpay2faTxnRepository;
import com.rupiksha.aeps.provider.fingpay.util.FingpayEncryptionUtil;
import com.rupiksha.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.crypto.SecretKey;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class FpDailyAuthService {

    private final FingpayEncryptionUtil encryptionUtil;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;
    private final AepsKycRepository aepsKycRepo;
    private final FingUserRepository fingUserRepository;
    private final Fingpay2faTxnRepository dailyTxnRepo;
    private final UserRepository mainUserRepository;

    @Value("${fingpay.supermerchant.id:1407}")
    private Integer superMerchantId;

    @Value("${fingpay.device.imei:10068311}")
    private String configuredDeviceImei;

    @Value("${fingpay.daily-auth.url:https://fingpayap.tapits.in/fpaepsservice/auth/tfauth/merchant/validate/aadhar}")
    private String dailyAuthUrl;

    public ProviderKycResult authenticate(AepsDailyAuthRequest request) {
        String merchantTranId = "FGP2FA" + System.currentTimeMillis();
        log.info("FpDailyAuthService starting daily authentication for mobile: {}, tranId: {}, serviceType: {}", 
                request.getMobileNumber(), merchantTranId, request.getServiceType());

        try {
            // 1. Fetch main user to resolve internal UUID
            com.rupiksha.backend.domain.User mainUser = mainUserRepository.findByMobile(request.getMobileNumber())
                    .orElseThrow(() -> new RuntimeException("Merchant core account not found for: " + request.getMobileNumber()));

            long uidLong = mainUser.getId().getMostSignificantBits() & Long.MAX_VALUE;

            // 2. Fetch outlet details & pin
            AepsKyc kyc = aepsKycRepo.findByUid(uidLong).orElse(null);

            String merchantUserName = resolveMerchantUserName(mainUser, kyc, request.getMerchantId());
            if (merchantUserName == null || merchantUserName.isBlank()) {
                throw new RuntimeException("Fingpay merchant login ID is missing for daily authentication.");
            }
            String rawPin = (kyc != null && kyc.getMpin() != null && !kyc.getMpin().isBlank())
                    ? kyc.getMpin()
                    : fingUserRepository.findById(uidLong)
                    .map(com.rupiksha.aeps.provider.fingpay.entity.FingUser::getPin)
                    .orElse("1234");
            log.info("Daily 2FA merchant identity resolved for mobile={} using merchantUserName='{}'", request.getMobileNumber(), merchantUserName);

            // 3. Parse Biometrics XML
            Map<String, String> biometricMap = parsePidXml(request.getPidXml());
            
            // Resolve device IMEI / serial number
            String deviceIMEI = biometricMap.get("srno");
            if (deviceIMEI == null || deviceIMEI.trim().isEmpty()) {
                deviceIMEI = biometricMap.get("dc");
            }
            if (deviceIMEI == null || deviceIMEI.trim().isEmpty()) {
                deviceIMEI = configuredDeviceImei;
            }

            Map<String, Object> captureResponse = new LinkedHashMap<>();
            captureResponse.put("errCode", biometricMap.get("errCode"));
            captureResponse.put("errInfo", biometricMap.get("errInfo"));
            captureResponse.put("fCount", biometricMap.getOrDefault("fCount", "1"));
            captureResponse.put("fType", biometricMap.getOrDefault("fType", "0"));
            captureResponse.put("iCount", biometricMap.getOrDefault("iCount", "0"));
            captureResponse.put("iType", biometricMap.getOrDefault("iType", "0"));
            captureResponse.put("pCount", biometricMap.getOrDefault("pCount", "0"));
            captureResponse.put("pType", biometricMap.getOrDefault("pType", "0"));
            captureResponse.put("nmPoints", biometricMap.getOrDefault("nmPoints", "46"));
            captureResponse.put("qScore", biometricMap.getOrDefault("qScore", "100"));
            captureResponse.put("dpID", biometricMap.get("dpID"));
            captureResponse.put("rdsID", biometricMap.get("rdsID"));
            captureResponse.put("rdsVer", biometricMap.get("rdsVer"));
            captureResponse.put("dc", biometricMap.get("dc"));
            captureResponse.put("mi", biometricMap.get("mi"));
            captureResponse.put("mc", biometricMap.get("mc"));
            captureResponse.put("ci", biometricMap.get("ci"));
            captureResponse.put("sessionKey", biometricMap.get("sessionKey"));
            captureResponse.put("hmac", biometricMap.get("hmac"));
            captureResponse.put("PidDatatype", biometricMap.getOrDefault("PidDatatype", "FMR"));
            captureResponse.put("Piddata", biometricMap.get("Piddata"));

            // 4. Construct Aadhaar/VID representation
            Map<String, Object> cardOrUID = new LinkedHashMap<>();
            String rawAadhar = request.getAdharNumber();
            if (rawAadhar == null || rawAadhar.isBlank()) {
                rawAadhar = mainUser.getAadhaarNumber();
            }
            if (rawAadhar != null && rawAadhar.length() == 16) {
                cardOrUID.put("indicatorforUID", 2);
                cardOrUID.put("adhaarNumber", "999999999999");
                cardOrUID.put("virtualId", rawAadhar);
                cardOrUID.put("nationalBankIdentificationNumber", "");
            } else {
                cardOrUID.put("indicatorforUID", 0);
                cardOrUID.put("adhaarNumber", rawAadhar != null ? rawAadhar : "");
                cardOrUID.put("nationalBankIdentificationNumber", "");
            }

            // Resolve target serviceType ("AEPS" or "AP" strictly per doc p. 8)
            String rawService = request.getServiceType();
            String resolvedServiceType = "AEPS";
            if (rawService != null && (rawService.equalsIgnoreCase("AP")
                    || rawService.equalsIgnoreCase("AADHAAR_PAY")
                    || rawService.equalsIgnoreCase("AADHAARPAY"))) {
                resolvedServiceType = "AP";
            }

            // Parse numerical latitude and longitude per official model
            double lat = 28.6139;
            try {
                if (request.getLatitude() != null && !request.getLatitude().isBlank()) {
                    lat = Double.parseDouble(request.getLatitude().trim());
                }
            } catch (Exception ignored) {}

            double lon = 77.2090;
            try {
                if (request.getLongitude() != null && !request.getLongitude().isBlank()) {
                    lon = Double.parseDouble(request.getLongitude().trim());
                }
            } catch (Exception ignored) {}

            int superMerchantIdInt = (superMerchantId != null) ? superMerchantId : 1407;

            // 5. Main JSON payload strictly adhering to 2FA Biometric API v2.1
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("superMerchantId", superMerchantIdInt);
            payload.put("merchantUserName", merchantUserName);
            payload.put("merchantPin", md5(rawPin));
            payload.put("transactionType", "AUO");
            payload.put("latitude", lat);
            payload.put("longitude", lon);
            payload.put("requestRemarks", "Daily 2FA Validation");
            payload.put("merchantTranId", merchantTranId);
            payload.put("serviceType", resolvedServiceType);
            payload.put("mobileNumber", request.getMobileNumber());
            payload.put("cardnumberORUID", cardOrUID);
            payload.put("captureResponse", captureResponse);

            String plainJson = objectMapper.writeValueAsString(payload);
            log.info("========== FINGPAY DAILY 2FA REQUEST PAYLOAD PRE-CHECK ==========");
            log.info("dailyAuthUrl: {}", dailyAuthUrl);
            log.info("superMerchantId: {}", superMerchantIdInt);
            log.info("merchantUserName: {}", merchantUserName);
            log.info("serviceType: {}", resolvedServiceType);
            log.info("deviceIMEI: {}", deviceIMEI);
            log.info("merchantTranId: {}", merchantTranId);
            log.info("Plain JSON: {}", plainJson);
            log.info("=================================================================");

            // 6. Encrypt body and key
            SecretKey sessionKey = encryptionUtil.generateSessionKey();
            String encryptedBody = encryptionUtil.encryptBody(plainJson, sessionKey);
            String eskey = encryptionUtil.encryptSessionKey(sessionKey);
            String trnTimestamp = encryptionUtil.timestamp();

            // Daily 2FA follows the same encrypted-AEPS signing rule as provider sample:
            // Base64(SHA-256(plainJson))
            String hash = encryptionUtil.generateHash(plainJson);

            // 7. Request Execution
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.TEXT_PLAIN);
            headers.set("trnTimestamp", trnTimestamp);
            headers.set("hash", hash);
            headers.set("deviceIMEI", deviceIMEI);
            headers.set("eskey", eskey);

            HttpEntity<String> entity = new HttpEntity<>(encryptedBody, headers);
            log.info("Sending Daily 2FA request to: {}", dailyAuthUrl);
            
            ResponseEntity<String> httpResp = restTemplate.exchange(
                    dailyAuthUrl, HttpMethod.POST, entity, String.class
            );

            log.info("========== FINGPAY DAILY 2FA RESPONSE ==========");
            log.info("HTTP Status: {}", httpResp.getStatusCode());
            log.info("Response Body: {}", httpResp.getBody());
            log.info("================================================");

            // Parse response body
            JsonNode root = objectMapper.readTree(httpResp.getBody());
            String statusStr = root.path("status").asText("");
            boolean apiSuccess = "true".equalsIgnoreCase(statusStr)
                    || "SUCCESS".equalsIgnoreCase(statusStr)
                    || root.path("status").asBoolean(false);

            JsonNode dataNode = root.path("data");
            String responseCode = dataNode.path("responseCode").asText("");
            String responseMessage = dataNode.path("responseMessage").asText("");

            boolean authenticated = apiSuccess && "00".equals(responseCode);

            // 8. Log Audit Details safely (Never store Aadhaar or Biometrics)
            Fingpay2faTxn dailyTxn = Fingpay2faTxn.builder()
                    .userId(mainUser.getId())
                    .merchantTranId(merchantTranId)
                    .fingpayTransactionId(dataNode.path("fingpayTransactionId").asText(""))
                    .tefPkId(dataNode.path("tefPkId").asLong(0L))
                    .stan(dataNode.path("stan").asText(""))
                    .fpRrn(dataNode.path("fpRrn").asText(""))
                    .responseCode(responseCode.isEmpty() ? (authenticated ? "00" : "99") : responseCode)
                    .responseMessage(responseMessage.isEmpty() ? (authenticated ? "SUCCESS" : root.path("message").asText("Authentication Failed")) : responseMessage)
                    .mobileNumber(request.getMobileNumber())
                    .transactionTimestamp(LocalDateTime.now())
                    .authenticatedAt(authenticated ? LocalDateTime.now() : null)
                    .serviceType(resolvedServiceType)
                    .provider("fingpay")
                    .build();

            dailyTxnRepo.save(dailyTxn);

            if (authenticated) {
                log.info("Fingpay Daily 2FA authenticated successfully for mobile: {}", request.getMobileNumber());
                return ProviderKycResult.builder()
                        .workflowState(AepsWorkflowState.READY_FOR_TRANSACTIONS)
                        .providerTxnId(dailyTxn.getFingpayTransactionId())
                        .providerReference(String.valueOf(dailyTxn.getTefPkId()))
                        .message("Daily authentication completed successfully.")
                        .build();
            } else {
                log.warn("Fingpay Daily 2FA authentication rejected: Code={}, Message={}", responseCode, responseMessage);
                return ProviderKycResult.builder()
                        .workflowState(AepsWorkflowState.READY_FOR_DAILY_2FA)
                        .message(dailyTxn.getResponseMessage())
                        .build();
            }

        } catch (Exception e) {
            log.error("Fingpay Daily 2FA authentication execution failed: {}", e.getMessage(), e);
            return ProviderKycResult.builder()
                    .workflowState(AepsWorkflowState.READY_FOR_DAILY_2FA)
                    .message("Daily authentication failed: " + e.getMessage())
                    .build();
        }
    }

    private Map<String, String> parsePidXml(String pidXml) throws Exception {
        Map<String, String> map = new HashMap<>();
        
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        DocumentBuilder builder = factory.newDocumentBuilder();
        Document doc = builder.parse(new ByteArrayInputStream(pidXml.trim().getBytes(StandardCharsets.UTF_8)));
        
        Element root = doc.getDocumentElement();
        
        NodeList respList = root.getElementsByTagName("Resp");
        if (respList.getLength() > 0) {
            Element resp = (Element) respList.item(0);
            map.put("errCode", resp.getAttribute("errCode"));
            map.put("errInfo", resp.getAttribute("errInfo"));
            map.put("fCount", resp.getAttribute("fCount"));
            String fType = resp.getAttribute("fType");
            // Fingpay 2FA model expects UIDAI format type code (0 for FMR / 1 for FIR)
            map.put("fType", (fType != null && !fType.isBlank() && !fType.equals("2")) ? fType : "0");
            map.put("iCount", resp.getAttribute("iCount"));
            map.put("iType", resp.getAttribute("iType"));
            map.put("pCount", resp.getAttribute("pCount"));
            map.put("pType", resp.getAttribute("pType"));
            String nmPoints = resp.getAttribute("nmPoints");
            map.put("nmPoints", (nmPoints != null && !nmPoints.isBlank() && !nmPoints.equals("0")) ? nmPoints : "46");
            String qScore = resp.getAttribute("qScore");
            map.put("qScore", (qScore != null && !qScore.isBlank() && !qScore.equals("0")) ? qScore : "100");
        }
        
        NodeList devInfoList = root.getElementsByTagName("DeviceInfo");
        if (devInfoList.getLength() > 0) {
            Element devInfo = (Element) devInfoList.item(0);
            String dpID = devInfo.getAttribute("dpID");
            map.put("dpID", dpID.isEmpty() ? devInfo.getAttribute("dpId") : dpID);
            String rdsID = devInfo.getAttribute("rdsID");
            map.put("rdsID", rdsID.isEmpty() ? devInfo.getAttribute("rdsId") : rdsID);
            map.put("rdsVer", devInfo.getAttribute("rdsVer"));
            map.put("dc", devInfo.getAttribute("dc"));
            map.put("mi", devInfo.getAttribute("mi"));
            map.put("mc", devInfo.getAttribute("mc"));
        }
        
        // Parse Param srno tags under additional_info
        NodeList paramList = root.getElementsByTagName("Param");
        for (int i = 0; i < paramList.getLength(); i++) {
            Element param = (Element) paramList.item(i);
            String name = param.getAttribute("name");
            if (name != null && name.equalsIgnoreCase("srno")) {
                map.put("srno", param.getAttribute("value"));
            }
        }
        
        NodeList skeyList = root.getElementsByTagName("Skey");
        if (skeyList.getLength() > 0) {
            Element skey = (Element) skeyList.item(0);
            map.put("ci", skey.getAttribute("ci"));
            map.put("sessionKey", skey.getTextContent().trim());
        }
        
        NodeList hmacList = root.getElementsByTagName("Hmac");
        if (hmacList.getLength() > 0) {
            map.put("hmac", hmacList.item(0).getTextContent().trim());
        }
        
        NodeList dataList = root.getElementsByTagName("Data");
        if (dataList.getLength() > 0) {
            Element data = (Element) dataList.item(0);
            String dataType = data.getAttribute("type");
            if (dataType == null || dataType.isBlank() || "raw".equalsIgnoreCase(dataType)) {
                dataType = "FMR";
            }
            map.put("PidDatatype", dataType);
            map.put("Piddata", data.getTextContent().trim());
        }
        
        return map;
    }

    private String resolveMerchantUserName(com.rupiksha.backend.domain.User mainUser, AepsKyc kyc, String requestMerchantId) {
        if (kyc != null && kyc.getOutlet() != null && !kyc.getOutlet().isBlank()) {
            return kyc.getOutlet().trim();
        }
        if (kyc != null && kyc.getMerchantId() != null && !kyc.getMerchantId().isBlank()) {
            return kyc.getMerchantId().trim();
        }
        if (mainUser.getPartyCode() != null && !mainUser.getPartyCode().isBlank()) {
            return mainUser.getPartyCode().trim();
        }
        if (requestMerchantId != null && !requestMerchantId.isBlank()) {
            return requestMerchantId.trim();
        }
        if (mainUser.getAepsAgentId() != null && !mainUser.getAepsAgentId().isBlank()) {
            return mainUser.getAepsAgentId().trim();
        }
        if (mainUser.getAepsMerchantId() != null && !mainUser.getAepsMerchantId().isBlank()) {
            return mainUser.getAepsMerchantId().trim();
        }
        if (mainUser.getMobile() != null && !mainUser.getMobile().isBlank()) {
            return mainUser.getMobile().trim();
        }
        return null;
    }

    private String md5(String input) throws Exception {
        MessageDigest md = MessageDigest.getInstance("MD5");
        byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder();
        for (byte b : hash) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}
