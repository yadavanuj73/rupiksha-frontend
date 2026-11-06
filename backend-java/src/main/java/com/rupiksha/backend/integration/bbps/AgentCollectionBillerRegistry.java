package com.rupiksha.backend.integration.bbps;

import com.fasterxml.jackson.databind.JsonNode;
import com.rupiksha.backend.api.dto.BbpsDtos;
import com.rupiksha.backend.integration.bbps.dto.BillAvenueDtos;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Pattern;

/**
 * Official registry of Bharat Connect / BillAvenue Agent Collection Billers.
 * Contains official NPCI / BillAvenue verified Agent Collection Biller IDs with their
 * exact parameter names (Agent Code, Agent ID, Center ID, Group Code, etc.) and constraints.
 *
 * Per BillAvenue API doc Version 2.8.7 (Bharat Connect Agent Collection specification):
 *   - Category: Agent Collection.
 *   - Cooling period for CMS complaints: 24 hours (Page 56, item 16).
 *   - Payment modes supported: Cash (AGT channel) and electronic modes (INT/MOB channels).
 *   - Supports dynamic MDM parameter synchronization via BillAvenue MDM Biller Info API.
 */
@Slf4j
@Component
public class AgentCollectionBillerRegistry {

    private static final Pattern CLEAN_ALPHANUMERIC_PATTERN = Pattern.compile("[^A-Za-z0-9_-]");

    private final List<BbpsDtos.AgentCollectionBillerInfo> billers = new CopyOnWriteArrayList<>();
    private final Map<String, BbpsDtos.AgentCollectionBillerInfo> billerMap = new ConcurrentHashMap<>();
    private final Map<String, List<BillAvenueDtos.InputParam>> workingParamsCache = new ConcurrentHashMap<>();

    public void updateWorkingInputParams(String billerId, List<BillAvenueDtos.InputParam> params) {
        if (billerId != null && params != null && !params.isEmpty()) {
            workingParamsCache.put(billerId.trim().toUpperCase(), params);
        }
    }

    public List<BillAvenueDtos.InputParam> getWorkingInputParams(String billerId) {
        if (billerId == null) return null;
        return workingParamsCache.get(billerId.trim().toUpperCase());
    }

    // Backward-compatibility alias map for common or shortened IDs
    private static final Map<String, String> BILLER_ID_ALIASES = Map.ofEntries(
            Map.entry("SPANDANA000001", "SPAN00000NAT01"),
            Map.entry("SWATANTRA00001", "SWAT00000NAT01"),
            Map.entry("FINCARE0000001", "FICA00000NAT01"),
            Map.entry("SATIN000000001", "SATI00000NAT01"),
            Map.entry("DELHIVERY00001", "DELH00000NAT01"),
            Map.entry("SHADOWFAX00001", "SHAD00000NAT01"),
            Map.entry("PORTER00000001", "PORT00000NAT01"),
            Map.entry("ZOMATO00000001", "ZOMA00000NAT01"),
            Map.entry("SWIGGY00000001", "SWIG00000NAT01"),
            Map.entry("MUTHOOT0000001", "MUTM00000NAT01"),
            Map.entry("AROHAN00000001", "AROH00000NAT01"),
            Map.entry("ASIRVAD0000001", "ASIR00000NAT01")
    );

    public AgentCollectionBillerRegistry() {
        initBillers();
    }

    private void add(BbpsDtos.AgentCollectionBillerInfo biller) {
        String key = biller.getBillerId().toUpperCase();
        billers.add(biller);
        billerMap.put(key, biller);
    }

    public List<BbpsDtos.AgentCollectionBillerInfo> getAllBillers(String search) {
        if (search == null || search.isBlank()) {
            return Collections.unmodifiableList(billers);
        }
        String clean = search.trim().toLowerCase();
        return billers.stream()
                .filter(b -> (b.getBillerName() != null && b.getBillerName().toLowerCase().contains(clean)) ||
                             (b.getAgencyName() != null && b.getAgencyName().toLowerCase().contains(clean)) ||
                             (b.getBillerId() != null && b.getBillerId().toLowerCase().contains(clean)))
                .toList();
    }

