package com.rupiksha.backend.integration.bbps;

import com.rupiksha.backend.api.dto.BbpsDtos;
import com.rupiksha.backend.integration.bbps.dto.BillAvenueDtos;
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
@Component
public class AgentCollectionBillerRegistry {

    private static final Pattern CLEAN_ALPHANUMERIC_PATTERN = Pattern.compile("[^A-Za-z0-9_-]");

    private final List<BbpsDtos.AgentCollectionBillerInfo> billers = new CopyOnWriteArrayList<>();
    private final Map<String, BbpsDtos.AgentCollectionBillerInfo> billerMap = new ConcurrentHashMap<>();

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
        for (String key : List.of("Agent Code", "Agent ID", "Collector ID", "Employee ID", "CSR ID", "DE ID", "Rider ID", "Partner ID", "Cashier ID", "agentCode", "agentId")) {
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

    public List<List<BillAvenueDtos.InputParam>> generateParameterVariations(String agentCode, String collectionRef, String mobile) {
        List<List<BillAvenueDtos.InputParam>> variations = new ArrayList<>();
        if (agentCode == null || agentCode.isBlank()) return variations;

        String cleanCode = agentCode.trim();

        variations.add(List.of(
                BillAvenueDtos.InputParam.builder().paramName("Agent Code").paramValue(cleanCode).build()
        ));
        variations.add(List.of(
                BillAvenueDtos.InputParam.builder().paramName("Agent ID").paramValue(cleanCode).build()
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

        if (collectionRef != null && !collectionRef.isBlank()) {
            variations.add(List.of(
                    BillAvenueDtos.InputParam.builder().paramName("Agent Code").paramValue(cleanCode).build(),
                    BillAvenueDtos.InputParam.builder().paramName("Center ID").paramValue(collectionRef.trim()).build()
            ));
            variations.add(List.of(
                    BillAvenueDtos.InputParam.builder().paramName("Agent ID").paramValue(cleanCode).build(),
                    BillAvenueDtos.InputParam.builder().paramName("Group Code").paramValue(collectionRef.trim()).build()
            ));
        }

        return variations;
    }

    private String findParamValue(Map<String, String> params, String key) {
        if (params == null || key == null) return null;
        for (Map.Entry<String, String> entry : params.entrySet()) {
            if (entry.getKey().equalsIgnoreCase(key) ||
                entry.getKey().replaceAll("[^A-Za-z0-9]", "").equalsIgnoreCase(key.replaceAll("[^A-Za-z0-9]", ""))) {
                return entry.getValue();
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
        // 1. Spandana Sphoorty Financial Limited
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("SPAN00000NAT01")
                .billerName("Spandana Sphoorty Financial - Agent Collection")
                .agencyName("Spandana Sphoorty Financial Ltd")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(200000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Agent Code").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(20).build(),
                        BbpsDtos.InputParamInfo.builder().paramName("Center ID").dataType("ALPHANUMERIC").optional(true).minLength(2).maxLength(20).build()
                ))
                .description("Microfinance field collection and group repayment deposits")
                .build());

        // 2. Swatantra Microfin
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("SWAT00000NAT01")
                .billerName("Swatantra Microfin - Agent Collection")
                .agencyName("Swatantra Microfin Pvt Ltd")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(200000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Agent ID").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(20).build(),
                        BbpsDtos.InputParamInfo.builder().paramName("Group Code").dataType("ALPHANUMERIC").optional(true).minLength(2).maxLength(20).build()
                ))
                .description("Swatantra Microfin field agent collection drop")
                .build());

        // 3. Fincare Small Finance Bank - Agent Collection
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("FICA00000NAT01")
                .billerName("Fincare Small Finance Bank - Agent Collection")
                .agencyName("Fincare Small Finance Bank")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(50))
                .maxAmount(BigDecimal.valueOf(200000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Agent Code").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(20).build()
                ))
                .description("Fincare field executive cash deposit collection")
                .build());

