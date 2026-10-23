package com.rupiksha.backend.integration.bbps;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rupiksha.backend.integration.bbps.dto.BillAvenueDtos;
import com.rupiksha.backend.integration.bbps.util.BillAvenueCryptoUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
public class BillAvenueClient {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    @Value("${billavenue.base-url:https://stgapi.billavenue.com/billpay}")
    private String baseUrl;

    @Value("${billavenue.access-code:}")
    private String accessCode;

    @Value("${billavenue.working-key:}")
    private String workingKey;

    @Value("${billavenue.institute-id:CC01}")
    private String instituteId;

    @Value("${billavenue.agent-id:CC01BP66AGTU00000001}")
    private String agentId;

    @Value("${billavenue.init-channel:AGT}")
    private String initChannel;

    @Value("${billavenue.payment-mode:Cash}")
    private String paymentMode;

    @Value("${billavenue.aes-iv:}")
    private String aesIv;

    @Value("${billavenue.timeout-seconds:60}")
    private int timeoutSeconds;

    public BillAvenueClient(RestTemplateBuilder restTemplateBuilder, ObjectMapper objectMapper) {
        this.restTemplate = restTemplateBuilder
                .setConnectTimeout(Duration.ofSeconds(15))
                .setReadTimeout(Duration.ofSeconds(60))
                .build();
        this.objectMapper = objectMapper;
    }

    public String getAgentId() {
        return agentId != null && !agentId.isBlank() ? agentId.trim() : "CC01BP66AGTU00000001";
    }

    public String getInitChannel() {
        return initChannel != null && !initChannel.isBlank() ? initChannel.trim() : "AGT";
    }

    public String getPaymentMode() {
        return paymentMode != null && !paymentMode.isBlank() ? paymentMode.trim() : "Cash";
    }

    public String getInstituteId() {
        return instituteId != null && !instituteId.isBlank() ? instituteId.trim() : "CC01";
    }

    public String getCleanBaseUrl() {
        if (baseUrl == null || baseUrl.isBlank()) {
            return "https://api.billavenue.com/billpay";
        }
        String clean = baseUrl.trim();
        while (clean.endsWith("/")) {
            clean = clean.substring(0, clean.length() - 1);
        }
        if (!clean.endsWith("/billpay")) {
            clean = clean + "/billpay";
        }
        return clean;
    }

    public boolean isConfigured() {
        return accessCode != null && !accessCode.isBlank()
                && workingKey != null && !workingKey.isBlank();
    }

