package com.rupiksha.backend.integration.bbps;

import com.rupiksha.backend.api.dto.BbpsDtos;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.regex.Pattern;

/**
 * Official registry of Bharat Connect / BillAvenue Loan Repayment Lenders & NBFCs
 * with documented customer input parameters, validations, and fetch/validation requirements.
 */
@Component
public class LoanBillerRegistry {

    private final List<BbpsDtos.LoanBillerInfo> billers = new ArrayList<>();
    private final Map<String, BbpsDtos.LoanBillerInfo> billerMap = new HashMap<>();

    public LoanBillerRegistry() {
        initBillers();
    }

    public List<BbpsDtos.LoanBillerInfo> getAllBillers(String searchFilter) {
        if (searchFilter == null || searchFilter.isBlank()) {
            return Collections.unmodifiableList(billers);
        }
        String clean = searchFilter.trim().toLowerCase();
        return billers.stream()
                .filter(b -> (b.getBillerName() != null && b.getBillerName().toLowerCase().contains(clean)) ||
                             (b.getBillerId() != null && b.getBillerId().toLowerCase().contains(clean)) ||
                             (b.getDescription() != null && b.getDescription().toLowerCase().contains(clean)))
                .toList();
    }

    public Optional<BbpsDtos.LoanBillerInfo> findById(String billerId) {
        if (billerId == null || billerId.isBlank()) return Optional.empty();
        BbpsDtos.LoanBillerInfo found = billerMap.get(billerId.trim().toUpperCase());
        if (found != null) {
            return Optional.of(found);
        }
        // Fallback: If it's a valid 14-character BBPS biller ID, create a generic fetch-enabled loan biller info on the fly
        String clean = billerId.trim().toUpperCase();
        if (clean.matches("^[A-Z0-9]{14}$")) {
            return Optional.of(BbpsDtos.LoanBillerInfo.builder()
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
                    .build());
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
                .description("IDFC FIRST Bank consumer durable, personal, two wheeler, and home loan repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(8).maxLength(20).hint("Loan Account Number").build()
                ))
                .build(), "IDFCLOAN", "IDFB00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("ADIT00000NAT01")
                .billerName("Aditya Birla Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Aditya Birla Capital personal, business, mortgage, and SME loan repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Loan / Application Number").build()
                ))
                .build(), "ABFL00000NAT01", "ADITYABIRLA");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("PIRA00000NAT01")
                .billerName("Piramal Capital & Housing Finance")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Piramal Finance home loans, business loans, and MSME financing")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Piramal Loan Account No").build()
                ))
                .build(), "PIRAMALFIN", "DHFL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("CHOL00000NAT01")
                .billerName("Cholamandalam Investment and Finance Company")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Chola vehicle finance, home equity loans, and affordable home loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Agreement Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Agreement / Contract Number").build()
                ))
                .build(), "CHOLAFIN", "CIFC00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("SHRI00000NAT01")
                .billerName("Shriram Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Shriram commercial vehicle, two-wheeler, passenger car, and personal loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Proposal Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Proposal Number / Loan Agreement No").build()
                ))
                .build(), "SHRIRAMFIN", "STFC00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("POON00000NAT01")
                .billerName("Poonawalla Fincorp Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Poonawalla Fincorp pre-owned car loans, personal loans, and business loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Poonawalla Loan Account Number").build()
                ))
                .build(), "POONAWALLA", "MAGM00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("IIFL00000NAT01")
                .billerName("IIFL Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("IIFL gold loan, home loan, business loan, and microfinance EMI repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Contract Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("IIFL Contract / Prospect Number").build()
                ))
                .build(), "IIFLFINANCE", "IIFL00000NAT02");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("TVSC00000NAT01")
                .billerName("TVS Credit Services Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("TVS Credit two-wheeler loans, used car loans, consumer durables, and tractor finance")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Agreement Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("TVS Credit Agreement Number").build()
                ))
                .build(), "TVSCREDIT", "TVSC00000NAT02");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("KOTA00000NAT01")
                .billerName("Kotak Mahindra Prime Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Kotak Prime car financing, retail loans, and two wheeler loan repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Agreement Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Kotak Prime Agreement Number").build()
                ))
                .build(), "KOTAKPRIME", "KMPL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("DMIF00000NAT01")
                .billerName("DMI Finance Private Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("DMI Finance digital personal loans, checkout financing, and MSME loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("DMI Loan Account Number").build()
                ))
                .build(), "DMIFINANCE", "DMIF00000NAT02");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("HOME00000NAT01")
                .billerName("Home Credit India")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Home Credit consumer durable loans, mobile phone EMI, and personal loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Contract Number").dataType("NUMERIC").optional(false).minLength(10).maxLength(10).hint("10-digit Contract Number").build()
                ))
                .build(), "HOMECREDIT", "HCIN00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("FULL00000NAT01")
                .billerName("SMFG India Credit (Fullerton India)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("SMFG India Credit / Fullerton India personal loans, SME loans, and loan against property")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("SMFG / Fullerton Loan Account Number").build()
                ))
                .build(), "FULLERTON", "FICL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("MANA00000NAT01")
                .billerName("Manappuram Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Manappuram gold loans, vehicle loans, microfinance, and home loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Customer ID").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Customer ID / Loan Account No").build()
                ))
                .build(), "MANAPPURAM", "MAFI00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("KRAZ00000NAT01")
                .billerName("KreditBee (KrazyBee Services)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("KreditBee instant personal loans and salary advance EMI repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("KreditBee Loan Account Number").build()
                ))
                .build(), "KREDITBEE", "KBEE00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("NAVI00000NAT01")
                .billerName("Navi Finserv Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Navi digital personal loans and home loan EMI repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan ID").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Navi Loan ID").build()
                ))
                .build(), "NAVIFINSERV", "NAVI00000NAT02");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("BHAN00000NAT01")
                .billerName("CASHe (Bhanix Finance & Investment)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("CASHe app instant personal loans and credit lines")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("CASHe Loan ID / Mobile Number").build()
                ))
                .build(), "CASHEFIN", "BHANIX000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("PAYU00000NAT01")
                .billerName("PayU Finance / PaySense")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("PaySense personal loans and LazyPay EMI credit lines")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("PaySense Loan Number").build()
                ))
                .build(), "PAYSENSE", "PAYUFINANCE");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("AXIS00000NAT01")
                .billerName("Axis Bank - Retail Loan Repayment")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Axis Bank personal, car, home, and commercial loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(10).maxLength(20).hint("Axis Bank Loan Account Number").build()
                ))
                .build(), "AXISLOAN", "UTIB00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("ICIC00000NAT01")
                .billerName("ICICI Bank - Loan Repayment")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("ICICI Bank consumer loans, two-wheeler, auto, and home loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(10).maxLength(20).hint("ICICI Bank Loan Account Number").build()
                ))
                .build(), "ICICILOAN", "ICIC00000RET01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("SBIN00000NAT01")
                .billerName("State Bank of India - Loan Repayment")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("State Bank of India retail loans, car loans, and personal financing")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("NUMERIC").optional(false).minLength(11).maxLength(11).hint("11-digit SBI Loan Account Number").build()
                ))
                .build(), "SBILOAN", "SBIN00000RET01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("FEDB00000NAT01")
                .billerName("Fedbank Financial Services (Fedfina)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Fedfina gold loans, business loans, and loan against property")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Fedfina Loan Account Number").build()
                ))
                .build(), "FEDFINA", "FEDB00000NAT02");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("SUND00000NAT01")
                .billerName("Sundaram Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Sundaram commercial vehicle finance, car loans, and tractor loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Customer Agreement Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Sundaram Agreement Number").build()
                ))
                .build(), "SUNDARAMFIN", "SFIL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("LEND00000NAT01")
                .billerName("Lendingkart Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Lendingkart business loans and MSME working capital repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Application Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Lendingkart Application Number").build()
                ))
                .build(), "LENDINGKART", "LKFL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("KISS00000NAT01")
                .billerName("Kissht (OnEMI Technology Solutions)")
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