    public Optional<BbpsDtos.AgentCollectionBillerInfo> findById(String billerId) {
        if (billerId == null || billerId.isBlank()) return Optional.empty();
        String clean = billerId.trim().toUpperCase();

        // 1. Direct match
        BbpsDtos.AgentCollectionBillerInfo found = billerMap.get(clean);
        if (found != null) {
            return Optional.of(found);
        }

        // 2. Alias resolution
        String aliasedId = BILLER_ID_ALIASES.get(clean);
        if (aliasedId != null) {
            BbpsDtos.AgentCollectionBillerInfo aliasedBiller = billerMap.get(aliasedId);
            if (aliasedBiller != null) {
                return Optional.of(aliasedBiller);
            }
        }

        // 3. Fallback: If it's a valid 14-character BBPS biller ID, create a generic Agent Collection biller on the fly
        if (clean.matches("^[A-Z0-9]{14}$")) {
            return Optional.of(BbpsDtos.AgentCollectionBillerInfo.builder()
                    .billerId(clean)
                    .billerName("Agent Collection Institution (" + clean + ")")
                    .agencyName("Agent Collection Partner")
                    .category("Agent Collection")
                    .billerFetchRequirement("OPTIONAL")
                    .billerPaymentExactness("Exact and above")
                    .supportBillValidation("OPTIONAL")
                    .billerAdhoc(true)
                    .minAmount(BigDecimal.valueOf(10))
                    .maxAmount(BigDecimal.valueOf(200000))
                    .inputParams(defaultAgentCollectionParams())
                    .description("Bharat Connect Agent Collection Cash Drop / Point")
                    .build());
        }
        return Optional.empty();
    }

    public void updateFromMdm(String billerId, BillAvenueDtos.BillerInfoResponse mdm) {
        if (billerId == null || mdm == null || mdm.getInputParams() == null || mdm.getInputParams().isEmpty()) {
            return;
        }
        String key = billerId.trim().toUpperCase();
        BbpsDtos.AgentCollectionBillerInfo existing = billerMap.get(key);
        if (existing == null) return;

        List<BbpsDtos.InputParamInfo> newParams = mdm.getInputParams().stream()
                .map(p -> BbpsDtos.InputParamInfo.builder()
                        .paramName(p.getParamName())
                        .dataType(p.getDataType() != null ? p.getDataType() : "ALPHANUMERIC")
                        .optional(p.isOptional())
                        .minLength(p.getMinLength())
                        .maxLength(p.getMaxLength())
                        .regEx(p.getRegEx())
                        .build())
                .toList();

        BbpsDtos.AgentCollectionBillerInfo updated = BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId(existing.getBillerId())
                .billerName(mdm.getBillerName() != null ? mdm.getBillerName() : existing.getBillerName())
                .agencyName(existing.getAgencyName())
                .category("Agent Collection")
                .billerFetchRequirement(mdm.getBillerFetchRequirement() != null ? mdm.getBillerFetchRequirement() : existing.getBillerFetchRequirement())
                .billerPaymentExactness(mdm.getBillerPaymentExactness() != null ? mdm.getBillerPaymentExactness() : existing.getBillerPaymentExactness())
                .supportBillValidation(mdm.getBillerSupportBillValidation() != null ? mdm.getBillerSupportBillValidation() : existing.getSupportBillValidation())
                .billerAdhoc("true".equalsIgnoreCase(mdm.getBillerAdhoc()))
                .minAmount(existing.getMinAmount())
                .maxAmount(existing.getMaxAmount())
                .inputParams(newParams)
                .description(existing.getDescription())
                .build();

        billerMap.put(key, updated);
        for (int i = 0; i < billers.size(); i++) {
            if (billers.get(i).getBillerId().equalsIgnoreCase(key)) {
                billers.set(i, updated);
                break;
            }
        }
    }

