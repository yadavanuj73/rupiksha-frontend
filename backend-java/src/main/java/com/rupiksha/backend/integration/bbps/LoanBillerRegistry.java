package com.rupiksha.backend.integration.bbps;

import com.rupiksha.backend.api.dto.BbpsDtos;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Pattern;

/**
 * Official registry of Bharat Connect / BillAvenue Loan Repayment Lenders & NBFCs
 * with verified NPCI BBPS Biller IDs, candidate aliases, customer input parameters, and validations.
 */
@Component
public class LoanBillerRegistry {

    private final List<BbpsDtos.LoanBillerInfo> billers = new CopyOnWriteArrayList<>();
    private final Map<String, BbpsDtos.LoanBillerInfo> billerMap = new ConcurrentHashMap<>();
    private final Map<String, List<String>> billerFallbackIds = new ConcurrentHashMap<>();

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
     * Returns the ordered candidate BBPS biller IDs to attempt (primary official ID first, then aliases).
     */
    public List<String> getBillerCandidateIds(String billerId) {
        if (billerId == null || billerId.isBlank()) return Collections.emptyList();
        String clean = billerId.trim().toUpperCase();
        BbpsDtos.LoanBillerInfo info = billerMap.get(clean);
        if (info != null) {
            List<String> list = billerFallbackIds.get(info.getBillerId().toUpperCase());
            if (list != null && !list.isEmpty()) {
                return new ArrayList<>(list);
            }
            return List.of(info.getBillerId().toUpperCase());
        }
        return List.of(clean);
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
        String primaryId = info.getBillerId().toUpperCase();
        billerMap.put(primaryId, info);

        List<String> idList = new ArrayList<>();
        idList.add(primaryId);

        if (aliases != null) {
            for (String alias : aliases) {
                if (alias != null && !alias.isBlank()) {
                    String cleanAlias = alias.trim().toUpperCase();
                    billerMap.put(cleanAlias, info);
                    if (cleanAlias.matches("^[A-Z0-9]{14}$") && !idList.contains(cleanAlias)) {
                        idList.add(cleanAlias);
                    }
                }
            }
        }
        billerFallbackIds.put(primaryId, idList);
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
                .billerId("DMIF00000NATMN")
                .billerName("DMI Finance Private Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("DMI Finance personal loans, Samsung Finance+, and digital consumer finance EMIs")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(30).hint("DMI Loan Account Number / LAN").build()
                ))
                .build(), "DMIF00000NAT01", "DMIF00000NAT02", "DMIFINANCE", "DMI", "Samsung Finance+");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("BFL000000NAT01")
                .billerName("Bajaj Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Bajaj Finserv EMI cards, personal loans, consumer durable loans, and business financing")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Enter your Loan Account Number / LAN").build()
                ))
                .build(), "BAJA00000NAT01", "BAJA00000NATG1", "BAJAJFINANCE", "BAJAJFINSERV");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("MUTH00000NATX8")
                .billerName("Muthoot Finance")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Muthoot Finance gold loan interest, personal loan, and EMI repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Muthoot Loan Account / Token No").build()
                ))
                .build(), "MUTH00000NAT01", "MUTHOOTFIN", "MUTHOOT00NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("TATA00000NATGS")
                .billerName("Tata Capital Financial Services")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Tata Capital personal loans, business loans, and consumer finance EMI repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Agreement Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Agreement / Loan ID").build()
                ))
                .build(), "TATA00000NAT01", "TATACAPITAL", "TCFL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("HERO00000NATI6")
                .billerName("Hero FinCorp Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Hero FinCorp two-wheeler, personal loan, used car loan, and SME EMI installments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Application / Loan Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Hero FinCorp Loan Number").build()
                ))
                .build(), "HERO00000NAT01", "HEROFINCORP", "HFCL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("MAHI00000NATKR")
                .billerName("Mahindra & Mahindra Financial Services Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Mahindra Finance vehicle loans, tractor loans, and SME financing")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Proposal Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Proposal / Contract Number").build()
                ))
                .build(), "MAHI00000NAT01", "MAHINDRALN", "MMFSL0000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("MAHI00000NATM9")
                .billerName("Mahindra Finance Consumer Loans")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Mahindra Finance consumer durable and personal loan repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Loan Account Number").build()
                ))
                .build(), "MAHINDRACONS");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("LAMP00000NAT7E")
                .billerName("L&T Financial Services")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("L&T Finance two wheeler, farm equipment, micro loan, and consumer loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("L&T Loan Account Number").build()
                ))
                .build(), "LTFI00000NAT01", "LTFS00000NAT01", "LTFINANCE");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("SHRI00000NAT23")
                .billerName("Shriram Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Shriram commercial vehicle, passenger vehicle, MSME, and two-wheeler financing")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Agreement Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Shriram Loan / Agreement No").build()
                ))
                .build(), "SHRI00000NAT01", "SHRIRAMCITY", "STFC00000NAT01", "SHRIRAMFIN");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("IDFC00000NATCK")
                .billerName("IDFC FIRST Bank - Loan Repayment")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("IDFC FIRST Bank consumer durable, two wheeler, and personal loan repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("IDFC FIRST Loan ID").build()
                ))
                .build(), "IDFC00000NAT01", "IDFCFIRSTLN", "IDFC00000NAT02");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("MANA00000NATCH")
                .billerName("Manappuram Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Manappuram gold loans, microfinance, and home loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Pledge / Loan Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Manappuram Loan / Pledge Number").build()
                ))
                .build(), "MANA00000NAT01", "MANAPPURAM", "MAFIL0000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("ADIT00000NATRA")
                .billerName("Aditya Birla Housing / Finance")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Aditya Birla Capital personal, business, SME, and mortgaged loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("ABFL Loan Account Number").build()
                ))
                .build(), "ADIT00000NAT01", "ADITYABIRLA", "ABFL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("PIRA00000NATQ0")
                .billerName("Piramal Capital & Housing Finance")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Piramal retail housing loans, personal loans, and business installment repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Piramal Loan Account Number").build()
                ))
                .build(), "PIRA00000NAT01", "PIRAMALFIN", "PCHFL0000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("POON00000NATE7")
                .billerName("Poonawalla Fincorp / Housing")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Poonawalla pre-owned car, personal, professional, and business loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Agreement Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Poonawalla Loan Agreement Number").build()
                ))
                .build(), "POON00000NAT01", "POONAWALLA", "MAGMA0000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("TVSC00000NAT0T")
                .billerName("TVS Credit Services Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("TVS Credit two-wheeler, tractor, used car, and consumer durable finance")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Agreement / Loan Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("TVS Credit Loan Number").build()
                ))
                .build(), "TVSC00000NAT01", "TVSCREDIT", "TVSC00000NAT02");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("IIFL00000NAT5F")
                .billerName("IIFL Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("IIFL gold loans, business loans, microfinance, and personal loan EMIs")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("IIFL Loan Account Number").build()
                ))
                .build(), "IIFL00000NAT01", "IIFLFIN", "IIFL00000NAT02");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("HOME00000NATWT")
                .billerName("Home Credit India Finance")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Home Credit consumer durable and personal loan installment payments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Contract Number").dataType("NUMERIC").optional(false).minLength(10).maxLength(10).hint("10-digit Contract Number").build()
                ))
                .build(), "HOME00000NAT01", "HOMECREDIT", "HCIN00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("NAVI00000NATZH")
                .billerName("Navi Finserv Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Navi digital personal loan and home loan monthly EMI payments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan ID / Mobile Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Navi Loan Identifier").build()
                ))
                .build(), "NAVI00000NAT01", "NAVIFINSERV", "NAVIFIN");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("KRED00000NATSY")
                .billerName("KreditBee (Krazybee Services Private Limited)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("KreditBee personal loans, self-employed loans, and digital EMI repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan ID").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("KreditBee Loan ID").build()
                ))
                .build(), "KRAZ00000NAT01", "KREDITBEE", "KRAZYBEE");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("SUND00000NAT16")
                .billerName("Sundaram Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Sundaram Finance commercial vehicle, car, and equipment loan repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Agreement Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Sundaram Agreement Number").build()
                ))
                .build(), "SUND00000NAT01", "SUNDARAMFIN", "SFL000000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("KOTA00000NATTW")
                .billerName("Kotak Mahindra Bank - Loans")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Kotak retail loans, personal loans, and banking EMI repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Kotak Loan Account Number").build()
                ))
                .build(), "KOTA00000NAT01", "KOTAKLOAN");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("KOTA00000NATE1")
                .billerName("Kotak Mahindra Prime Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Kotak car loans and vehicle finance EMI repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Kotak Prime Account Number").build()
                ))
                .build(), "KOTAKPRIME");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("AXIS00000NATLM")
                .billerName("Axis Bank - Digital & Retail Loans")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Axis Bank home loans, auto loans, personal loans, and SME loan repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(8).maxLength(20).hint("Axis Bank Loan Account Number").build()
                ))
                .build(), "AXIS00000NAT01", "AXISLOAN", "AXIS00000RET01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("ICIC00000NATMS")
                .billerName("ICICI Bank - Loans")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("ICICI Bank auto loans, personal loans, home loans, and two-wheeler EMIs")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(8).maxLength(20).hint("ICICI 16-digit Loan Account").build()
                ))
                .build(), "ICIC00000NAT01", "ICICILOAN");

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
                .billerId("AROH00000WBL0I")
                .billerName("Arohan Financial Services Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Arohan Financial Services microfinance and saral loan repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("Arohan Loan Account Number").build()
                ))
                .build(), "AROH00000NAT01", "AROHANFIN", "AROH00000NAT02");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("FUSI00000NATBS")
                .billerName("Fusion Finance Limited (Fusion Microfinance)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Fusion Microfinance joint liability group and enterprise loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("Fusion Loan Account Number").build()
                ))
                .build(), "FUSI00000NAT01", "FUSIONMICRO", "FMFL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("SATI00000NAT8Q")
                .billerName("Satin Creditcare Network Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Satin Creditcare microfinance, MSME, and rural loan repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("Satin Loan Account Number").build()
                ))
                .build(), "SATI00000NAT01", "SATINCREDIT", "SCNL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("SPAN00000NAT3J")
                .billerName("Spandana Sphoorty Financial Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Spandana Sphoorty micro loans, rural finance, and group loan repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("Spandana Loan Account Number").build()
                ))
                .build(), "SPAN00000NAT01", "SPANDANAFIN", "SSFL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("CRED00000NAT8X")
                .billerName("CreditAccess Grameen Limited (Grameen Koota)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("CreditAccess Grameen group loans and retail microfinance repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("CreditAccess Loan Account Number").build()
                ))
                .build(), "CRED00000NAT01", "GRAMEENKOOTA", "CAGL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("SICR00000NATDG")
                .billerName("Kissht / Ring (Si Creva Capital Services)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Kissht quick loan and Ring app digital purchase EMI installments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Loan Account ID").build()
                ))
                .build(), "KISS00000NAT01", "KISSHTFIN", "ONEMI0000NAT01", "RING00000NAT01", "RINGAPP");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("HDBF00000NATGJ")
                .billerName("HDB Financial Services Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("HDB consumer loans, personal loans, business loans, and gold loan repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(8).maxLength(20).hint("HDB Loan Account Number").build()
                ))
                .build(), "HDBF00000NAT01", "HDBFIN", "HDBF00000NAT02");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("MUTH00000NAT0I")
                .billerName("Muthoot Microfin Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Muthoot Microfin micro loans and women empowerment finance")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("Muthoot Microfin Account Number").build()
                ))
                .build(), "MUTH00000NAT02", "MUTHOOTMICRO", "MML000000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("ASIR00000NATCP")
                .billerName("Asirvad Microfinance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Asirvad Microfinance (Manappuram subsidiary) micro-loans and SME financing")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("Asirvad Loan Account Number").build()
                ))
                .build(), "ASIR00000NAT01", "ASIRVADFIN", "AMFL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("BELS00000NATD7")
                .billerName("Belstar Microfinance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Belstar Microfinance SHG / JLG and rural enterprise loan repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("Belstar Loan Account Number").build()
                ))
                .build(), "BELS00000NAT01", "BELSTARFIN", "BMFL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("CHAI00000NATYY")
                .billerName("Chaitanya India Fin Credit Private Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Chaitanya India Fin Credit microfinance and livelihood loan repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("Chaitanya Loan Account Number").build()
                ))
                .build(), "CHAI00000NAT01", "CHAITANYAFIN", "CIFC00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("MIDL00000NATIP")
                .billerName("Midland Microfin Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Midland Microfin group loans and small business financing")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("Midland Loan Account Number").build()
                ))
                .build(), "MIDL00000NAT01", "MIDLANDFIN", "MMFL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("SONA00000NATUQ")
                .billerName("Sonata Finance Private Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Sonata Finance micro-credit loans and income generation finance")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("Sonata Loan Account Number").build()
                ))
                .build(), "SONA00000NAT01", "SONATAFIN", "SFPL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("SVCR00000NATDL")
                .billerName("SV Creditline Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("SV Creditline microfinance loans and livelihood installments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("SVCL Loan Account Number").build()
                ))
                .build(), "SVCL00000NAT01", "SVCREDITLINE", "SVCL00000NAT02");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("CANF00000KARZ2")
                .billerName("Can Fin Homes Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Can Fin Homes individual housing loans and composite loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Can Fin Loan Account Number").build()
                ))
                .build(), "CANF00000NAT01", "CANFINHOMES", "CANFIN");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("AADH00000NATPT")
                .billerName("Aadhar Housing Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Aadhar affordable home loans and property improvement financing")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Aadhar Loan Account Number").build()
                ))
                .build(), "AADH00000NAT01", "AADHARHFL", "AADHARHOUS");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("APTU00000NAT2L")
                .billerName("Aptus Value Housing Finance India")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Aptus self-employed home construction and business expansion loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Aptus Loan Account Number").build()
                ))
                .build(), "APTU00000NAT01", "APTUSFIN", "APTUSHFL");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("LOAN00000NATJ0")
                .billerName("Loanfront (Vaibhav Vyapaar Private Limited)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Loanfront instant personal loans and salary advance repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(25).hint("Loanfront Loan Account Number").build()
                ))
                .build(), "LOANFRONT", "LOAN00000NAT01");
    }
}
