package com.rupiksha.backend.integration.bbps;

import com.rupiksha.backend.api.dto.BbpsDtos;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Pattern;

/**
 * Official registry of Bharat Connect / BillAvenue Loan Repayment Lenders & NBFCs
 * with documented customer input parameters, validations, and fetch/validation requirements.
 */
@Component
public class LoanBillerRegistry {

    private final List<BbpsDtos.LoanBillerInfo> billers = new CopyOnWriteArrayList<>();
    private final Map<String, BbpsDtos.LoanBillerInfo> billerMap = new ConcurrentHashMap<>();

    public LoanBillerRegistry() {
        initBillers();
    }

    public List<BbpsDtos.LoanBillerInfo> getAllBillers(String searchFilter) {
        if (searchFilter == null || searchFilter.isBlank()) {
            return Collections.unmodifiableList(billers);
        }
        String clean = searchFilter.trim().toLowerCase();
        String upper = searchFilter.trim().toUpperCase();

        // 1. Direct contains check
        List<BbpsDtos.LoanBillerInfo> directMatches = billers.stream()
                .filter(b -> (b.getBillerName() != null && b.getBillerName().toLowerCase().contains(clean)) ||
                             (b.getBillerId() != null && b.getBillerId().toLowerCase().contains(clean)) ||
                             (b.getDescription() != null && b.getDescription().toLowerCase().contains(clean)))
                .toList();

        if (!directMatches.isEmpty()) {
            return directMatches;
        }

        // 2. Direct 14-character BBPS biller ID match or dynamic resolution
        if (upper.matches("^[A-Z0-9]{14}$")) {
            Optional<BbpsDtos.LoanBillerInfo> dynamic = findById(upper);
            if (dynamic.isPresent()) {
                return List.of(dynamic.get());
            }
        }

        // 3. Token-based matching (handles hyphens, abbreviations, and word order e.g. "Annapurna Finance Private Limited-MFI")
        String[] tokens = clean.replaceAll("[^a-z0-9]", " ").split("\\s+");
        List<String> validTokens = Arrays.stream(tokens).filter(t -> t.length() >= 3).toList();
        if (!validTokens.isEmpty()) {
            List<BbpsDtos.LoanBillerInfo> tokenMatches = billers.stream()
                    .filter(b -> {
                        String fullText = ((b.getBillerName() != null ? b.getBillerName() : "") + " " +
                                           (b.getBillerId() != null ? b.getBillerId() : "") + " " +
                                           (b.getDescription() != null ? b.getDescription() : "")).toLowerCase();
                        for (String token : validTokens) {
                            if (fullText.contains(token)) {
                                return true;
                            }
                        }
                        return false;
                    })
                    .toList();
            if (!tokenMatches.isEmpty()) {
                return tokenMatches;
            }
        }

        return Collections.emptyList();
    }

    public Optional<BbpsDtos.LoanBillerInfo> findById(String billerId) {
        if (billerId == null || billerId.isBlank()) return Optional.empty();
        String clean = billerId.trim().toUpperCase();
        BbpsDtos.LoanBillerInfo found = billerMap.get(clean);
        if (found != null) {
            return Optional.of(found);
        }
        // Fallback: If it's a valid 14-character BBPS biller ID, register on the fly
        if (clean.matches("^[A-Z0-9]{14}$")) {
            BbpsDtos.LoanBillerInfo dynamicInfo = BbpsDtos.LoanBillerInfo.builder()
                    .billerId(clean)
                    .billerName("Loan Provider (" + clean + ")")
                    .category("Loan Repayment")
                    .billerFetchRequirement("MANDATORY")
                    .billerPaymentExactness("Exact")
                    .supportBillValidation("OPTIONAL")
                    .description("Bharat Connect registered loan provider")
                    .inputParams(List.of(
                            BbpsDtos.InputParamInfo.builder()
                                    .paramName("Loan Account Number")
                                    .dataType("ALPHANUMERIC")
                                    .optional(false)
                                    .minLength(4)
                                    .maxLength(30)
                                    .hint("Loan Account Number / LAN")
                                    .build()
                    ))
                    .build();
            addBiller(dynamicInfo);
            return Optional.of(dynamicInfo);
        }
        return Optional.empty();
    }