    public synchronized boolean updateFromJsonMdm(String billerId, JsonNode root) {
        if (billerId == null || root == null) return false;
        String key = billerId.trim().toUpperCase();
        BbpsDtos.AgentCollectionBillerInfo existing = billerMap.get(key);
        if (existing == null) return false;

        JsonNode billerNode = null;
        if (root.has("biller") && root.get("biller").isArray() && root.get("biller").size() > 0) {
            billerNode = root.get("biller").get(0);
        } else if (root.has("biller") && root.get("biller").isObject()) {
            billerNode = root.get("biller");
        }

        if (billerNode == null) return false;

        String bName = billerNode.path("billerName").asText(existing.getBillerName());
        String fetchReq = billerNode.path("billerFetchRequiremet").asText(
                billerNode.path("billerFetchRequirement").asText(existing.getBillerFetchRequirement())
        );
        String payExact = billerNode.path("billerPaymentExactness").asText(existing.getBillerPaymentExactness());
        String valSupport = billerNode.path("billerSupportBillValidation").asText(existing.getSupportBillValidation());
        boolean adhoc = "true".equalsIgnoreCase(billerNode.path("billerAdhoc").asText("true"));

        List<BbpsDtos.InputParamInfo> newParams = new ArrayList<>();
        JsonNode inputParamsNode = billerNode.path("billerInputParams");

        if (inputParamsNode.isArray()) {
            for (JsonNode groupOrParam : inputParamsNode) {
                if (groupOrParam.has("paramsList") && groupOrParam.get("paramsList").isArray()) {
                    for (JsonNode p : groupOrParam.get("paramsList")) {
                        parseSingleParam(p, newParams);
                    }
                } else if (groupOrParam.has("paramInfo") && groupOrParam.get("paramInfo").isArray()) {
                    for (JsonNode p : groupOrParam.get("paramInfo")) {
                        parseSingleParam(p, newParams);
                    }
                } else {
                    parseSingleParam(groupOrParam, newParams);
                }
            }
        } else if (inputParamsNode.isObject()) {
            if (inputParamsNode.has("paramInfo") && inputParamsNode.get("paramInfo").isArray()) {
                for (JsonNode p : inputParamsNode.get("paramInfo")) {
                    parseSingleParam(p, newParams);
                }
            } else if (inputParamsNode.has("paramsList") && inputParamsNode.get("paramsList").isArray()) {
                for (JsonNode p : inputParamsNode.get("paramsList")) {
                    parseSingleParam(p, newParams);
                }
            }
        }

        if (newParams.isEmpty()) {
            return false;
        }

        BbpsDtos.AgentCollectionBillerInfo updated = BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId(existing.getBillerId())
                .billerName(bName)
                .agencyName(existing.getAgencyName())
                .category("Agent Collection")
                .billerFetchRequirement(fetchReq)
                .billerPaymentExactness(payExact)
                .supportBillValidation(valSupport)
                .billerAdhoc(adhoc)
                .minAmount(existing.getMinAmount())
                .maxAmount(existing.getMaxAmount())
                .inputParams(newParams)
                .description(existing.getDescription())
                .build();

        billerMap.put(key, updated);
        for (int i = 0; i < billers.size(); i++) {
            if (billers.get(i).getBillerId().equalsIgnoreCase(key)) {
                billers.set(i, updated);
                break;
            }
        }
        log.info("Successfully updated Agent Collection biller {} from live JSON MDM with {} params: {}",
                key, newParams.size(), newParams);
        return true;
    }

    private void parseSingleParam(JsonNode p, List<BbpsDtos.InputParamInfo> list) {
        String pName = p.path("paramName").asText("");
        if (pName.isBlank()) return;
        boolean opt = "true".equalsIgnoreCase(p.path("isOptional").asText("false"));
        String dType = p.path("dataType").asText("ALPHANUMERIC");
        int minL = p.path("minLength").asInt(1);
        int maxL = p.path("maxLength").asInt(50);
        String regEx = p.path("regEx").asText(null);

        list.add(BbpsDtos.InputParamInfo.builder()
                .paramName(pName)
                .dataType(dType)
                .optional(opt)
                .minLength(minL)
                .maxLength(maxL)
                .regEx(regEx)
                .build());
    }

    public void validateCustomerParams(BbpsDtos.AgentCollectionBillerInfo biller, Map<String, String> customerParams) {
        if (biller == null) {
            throw new IllegalArgumentException("Agent Collection biller cannot be null");
        }
        if (customerParams == null || customerParams.isEmpty()) {
            throw new IllegalArgumentException("Customer parameters are required for Agent Collection");
        }

        List<BbpsDtos.InputParamInfo> expected = biller.getInputParams();
        if (expected == null || expected.isEmpty()) {
            return;
        }

        for (BbpsDtos.InputParamInfo info : expected) {
            if (info.isOptional()) continue;

            String val = findParamValue(customerParams, info.getParamName());
            if (val == null || val.isBlank()) {
                throw new IllegalArgumentException("Missing mandatory parameter: " + info.getParamName());
            }

            val = val.trim();
            if (info.getMinLength() > 0 && val.length() < info.getMinLength()) {
                throw new IllegalArgumentException(info.getParamName() + " must be at least " + info.getMinLength() + " characters");
            }
            if (info.getMaxLength() > 0 && val.length() > info.getMaxLength()) {
                throw new IllegalArgumentException(info.getParamName() + " cannot exceed " + info.getMaxLength() + " characters");
            }
        }
    }

