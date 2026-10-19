package com.rupiksha.backend.integration.bbps;

import com.rupiksha.backend.api.dto.BbpsDtos;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Pattern;

/**
 * Official registry of Bharat Connect / BillAvenue Electricity Distribution Companies (DISCOMs)
 * with documented customer input parameters, validations, and fetch requirements.
 */
@Component
public class ElectricityBillerRegistry {

    private final List<BbpsDtos.ElectricityBillerInfo> billers = new ArrayList<>();
    private final Map<String, BbpsDtos.ElectricityBillerInfo> billerMap = new HashMap<>();

    public ElectricityBillerRegistry() {
        initBillers();
    }

    public List<BbpsDtos.ElectricityBillerInfo> getAllBillers(String stateFilter) {
        if (stateFilter == null || stateFilter.isBlank() || "All".equalsIgnoreCase(stateFilter) || "All India".equalsIgnoreCase(stateFilter)) {
            return Collections.unmodifiableList(billers);
        }
        String clean = stateFilter.trim().toLowerCase();
        return billers.stream()
                .filter(b -> b.getState() != null && b.getState().toLowerCase().contains(clean))
                .toList();
    }

    public Optional<BbpsDtos.ElectricityBillerInfo> findById(String billerId) {
        if (billerId == null || billerId.isBlank()) return Optional.empty();
        return Optional.ofNullable(billerMap.get(billerId.trim().toUpperCase()));
    }

    /**
     * Validates client-supplied customer parameters against the biller's documented schema.
     */
    public void validateCustomerParams(BbpsDtos.ElectricityBillerInfo biller, Map<String, String> customerParams) {
        if (biller == null) {
            throw new IllegalArgumentException("Invalid or unknown electricity biller");
        }
        if (customerParams == null || customerParams.isEmpty()) {
            throw new IllegalArgumentException("Customer parameters cannot be empty");
        }

        List<BbpsDtos.InputParamInfo> expectedParams = biller.getInputParams();
        if (expectedParams == null || expectedParams.isEmpty()) {
            return;
        }

        for (BbpsDtos.InputParamInfo expected : expectedParams) {
            String value = customerParams.get(expected.getParamName());
            if (value == null || value.isBlank()) {
                // Try case-insensitive lookup
                for (Map.Entry<String, String> entry : customerParams.entrySet()) {
                    if (entry.getKey().equalsIgnoreCase(expected.getParamName())) {
                        value = entry.getValue();
                        break;
                    }
                }
            }

            if (!expected.isOptional()) {
                if (value == null || value.isBlank()) {
                    throw new IllegalArgumentException("Parameter '" + expected.getParamName() + "' is required for " + biller.getBillerName());
                }
            }

            if (value != null && !value.isBlank()) {
                String trimmed = value.trim();
                if (expected.getMinLength() > 0 && trimmed.length() < expected.getMinLength()) {
                    throw new IllegalArgumentException("Parameter '" + expected.getParamName() + "' must be at least " + expected.getMinLength() + " characters");
                }
                if (expected.getMaxLength() > 0 && trimmed.length() > expected.getMaxLength()) {
                    throw new IllegalArgumentException("Parameter '" + expected.getParamName() + "' cannot exceed " + expected.getMaxLength() + " characters");
                }
                if ("NUMERIC".equalsIgnoreCase(expected.getDataType()) && !trimmed.matches("^\\d+$")) {
                    throw new IllegalArgumentException("Parameter '" + expected.getParamName() + "' must be numeric digits only");
                }
                if (expected.getRegEx() != null && !expected.getRegEx().isBlank()) {
                    try {
                        if (!Pattern.compile(expected.getRegEx()).matcher(trimmed).matches()) {
                            throw new IllegalArgumentException("Parameter '" + expected.getParamName() + "' does not match required format");
                        }
                    } catch (Exception ignored) {}
                }
            }
        }
    }

    /**
     * Extracts the primary consumer identifier for storage and masking.
     */
    public String extractPrimaryConsumerNumber(Map<String, String> customerParams) {
        if (customerParams == null || customerParams.isEmpty()) return "UNKNOWN";
        for (Map.Entry<String, String> e : customerParams.entrySet()) {
            String key = e.getKey().toLowerCase();
            if (key.contains("consumer") || key.contains("ca number") || key.contains("account") ||
                key.contains("service") || key.contains("k number") || key.contains("bp number") ||
                key.contains("ivrs") || key.contains("customer")) {
                return e.getValue();
            }
        }
        return customerParams.values().iterator().next();
    }