    /**
     * Executes Encrypted XML API call matching the working PHP reference (BillAvenueBBPSService::executeApiCall).
     * Endpoint e.g. "extBillPayCntrl/billPayRequest/xml"
     */
    public String executeXmlApiCall(
            String endpointPath,
            String xmlRequest,
            String ver,
            String requestId
    ) {
        String base = getCleanBaseUrl();
        String encRequest = BillAvenueCryptoUtil.encrypt(xmlRequest, workingKey, aesIv);
        String v = (ver != null && !ver.isBlank()) ? ver : "1.0";

        // In the working PHP reference, queryParams contains: accessCode, requestId, encRequest, ver, instituteId
        // with empty POST body. We also support falling back to application/x-www-form-urlencoded body.
        String urlWithQuery = String.format("%s/%s?accessCode=%s&requestId=%s&encRequest=%s&ver=%s&instituteId=%s",
                base,
                endpointPath,
                accessCode != null ? accessCode.trim() : "",
                requestId,
                encRequest,
                v,
                getInstituteId());

        log.info("Dispatching BillAvenue XML API call to {} for requestId: {}", endpointPath, requestId);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(urlWithQuery, HttpEntity.EMPTY, String.class);
            String rawBody = response.getBody();
            if (rawBody != null && !rawBody.isBlank()) {
                log.info("Received response from BillAvenue XML endpoint: {} for requestId: {}", endpointPath, requestId);
                return rawBody;
            }
        } catch (ResourceAccessException re) {
            log.error("Network timeout calling BillAvenue XML API: {}", endpointPath, re);
            throw new BillAvenueTimeoutException("Timeout communicating with BillAvenue: " + re.getMessage(), re);
        } catch (Exception e) {
            log.warn("POST with query string for XML endpoint {} returned exception ({}). Trying form body fallback.",
                    endpointPath, e.getMessage());
            try {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

                MultiValueMap<String, String> map = new LinkedMultiValueMap<>();
                map.add("accessCode", accessCode != null ? accessCode.trim() : "");
                map.add("requestId", requestId);
                map.add("encRequest", encRequest);
                map.add("ver", v);
                map.add("instituteId", getInstituteId());

                String fallbackUrl = String.format("%s/%s?accessCode=%s&requestId=%s&ver=%s&instituteId=%s",
                        base, endpointPath, accessCode != null ? accessCode.trim() : "", requestId, v, getInstituteId());

                ResponseEntity<String> response = restTemplate.postForEntity(fallbackUrl, new HttpEntity<>(map, headers), String.class);
                return response.getBody();
            } catch (ResourceAccessException re2) {
                throw new BillAvenueTimeoutException("Timeout communicating with BillAvenue: " + re2.getMessage(), re2);
            } catch (Exception ex2) {
                log.error("XML form fallback also failed for endpoint: {}", endpointPath, ex2);
                return null;
            }
        }
        return null;
    }

    /**
     * Executes Bill Fetch API via XML (Section 3 of PHP reference / Section 4.2 of doc)
     */
    public BillAvenueDtos.BillFetchResponse fetchBill(
            String billerId,
            List<BillAvenueDtos.InputParam> inputParams,
            String customerMobile,
            String clientIp
    ) {
        if (!isConfigured()) {
            return BillAvenueDtos.BillFetchResponse.builder()
                    .responseCode("001")
                    .responseReason("BillAvenue credentials not configured")
                    .build();
        }

        StringBuilder inputXml = new StringBuilder();
        if (inputParams != null) {
            for (BillAvenueDtos.InputParam p : inputParams) {
                inputXml.append("<input>")
                        .append("<paramName>").append(escapeXml(p.getParamName())).append("</paramName>")
                        .append("<paramValue>").append(escapeXml(p.getParamValue())).append("</paramValue>")
                        .append("</input>");
            }
        }

        String sanitizedIp = (clientIp != null && clientIp.matches("^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$"))
                ? clientIp : "103.108.7.127";

        String xml = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
                + "<billFetchRequest>"
                + "<agentDeviceInfo>"
                + "<app>BillPay</app>"
                + "<imei>000000000000000</imei>"
                + "<initChannel>AGT</initChannel>"
                + "<ip>" + escapeXml(sanitizedIp) + "</ip>"
                + "<os>android</os>"
                + "</agentDeviceInfo>"
                + "<agentId>" + escapeXml(getAgentId()) + "</agentId>"
                + "<billerId>" + escapeXml(billerId) + "</billerId>"
                + "<customerInfo>"
                + "<customerMobile>" + escapeXml(customerMobile) + "</customerMobile>"
                + "</customerInfo>"
                + "<inputParams>" + inputXml + "</inputParams>"
                + "</billFetchRequest>";

        String fetchRequestId = BillAvenueCryptoUtil.generateRequestId();
        log.info("Sending BillFetch XML request for biller: {}, mobile: {}, requestId: {}",
                billerId, customerMobile, fetchRequestId);

        try {
            String rawResp = executeXmlApiCall("extBillCntrl/billFetchRequest/xml", xml, "1.0", fetchRequestId);
            if (rawResp == null || rawResp.isBlank()) {
                return BillAvenueDtos.BillFetchResponse.builder()
                        .responseCode("500")
                        .responseReason("Empty response from BillAvenue provider")
                        .fetchRequestId(fetchRequestId)
                        .build();
            }

            String decryptedXml = decryptResponseIfNeeded(rawResp);
            log.info("Decrypted BillFetch XML response for requestId {}: {}", fetchRequestId, decryptedXml);
            return parseBillFetchXmlResponse(decryptedXml, fetchRequestId, billerId, customerMobile, inputParams);
        } catch (BillAvenueTimeoutException te) {
            throw te;
        } catch (Exception e) {
            log.warn("Exception during BillFetch for biller {}: {}", billerId, e.getMessage());
            return BillAvenueDtos.BillFetchResponse.builder()
                    .responseCode("500")
                    .responseReason("Bill fetch error: " + e.getMessage())
                    .fetchRequestId(fetchRequestId)
                    .build();
        }
    }

    /**
     * Executes Biller Validation API call for payment-only billers per BBPS specification (Pages 58-62).
     */
    public BillAvenueDtos.BillValidationResponse validateBillXml(
            String billerId,
            List<BillAvenueDtos.InputParam> inputParams
    ) {
        if (!isConfigured()) {
            return BillAvenueDtos.BillValidationResponse.builder()
                    .responseCode("001")
                    .responseReason("BillAvenue credentials not configured")
                    .build();
        }

        StringBuilder inputXml = new StringBuilder();
        if (inputParams != null) {
            for (BillAvenueDtos.InputParam p : inputParams) {
                inputXml.append("<input>")
                        .append("<paramName>").append(escapeXml(p.getParamName())).append("</paramName>")
                        .append("<paramValue>").append(escapeXml(p.getParamValue())).append("</paramValue>")
                        .append("</input>");
            }
        }

        String xml = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
                + "<billValidationRequest>"
                + "<agentId>" + escapeXml(getAgentId()) + "</agentId>"
                + "<billerId>" + escapeXml(billerId) + "</billerId>"
                + "<inputParams>" + inputXml + "</inputParams>"
                + "</billValidationRequest>";

        String requestId = BillAvenueCryptoUtil.generateRequestId();
        log.info("Sending BillValidation XML request for biller: {}, requestId: {}", billerId, requestId);

        try {
            String rawResp = executeXmlApiCall("extBillValCntrl/billValidationRequest/xml", xml, "1.0", requestId);
            if (rawResp == null || rawResp.isBlank()) {
                return BillAvenueDtos.BillValidationResponse.builder()
                        .responseCode("500")
                        .responseReason("Empty response from BillAvenue provider")
                        .build();
            }

            String decryptedXml = decryptResponseIfNeeded(rawResp);
            log.info("Decrypted BillValidation XML response: {}", decryptedXml);
            return parseBillValidationXmlResponse(decryptedXml);
        } catch (BillAvenueTimeoutException te) {
            throw te;
        } catch (Exception e) {
            log.warn("Exception during BillValidation for biller {}: {}", billerId, e.getMessage());
            return BillAvenueDtos.BillValidationResponse.builder()
                    .responseCode("500")
                    .responseReason("Bill validation error: " + e.getMessage())
                    .build();
        }
    }

    private final java.util.Map<String, BillAvenueDtos.BillerInfoResponse> mdmCache = new java.util.concurrent.ConcurrentHashMap<>();

    /**
     * Executes Biller Info API (MDM) per BBPS Specification Section 4.1 (Pages 11-22).
     * Endpoint: extMdmCntrl/mdmRequestNew/xml
     * Note: Respects the BillAvenue quota (15 requests per 24 hours) by caching responses in memory.
     */
    public BillAvenueDtos.BillerInfoResponse fetchBillerInfo(String billerId) {
        if (billerId == null || billerId.isBlank()) return null;
        String cleanId = billerId.trim().toUpperCase();
        BillAvenueDtos.BillerInfoResponse cached = mdmCache.get(cleanId);
        if (cached != null) {
            log.info("Returning cached Biller Info MDM for: {}", cleanId);
            return cached;
        }

        if (!isConfigured()) {
            return null;
        }

        String xml = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
                + "<billerInfoRequest>"
                + "<billerId>" + escapeXml(cleanId) + "</billerId>"
                + "</billerInfoRequest>";

        String requestId = BillAvenueCryptoUtil.generateRequestId();
        log.info("Sending Biller Info MDM XML request for biller: {}, requestId: {}", cleanId, requestId);

        try {
            String rawResp = executeXmlApiCall("extMdmCntrl/mdmRequestNew/xml", xml, "1.0", requestId);
            if (rawResp == null || rawResp.isBlank()) return null;

            String decryptedXml = decryptResponseIfNeeded(rawResp);
            log.info("Decrypted Biller Info MDM XML response for {}: {}", cleanId, decryptedXml);
            BillAvenueDtos.BillerInfoResponse parsed = parseBillerInfoXmlResponse(decryptedXml, cleanId);
            if (parsed != null && parsed.isSuccess()) {
                mdmCache.put(cleanId, parsed);
            }
            return parsed;
        } catch (Exception e) {
            log.warn("Exception during Biller Info MDM fetch for biller {}: {}", cleanId, e.getMessage());
            return null;
        }
    }

    public BillAvenueDtos.BillerInfoResponse parseBillerInfoXmlResponse(String xmlStr, String billerId) {
        BillAvenueDtos.BillerInfoResponse.BillerInfoResponseBuilder builder = BillAvenueDtos.BillerInfoResponse.builder()
                .billerId(billerId)
                .rawXml(xmlStr);
        if (xmlStr == null || xmlStr.isBlank()) {
            return builder.responseCode("500").responseReason("Empty XML response").build();
        }

        try {
            Document doc = parseXml(xmlStr.trim());
            Element root = doc.getDocumentElement();

            String code = getTagValue(root, "responseCode");
            String reason = getTagValue(root, "responseReason");
            builder.responseCode(!code.isBlank() ? code : "500");
            builder.responseReason(!reason.isBlank() ? reason : "Unknown");

            Element billerElem = getFirstChildElement(root, "biller");
            if (billerElem != null) {
                builder.billerName(getTagValue(billerElem, "billerName"));
                builder.billerCategory(getTagValue(billerElem, "billerCategory"));
                builder.billerAdhoc(getTagValue(billerElem, "billerAdhoc"));
                builder.billerFetchRequirement(getTagValue(billerElem, "billerFetchRequiremet"));
                builder.billerPaymentExactness(getTagValue(billerElem, "billerPaymentExactness"));
                builder.billerSupportBillValidation(getTagValue(billerElem, "billerSupportBillValidation"));

                Element inputParamsElem = getFirstChildElement(billerElem, "billerInputParams");
                if (inputParamsElem != null) {
                    List<BillAvenueDtos.BillerParamInfo> paramList = new ArrayList<>();
                    NodeList params = inputParamsElem.getElementsByTagName("paramInfo");
                    for (int i = 0; i < params.getLength(); i++) {
                        Element pElem = (Element) params.item(i);
                        String pName = getTagValue(pElem, "paramName");
                        String dType = getTagValue(pElem, "dataType");
                        String isOpt = getTagValue(pElem, "isOptional");
                        String minL = getTagValue(pElem, "minLength");
                        String maxL = getTagValue(pElem, "maxLength");
                        String regEx = getTagValue(pElem, "regEx");

                        int min = 0;
                        int max = 0;
                        try { if (!minL.isBlank()) min = Integer.parseInt(minL); } catch (Exception ignored) {}
                        try { if (!maxL.isBlank()) max = Integer.parseInt(maxL); } catch (Exception ignored) {}

                        paramList.add(BillAvenueDtos.BillerParamInfo.builder()
                                .paramName(pName)
                                .dataType(dType)
                                .optional("true".equalsIgnoreCase(isOpt))
                                .minLength(min)
                                .maxLength(max)
                                .regEx(regEx)
                                .build());
                    }
                    builder.inputParams(paramList);
                }
            }

            NodeList errNodes = root.getElementsByTagName("error");
            if (errNodes != null && errNodes.getLength() > 0) {
                List<BillAvenueDtos.ErrorInfo> errors = new ArrayList<>();
                for (int i = 0; i < errNodes.getLength(); i++) {
                    Element errElem = (Element) errNodes.item(i);
                    String errCode = getTagValue(errElem, "errorCode");
                    String errMsg = getTagValue(errElem, "errorMessage");
                    errors.add(new BillAvenueDtos.ErrorInfo(errCode, errMsg));
                }
                builder.errorInfo(errors);
            }

            return builder.build();
        } catch (Exception e) {
            log.warn("Error parsing Biller Info MDM XML: {}", e.getMessage());
            return builder.responseCode("PARSE_ERROR").responseReason("Failed to parse MDM XML: " + e.getMessage()).build();
        }
    }

    /**
     * Executes Bill Payment via XML matching the PHP working reference (Section 4 of PHP code)
     */
    public BillAvenueDtos.BillPayResponse payBillXml(BillAvenueDtos.BillPayXmlRequest req) {
        String requestId = (req.getFetchRequestId() != null && !req.getFetchRequestId().isBlank())
                ? req.getFetchRequestId()
                : BillAvenueCryptoUtil.generateRequestId();

        if (!isConfigured()) {
            BillAvenueDtos.BillPayResponse r = new BillAvenueDtos.BillPayResponse();
            r.setResponseCode("001");
            r.setResponseReason("BillAvenue credentials not configured on server");
            r.setRequestId(requestId);
            return r;
        }

        // 1. Build Inputs XML
        StringBuilder inputXml = new StringBuilder();
        if (req.getInputParams() != null) {
            for (BillAvenueDtos.InputParam p : req.getInputParams()) {
                inputXml.append("<input>")
                        .append("<paramName>").append(escapeXml(p.getParamName())).append("</paramName>")
                        .append("<paramValue>").append(escapeXml(p.getParamValue())).append("</paramValue>")
                        .append("</input>");
            }
        }

        // 2. Build Biller Response XML (mirror what fetch returned, or send recharge amount)
        // 2. Build Biller Response XML (mirror what fetch returned verbatim per BBPS spec, or send fallback)
        String billerRespXmlStr;
        if (req.getRawBillerResponseXml() != null && !req.getRawBillerResponseXml().isBlank()) {
            billerRespXmlStr = req.getRawBillerResponseXml().trim();
        } else {
            long billerRespPaise = (req.getBillAmountPaise() > 0) ? req.getBillAmountPaise() : req.getAmountPaise();
            StringBuilder billerRespXml = new StringBuilder("<billerResponse>");
            billerRespXml.append("<billAmount>").append(billerRespPaise).append("</billAmount>");
            // billDate: format must be YYYY-MM-DD per doc (Page 37). BillAvenue rejects missing date with "Bill date required (E022)".
            String billDate = (req.getBillDate() != null && !req.getBillDate().isBlank() && !"N/A".equalsIgnoreCase(req.getBillDate().trim()))
                    ? req.getBillDate().trim()
                    : java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE);
            billerRespXml.append("<billDate>").append(escapeXml(billDate)).append("</billDate>");
            // billNumber: max length 100 alphanumeric with _@./#&+- per doc (Page 37). BillAvenue rejects missing billNumber with "Bill number is required (E024)".
            String billNumber = (req.getBillNumber() != null && !req.getBillNumber().isBlank() && !"N/A".equalsIgnoreCase(req.getBillNumber().trim()))
                    ? req.getBillNumber().trim()
                    : (req.getClientTxnId() != null && !req.getClientTxnId().isBlank() ? req.getClientTxnId().trim() : "NA");
            billerRespXml.append("<billNumber>").append(escapeXml(billNumber)).append("</billNumber>");

            // billPeriod: max length 35 alphanumeric with _,@./#&+'- per doc (Page 38). BillAvenue rejects missing billPeriod with "Bill period is required (E025)".
            String billPeriod = (req.getBillPeriod() != null && !req.getBillPeriod().isBlank() && !"N/A".equalsIgnoreCase(req.getBillPeriod().trim()))
                    ? req.getBillPeriod().trim()
                    : "NA";
            billerRespXml.append("<billPeriod>").append(escapeXml(billPeriod)).append("</billPeriod>");

            // customerName: max length 100 alphanumeric with _ per doc (Page 38).
            String customerName = (req.getCustomerName() != null && !req.getCustomerName().isBlank() && !"N/A".equalsIgnoreCase(req.getCustomerName().trim()))
                    ? req.getCustomerName().trim()
                    : "Customer";
            billerRespXml.append("<customerName>").append(escapeXml(customerName)).append("</customerName>");

            // dueDate: format must be YYYY-MM-DD per doc (Page 38).
            String dueDate = (req.getDueDate() != null && !req.getDueDate().isBlank() && !"N/A".equalsIgnoreCase(req.getDueDate().trim()))
                    ? req.getDueDate().trim()
                    : billDate;
            billerRespXml.append("<dueDate>").append(escapeXml(dueDate)).append("</dueDate>");
            billerRespXml.append("</billerResponse>");
            billerRespXmlStr = billerRespXml.toString();
        }

        // 3. Build Additional Info XML
        String addnlInfoXmlStr;
        if (req.getRawAdditionalInfoXml() != null && !req.getRawAdditionalInfoXml().isBlank()) {
            addnlInfoXmlStr = req.getRawAdditionalInfoXml().trim();
        } else if (req.getAdditionalInfo() != null && !req.getAdditionalInfo().isEmpty()) {
            StringBuilder addnlInfoXml = new StringBuilder("<additionalInfo>");
            for (BillAvenueDtos.InfoItem info : req.getAdditionalInfo()) {
                addnlInfoXml.append("<info>")
                        .append("<infoName>").append(escapeXml(info.getInfoName())).append("</infoName>")
                        .append("<infoValue>").append(escapeXml(info.getInfoValue())).append("</infoValue>")
                        .append("</info>");
            }
            addnlInfoXml.append("</additionalInfo>");
            addnlInfoXmlStr = addnlInfoXml.toString();
        } else {
            addnlInfoXmlStr = "";
        }

        // 4. Build Payment Account Info & Payment Info XML
        String mode = (req.getPaymentMode() != null && !req.getPaymentMode().isBlank()) ? req.getPaymentMode() : "Cash";
        String remitter = (req.getRemitterName() != null && !req.getRemitterName().isBlank()) ? req.getRemitterName() : "Customer";
        String acctInfo = (req.getPaymentAccountInfo() != null && !req.getPaymentAccountInfo().isBlank()) ? req.getPaymentAccountInfo() : "Cash Payment";
        String remarks = (req.getRemarks() != null && !req.getRemarks().isBlank()) ? req.getRemarks() : "Received";

        String rawRef = (req.getClientTxnId() != null && !req.getClientTxnId().isBlank())
                ? req.getClientTxnId() : requestId;
        String cleanPaymentRefId = rawRef.replaceAll("[^a-zA-Z0-9]", "");
        if (cleanPaymentRefId.isBlank()) {
            cleanPaymentRefId = (requestId != null && !requestId.isBlank())
                    ? requestId.replaceAll("[^a-zA-Z0-9]", "")
                    : "TXN" + System.currentTimeMillis();
        }
        if (cleanPaymentRefId.length() > 35) {
            cleanPaymentRefId = cleanPaymentRefId.substring(0, 35);
        }

        StringBuilder paymentInfoXml = new StringBuilder();
        paymentInfoXml.append("<info><infoName>Remitter Name</infoName><infoValue>").append(escapeXml(remitter)).append("</infoValue></info>");
        paymentInfoXml.append("<info><infoName>PaymentRefId</infoName><infoValue>").append(escapeXml(cleanPaymentRefId)).append("</infoValue></info>");
        if ("Cash".equalsIgnoreCase(mode)) {
            paymentInfoXml.append("<info><infoName>Remarks</infoName><infoValue>").append(escapeXml(remarks)).append("</infoValue></info>");
        }
        paymentInfoXml.append("<info><infoName>Payment Account Info</infoName><infoValue>").append(escapeXml(acctInfo)).append("</infoValue></info>");
        paymentInfoXml.append("<info><infoName>Payment mode</infoName><infoValue>").append(escapeXml(mode)).append("</infoValue></info>");

        // 5. KYC (PAN / Aadhaar) rules for transactions >= 50,000 INR (5,000,000 paise)
        StringBuilder kycXml = new StringBuilder();
        if (req.getAmountPaise() >= 5000000L) {
            if (req.getPan() != null && !req.getPan().isBlank()) {
                kycXml.append("<customerPan>").append(escapeXml(req.getPan().toUpperCase())).append("</customerPan>");
            }
            if (req.getAadhaar() != null && !req.getAadhaar().isBlank()) {
                kycXml.append("<customerAdhaar>").append(escapeXml(req.getAadhaar())).append("</customerAdhaar>");
            }
            kycXml.append("<REMITTER_NAME>").append(escapeXml(remitter)).append("</REMITTER_NAME>");
        }

        String sanitizedIp = (req.getClientIp() != null && req.getClientIp().matches("^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$"))
                ? req.getClientIp() : "103.108.7.127";

        String billerAdhoc = (req.getBillerAdhoc() != null && !req.getBillerAdhoc().isBlank())
                ? req.getBillerAdhoc().trim() : "true";
        long ccf1 = req.getCcf1Paise();
        long custConvFee = req.getCustConvFeePaise();

        String quickPay = (req.getQuickPay() != null && !req.getQuickPay().isBlank())
                ? req.getQuickPay().trim().toUpperCase()
                : ((req.getFetchRequestId() != null && !req.getFetchRequestId().isBlank()) ? "N" : "Y");

        // 6. Build Master Payment XML matching PHP structure
        String xml = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
                + "<billPaymentRequest>"
                + addnlInfoXmlStr
                + "<agentDeviceInfo>"
                + "<app>BillPay</app>"
                + "<imei>000000000000000</imei>"
                + "<initChannel>AGT</initChannel>"
                + "<ip>" + escapeXml(sanitizedIp) + "</ip>"
                + "<os>android</os>"
                + "</agentDeviceInfo>"
                + "<agentId>" + escapeXml(getAgentId()) + "</agentId>"
                + "<amountInfo>"
                + "<amount>" + req.getAmountPaise() + "</amount>"
                + "<CCF1>" + ccf1 + "</CCF1>"
                + "<currency>356</currency>"
                + "<custConvFee>" + custConvFee + "</custConvFee>"
                + "</amountInfo>"
                + "<billerId>" + escapeXml(req.getBillerId()) + "</billerId>"
                + "<billerAdhoc>" + escapeXml(billerAdhoc) + "</billerAdhoc>"
                + billerRespXmlStr
                + "<customerInfo>"
                + "<customerMobile>" + escapeXml(req.getCustomerMobile()) + "</customerMobile>"
                + kycXml
                + "</customerInfo>"
                + "<inputParams>" + inputXml + "</inputParams>"
                + "<paymentMethod>"
                + "<paymentMode>" + escapeXml(mode) + "</paymentMode>"
                + "<quickPay>" + escapeXml(quickPay) + "</quickPay>"
                + "<splitPay>N</splitPay>"
                + "</paymentMethod>"
                + "<paymentInfo>" + paymentInfoXml + "</paymentInfo>"
                + "<paymentRefId>" + escapeXml(cleanPaymentRefId) + "</paymentRefId>"
                + "</billPaymentRequest>";

        log.info("Sending Bill Payment XML for biller: {}, txnId: {}, requestId: {}",
                req.getBillerId(), req.getClientTxnId(), requestId);

        try {
            String rawResp = executeXmlApiCall("extBillPayCntrl/billPayRequest/xml", xml, "1.0", requestId);
            if (rawResp == null || rawResp.isBlank()) {
                BillAvenueDtos.BillPayResponse empty = new BillAvenueDtos.BillPayResponse();
                empty.setResponseCode("500");
                empty.setResponseReason("Empty response from BillAvenue");
                empty.setRequestId(requestId);
                return empty;
            }

            String decryptedXml = decryptResponseIfNeeded(rawResp);
            log.info("Decrypted BillPay XML response for requestId {}: {}", requestId, decryptedXml);
            return parseBillPayXmlResponse(decryptedXml, requestId);
        } catch (BillAvenueTimeoutException te) {
            throw te;
        } catch (Exception e) {
            log.error("Unexpected error executing BillAvenue XML payment for requestId: {}", requestId, e);
            BillAvenueDtos.BillPayResponse failResp = new BillAvenueDtos.BillPayResponse();
            failResp.setResponseCode("500");
            failResp.setResponseReason("Error executing BillAvenue XML payment: " + e.getMessage());
            failResp.setRequestId(requestId);
            return failResp;
        }
    }

    /**
     * Executes Bill Payment API (Section 4.3 of BillAvenue doc)
     * POST /extBillPayCntrl/billPayRequest/json
     */
    public BillAvenueDtos.BillPayResponse payBill(BillAvenueDtos.BillPayRequest request, String requestId) {
        String base = getCleanBaseUrl();
        String endpoint = base + "/extBillPayCntrl/billPayRequest/json";
        String urlWithQuery = String.format("%s?accessCode=%s&requestId=%s&ver=1.0&instituteId=%s",
                endpoint,
                accessCode != null ? accessCode.trim() : "",
                requestId,
                getInstituteId());

        log.info("Sending Bill Payment request to BillAvenue endpoint: {} with requestId: {}", urlWithQuery, requestId);

        try {
            String plainJson = objectMapper.writeValueAsString(request);
            log.info("Submitting BillAvenue plain payload for requestId {}: {}", requestId, plainJson);

            if (!isConfigured()) {
                log.warn("BillAvenue credentials not configured (BILLAVENUE_ACCESS_CODE/BILLAVENUE_WORKING_KEY).");
                BillAvenueDtos.BillPayResponse resp = new BillAvenueDtos.BillPayResponse();
                resp.setResponseCode("001");
                resp.setResponseReason("BillAvenue credentials not configured on server");
                resp.setRequestId(requestId);
                return resp;
            }

            String encRequest = BillAvenueCryptoUtil.encrypt(plainJson, workingKey, aesIv);

            // POST form fields as specified in BillAvenue doc Section 3.0
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            MultiValueMap<String, String> map = new LinkedMultiValueMap<>();
            map.add("accessCode", accessCode.trim());
            map.add("requestId", requestId);
            map.add("encRequest", encRequest);
            map.add("ver", "1.0");
            map.add("instituteId", getInstituteId());

            HttpEntity<MultiValueMap<String, String>> entity = new HttpEntity<>(map, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(urlWithQuery, entity, String.class);
            String rawBody = response.getBody();
            log.info("Received HTTP {} response from BillAvenue for requestId: {}", response.getStatusCode(), requestId);

            return parseBillPayResponse(rawBody, requestId);
        } catch (ResourceAccessException e) {
            log.error("Network timeout or connection failure calling BillAvenue BillPay API for requestId: {}", requestId, e);
            throw new BillAvenueTimeoutException("Timeout communicating with BillAvenue provider: " + e.getMessage(), e);
        } catch (Exception e) {
            log.error("Unexpected error executing BillAvenue payBill for requestId: {}", requestId, e);
            BillAvenueDtos.BillPayResponse failResp = new BillAvenueDtos.BillPayResponse();
            failResp.setResponseCode("500");
            failResp.setResponseReason("Error executing BillAvenue payment: " + e.getMessage());
            failResp.setRequestId(requestId);
            return failResp;
        }
    }

    /**
     * Executes Transaction Status API (Section 4.4 of BillAvenue doc)
     * POST /transactionstatus/fetchinfo/json
     */
    public BillAvenueDtos.TransactionStatusResponse checkTransactionStatus(String trackType, String trackValue) {
        String endpoint = baseUrl + "/transactionstatus/fetchinfo/json";
        log.info("Checking transaction status from BillAvenue: trackType={}, trackValue={}", trackType, trackValue);

        try {
            if (!isConfigured()) {
                BillAvenueDtos.TransactionStatusResponse resp = new BillAvenueDtos.TransactionStatusResponse();
                resp.setResponseCode("200");
                resp.setResponseReason("BillAvenue credentials not configured");
                return resp;
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            String reqJson = String.format("{\"trackingType\":\"%s\",\"trackingValue\":\"%s\"}", trackType, trackValue);
            HttpEntity<String> entity = new HttpEntity<>(reqJson, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(endpoint, entity, String.class);
            String rawBody = response.getBody();

            if (rawBody == null || rawBody.isBlank()) {
                BillAvenueDtos.TransactionStatusResponse empty = new BillAvenueDtos.TransactionStatusResponse();
                empty.setResponseCode("500");
                empty.setResponseReason("Empty response received from BillAvenue status API");
                return empty;
            }

            String jsonToParse = rawBody.trim();
            if (!jsonToParse.startsWith("{") && !jsonToParse.startsWith("[")) {
                // Response is encrypted
                jsonToParse = BillAvenueCryptoUtil.decrypt(jsonToParse, workingKey, aesIv);
            }

            return objectMapper.readValue(jsonToParse, BillAvenueDtos.TransactionStatusResponse.class);
        } catch (Exception e) {
            log.error("Failed to check status for trackValue: {}", trackValue, e);
            BillAvenueDtos.TransactionStatusResponse err = new BillAvenueDtos.TransactionStatusResponse();
            err.setResponseCode("500");
            err.setResponseReason("Status check exception: " + e.getMessage());
            return err;
        }
    }

    /**
     * Executes Plan Pull API (Section 8.0 of BillAvenue doc)
     * POST /extPlanMDM/planMdmRequest/json
     */
    public BillAvenueDtos.PlanPullResponse pullPlans(String billerId) {
        String requestId = BillAvenueCryptoUtil.generateRequestId();
        String endpoint = String.format("%s/extPlanMDM/planMdmRequest/json?accessCode=%s&requestId=%s&ver=1.0&instituteId=%s",
                baseUrl, accessCode != null ? accessCode : "", requestId, getInstituteId());

        try {
            if (!isConfigured()) {
                return null;
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            String bodyJson = String.format("{\"billerId\":[\"%s\"]}", billerId);
            HttpEntity<String> entity = new HttpEntity<>(bodyJson, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(endpoint, entity, String.class);
            String rawBody = response.getBody();

            if (rawBody == null || rawBody.isBlank()) return null;

            String jsonToParse = rawBody.trim();
            if (!jsonToParse.startsWith("{") && !jsonToParse.startsWith("[")) {
                jsonToParse = BillAvenueCryptoUtil.decrypt(jsonToParse, workingKey, aesIv);
            }

            return objectMapper.readValue(jsonToParse, BillAvenueDtos.PlanPullResponse.class);
        } catch (Exception e) {
            log.warn("Plan pull failed or not supported for biller {}: {}", billerId, e.getMessage());
            return null;
        }
    }

    private BillAvenueDtos.BillPayResponse parseBillPayResponse(String rawBody, String requestId) {
        if (rawBody == null || rawBody.isBlank()) {
            BillAvenueDtos.BillPayResponse empty = new BillAvenueDtos.BillPayResponse();
            empty.setResponseCode("500");
            empty.setResponseReason("Empty response body from BillAvenue");
            empty.setRequestId(requestId);
            return empty;
        }

        try {
            String json = rawBody.trim();
            if (!json.startsWith("{") && !json.startsWith("[")) {
                // Encrypted response: decrypt using shared workingKey
                json = BillAvenueCryptoUtil.decrypt(json, workingKey, aesIv);
            }
            JsonNode root = objectMapper.readTree(json);
            if (root.has("ExtBillPayResponse")) {
                root = root.get("ExtBillPayResponse");
            } else if (root.has("extBillPayResponse")) {
                root = root.get("extBillPayResponse");
            } else if (root.has("billPaymentResponse")) {
                root = root.get("billPaymentResponse");
            } else if (root.has("billPayResponse")) {
                root = root.get("billPayResponse");
            }

            BillAvenueDtos.BillPayResponse resp = new BillAvenueDtos.BillPayResponse();
            resp.setRawResponse(json);
            if (root.has("responseCode")) {
                resp.setResponseCode(root.path("responseCode").asText(null));
            }
            if (root.has("responseReason")) {
                resp.setResponseReason(root.path("responseReason").asText(null));
            }
            if (root.has("txnRefId")) {
                resp.setTxnRefId(root.path("txnRefId").asText(null));
            }
            if (root.has("approvalRefNumber")) {
                resp.setApprovalRefNumber(root.path("approvalRefNumber").asText(null));
            }
            if (root.has("txnRespType")) {
                resp.setTxnRespType(root.path("txnRespType").asText(null));
            }
            if (root.has("respAmount")) {
                resp.setRespAmount(root.path("respAmount").asText(null));
            }
            if (root.has("respBillNumber")) {
                resp.setRespBillNumber(root.path("respBillNumber").asText(null));
            }
            if (root.has("respCustomerName")) {
                resp.setRespCustomerName(root.path("respCustomerName").asText(null));
            }
            if (root.has("requestId")) {
                resp.setRequestId(root.path("requestId").asText(null));
            }

            if (root.has("complianceCode")) {
                resp.setComplianceCode(root.path("complianceCode").asText(null));
            }
            if (root.has("complianceReason")) {
                resp.setComplianceReason(root.path("complianceReason").asText(null));
            }
            if (root.has("message")) {
                resp.setMessage(root.path("message").asText(null));
            }
            if (root.has("errorMessage")) {
                resp.setErrorMessage(root.path("errorMessage").asText(null));
            }

            List<BillAvenueDtos.ErrorInfo> errors = extractErrors(root);
            if (!errors.isEmpty()) {
                resp.setErrorInfo(errors);
            }

            return resp;
        } catch (Exception e) {
            log.error("Failed to parse BillAvenue response for requestId: {}. Raw: {}", requestId, rawBody, e);
            BillAvenueDtos.BillPayResponse err = new BillAvenueDtos.BillPayResponse();
            err.setResponseCode("PARSE_ERROR");
            err.setResponseReason("Failed to parse response: " + e.getMessage());
            err.setRequestId(requestId);
            return err;
        }
    }

    /**
     * Calls BillAvenue MDM Biller Info API (Section 11.0 of BillAvenue doc)
     * POST /extMdmCntrl/mdmRequestNew/json
     */
    public JsonNode getBillerInfo(String billerId) {
        String requestId = BillAvenueCryptoUtil.generateRequestId();
        String endpoint = String.format("%s/extMdmCntrl/mdmRequestNew/json?accessCode=%s&requestId=%s&ver=1.0&instituteId=%s",
                baseUrl, accessCode != null ? accessCode.trim() : "", requestId, getInstituteId());

        try {
            if (!isConfigured()) {
                return null;
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            String bodyJson = String.format("{\"billerId\":[\"%s\"]}", billerId);
            HttpEntity<String> entity = new HttpEntity<>(bodyJson, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(endpoint, entity, String.class);
            String rawBody = response.getBody();
            if (rawBody == null || rawBody.isBlank()) return null;

            String jsonToParse = rawBody.trim();
            if (!jsonToParse.startsWith("{") && !jsonToParse.startsWith("[")) {
                jsonToParse = BillAvenueCryptoUtil.decrypt(jsonToParse, workingKey, aesIv);
            }

            log.info("Decrypted MDM BillerInfo for {}: {}", billerId, jsonToParse);
            return objectMapper.readTree(jsonToParse);
        } catch (Exception e) {
            log.warn("MDM BillerInfo call failed for biller {}: {}", billerId, e.getMessage());
            return null;
        }
    }

    private List<BillAvenueDtos.ErrorInfo> extractErrors(JsonNode root) {
        List<BillAvenueDtos.ErrorInfo> list = new ArrayList<>();

        if (root.has("complianceCode") && !root.path("complianceCode").asText("").isBlank()) {
            list.add(new BillAvenueDtos.ErrorInfo(
                    root.path("complianceCode").asText(),
                    root.path("complianceReason").asText("Validation compliance failed")
            ));
        }

        JsonNode errorInfoNode = root.path("errorInfo");
        if (errorInfoNode.isMissingNode() || errorInfoNode.isNull()) {
            errorInfoNode = root.path("error");
        }
        if (errorInfoNode.isArray()) {
            for (JsonNode item : errorInfoNode) {
                list.add(new BillAvenueDtos.ErrorInfo(
                        item.path("errorCode").isMissingNode() ? null : item.path("errorCode").asText(),
                        item.path("errorMessage").isMissingNode() ? null : item.path("errorMessage").asText()
                ));
            }
        } else if (errorInfoNode.isObject()) {
            JsonNode innerError = errorInfoNode.path("error");
            if (innerError.isArray()) {
                for (JsonNode item : innerError) {
                    list.add(new BillAvenueDtos.ErrorInfo(
                            item.path("errorCode").isMissingNode() ? null : item.path("errorCode").asText(),
                            item.path("errorMessage").isMissingNode() ? null : item.path("errorMessage").asText()
                    ));
                }
            } else if (innerError.isObject()) {
                list.add(new BillAvenueDtos.ErrorInfo(
                        innerError.path("errorCode").isMissingNode() ? null : innerError.path("errorCode").asText(),
                        innerError.path("errorMessage").isMissingNode() ? null : innerError.path("errorMessage").asText()
                ));
            } else if (errorInfoNode.has("errorCode") || errorInfoNode.has("errorMessage")) {
                list.add(new BillAvenueDtos.ErrorInfo(
                        errorInfoNode.path("errorCode").isMissingNode() ? null : errorInfoNode.path("errorCode").asText(),
                        errorInfoNode.path("errorMessage").isMissingNode() ? null : errorInfoNode.path("errorMessage").asText()
                ));
            }
        }
        return list;
    }

    private String decryptResponseIfNeeded(String rawBody) {
        if (rawBody == null || rawBody.isBlank()) return "";
        String trimmed = rawBody.trim();
        if (trimmed.startsWith("<?xml") || trimmed.startsWith("<") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
            return trimmed;
        }
        try {
            String decrypted = BillAvenueCryptoUtil.decrypt(trimmed, workingKey, aesIv);
            if (decrypted != null && !decrypted.isBlank()) {
                return decrypted.trim();
            }
        } catch (Exception e) {
            log.warn("Failed to decrypt raw body or payload was plain text: {}", e.getMessage());
        }
        return trimmed;
    }

    public BillAvenueDtos.BillPayResponse parseBillPayXmlResponse(String xmlStr, String requestId) {
        BillAvenueDtos.BillPayResponse resp = new BillAvenueDtos.BillPayResponse();
        resp.setRequestId(requestId);
        resp.setRawResponse(xmlStr);

        if (xmlStr == null || xmlStr.isBlank()) {
            resp.setResponseCode("500");
            resp.setResponseReason("Empty response");
            return resp;
        }

        String trimmed = xmlStr.trim();
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            return parseBillPayResponse(trimmed, requestId);
        }

        try {
            Document doc = parseXml(trimmed);
            Element root = doc.getDocumentElement();

            String code = getTagValue(root, "responseCode");
            String reason = getTagValue(root, "responseReason");
            String txnRefId = getTagValue(root, "txnRefId");
            String approvalRef = getTagValue(root, "approvalRefNumber");
            String txnRespType = getTagValue(root, "txnRespType");
            String respAmount = getTagValue(root, "RespAmount");
            String respBillNumber = getTagValue(root, "RespBillNumber");
            String respCustomerName = getTagValue(root, "RespCustomerName");
            String complianceCode = getTagValue(root, "complianceCode");
            String complianceReason = getTagValue(root, "complianceReason");

            resp.setResponseCode(!code.isBlank() ? code : "500");
            resp.setResponseReason(!reason.isBlank() ? reason : null);
            resp.setTxnRefId(!txnRefId.isBlank() ? txnRefId : null);
            resp.setApprovalRefNumber(!approvalRef.isBlank() ? approvalRef : null);
            resp.setTxnRespType(!txnRespType.isBlank() ? txnRespType : null);
            resp.setRespAmount(!respAmount.isBlank() ? respAmount : null);
            resp.setRespBillNumber(!respBillNumber.isBlank() ? respBillNumber : null);
            resp.setRespCustomerName(!respCustomerName.isBlank() ? respCustomerName : null);
            resp.setComplianceCode(!complianceCode.isBlank() ? complianceCode : null);
            resp.setComplianceReason(!complianceReason.isBlank() ? complianceReason : null);

            NodeList errNodes = root.getElementsByTagName("error");
            if (errNodes != null && errNodes.getLength() > 0) {
                List<BillAvenueDtos.ErrorInfo> errors = new ArrayList<>();
                for (int i = 0; i < errNodes.getLength(); i++) {
                    Element errElem = (Element) errNodes.item(i);
                    String errCode = getTagValue(errElem, "errorCode");
                    String errMsg = getTagValue(errElem, "errorMessage");
                    errors.add(new BillAvenueDtos.ErrorInfo(errCode, errMsg));
                }
                resp.setErrorInfo(errors);
            }

            return resp;
        } catch (Exception e) {
            log.error("Error parsing XML response from BillAvenue: {}", xmlStr, e);
            resp.setResponseCode("PARSE_ERROR");
            resp.setResponseReason("Failed to parse provider XML: " + e.getMessage());
            return resp;
        }
    }

    public BillAvenueDtos.BillFetchResponse parseBillFetchXmlResponse(
            String xmlStr,
            String requestId,
            String billerId,
            String customerMobile,
            List<BillAvenueDtos.InputParam> inputParams
    ) {
        BillAvenueDtos.BillFetchResponse.BillFetchResponseBuilder builder = BillAvenueDtos.BillFetchResponse.builder()
                .fetchRequestId(requestId)
                .billerId(billerId)
                .customerMobile(customerMobile)
                .inputParams(inputParams)
                .rawXml(xmlStr);

        if (xmlStr != null) {
            java.util.regex.Matcher brMatcher = java.util.regex.Pattern.compile("(?s)<billerResponse>.*?</billerResponse>", java.util.regex.Pattern.CASE_INSENSITIVE).matcher(xmlStr);
            if (brMatcher.find()) {
                builder.rawBillerResponseXml(brMatcher.group());
            }

            java.util.regex.Matcher aiMatcher = java.util.regex.Pattern.compile("(?s)<additionalInfo>.*?</additionalInfo>", java.util.regex.Pattern.CASE_INSENSITIVE).matcher(xmlStr);
            if (aiMatcher.find()) {
                builder.rawAdditionalInfoXml(aiMatcher.group());
            }
        }

        if (xmlStr == null || xmlStr.isBlank()) {
            return builder.responseCode("500").responseReason("Empty XML response").build();
        }

        try {
            Document doc = parseXml(xmlStr.trim());
            Element root = doc.getDocumentElement();

            String code = getTagValue(root, "responseCode");
            builder.responseCode(!code.isBlank() ? code : "500");

            // Parse additionalInfo first so items can be inspected for customer name
            List<BillAvenueDtos.InfoItem> items = new ArrayList<>();
            Element addnlElem = getFirstChildElement(root, "additionalInfo");
            if (addnlElem != null) {
                NodeList infoList = addnlElem.getElementsByTagName("info");
                if (infoList != null && infoList.getLength() > 0) {
                    for (int i = 0; i < infoList.getLength(); i++) {
                        Element itemElem = (Element) infoList.item(i);
                        String name = getTagValue(itemElem, "infoName");
                        String val = getTagValue(itemElem, "infoValue");
                        if (val.isBlank()) val = getTagValue(itemElem, "InfoValue");
                        items.add(new BillAvenueDtos.InfoItem(name, val));
                    }
                    builder.additionalInfo(items);
                }
            }

            Element billerResp = getFirstChildElement(root, "billerResponse");
            if (billerResp != null) {
                String amt = findFirstTagValue(billerResp, "billAmount", "RespAmount", "amount");
                if (!amt.isBlank()) {
                    try {
                        builder.billAmountPaise(Long.parseLong(amt));
                    } catch (NumberFormatException ignored) {}
                }
                builder.billNumber(findFirstTagValue(billerResp, "billNumber", "RespBillNumber", "billNo"));
                builder.billDate(findFirstTagValue(billerResp, "billDate", "RespBillDate"));
                builder.dueDate(findFirstTagValue(billerResp, "dueDate", "RespDueDate"));
                builder.billPeriod(findFirstTagValue(billerResp, "billPeriod", "RespBillPeriod"));
            } else {
                String amt = findFirstTagValue(root, "billAmount", "RespAmount", "amount");
                if (!amt.isBlank()) {
                    try {
                        builder.billAmountPaise(Long.parseLong(amt));
                    } catch (NumberFormatException ignored) {}
                }
                builder.billNumber(findFirstTagValue(root, "billNumber", "RespBillNumber", "billNo"));
                builder.billDate(findFirstTagValue(root, "billDate", "RespBillDate"));
                builder.dueDate(findFirstTagValue(root, "dueDate", "RespDueDate"));
                builder.billPeriod(findFirstTagValue(root, "billPeriod", "RespBillPeriod"));
            }

            // Extract the real customer connection holder name from all possible BBPS locations
            String extractedCustName = extractCustomerName(root, billerResp, items, xmlStr);
            if (!extractedCustName.isBlank()) {
                builder.customerName(extractedCustName);
            }

            NodeList errNodes = root.getElementsByTagName("error");
            if (errNodes != null && errNodes.getLength() > 0) {
                List<BillAvenueDtos.ErrorInfo> errors = new ArrayList<>();
                for (int i = 0; i < errNodes.getLength(); i++) {
                    Element errElem = (Element) errNodes.item(i);
                    String errCode = getTagValue(errElem, "errorCode");
                    String errMsg = getTagValue(errElem, "errorMessage");
                    errors.add(new BillAvenueDtos.ErrorInfo(errCode, errMsg));
                }
                builder.errorInfo(errors);
            }

            return builder.build();
        } catch (Exception e) {
            log.warn("Error parsing BillFetch XML response: {}", e.getMessage());
            return builder.responseCode("PARSE_ERROR").responseReason("Failed to parse BillFetch XML: " + e.getMessage()).build();
        }
    }

    public BillAvenueDtos.BillValidationResponse parseBillValidationXmlResponse(String xmlStr) {
        BillAvenueDtos.BillValidationResponse.BillValidationResponseBuilder builder = BillAvenueDtos.BillValidationResponse.builder()
                .rawXml(xmlStr);
        if (xmlStr == null || xmlStr.isBlank()) {
            return builder.responseCode("500").responseReason("Empty XML response").build();
        }
        try {
            Document doc = parseXml(xmlStr.trim());
            Element root = doc.getDocumentElement();

            String code = getTagValue(root, "responseCode");
            String reason = getTagValue(root, "responseReason");
            builder.responseCode(!code.isBlank() ? code : "500");
            builder.responseReason(!reason.isBlank() ? reason : "Unknown");

            builder.complianceCode(getTagValue(root, "complianceCode"));
            builder.complianceReason(getTagValue(root, "complianceReason"));
            builder.approvalRefNo(getTagValue(root, "approvalRefNo"));

            List<BillAvenueDtos.InfoItem> items = new ArrayList<>();
            Element addnlElem = getFirstChildElement(root, "additionalInfo");
            if (addnlElem != null) {
                NodeList infoList = addnlElem.getElementsByTagName("info");
                for (int i = 0; i < infoList.getLength(); i++) {
                    Element itemElem = (Element) infoList.item(i);
                    String name = getTagValue(itemElem, "infoName");
                    String val = getTagValue(itemElem, "infoValue");
                    items.add(new BillAvenueDtos.InfoItem(name, val));
                }
                builder.additionalInfo(items);
            }

            NodeList errNodes = root.getElementsByTagName("error");
            if (errNodes != null && errNodes.getLength() > 0) {
                List<BillAvenueDtos.ErrorInfo> errors = new ArrayList<>();
                for (int i = 0; i < errNodes.getLength(); i++) {
                    Element errElem = (Element) errNodes.item(i);
                    String errCode = getTagValue(errElem, "errorCode");
                    String errMsg = getTagValue(errElem, "errorMessage");
                    errors.add(new BillAvenueDtos.ErrorInfo(errCode, errMsg));
                }
                builder.errorInfo(errors);
            }

            return builder.build();
        } catch (Exception e) {
            log.warn("Error parsing BillValidation XML: {}", e.getMessage());
            return builder.responseCode("PARSE_ERROR").responseReason("Failed to parse BillValidation XML: " + e.getMessage()).build();
        }
    }

    private Document parseXml(String xmlStr) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setXIncludeAware(false);
        factory.setExpandEntityReferences(false);
        DocumentBuilder builder = factory.newDocumentBuilder();
        return builder.parse(new InputSource(new StringReader(xmlStr)));
    }

    private Element getFirstChildElement(Element parent, String tagName) {
        if (parent == null) return null;
        NodeList list = parent.getElementsByTagName(tagName);
        if (list != null && list.getLength() > 0) {
            return (Element) list.item(0);
        }
        return null;
    }

    private String getTagValue(Element element, String tagName) {
        if (element == null) return "";
        NodeList list = element.getElementsByTagName(tagName);
        if (list != null && list.getLength() > 0) {
            Node node = list.item(0);
            return node.getTextContent() != null ? node.getTextContent().trim() : "";
        }
        return "";
    }

    private String findFirstTagValue(Element parent, String... tagNames) {
        if (parent == null) return "";
        for (String t : tagNames) {
            String v = getTagValue(parent, t);
            if (v != null && !v.isBlank()) {
                return v.trim();
            }
        }
        // Case-insensitive check across child tags
        NodeList children = parent.getElementsByTagName("*");
        if (children != null) {
            for (int i = 0; i < children.getLength(); i++) {
                Node n = children.item(i);
                if (n.getNodeType() == Node.ELEMENT_NODE) {
                    String nodeName = n.getNodeName();
                    for (String t : tagNames) {
                        if (nodeName.equalsIgnoreCase(t)) {
                            String v = n.getTextContent();
                            if (v != null && !v.isBlank()) {
                                return v.trim();
                            }
                        }
                    }
                }
            }
        }
        return "";
    }

    private String extractCustomerName(Element root, Element billerResp, List<BillAvenueDtos.InfoItem> items, String xmlStr) {
        String val = "";
        // 1. Check billerResponse first
        if (billerResp != null) {
            val = findFirstTagValue(billerResp, "customerName", "CustomerName", "RespCustomerName", "respCustomerName",
                    "consumerName", "ConsumerName", "userName", "accountHolderName", "customer_name", "consumer_name");
        }
        // 2. Check directly under root (<billFetchResponse>)
        if ((val == null || val.isBlank() || "NA".equalsIgnoreCase(val.trim())) && root != null) {
            val = findFirstTagValue(root, "customerName", "CustomerName", "RespCustomerName", "respCustomerName",
                    "consumerName", "ConsumerName", "userName", "accountHolderName", "customer_name", "consumer_name");
        }
        // 3. Check inside additionalInfo items
        if ((val == null || val.isBlank() || "NA".equalsIgnoreCase(val.trim())) && items != null) {
            for (BillAvenueDtos.InfoItem item : items) {
                if (item == null || item.getInfoName() == null || item.getInfoValue() == null) continue;
                String k = item.getInfoName().trim().toLowerCase();
                if (k.equals("customer name") || k.equals("consumer name") ||
                    k.equals("customername") || k.equals("consumername") ||
                    k.equals("account holder name") || k.equals("accountholdername") ||
                    k.equals("user name") || k.equals("subscriber name") ||
                    k.equals("name") || k.contains("consumer name") || k.contains("customer name")) {
                    String candidate = item.getInfoValue().trim();
                    if (!candidate.isBlank() && !"NA".equalsIgnoreCase(candidate)) {
                        val = candidate;
                        break;
                    }
                }
            }
        }
        // 4. Regex scan on raw XML as safety net
        if ((val == null || val.isBlank() || "NA".equalsIgnoreCase(val.trim())) && xmlStr != null && !xmlStr.isBlank()) {
            Pattern p = Pattern.compile("<(?:Resp)?(?:Customer|Consumer|User)Name>([^<]+)<", Pattern.CASE_INSENSITIVE);
            Matcher m = p.matcher(xmlStr);
            if (m.find()) {
                String candidate = m.group(1).trim();
                if (!candidate.isBlank() && !"NA".equalsIgnoreCase(candidate)) {
                    val = candidate;
                }
            }
        }
        return (val != null && !val.isBlank() && !"NA".equalsIgnoreCase(val.trim())) ? val.trim() : "";
    }

    private static String escapeXml(String value) {
        if (value == null) return "";
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    public String buildTxnReferenceId(String existingId) {
        if (existingId != null && existingId.matches("^CC01[A-Za-z0-9]{16}$")) {
            return existingId;
        }
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        StringBuilder rand = new StringBuilder(16);
        SecureRandom random = new SecureRandom();
        for (int i = 0; i < 16; i++) {
            rand.append(chars.charAt(random.nextInt(chars.length())));
        }
        return "CC01" + rand;
    }
}