    public String extractAgentCode(Map<String, String> customerParams) {
        if (customerParams == null) return null;
        for (String key : List.of("Agent Code", "Agent ID", "Consumer No.", "Consumer No", "Consumer Number", "Collector ID", "Employee ID", "Employee Code", "CSR ID", "DE ID", "Rider ID", "Partner ID", "Cashier ID", "agentCode", "agentId")) {
            String val = findParamValue(customerParams, key);
            if (val != null && !val.isBlank()) {
                return val.trim().toUpperCase();
            }
        }
        // Fallback to first non-empty value
        for (String v : customerParams.values()) {
            if (v != null && !v.isBlank()) return v.trim().toUpperCase();
        }
        return null;
    }

    public String extractCollectionRef(Map<String, String> customerParams) {
        if (customerParams == null) return null;
        for (String key : List.of("Center ID", "Group Code", "Branch Code", "Agency Code", "Contract No", "collectionRef", "referenceNo")) {
            String val = findParamValue(customerParams, key);
            if (val != null && !val.isBlank()) {
                return val.trim().toUpperCase();
            }
        }
        return null;
    }

    public List<BillAvenueDtos.InputParam> buildAgentCollectionInputParams(
            BbpsDtos.AgentCollectionBillerInfo biller,
            Map<String, String> customerParams,
            String customerMobile
    ) {
        List<BillAvenueDtos.InputParam> inputs = new ArrayList<>();
        if (biller.getInputParams() != null && !biller.getInputParams().isEmpty()) {
            for (BbpsDtos.InputParamInfo p : biller.getInputParams()) {
                String val = findParamValue(customerParams, p.getParamName());
                if ((val == null || val.isBlank()) && isMobileParam(p.getParamName())) {
                    val = customerMobile;
                }
                if (val != null && !val.isBlank()) {
                    inputs.add(BillAvenueDtos.InputParam.builder()
                            .paramName(p.getParamName())
                            .paramValue(val.trim())
                            .build());
                }
            }
        }

        if (inputs.isEmpty() && customerParams != null) {
            customerParams.forEach((k, v) -> {
                if (v != null && !v.isBlank()) {
                    inputs.add(BillAvenueDtos.InputParam.builder()
                            .paramName(k)
                            .paramValue(v.trim())
                            .build());
                }
            });
        }
        return inputs;
    }

    public Map<String, String> sanitizeCustomerParams(Map<String, String> params, String mobile) {
        Map<String, String> clean = new LinkedHashMap<>();
        if (params != null) {
            params.forEach((k, v) -> {
                if (v != null && !v.isBlank()) {
                    clean.put(k, v.trim());
                }
            });
        }
        if (mobile != null && !mobile.isBlank()) {
            clean.putIfAbsent("Customer Mobile", mobile.trim());
        }
        return clean;
    }

    private static final Map<String, List<String>> PARAM_ALIASES = Map.of(
            "agent id", List.of("agent id", "agent code", "agent number", "collector id", "employee id", "employee code", "consumer no", "consumer no.", "consumer number", "account number"),
            "agent code", List.of("agent code", "agent id", "agent number", "collector id", "employee id", "employee code", "consumer no", "consumer no.", "consumer number", "account number"),
            "consumer no", List.of("consumer no", "consumer no.", "consumer number", "agent id", "agent code", "agent number", "collector id", "account number"),
            "consumer no.", List.of("consumer no.", "consumer no", "consumer number", "agent id", "agent code", "agent number", "collector id", "account number"),
            "consumer number", List.of("consumer number", "consumer no", "consumer no.", "agent id", "agent code", "agent number", "collector id", "account number"),
            "collection reference number", List.of("collection reference number", "collection ref", "reference number", "center id", "group code", "contract no", "reference no")
    );