    private void addBiller(BbpsDtos.ElectricityBillerInfo info) {
        billers.add(info);
        billerMap.put(info.getBillerId().toUpperCase(), info);
    }

    private void initBillers() {
        // ── MAHARASHTRA ─────────────────────────────────────────────────────────
        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("MSED00000MAH01")
                .billerName("Maharashtra State Electricity Distribution (MSEDCL / Mahavitaran)")
                .state("Maharashtra")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("MSEDCL / Mahavitaran power supply for residential, commercial & industrial consumers in Maharashtra")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Consumer Number").dataType("NUMERIC").optional(false).minLength(12).maxLength(12).hint("12-digit consumer number on bill").build(),
                        BbpsDtos.InputParamInfo.builder().paramName("Billing Unit (BU)").dataType("NUMERIC").optional(false).minLength(4).maxLength(4).hint("4-digit BU code printed on bill").build()
                ))
                .build());

        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("TATA00000MUM01")
                .billerName("Tata Power - Mumbai")
                .state("Maharashtra")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Tata Power electricity distribution in Mumbai and suburbs")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Consumer Number").dataType("NUMERIC").optional(false).minLength(12).maxLength(12).hint("12-digit consumer number").build()
                ))
                .build());

        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("ADAN00000MUM01")
                .billerName("Adani Electricity Mumbai Limited")
                .state("Maharashtra")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Adani Electricity Mumbai distribution across Mumbai suburbs")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Consumer Number").dataType("NUMERIC").optional(false).minLength(9).maxLength(10).hint("9 or 10-digit consumer account number").build()
                ))
                .build());

        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("BEST00000MUM01")
                .billerName("Brihanmumbai Electric Supply and Transport (BEST)")
                .state("Maharashtra")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("BEST Undertaking electricity supply in Mumbai island city")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Consumer Number").dataType("NUMERIC").optional(false).minLength(9).maxLength(12).hint("Consumer number on your electricity bill").build()
                ))
                .build());

        // ── DELHI ───────────────────────────────────────────────────────────────
        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("BSES00000DEL01")
                .billerName("BSES Rajdhani Power Limited (BRPL)")
                .state("Delhi")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("BSES Rajdhani electricity distribution in South and West Delhi")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("CA Number").dataType("NUMERIC").optional(false).minLength(9).maxLength(9).hint("9-digit CA Number on your BSES bill").build()
                ))
                .build());

        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("BSES00000DEL02")
                .billerName("BSES Yamuna Power Limited (BYPL)")
                .state("Delhi")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("BSES Yamuna electricity distribution in Central and East Delhi")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("CA Number").dataType("NUMERIC").optional(false).minLength(9).maxLength(9).hint("9-digit CA Number on your BSES bill").build()
                ))
                .build());

        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("TPDD00000DEL01")
                .billerName("Tata Power - DDL (North Delhi)")
                .state("Delhi")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Tata Power Delhi Distribution Limited in North and North-West Delhi")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("CA Number").dataType("NUMERIC").optional(false).minLength(11).maxLength(11).hint("11-digit CA Number on Tata Power bill").build()
                ))
                .build());

        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("NDMC00000DEL01")
                .billerName("New Delhi Municipal Council (NDMC) - Electricity")
                .state("Delhi")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("NDMC electricity utility services in Lutyens Delhi area")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Consumer Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(15).hint("Consumer number on NDMC bill").build()
                ))
                .build());

        // ── UTTAR PRADESH ───────────────────────────────────────────────────────
        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("UPPC00000UPE01")
                .billerName("UPPCL (Uttar Pradesh Power Corp) - Rural")
                .state("Uttar Pradesh")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("UPPCL rural power consumers (MVVNL, DVVNL, PVVNL, PuVVNL Rural)")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Account Number").dataType("NUMERIC").optional(false).minLength(12).maxLength(12).hint("12-digit rural electricity account number").build()
                ))
                .build());

        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("UPPC00000UPE02")
                .billerName("UPPCL (Uttar Pradesh Power Corp) - Urban")
                .state("Uttar Pradesh")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("UPPCL urban power consumers across cities in Uttar Pradesh")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Account Number").dataType("NUMERIC").optional(false).minLength(10).maxLength(10).hint("10-digit urban electricity account ID").build()
                ))
                .build());

        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("KESCO0000UPE01")
                .billerName("Kanpur Electricity Supply Company (KESCO)")
                .state("Uttar Pradesh")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("KESCO power distribution in Kanpur city")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Account Number").dataType("NUMERIC").optional(false).minLength(10).maxLength(10).hint("10-digit consumer account number").build()
                ))
                .build());

        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("TORRENT000AGR1")
                .billerName("Torrent Power - Agra")
                .state("Uttar Pradesh")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Torrent Power electricity distribution in Agra city")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Service Number").dataType("NUMERIC").optional(false).minLength(10).maxLength(10).hint("10-digit service number on Torrent bill").build()
                ))
                .build());

        // ── KARNATAKA ───────────────────────────────────────────────────────────
        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("BESC00000KAR01")
                .billerName("Bangalore Electricity Supply Company (BESCOM)")
                .state("Karnataka")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("BESCOM power distribution across Bengaluru Urban, Rural, and surrounding districts")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Consumer ID / Account ID").dataType("NUMERIC").optional(false).minLength(10).maxLength(10).hint("10-digit Account ID on BESCOM bill").build()
                ))
                .build());

        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("HESC00000KAR01")
                .billerName("Hubli Electricity Supply Company (HESCOM)")
                .state("Karnataka")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("HESCOM power distribution across North Karnataka")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Account ID").dataType("NUMERIC").optional(false).minLength(10).maxLength(10).hint("10-digit Account ID").build()
                ))
                .build());

        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("MESC00000KAR01")
                .billerName("Mangalore Electricity Supply Company (MESCOM)")
                .state("Karnataka")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("MESCOM power distribution in coastal Karnataka")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Account ID").dataType("NUMERIC").optional(false).minLength(10).maxLength(10).hint("10-digit Account ID").build()
                ))
                .build());

        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("CESC00000KAR01")
                .billerName("Chamundeshwari Electricity Supply Corporation (CESC Mysore)")
                .state("Karnataka")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("CESC Mysore electricity distribution across Mysuru, Mandya, Chamarajanagar")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Account ID").dataType("NUMERIC").optional(false).minLength(10).maxLength(10).hint("10-digit Account ID").build()
                ))
                .build());

        // ── TELANGANA & ANDHRA PRADESH ──────────────────────────────────────────
        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("TSSP00000TEL01")
                .billerName("Telangana Southern Power Distribution (TSSPDCL)")
                .state("Telangana")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("TSSPDCL electricity distribution across Hyderabad and Southern Telangana")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Unique Service Number (USCNO)").dataType("NUMERIC").optional(false).minLength(7).maxLength(10).hint("7 to 10-digit USCNO number").build()
                ))
                .build());

        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("TSNP00000TEL01")
                .billerName("Telangana Northern Power Distribution (TSNPDCL)")
                .state("Telangana")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("TSNPDCL electricity distribution in Warangal, Karimnagar and North Telangana")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Consumer Number").dataType("NUMERIC").optional(false).minLength(8).maxLength(10).hint("Consumer number on TSNPDCL bill").build()
                ))
                .build());

        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("APSP00000AND01")
                .billerName("Southern Power Distribution of AP (APSPDCL)")
                .state("Andhra Pradesh")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("APSPDCL power distribution across Southern Andhra Pradesh")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Service Number").dataType("ALPHANUMERIC").optional(false).minLength(8).maxLength(15).hint("Service number on APSPDCL bill").build()
                ))
                .build());

        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("APEP00000AND01")
                .billerName("Eastern Power Distribution of AP (APEPDCL)")
                .state("Andhra Pradesh")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("APEPDCL power distribution across Visakhapatnam and coastal districts")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Service Number").dataType("ALPHANUMERIC").optional(false).minLength(8).maxLength(15).hint("Service number on APEPDCL bill").build()
                ))
                .build());

        // ── WEST BENGAL ─────────────────────────────────────────────────────────
        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("WBSE00000WES01")
                .billerName("West Bengal State Electricity Distribution (WBSEDCL)")
                .state("West Bengal")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("WBSEDCL electricity distribution across West Bengal districts")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Consumer ID").dataType("NUMERIC").optional(false).minLength(9).maxLength(9).hint("9-digit consumer ID on WBSEDCL bill").build(),
                        BbpsDtos.InputParamInfo.builder().paramName("Installation Number").dataType("NUMERIC").optional(true).minLength(0).maxLength(10).hint("Optional installation number").build()
                ))
                .build());

        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("CESC00000WES01")
                .billerName("CESC Limited (Kolkata & Howrah)")
                .state("West Bengal")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("CESC power distribution in Kolkata, Howrah, Hooghly and 24 Parganas")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Customer ID").dataType("NUMERIC").optional(false).minLength(11).maxLength(11).hint("11-digit Customer ID on CESC bill").build()
                ))
                .build());

        // ── BIHAR ───────────────────────────────────────────────────────────────
        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("NBPD00000BIH01")
                .billerName("North Bihar Power Distribution Company (NBPDCL)")
                .state("Bihar")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("NBPDCL power distribution in North Bihar districts")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("CA Number").dataType("NUMERIC").optional(false).minLength(11).maxLength(11).hint("11-digit CA Number on NBPDCL bill").build()
                ))
                .build());

        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("SBPD00000BIH01")
                .billerName("South Bihar Power Distribution Company (SBPDCL)")
                .state("Bihar")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("SBPDCL power distribution in Patna and South Bihar districts")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("CA Number").dataType("NUMERIC").optional(false).minLength(11).maxLength(11).hint("11-digit CA Number on SBPDCL bill").build()
                ))
                .build());

        // ── GUJARAT ─────────────────────────────────────────────────────────────
        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("DGVCL0000GUJ01")
                .billerName("Dakshin Gujarat Vij Company Ltd (DGVCL)")
                .state("Gujarat")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("DGVCL electricity distribution in South Gujarat (Surat, Navsari, Valsad)")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Consumer Number").dataType("NUMERIC").optional(false).minLength(11).maxLength(11).hint("11-digit consumer number").build()
                ))
                .build());

        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("MGVCL0000GUJ01")
                .billerName("Madhya Gujarat Vij Company Ltd (MGVCL)")
                .state("Gujarat")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("MGVCL electricity distribution in Central Gujarat (Vadodara, Anand, Kheda)")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Consumer Number").dataType("NUMERIC").optional(false).minLength(11).maxLength(11).hint("11-digit consumer number").build()
                ))
                .build());

        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("PGVCL0000GUJ01")
                .billerName("Paschim Gujarat Vij Company Ltd (PGVCL)")
                .state("Gujarat")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("PGVCL electricity distribution in Saurashtra and Kutch")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Consumer Number").dataType("NUMERIC").optional(false).minLength(11).maxLength(11).hint("11-digit consumer number").build()
                ))
                .build());

        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("UGVCL0000GUJ01")
                .billerName("Uttar Gujarat Vij Company Ltd (UGVCL)")
                .state("Gujarat")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("UGVCL electricity distribution in North Gujarat (Mehsana, Sabarkantha)")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Consumer Number").dataType("NUMERIC").optional(false).minLength(11).maxLength(11).hint("11-digit consumer number").build()
                ))
                .build());

        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("TORRENT000AHM1")
                .billerName("Torrent Power - Ahmedabad & Gandhinagar")
                .state("Gujarat")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Torrent Power distribution in Ahmedabad and Gandhinagar cities")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Service Number").dataType("NUMERIC").optional(false).minLength(10).maxLength(10).hint("10-digit service number on Torrent bill").build()
                ))
                .build());

        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("TORRENT000SUR1")
                .billerName("Torrent Power - Surat")
                .state("Gujarat")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Torrent Power distribution in Surat city")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Service Number").dataType("NUMERIC").optional(false).minLength(10).maxLength(10).hint("10-digit service number on Torrent bill").build()
                ))
                .build());

        // ── RAJASTHAN ───────────────────────────────────────────────────────────
        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("JVVN00000RAJ01")
                .billerName("Jaipur Vidyut Vitran Nigam Ltd (JVVNL)")
                .state("Rajasthan")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("JVVNL power distribution across Jaipur and Eastern Rajasthan")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("K Number").dataType("NUMERIC").optional(false).minLength(12).maxLength(12).hint("12-digit K Number on JVVNL bill").build()
                ))
                .build());

        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("AVVN00000RAJ01")
                .billerName("Ajmer Vidyut Vitran Nigam Ltd (AVVNL)")
                .state("Rajasthan")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("AVVNL power distribution in Ajmer, Udaipur, and Central Rajasthan")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("K Number").dataType("NUMERIC").optional(false).minLength(12).maxLength(12).hint("12-digit K Number on AVVNL bill").build()
                ))
                .build());

        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("JDVV00000RAJ01")
                .billerName("Jodhpur Vidyut Vitran Nigam Ltd (JdVVNL)")
                .state("Rajasthan")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("JdVVNL power distribution in Jodhpur, Bikaner, and Western Rajasthan")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("K Number").dataType("NUMERIC").optional(false).minLength(12).maxLength(12).hint("12-digit K Number on JdVVNL bill").build()
                ))
                .build());

        // ── PUNJAB & HARYANA ────────────────────────────────────────────────────
        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("PSPC00000PUN01")
                .billerName("Punjab State Power Corporation (PSPCL)")
                .state("Punjab")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("PSPCL electricity generation and distribution across Punjab state")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Account Number").dataType("ALPHANUMERIC").optional(false).minLength(10).maxLength(12).hint("10 to 12-character PSPCL account number").build()
                ))
                .build());

        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("DHBV00000HAR01")
                .billerName("Dakshin Haryana Bijli Vitran Nigam (DHBVN)")
                .state("Haryana")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("DHBVN electricity distribution in Gurugram, Faridabad, and South Haryana")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Account Number").dataType("ALPHANUMERIC").optional(false).minLength(10).maxLength(10).hint("10-character DHBVN account number").build()
                ))
                .build());

        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("UHBV00000HAR01")
                .billerName("Uttar Haryana Bijli Vitran Nigam (UHBVN)")
                .state("Haryana")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("UHBVN electricity distribution in Panchkula, Ambala, and North Haryana")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Account Number").dataType("ALPHANUMERIC").optional(false).minLength(10).maxLength(10).hint("10-character UHBVN account number").build()
                ))
                .build());

        // ── MADHYA PRADESH ──────────────────────────────────────────────────────
        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("MPPK00000MAD01")
                .billerName("MP Poorv Kshetra Vidyut Vitaran (Jabalpur)")
                .state("Madhya Pradesh")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("MP Poorv Kshetra electricity distribution in Jabalpur and Eastern MP")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Service Connection / IVRS Number").dataType("NUMERIC").optional(false).minLength(10).maxLength(10).hint("10-digit IVRS number on bill").build()
                ))
                .build());

        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("MPMK00000MAD01")
                .billerName("MP Madhya Kshetra Vidyut Vitaran (Bhopal)")
                .state("Madhya Pradesh")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("MP Madhya Kshetra electricity distribution in Bhopal and Gwalior")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("IVRS Number").dataType("NUMERIC").optional(false).minLength(10).maxLength(10).hint("10-digit IVRS number").build()
                ))
                .build());

        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("MPPK00000MAD02")
                .billerName("MP Paschim Kshetra Vidyut Vitaran (Indore)")
                .state("Madhya Pradesh")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("MP Paschim Kshetra electricity distribution in Indore and Ujjain")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("IVRS Number").dataType("NUMERIC").optional(false).minLength(10).maxLength(10).hint("10-digit IVRS number").build()
                ))
                .build());

        // ── CHHATTISGARH ────────────────────────────────────────────────────────
        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("CSPD00000CHH01")
                .billerName("Chhattisgarh State Power Distribution (CSPDCL)")
                .state("Chhattisgarh")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("CSPDCL power distribution across Chhattisgarh")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Consumer Number / BP Number").dataType("NUMERIC").optional(false).minLength(10).maxLength(10).hint("10-digit BP / Consumer number").build()
                ))
                .build());

        // ── ASSAM ───────────────────────────────────────────────────────────────
        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("APDC00000ASS01")
                .billerName("Assam Power Distribution Company Ltd (APDCL)")
                .state("Assam")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("APDCL power distribution across Assam state")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Consumer Number").dataType("NUMERIC").optional(false).minLength(12).maxLength(12).hint("12-digit consumer number on APDCL bill").build()
                ))
                .build());

        // ── KERALA ──────────────────────────────────────────────────────────────
        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("KSEB00000KER01")
                .billerName("Kerala State Electricity Board (KSEB)")
                .state("Kerala")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("KSEBL electricity distribution across Kerala state")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Consumer Number").dataType("NUMERIC").optional(false).minLength(13).maxLength(13).hint("13-digit consumer number on KSEB bill").build()
                ))
                .build());

        // ── TAMIL NADU ──────────────────────────────────────────────────────────
        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("TANG00000TAM01")
                .billerName("Tamil Nadu Generation & Distribution (TANGEDCO)")
                .state("Tamil Nadu")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("TANGEDCO electricity supply across Tamil Nadu")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Consumer Number").dataType("NUMERIC").optional(false).minLength(9).maxLength(12).hint("Consumer number with section code").build()
                ))
                .build());

        // ── ODISHA ──────────────────────────────────────────────────────────────
        addBiller(BbpsDtos.ElectricityBillerInfo.builder()
                .billerId("TPCO00000ODI01")
                .billerName("TP Central Odisha Distribution Ltd (TPCODL)")
                .state("Odisha")
                .category("Electricity")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("TPCODL power distribution in Bhubaneswar, Cuttack, Puri")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Consumer Number").dataType("NUMERIC").optional(false).minLength(12).maxLength(12).hint("12-digit consumer number").build()
                ))
                .build());
    }
}