    /**
     * Validates client-supplied customer parameters against the loan biller's documented schema.
     */
    public void validateCustomerParams(BbpsDtos.LoanBillerInfo biller, Map<String, String> customerParams) {
        if (biller == null) {
            throw new IllegalArgumentException("Invalid or unknown loan biller");
        }
        if (customerParams == null || customerParams.isEmpty()) {
            throw new IllegalArgumentException("Customer loan parameters cannot be empty");
        }

        List<BbpsDtos.InputParamInfo> expectedParams = biller.getInputParams();
        if (expectedParams == null || expectedParams.isEmpty()) {
            return;
        }

        for (BbpsDtos.InputParamInfo expected : expectedParams) {
            String value = customerParams.get(expected.getParamName());
            if (value == null || value.isBlank()) {
                // Case-insensitive fallback
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
                    throw new IllegalArgumentException("Parameter '" + expected.getParamName() + "' must contain numeric digits only");
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
     * Extracts the primary loan account number for storage and display.
     */
    public String extractPrimaryLoanAccountNumber(Map<String, String> customerParams) {
        if (customerParams == null || customerParams.isEmpty()) return "UNKNOWN";
        for (Map.Entry<String, String> e : customerParams.entrySet()) {
            String key = e.getKey().toLowerCase();
            if (key.contains("loan") || key.contains("lan") || key.contains("account") ||
                key.contains("agreement") || key.contains("contract") || key.contains("proposal") ||
                key.contains("application") || key.contains("customer")) {
                return e.getValue();
            }
        }
        return customerParams.values().iterator().next();
    }

    private void addBiller(BbpsDtos.LoanBillerInfo info, String... aliases) {
        billers.add(info);
        billerMap.put(info.getBillerId().toUpperCase(), info);
        if (aliases != null) {
            for (String alias : aliases) {
                if (alias != null && !alias.isBlank()) {
                    billerMap.put(alias.trim().toUpperCase(), info);
                }
            }
        }
    }

    private void initBillers() {
        // ── PROMINENT MICROFINANCE INSTITUTIONS (MFIs) & SPECIALIZED NBFCs ────────
        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("ANNA00000NATUO")
                .billerName("Annapurna Finance Private Limited-MFI")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Annapurna Finance microfinance loans, MSME business loans, and group loan installment repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("Annapurna Loan Account Number / LAN").build()
                ))
                .build(), "ANNA00000NAT01", "ANNA00000NAT02", "ANNA00000MFIP01", "ANNAPURNA", "ANNAPURNAFINANCE", "ANNAPURNAMFI", "Annapurna Finance Pvt Ltd");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("ANNA00000NATMR")
                .billerName("Annapurna Finance Private Limited - MSME")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Annapurna Finance MSME business loan installments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("Annapurna MSME Loan Account Number").build()
                ))
                .build(), "ANNAPURNAMSME");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("AROH00000NAT01")
                .billerName("Arohan Financial Services Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Arohan Financial Services microfinance and saral loan repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("Arohan Loan Account Number").build()
                ))
                .build(), "AROHANFIN", "AROH00000NAT02");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("SATI00000NAT01")
                .billerName("Satin Creditcare Network Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Satin Creditcare microfinance, MSME, and rural loan repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("Satin Loan Account Number").build()
                ))
                .build(), "SATINCREDIT", "SCNL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("CRED00000NAT01")
                .billerName("CreditAccess Grameen Limited (Grameen Koota)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("CreditAccess Grameen group loans and retail microfinance repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("CreditAccess Loan Account Number").build()
                ))
                .build(), "GRAMEENKOOTA", "CAGL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("FUSI00000NAT01")
                .billerName("Fusion Microfinance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Fusion Microfinance joint liability group and enterprise loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("Fusion Loan Account Number").build()
                ))
                .build(), "FUSIONMICRO", "FMFL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("MUTH00000NAT02")
                .billerName("Muthoot Microfin Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Muthoot Microfin micro loans and women empowerment finance")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("Muthoot Microfin Account Number").build()
                ))
                .build(), "MUTHOOTMICRO", "MML000000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("SPAN00000NAT01")
                .billerName("Spandana Sphoorty Financial Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Spandana Sphoorty micro loans, rural finance, and group loan repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("Spandana Loan Account Number").build()
                ))
                .build(), "SPANDANAFIN", "SSFL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("ASIR00000NAT01")
                .billerName("Asirvad Microfinance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Asirvad Microfinance (Manappuram subsidiary) micro-loans and SME financing")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("Asirvad Loan Account Number").build()
                ))
                .build(), "ASIRVADFIN", "AMFL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("BELS00000NAT01")
                .billerName("Belstar Microfinance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Belstar Microfinance SHG / JLG and rural enterprise loan repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("Belstar Loan Account Number").build()
                ))
                .build(), "BELSTARFIN", "BMFL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("CHAI00000NAT01")
                .billerName("Chaitanya India Fin Credit Private Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Chaitanya India Fin Credit microfinance and livelihood loan repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("Chaitanya Loan Account Number").build()
                ))
                .build(), "CHAITANYAFIN", "CIFC00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("MIDL00000NAT01")
                .billerName("Midland Microfin Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Midland Microfin group loans and small business financing")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("Midland Loan Account Number").build()
                ))
                .build(), "MIDLANDFIN", "MMFL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("SONA00000NAT01")
                .billerName("Sonata Finance Private Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Sonata Finance micro-credit loans and income generation finance")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("Sonata Loan Account Number").build()
                ))
                .build(), "SONATAFIN", "SFPL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("SVCL00000NAT01")
                .billerName("SV Creditline Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("SV Creditline microfinance loans and livelihood installments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("SVCL Loan Account Number").build()
                ))
                .build(), "SVCREDITLINE", "SVCL00000NAT02");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("SAMB00000NAT01")
                .billerName("Sambandh Finserve Private Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Sambandh Finserve micro-credit and rural enterprise loan repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("Sambandh Loan Account Number").build()
                ))
                .build(), "SAMBANDHFIN");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("SUBH00000NAT01")
                .billerName("Subhlakshmi Finance Private Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Subhlakshmi Finance MSME and micro-enterprise loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("Subhlakshmi Loan Account Number").build()
                ))
                .build(), "SUBHLAKSHMI");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("CENM00000NAT01")
                .billerName("Centrum Microcredit Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Centrum Microcredit financial inclusion and women entrepreneur loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("Centrum Microcredit Account Number").build()
                ))
                .build(), "CENTRUMMICRO");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("LIGH00000NAT01")
                .billerName("Light Microfinance Private Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Light Microfinance community and income-generation finance")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("Light Microfinance Account Number").build()
                ))
                .build(), "LIGHTMICRO");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("SVAR00000NAT01")
                .billerName("Svarna Infrastructure / Svarna Finance")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Svarna Finance micro-loans and rural enterprise loan repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("Svarna Loan Account Number").build()
                ))
                .build(), "SVARNAFIN");

        // ── TOP INDIAN NBFCs & FINANCIERS ───────────────────────────────────────
        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("BAJA00000NAT01")
                .billerName("Bajaj Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Bajaj Finserv EMI cards, personal loans, consumer durable loans, and business financing")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Enter your Loan Account Number / LAN").build()
                ))
                .build(), "BAJA00000NATG1", "BAJAJFINANCE", "BAJAJFINSERV");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("MUTH00000NAT01")
                .billerName("Muthoot Finance")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Muthoot Finance gold loan interest, principal, and EMI repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Muthoot Loan Account / Token No").build()
                ))
                .build(), "MUTHOOTFIN", "MUTHOOT00NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("MAHI00000NAT01")
                .billerName("Mahindra & Mahindra Financial Services Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Mahindra Finance vehicle loans, tractor loans, and SME financing")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Proposal Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Proposal / Contract Number").build()
                ))
                .build(), "MAHINDRALN", "MMFSL0000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("TATA00000NAT01")
                .billerName("Tata Capital Financial Services")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Tata Capital personal loans, business loans, and consumer finance EMI repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Agreement Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Agreement / Loan ID").build()
                ))
                .build(), "TATACAPITAL", "TCFL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("HDFC00000NAT01")
                .billerName("HDFC Bank - Retail Loan Repayment")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("HDFC Bank auto loans, personal loans, home loans, and two-wheeler loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(8).maxLength(20).hint("16-digit Loan Account Number").build()
                ))
                .build(), "HDFCLOAN", "HDFC00000RET01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("LTFI00000NAT01")
                .billerName("L&T Financial Services")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("L&T Finance two wheeler, farm equipment, micro loan, and consumer loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("L&T Loan Account Number").build()
                ))
                .build(), "LTFINANCE", "LTFS00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("HERO00000NAT01")
                .billerName("Hero FinCorp Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Hero FinCorp two-wheeler, personal loan, used car loan, and SME EMI installments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Application / Loan Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Hero FinCorp Loan Number").build()
                ))
                .build(), "HEROFINCORP", "HFCL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("IDFC00000NAT01")
                .billerName("IDFC FIRST Bank - Loan Repayment")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("IDFC FIRST Bank consumer durable, two wheeler, and personal loan repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("IDFC FIRST Loan ID").build()
                ))
                .build(), "IDFCFIRSTLN", "IDFC00000NAT02");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("CHOL00000NAT01")
                .billerName("Cholamandalam Investment and Finance Company Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Chola vehicle finance, home equity, and loan against property EMI repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Agreement Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Chola Agreement Number").build()
                ))
                .build(), "CHOLA", "CIFCL0000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("SHRI00000NAT01")
                .billerName("Shriram Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Shriram commercial vehicle, passenger vehicle, MSME, and two-wheeler financing")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Agreement Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Shriram Loan / Agreement No").build()
                ))
                .build(), "SHRIRAMCITY", "STFC00000NAT01", "SHRIRAMFIN");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("MANA00000NAT01")
                .billerName("Manappuram Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Manappuram gold loans, microfinance, and home loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Pledge / Loan Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Manappuram Loan / Pledge Number").build()
                ))
                .build(), "MANAPPURAM", "MAFIL0000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("ADIT00000NAT01")
                .billerName("Aditya Birla Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Aditya Birla Capital personal, business, SME, and mortgaged loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("ABFL Loan Account Number").build()
                ))
                .build(), "ADITYABIRLA", "ABFL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("PIRA00000NAT01")
                .billerName("Piramal Capital & Housing Finance")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Piramal retail housing loans, personal loans, and business installment repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Piramal Loan Account Number").build()
                ))
                .build(), "PIRAMALFIN", "PCHFL0000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("POON00000NAT01")
                .billerName("Poonawalla Fincorp Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Poonawalla Fincorp pre-owned car, personal, professional, and business loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Agreement Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Poonawalla Loan Agreement Number").build()
                ))
                .build(), "POONAWALLA", "MAGMA0000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("IIFL00000NAT01")
                .billerName("IIFL Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("IIFL gold loans, business loans, microfinance, and personal loan EMIs")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("IIFL Loan Account Number").build()
                ))
                .build(), "IIFLFIN", "IIFL00000NAT02");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("SMFG00000NAT01")
                .billerName("SMFG India Credit (formerly Fullerton India)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("SMFG India Credit personal, commercial vehicle, and rural finance EMIs")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("SMFG / Fullerton Loan Account Number").build()
                ))
                .build(), "FULLERTON", "FICCL0000NAT01", "FULL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("DHAN00000NAT01")
                .billerName("Dhani Loans and Services Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Dhani personal loans, credit line dues, and monthly installments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Dhani Loan / Customer Number").build()
                ))
                .build(), "DHANILOAN", "INDIABULLS", "INDI00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("HOME00000NAT01")
                .billerName("Home Credit India Finance")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Home Credit consumer durable and personal loan installment payments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Contract Number").dataType("NUMERIC").optional(false).minLength(10).maxLength(10).hint("10-digit Contract Number").build()
                ))
                .build(), "HOMECREDIT", "HCIN00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("NAVI00000NAT01")
                .billerName("Navi Finserv Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Navi digital personal loan and home loan monthly EMI payments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan ID / Mobile Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Navi Loan Identifier").build()
                ))
                .build(), "NAVIFINSERV", "NAVIFIN");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("KRAZ00000NAT01")
                .billerName("KreditBee (Krazybee Services Private Limited)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("KreditBee personal loans, self-employed loans, and digital EMI repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan ID").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("KreditBee Loan ID").build()
                ))
                .build(), "KREDITBEE", "KRAZYBEE");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("DMIF00000NAT01")
                .billerName("DMI Finance Private Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("DMI Finance personal loans, Samsung Finance+, and digital consumer finance")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("DMI Loan Account Number").build()
                ))
                .build(), "DMIFINANCE", "DMIF00000NAT02");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("TVSC00000NAT01")
                .billerName("TVS Credit Services Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("TVS Credit two-wheeler, tractor, used car, and consumer durable finance")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Agreement / Loan Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("TVS Credit Loan Number").build()
                ))
                .build(), "TVSCREDIT", "TVSC00000NAT02");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("SUND00000NAT01")
                .billerName("Sundaram Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Sundaram Finance commercial vehicle, car, and equipment loan repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Agreement Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Sundaram Agreement Number").build()
                ))
                .build(), "SUNDARAMFIN", "SFL000000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("KOTA00000NAT01")
                .billerName("Kotak Mahindra Prime / Bank Loans")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Kotak car loans, personal loans, and retail finance EMI repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Kotak Loan Account Number").build()
                ))
                .build(), "KOTAKLOAN", "KOTAKPRIME");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("AXIS00000NAT01")
                .billerName("Axis Bank - Retail Loans")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Axis Bank home loans, auto loans, personal loans, and SME loan repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(8).maxLength(20).hint("Axis Bank Loan Account Number").build()
                ))
                .build(), "AXISLOAN", "AXIS00000RET01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("ICIC00000NAT01")
                .billerName("ICICI Bank - Loans")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("ICICI Bank auto loans, personal loans, home loans, and two-wheeler EMIs")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(8).maxLength(20).hint("ICICI 16-digit Loan Account").build()
                ))
                .build(), "ICICILOAN", "ICICI0000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("SBIN00000NAT01")
                .billerName("State Bank of India (SBI) - Loans")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("SBI personal loans, car loans, home loans, and agricultural loan repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("NUMERIC").optional(false).minLength(11).maxLength(17).hint("SBI Loan Account Number (11-17 digits)").build()
                ))
                .build(), "SBILOAN", "SBI000000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("PUNB00000NAT01")
                .billerName("Punjab National Bank - Loans")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("PNB retail loans, MSME finance, and vehicle loan EMI repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("NUMERIC").optional(false).minLength(14).maxLength(16).hint("PNB 16-digit Loan Account").build()
                ))
                .build(), "PNBLOAN", "PNB000000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("BARB00000NAT01")
                .billerName("Bank of Baroda - Loans")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Bank of Baroda baroda car loans, home loans, and education loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("NUMERIC").optional(false).minLength(14).maxLength(14).hint("14-digit BoB Loan Account").build()
                ))
                .build(), "BOBLOAN", "BOB000000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("CNRB00000NAT01")
                .billerName("Canara Bank - Loans")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Canara Bank housing loans, vehicle loans, and MSME loan installments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("NUMERIC").optional(false).minLength(13).maxLength(14).hint("Canara Bank Loan Account").build()
                ))
                .build(), "CANARALOAN", "CANARA000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("UBIN00000NAT01")
                .billerName("Union Bank of India - Loans")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Union Bank retail and MSME loan installment repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("NUMERIC").optional(false).minLength(15).maxLength(15).hint("15-digit Union Bank Loan Account").build()
                ))
                .build(), "UNIONLOAN", "UBI000000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("INDB00000NAT01")
                .billerName("IndusInd Bank - Consumer Loans")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("IndusInd vehicle loans, personal loans, and consumer finance EMI repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("IndusInd Loan Account Number").build()
                ))
                .build(), "INDUSINDLN", "INDUSIND0NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("RATN00000NAT01")
                .billerName("RBL Bank - Loans")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("RBL Bank personal, business, and micro banking loan installments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(8).maxLength(20).hint("RBL Loan Account Number").build()
                ))
                .build(), "RBLLOAN", "RBL000000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("FDRL00000NAT01")
                .billerName("Federal Bank - Loans")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Federal Bank retail loans, auto loans, and SME finance repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("NUMERIC").optional(false).minLength(14).maxLength(14).hint("Federal Bank Loan Account Number").build()
                ))
                .build(), "FEDERALLOAN", "FED000000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("BDBL00000NAT01")
                .billerName("Bandhan Bank - Micro Banking / Loans")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Bandhan Bank micro banking loans, suchana loans, and srishti loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("NUMERIC").optional(false).minLength(10).maxLength(16).hint("Bandhan Loan Account Number").build()
                ))
                .build(), "BANDHANLOAN", "BANDHAN00NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("UJJV00000NAT01")
                .billerName("Ujjivan Small Finance Bank - Loans")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Ujjivan group loans, individual loans, and micro-mortgage repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("NUMERIC").optional(false).minLength(10).maxLength(16).hint("Ujjivan Loan Account Number").build()
                ))
                .build(), "UJJIVANLOAN", "UJJIVAN00NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("EQUI00000NAT01")
                .billerName("Equitas Small Finance Bank - Loans")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Equitas commercial vehicle loans, MSE loans, and microfinance repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(8).maxLength(20).hint("Equitas Loan Account Number").build()
                ))
                .build(), "EQUITASLOAN", "EQUITAS00NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("AUBF00000NAT01")
                .billerName("AU Small Finance Bank - Loans")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("AU Bank vehicle finance, commercial loans, and MSME installment repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(8).maxLength(20).hint("AU Bank Loan Account Number").build()
                ))
                .build(), "AUBANKLOAN", "AUSFB0000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("ESAF00000NAT01")
                .billerName("ESAF Small Finance Bank - Loans")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("ESAF micro-banking loans, retail loans, and clean energy loan repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(8).maxLength(20).hint("ESAF Loan Account Number").build()
                ))
                .build(), "ESAFLOAN", "ESAF00000NAT02");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("JANA00000NAT01")
                .billerName("Jana Small Finance Bank - Loans")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Jana Bank group loans, agriculture loans, and MSME installment repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(8).maxLength(20).hint("Jana Loan Account Number").build()
                ))
                .build(), "JANALOAN", "JANASFB00NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("UTKA00000NAT01")
                .billerName("Utkarsh Small Finance Bank - Loans")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Utkarsh JLG loans, micro enterprise loans, and personal loan repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("NUMERIC").optional(false).minLength(10).maxLength(16).hint("Utkarsh Loan Account Number").build()
                ))
                .build(), "UTKARSHLOAN", "UTKARSH0NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("FINC00000NAT01")
                .billerName("Fincare Small Finance Bank - Loans")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Fincare microfinance loans, loan against property, and gold loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(8).maxLength(20).hint("Fincare Loan Account Number").build()
                ))
                .build(), "FINCARELOAN", "FINCARE0NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("SURY00000NAT01")
                .billerName("Suryoday Small Finance Bank - Loans")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Suryoday inclusive finance, commercial vehicle loans, and home loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(8).maxLength(20).hint("Suryoday Loan Account Number").build()
                ))
                .build(), "SURYODAYLOAN", "SURYODAY0NAT01");

        // ── HOUSING FINANCE COMPANIES (HFCs) ────────────────────────────────────
        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("LICH00000NAT01")
                .billerName("LIC Housing Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("LIC Housing Finance home loans, plot loans, and home renovation EMIs")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("NUMERIC").optional(false).minLength(10).maxLength(12).hint("LIC HFL Loan Account Number").build()
                ))
                .build(), "LICHFL", "LIC000000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("PNBH00000NAT01")
                .billerName("PNB Housing Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("PNB Housing retail home loans and non-residential property loan repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("PNB Housing Loan Account").build()
                ))
                .build(), "PNBHOUSING", "PNBHFL000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("AADH00000NAT01")
                .billerName("Aadhar Housing Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Aadhar affordable home loans and property improvement financing")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Aadhar Loan Account Number").build()
                ))
                .build(), "AADHARHFL", "AADHARHOUS");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("APTU00000NAT01")
                .billerName("Aptus Value Housing Finance India")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Aptus self-employed home construction and business expansion loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Aptus Loan Account Number").build()
                ))
                .build(), "APTUSFIN", "APTUSHFL");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("CANF00000NAT01")
                .billerName("Can Fin Homes Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Can Fin Homes individual housing loans and composite loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Can Fin Loan Account Number").build()
                ))
                .build(), "CANFINHOMES", "CANFIN");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("HFFC00000NAT01")
                .billerName("Home First Finance Company India")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Home First affordable housing loans and loan against property")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Home First Loan Account").build()
                ))
                .build(), "HOMEFIRST", "HFFCL");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("ISFC00000NAT01")
                .billerName("India Shelter Finance Corporation")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("India Shelter affordable housing and home extension loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("India Shelter Loan Account").build()
                ))
                .build(), "INDIASHELTER", "ISFCL");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("REPC00000NAT01")
                .billerName("Repco Home Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Repco Home individual housing loans and non-housing loan repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Repco Loan Account Number").build()
                ))
                .build(), "REPCOHOME", "RHFL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("SHRF00000NAT01")
                .billerName("Shriram Housing Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Shriram Housing affordable home loan and loan against property repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Shriram Housing Loan ID").build()
                ))
                .build(), "SHRIRAMHOUS", "SHFL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("SUNH00000NAT01")
                .billerName("Sundaram Home Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Sundaram Home housing finance and commercial real estate finance")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Sundaram Home Loan Number").build()
                ))
                .build(), "SUNDARAMHOME", "SHFL");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("TATH00000NAT01")
                .billerName("Tata Capital Housing Finance")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Tata Capital affordable housing and home equity installment repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Tata Capital Housing Loan ID").build()
                ))
                .build(), "TATAHOUSING", "TCHFL0000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("VAST00000NAT01")
                .billerName("Vastu Housing Finance Corporation")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Vastu affordable home construction and micro-housing finance")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Vastu Loan Account Number").build()
                ))
                .build(), "VASTUFIN", "VASTUHFL");

        // ── DIGITAL LENDING, FINTECH & MSME PLATFORMS ───────────────────────────
        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("AYEF00000NAT01")
                .billerName("Aye Finance Private Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Aye Finance MSME working capital and micro enterprise loan repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Aye Finance Loan Account").build()
                ))
                .build(), "AYEFINANCE", "AYEF00000NAT02");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("KINA00000NAT01")
                .billerName("Kinara Capital (Visage Holdings and Finance)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Kinara Capital MSME collateral-free business loans and machinery financing")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Kinara Loan Account Number").build()
                ))
                .build(), "KINARACAPITAL", "VISAGEFIN");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("INCR00000NAT01")
                .billerName("InCred Financial Services Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("InCred personal loans, student education loans, and SME business financing")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("InCred Loan Account Number").build()
                ))
                .build(), "INCREDFIN", "KKR000000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("LEND00000NAT01")
                .billerName("Lendingkart Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Lendingkart working capital loans and MSME business financing repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Application / Loan ID").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Lendingkart Loan / App ID").build()
                ))
                .build(), "LENDINGKART", "LKFL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("NEOG00000NAT01")
                .billerName("NeoGrowth Credit Private Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("NeoGrowth POS-based merchant cash advance and retailer business loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("NeoGrowth Loan Account").build()
                ))
                .build(), "NEOGROWTH", "NCPL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("FEDB00000NAT01")
                .billerName("Fedbank Financial Services Limited (Fedfina)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Fedfina gold loans, loan against property, and business installment repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Fedfina Loan Account Number").build()
                ))
                .build(), "FEDFINA", "FEDBANKFIN");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("CAPR00000NAT01")
                .billerName("Capri Global Capital Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Capri Global MSME loans, construction finance, and affordable housing loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Capri Global Loan Account").build()
                ))
                .build(), "CAPRIGLOBAL", "CGCL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("CLIX00000NAT01")
                .billerName("Clix Capital Services Private Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Clix Capital personal, business, healthcare, and digital consumer finance")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Clix Loan Account Number").build()
                ))
                .build(), "CLIXCAPITAL", "CLIX00000NAT02");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("MASF00000NAT01")
                .billerName("MAS Financial Services Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("MAS Financial micro enterprise, commercial vehicle, and two wheeler loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("MAS Loan Account Number").build()
                ))
                .build(), "MASFINANCIAL", "MFSL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("PAIS00000NAT01")
                .billerName("Paisalo Digital Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Paisalo Digital small business loans and income-generating asset financing")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Paisalo Loan Account Number").build()
                ))
                .build(), "PAISALODIGITAL", "PDL000000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("PROT00000NAT01")
                .billerName("Protium Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Protium business loans, machinery finance, and consumer installment repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Protium Loan Account").build()
                ))
                .build(), "PROTIUMFIN", "GROWTHCON");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("CASH00000NAT01")
                .billerName("CASHe (Bhanix Finance and Investment)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("CASHe salaried instant personal loans, credit lines, and BNPL repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("CASHe Loan ID").build()
                ))
                .build(), "CASHEFIN", "BHANIXFIN");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("FAIR00000NAT01")
                .billerName("Faircent (Fairassets Technologies)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Faircent peer-to-peer personal and business loan EMI payments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Faircent Loan Account").build()
                ))
                .build(), "FAIRCENT", "P2PLOAN");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("FLEX00000NAT01")
                .billerName("FlexiLoans (Epimoney Private Limited)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("FlexiLoans collateral-free MSME loans, vendor finance, and term loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("FlexiLoans Loan Account").build()
                ))
                .build(), "FLEXILOANS", "EPIMONEY");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("MPOK00000NAT01")
                .billerName("mPokket (Maybright Ventures Private Limited)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("mPokket instant pocket money loans for students and salaried professionals")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("mPokket Loan ID").build()
                ))
                .build(), "MPOKKET", "MAYBRIGHT");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("PAYS00000NAT01")
                .billerName("PaySense (PayU Finance India Private Limited)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("PaySense personal loans, vehicle loans, and digital credit lines")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("PaySense Loan ID").build()
                ))
                .build(), "PAYSENSE", "PAYUFINANCE");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("RUPE00000NAT01")
                .billerName("Rupeek Fintech Private Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Rupeek doorstep gold loan monthly interest and principal repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Rupeek Loan ID").build()
                ))
                .build(), "RUPEEKGOLD", "RUPEEK");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("STAS00000NAT01")
                .billerName("Stashfin (Akara Capital Advisors)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Stashfin credit line cards, instant personal loans, and flexi EMIs")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Stashfin Loan Account").build()
                ))
                .build(), "STASHFIN", "AKARACAP");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("RING00000NAT01")
                .billerName("Ring (Kissht / Si Creva Capital Services)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Ring app digital credit limit, store payments, and personal loan repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan / Mobile Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Registered Mobile or Ring ID").build()
                ))
                .build(), "RINGAPP", "SICREVA");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("MWLN00000NAT01")
                .billerName("Money View Loans (Whizdm Innovations)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Money View instant personal loan and credit builder monthly installment repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Money View Loan ID").build()
                ))
                .build(), "MONEYVIEW", "WHIZDM");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("KISS00000NAT01")
                .billerName("Kissht (Onemi Technology Solutions)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Kissht quick loan and digital purchase EMI installments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Kissht Loan Account ID").build()
                ))
                .build(), "KISSHTFIN", "ONEMI0000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("EARL00000NAT01")
                .billerName("Fibe (formerly EarlySalary)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Fibe instant salary advance, personal loans, and credit lines")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Fibe / EarlySalary Loan ID").build()
                ))
                .build(), "FIBEFIN", "EARLYSALARY");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("HDBF00000NAT01")
                .billerName("HDB Financial Services")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("HDB consumer loans, personal loans, business loans, and gold loan repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(8).maxLength(20).hint("HDB Loan Account Number").build()
                ))
                .build(), "HDBFIN", "HDBF00000NAT02");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("AVAN00000NAT01")
                .billerName("Avanse Financial Services")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Avanse education loans and student financing EMI repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Avanse Loan Account Number").build()
                ))
                .build(), "AVANSEFIN", "AVAN00000NAT02");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("FIVE00000NAT01")
                .billerName("Five Star Business Finance")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Five Star small business loans and secured business finance")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Five Star Loan Number").build()
                ))
                .build(), "FIVESTAR", "FSBF00000NAT01");
    }
}