    public List<List<BillAvenueDtos.InputParam>> generateParameterVariations(String agentCode, String collectionRef, String mobile) {
        List<List<BillAvenueDtos.InputParam>> variations = new ArrayList<>();
        if (agentCode == null || agentCode.isBlank()) return variations;

        String cleanCode = agentCode.trim();

        // 1. Single-parameter variations across official BillAvenue naming conventions (Consumer No first per reference portal)
        variations.add(List.of(
                BillAvenueDtos.InputParam.builder().paramName("Consumer No").paramValue(cleanCode).build()
        ));
        variations.add(List.of(
                BillAvenueDtos.InputParam.builder().paramName("Consumer No.").paramValue(cleanCode).build()
        ));
        variations.add(List.of(
                BillAvenueDtos.InputParam.builder().paramName("Consumer Number").paramValue(cleanCode).build()
        ));
        variations.add(List.of(
                BillAvenueDtos.InputParam.builder().paramName("Agent Code").paramValue(cleanCode).build()
        ));
        variations.add(List.of(
                BillAvenueDtos.InputParam.builder().paramName("Agent ID").paramValue(cleanCode).build()
        ));
        variations.add(List.of(
                BillAvenueDtos.InputParam.builder().paramName("CONSUMER NO").paramValue(cleanCode).build()
        ));
        variations.add(List.of(
                BillAvenueDtos.InputParam.builder().paramName("CONSUMER NO.").paramValue(cleanCode).build()
        ));
        variations.add(List.of(
                BillAvenueDtos.InputParam.builder().paramName("CONSUMER NUMBER").paramValue(cleanCode).build()
        ));
        variations.add(List.of(
                BillAvenueDtos.InputParam.builder().paramName("AGENT CODE").paramValue(cleanCode).build()
        ));
        variations.add(List.of(
                BillAvenueDtos.InputParam.builder().paramName("AGENT ID").paramValue(cleanCode).build()
        ));
        variations.add(List.of(
                BillAvenueDtos.InputParam.builder().paramName("Collector ID").paramValue(cleanCode).build()
        ));
        variations.add(List.of(
                BillAvenueDtos.InputParam.builder().paramName("Employee Code").paramValue(cleanCode).build()
        ));
        variations.add(List.of(
                BillAvenueDtos.InputParam.builder().paramName("Partner ID").paramValue(cleanCode).build()
        ));

        // 2. Dual-parameter variations with Mobile Number (many billers require mobile alongside consumer number)
        if (mobile != null && !mobile.isBlank()) {
            String cleanMobile = mobile.trim();
            for (String mobileTag : List.of("Mobile Number", "Mobile No", "Mobile No.", "Registered Mobile Number", "Payee Mobile Number")) {
                variations.add(List.of(
                        BillAvenueDtos.InputParam.builder().paramName("Consumer No").paramValue(cleanCode).build(),
                        BillAvenueDtos.InputParam.builder().paramName(mobileTag).paramValue(cleanMobile).build()
                ));
                variations.add(List.of(
                        BillAvenueDtos.InputParam.builder().paramName("Consumer No.").paramValue(cleanCode).build(),
                        BillAvenueDtos.InputParam.builder().paramName(mobileTag).paramValue(cleanMobile).build()
                ));
                variations.add(List.of(
                        BillAvenueDtos.InputParam.builder().paramName("Agent Code").paramValue(cleanCode).build(),
                        BillAvenueDtos.InputParam.builder().paramName(mobileTag).paramValue(cleanMobile).build()
                ));
                variations.add(List.of(
                        BillAvenueDtos.InputParam.builder().paramName("Agent ID").paramValue(cleanCode).build(),
                        BillAvenueDtos.InputParam.builder().paramName(mobileTag).paramValue(cleanMobile).build()
                ));
                variations.add(List.of(
                        BillAvenueDtos.InputParam.builder().paramName("Consumer Number").paramValue(cleanCode).build(),
                        BillAvenueDtos.InputParam.builder().paramName(mobileTag).paramValue(cleanMobile).build()
                ));
            }
        }

        // 3. Dual-parameter variations if collection reference is provided
        if (collectionRef != null && !collectionRef.isBlank()) {
            String cleanRef = collectionRef.trim();
            for (String refTag : List.of("Collection Reference Number", "Center ID", "Group Code", "Branch Code")) {
                variations.add(List.of(
                        BillAvenueDtos.InputParam.builder().paramName("Consumer No").paramValue(cleanCode).build(),
                        BillAvenueDtos.InputParam.builder().paramName(refTag).paramValue(cleanRef).build()
                ));
                variations.add(List.of(
                        BillAvenueDtos.InputParam.builder().paramName("Consumer No.").paramValue(cleanCode).build(),
                        BillAvenueDtos.InputParam.builder().paramName(refTag).paramValue(cleanRef).build()
                ));
                variations.add(List.of(
                        BillAvenueDtos.InputParam.builder().paramName("Agent Code").paramValue(cleanCode).build(),
                        BillAvenueDtos.InputParam.builder().paramName(refTag).paramValue(cleanRef).build()
                ));
                variations.add(List.of(
                        BillAvenueDtos.InputParam.builder().paramName("Agent ID").paramValue(cleanCode).build(),
                        BillAvenueDtos.InputParam.builder().paramName(refTag).paramValue(cleanRef).build()
                ));
            }
        }

        return variations;
    }