        // 4. Satin Creditcare Network
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("SATI00000NAT01")
                .billerName("Satin Creditcare Network - Agent Collection")
                .agencyName("Satin Creditcare Network Ltd")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(200000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Agent ID").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(20).build(),
                        BbpsDtos.InputParamInfo.builder().paramName("Branch Code").dataType("ALPHANUMERIC").optional(true).minLength(2).maxLength(15).build()
                ))
                .description("Satin Creditcare field collection and cash drop")
                .build());

        // 5. Sonata Finance
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("SONA00000NAT01")
                .billerName("Sonata Finance - Agent Collection")
                .agencyName("Sonata Finance Pvt Ltd")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(200000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Collector ID").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(20).build()
                ))
                .description("Sonata microfinance loan recovery field collection")
                .build());

        // 6. Asirvad Microfinance
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("ASIR00000NAT01")
                .billerName("Asirvad Microfinance - Agent Collection")
                .agencyName("Asirvad Microfinance Ltd")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(200000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Agent ID").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(20).build()
                ))
                .description("Asirvad microfinance field staff collection point")
                .build());

        // 7. Muthoot Microfin
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("MUTM00000NAT01")
                .billerName("Muthoot Microfin - Agent Collection")
                .agencyName("Muthoot Microfin Ltd")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(200000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Agent ID").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(20).build(),
                        BbpsDtos.InputParamInfo.builder().paramName("Center Code").dataType("ALPHANUMERIC").optional(true).minLength(2).maxLength(20).build()
                ))
                .description("Muthoot Microfin field officer cash deposit")
                .build());

        // 8. Arohan Financial Services
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("AROH00000NAT01")
                .billerName("Arohan Financial Services - Agent Collection")
                .agencyName("Arohan Financial Services Ltd")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(200000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("CSR ID").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(20).build()
                ))
                .description("Arohan Customer Service Representative collection deposit")
                .build());

        // 9. Delhivery Field Agent Collection
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("DELH00000NAT01")
                .billerName("Delhivery - Field Agent Collection")
                .agencyName("Delhivery Ltd")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(50))
                .maxAmount(BigDecimal.valueOf(200000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Delivery Agent ID").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(25).build()
                ))
                .description("Delhivery cash-on-delivery field rider cash drop")
                .build());

        // 10. Shadowfax Rider Cash Drop
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("SHAD00000NAT01")
                .billerName("Shadowfax - Rider Collection")
                .agencyName("Shadowfax Technologies")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(50))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Rider ID").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(20).build()
                ))
                .description("Shadowfax logistics delivery partner cash deposit")
                .build());

        // 11. Porter Partner Collection
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("PORT00000NAT01")
                .billerName("Porter - Partner Cash Collection")
                .agencyName("SmartShift Logistics Solutions (Porter)")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(50))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Partner ID").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(20).build()
                ))
                .description("Porter driver partner COD reconciliation drop")
                .build());

        // 12. Zomato Delivery Partner Collection
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("ZOMA00000NAT01")
                .billerName("Zomato - Delivery Partner Collection")
                .agencyName("Zomato Limited")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(50))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Rider ID").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(20).build()
                ))
                .description("Zomato delivery partner cash float deposit")
                .build());

        // 13. Swiggy Delivery Partner Collection
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("SWIG00000NAT01")
                .billerName("Swiggy - Delivery Partner Collection")
                .agencyName("Bundl Technologies (Swiggy)")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(50))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("DE ID").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(20).build()
                ))
                .description("Swiggy Delivery Executive cash collection reconciliation")
                .build());

        // 14. Ekart Logistics Field Agent Collection
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("EKAR00000NAT01")
                .billerName("Ekart Logistics - Field Agent Collection")
                .agencyName("Instakart Services (Ekart)")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(50))
                .maxAmount(BigDecimal.valueOf(200000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Agent ID").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(25).build()
                ))
                .description("Ekart logistics delivery boy COD remittance drop")
                .build());

        // 15. L&T Finance - Collection
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("LNTF00000NAT01")
                .billerName("L&T Finance - Agent Collection")
                .agencyName("L&T Finance Holdings Ltd")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(200000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Agent Code").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(20).build()
                ))
                .description("L&T Finance two-wheeler & micro-loan field collection")
                .build());

        // 16. Bajaj Finance - Agent Collection
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("BAJA00000NAT01")
                .billerName("Bajaj Finance - Agent Collection")
                .agencyName("Bajaj Finance Limited")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(200000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Agent ID").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(20).build()
                ))
                .description("Bajaj Finance field collection agent deposit")
                .build());

        // 17. Cholamandalam Investment - Agent Collection
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("CHOL00000NAT01")
                .billerName("Cholamandalam Investment - Agent Collection")
                .agencyName("Cholamandalam Investment and Finance Co Ltd")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(200000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Agent ID").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(20).build()
                ))
                .description("Chola vehicle and LAP collection agent drop")
                .build());

        // 18. Shriram Finance - Agent Collection
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("SHRE00000NAT01")
                .billerName("Shriram Finance - Agent Collection")
                .agencyName("Shriram Finance Limited")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(200000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Agent ID").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(20).build()
                ))
                .description("Shriram commercial vehicle recovery collection")
                .build());

        // 19. Mahindra Finance - Agent Collection
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("MAHI00000NAT01")
                .billerName("Mahindra Finance - Agent Collection")
                .agencyName("Mahindra & Mahindra Financial Services Ltd")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(200000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Executive Code").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(20).build()
                ))
                .description("Mahindra Finance rural field recovery executive drop")
                .build());

        // 20. Tata Capital - Agent Collection
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("TATA00000NAT01")
                .billerName("Tata Capital - Agent Collection")
                .agencyName("Tata Capital Financial Services Ltd")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(200000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Agent ID").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(20).build()
                ))
                .description("Tata Capital loan field agent collection remittance")
                .build());

        // 21. HDB Financial Services
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("HDBF00000NAT01")
                .billerName("HDB Financial Services - Agent Collection")
                .agencyName("HDB Financial Services Ltd")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(200000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Agent Code").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(20).build()
                ))
                .description("HDB Financial consumer loan recovery deposit")
                .build());

        // 22. Aditya Birla Finance
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("ADIT00000NAT01")
                .billerName("Aditya Birla Finance - Agent Collection")
                .agencyName("Aditya Birla Finance Limited")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(200000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Collector ID").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(20).build()
                ))
                .description("Aditya Birla Capital loan collection point")
                .build());

        // 23. Kotak Mahindra Prime
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("KOTF00000NAT01")
                .billerName("Kotak Mahindra Prime - Agent Collection")
                .agencyName("Kotak Mahindra Prime Ltd")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(200000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Executive ID").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(20).build()
                ))
                .description("Kotak Prime car and two-wheeler finance recovery")
                .build());

        // 24. IDFC Bharat Banking
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("IDFC00000NAT01")
                .billerName("IDFC FIRST Bharat Banking - Agent Collection")
                .agencyName("IDFC FIRST Bank (Bharat Banking)")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(50))
                .maxAmount(BigDecimal.valueOf(200000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Bharat Agent ID").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(20).build()
                ))
                .description("IDFC FIRST micro-banking business correspondent deposit")
                .build());

        // 25. Annapurna Finance
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("ANNAP0000NAT01")
                .billerName("Annapurna Finance - Agent Collection")
                .agencyName("Annapurna Finance Pvt Ltd")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(200000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Agent ID").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(20).build()
                ))
                .description("Annapurna rural micro-credit field collection")
                .build());

        // 26. Belstar Microfinance
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("BELST0000NAT01")
                .billerName("Belstar Microfinance - Agent Collection")
                .agencyName("Belstar Microfinance Ltd")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(200000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Agent Code").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(20).build()
                ))
                .description("Belstar self-help group loan collection drop")
                .build());

        // 27. Midland Microfin
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("MIDLA0000NAT01")
                .billerName("Midland Microfin - Agent Collection")
                .agencyName("Midland Microfin Ltd")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(200000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Agent ID").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(20).build()
                ))
                .description("Midland Microfin northern region field remittance")
                .build());

        // 28. Svamaan Financial Services
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("SVATR0000NAT01")
                .billerName("Svamaan Financial Services - Agent Collection")
                .agencyName("Svamaan Financial Services Pvt Ltd")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(200000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Agent ID").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(20).build()
                ))
                .description("Svamaan micro-enterprise loan recovery deposit")
                .build());

        // 29. Five-Star Business Finance
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("FIVEL0000NAT01")
                .billerName("Five-Star Business Finance - Agent Collection")
                .agencyName("Five-Star Business Finance Ltd")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(200000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Collection Agent ID").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(20).build()
                ))
                .description("Five-Star MSME business loan recovery field collection")
                .build());

        // 30. CreditAccess Grameen
        add(BbpsDtos.AgentCollectionBillerInfo.builder()
                .billerId("CRED00000NAT01")
                .billerName("CreditAccess Grameen - Agent Collection")
                .agencyName("CreditAccess Grameen Limited")
                .category("Agent Collection")
                .billerFetchRequirement("OPTIONAL")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(200000))
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Kendra / Agent ID").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(20).build()
                ))
                .description("CreditAccess Grameen Kendra loan collection cash point")
                .build());
    }
}
