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

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

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

    @Value("${billavenue.init-channel:INT}")
    private String initChannel;

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
        return agentId != null && !agentId.isBlank() ? agentId : "CC01BP66AGTU00000001";
    }

    public String getInitChannel() {
        return initChannel != null && !initChannel.isBlank() ? initChannel : "INT";
    }

    public String getInstituteId() {
        return instituteId != null && !instituteId.isBlank() ? instituteId : "CC01";
    }

    public boolean isConfigured() {
        return accessCode != null && !accessCode.isBlank()
                && workingKey != null && !workingKey.isBlank();
    }

    /**
     * Executes Bill Payment API (Section 4.3 of BillAvenue doc)
     * POST /extBillPayCntrl/billPayRequest/json
     */
    public BillAvenueDtos.BillPayResponse payBill(BillAvenueDtos.BillPayRequest request, String requestId) {
        String endpoint = baseUrl + "/extBillPayCntrl/billPayRequest/json";
        log.info("Sending Bill Payment request to BillAvenue endpoint: {} with requestId: {}", endpoint, requestId);

        try {
            String plainJson = objectMapper.writeValueAsString(request);
            log.debug("BillAvenue plain request payload: {}", plainJson);

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
            map.add("accessCode", accessCode);
            map.add("requestId", requestId);
            map.add("encRequest", encRequest);
            map.add("ver", "1.0");
            map.add("instituteId", getInstituteId());

            HttpEntity<MultiValueMap<String, String>> entity = new HttpEntity<>(map, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(endpoint, entity, String.class);
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
            log.info("Decrypted BillAvenue BillPay response for requestId {}: {}", requestId, json);

            JsonNode root = objectMapper.readTree(json);
            BillAvenueDtos.BillPayResponse resp = new BillAvenueDtos.BillPayResponse();
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

    private List<BillAvenueDtos.ErrorInfo> extractErrors(JsonNode root) {
        List<BillAvenueDtos.ErrorInfo> list = new ArrayList<>();
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
}