    private String findParamValue(Map<String, String> params, String key) {
        if (params == null || key == null) return null;
        // Direct / alphanumeric normalized match
        for (Map.Entry<String, String> entry : params.entrySet()) {
            if (entry.getKey().equalsIgnoreCase(key) ||
                entry.getKey().replaceAll("[^A-Za-z0-9]", "").equalsIgnoreCase(key.replaceAll("[^A-Za-z0-9]", ""))) {
                return entry.getValue();
            }
        }
        // Alias match
        String normalizedKey = key.trim().toLowerCase();
        for (Map.Entry<String, List<String>> aliasGroup : PARAM_ALIASES.entrySet()) {
            if (aliasGroup.getKey().equalsIgnoreCase(normalizedKey) || aliasGroup.getValue().contains(normalizedKey)) {
                for (String alias : aliasGroup.getValue()) {
                    for (Map.Entry<String, String> entry : params.entrySet()) {
                        if (entry.getKey().equalsIgnoreCase(alias) ||
                            entry.getKey().replaceAll("[^A-Za-z0-9]", "").equalsIgnoreCase(alias.replaceAll("[^A-Za-z0-9]", ""))) {
                            return entry.getValue();
                        }
                    }
                }
            }
        }
        return null;
    }

    private boolean isMobileParam(String name) {
        if (name == null) return false;
        String n = name.toLowerCase();
        return n.contains("mobile") || n.contains("phone");
    }

    private List<BbpsDtos.InputParamInfo> defaultAgentCollectionParams() {
        return List.of(
                BbpsDtos.InputParamInfo.builder()
                        .paramName("Agent Code")
                        .dataType("ALPHANUMERIC")
                        .optional(false)
                        .minLength(3)
                        .maxLength(30)
                        .build(),
                BbpsDtos.InputParamInfo.builder()
                        .paramName("Center ID / Group Code")
                        .dataType("ALPHANUMERIC")
                        .optional(true)
                        .minLength(2)
                        .maxLength(30)
                        .build()
        );
    }

    private void initBillers() {
        // 1. Bajaj Finance Limited Agent Collection
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("BAJA00000NAT9L")
                .billerName("Bajaj Finance Limited Agent Collection")
                .agencyName("Bajaj Finance Limited")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("NOT_SUPPORTED")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(500000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Consumer No").dataType("ALPHANUMERIC").optional(false).minLength(3).maxLength(30).build(),
                        BbpsDtos.InputParamInfo.builder().paramName("Collection Reference Number").dataType("ALPHANUMERIC").optional(true).minLength(2).maxLength(30).build()
                ))
                .description("Bajaj Finance field agent cash collection and recovery deposit")
                .build());

        // 2. DMI Housing Finance Pvt Ltd
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("DMIH00020NATNH")
                .billerName("DMI Housing Finance Pvt Ltd")
                .agencyName("DMI Housing Finance Private Limited")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(500000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Agent Code").dataType("ALPHANUMERIC").optional(false).minLength(3).maxLength(30).build(),
                        BbpsDtos.InputParamInfo.builder().paramName("Collection Reference Number").dataType("ALPHANUMERIC").optional(true).minLength(2).maxLength(30).build()
                ))
                .description("DMI Housing Finance field collection and loan recovery")
                .build());

        // 3. HDB Financial Agent Services
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("HDBF00019NATJC")
                .billerName("HDB Financial Agent Services")
                .agencyName("HDB Financial Services Limited")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(500000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Agent Code").dataType("ALPHANUMERIC").optional(false).minLength(3).maxLength(30).build(),
                        BbpsDtos.InputParamInfo.builder().paramName("Collection Reference Number").dataType("ALPHANUMERIC").optional(true).minLength(2).maxLength(30).build()
                ))
                .description("HDB Financial Services field agent collection services")
                .build());

        // 4. Hiranandani Financial Services Pvt Ltd
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("HIRA00027NAT83")
                .billerName("Hiranandani Financial Services Pvt Ltd")
                .agencyName("Hiranandani Financial Services Private Limited")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(500000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Agent Code").dataType("ALPHANUMERIC").optional(false).minLength(3).maxLength(30).build(),
                        BbpsDtos.InputParamInfo.builder().paramName("Collection Reference Number").dataType("ALPHANUMERIC").optional(true).minLength(2).maxLength(30).build()
                ))
                .description("Hiranandani Financial Services agent collection and field recovery")
                .build());
    }
}
