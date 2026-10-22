package com.rupiksha.backend.integration.bbps;

import com.rupiksha.backend.api.dto.BbpsDtos;
import com.rupiksha.backend.integration.bbps.dto.BillAvenueDtos;
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

    public void updateFromMdm(String billerId, BillAvenueDtos.BillerInfoResponse mdm) {
        if (mdm == null || !mdm.isSuccess() || mdm.getInputParams() == null || mdm.getInputParams().isEmpty()) {
            return;
        }
        Optional<BbpsDtos.LoanBillerInfo> opt = findById(billerId);
        if (opt.isPresent()) {
            BbpsDtos.LoanBillerInfo existing = opt.get();
            List<BbpsDtos.InputParamInfo> newParams = new ArrayList<>();
            for (BillAvenueDtos.BillerParamInfo p : mdm.getInputParams()) {
                newParams.add(BbpsDtos.InputParamInfo.builder()
                        .paramName(p.getParamName())
                        .dataType(p.getDataType() != null ? p.getDataType() : "ALPHANUMERIC")
                        .optional(p.isOptional())
                        .minLength(p.getMinLength())
                        .maxLength(p.getMaxLength())
                        .regEx(p.getRegEx())
                        .hint(p.getParamName())
                        .build());
            }
            existing.setInputParams(newParams);
            if (mdm.getBillerFetchRequirement() != null && !mdm.getBillerFetchRequirement().isBlank()) {
                existing.setBillerFetchRequirement(mdm.getBillerFetchRequirement());
            }
            if ("true".equalsIgnoreCase(mdm.getBillerAdhoc())) {
                existing.setBillerAdhoc(true);
            }
        }
    }

    public void updateWorkingInputParams(String billerId, List<BillAvenueDtos.InputParam> workingInputs) {
        if (workingInputs == null || workingInputs.isEmpty()) return;
        Optional<BbpsDtos.LoanBillerInfo> opt = findById(billerId);
        if (opt.isPresent()) {
            BbpsDtos.LoanBillerInfo existing = opt.get();
            List<BbpsDtos.InputParamInfo> newParams = new ArrayList<>();
            for (BillAvenueDtos.InputParam p : workingInputs) {
                newParams.add(BbpsDtos.InputParamInfo.builder()
                        .paramName(p.getParamName())
                        .dataType(p.getParamName().toLowerCase().contains("mobile") ? "NUMERIC" : "ALPHANUMERIC")
                        .optional(false)
                        .minLength(p.getParamValue() != null ? Math.min(4, p.getParamValue().length()) : 4)
                        .maxLength(30)
                        .hint(p.getParamName())
                        .build());
            }
            existing.setInputParams(newParams);
        }
    }

    public boolean isLoanAccountIdentifier(String key) {
        if (key == null) return false;
        String k = key.toLowerCase();
        return k.contains("loan") || k.contains("lan") || k.contains("account") ||
               k.contains("contract") || k.contains("agreement") || k.contains("proposal") ||
               k.contains("application") || k.contains("id");
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

            // Synonym fallback: map Loan Account Number <-> Loan ID <-> LAN
            if ((value == null || value.isBlank()) && isLoanAccountIdentifier(expected.getParamName())) {
                String candidate = extractPrimaryLoanAccountNumber(customerParams);
                if (!"UNKNOWN".equalsIgnoreCase(candidate) && !candidate.isBlank()) {
                    value = candidate;
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


    private void registerLiveBillAvenueBiller(String billerId, String billerName, String... aliases) {
        String cleanId = billerId.trim().toUpperCase();
        if (billerMap.containsKey(cleanId)) {
            BbpsDtos.LoanBillerInfo existing = billerMap.get(cleanId);
            if (existing != null) {
                existing.setBillerName(billerName);
                if (aliases != null) {
                    for (String alias : aliases) {
                        if (alias != null && !alias.isBlank()) {
                            billerMap.put(alias.trim().toUpperCase(), existing);
                        }
                    }
                }
            }
            return;
        }

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId(cleanId)
                .billerName(billerName)
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .billerAdhoc(true)
                .supportBillValidation("OPTIONAL")
                .description(billerName + " loan EMI repayment via Bharat Connect")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder()
                                .paramName("Loan Account Number")
                                .dataType("ALPHANUMERIC")
                                .optional(false)
                                .minLength(4)
                                .maxLength(30)
                                .hint(billerName + " Loan Account Number / LAN")
                                .build()
                ))
                .build(), aliases);
    }

        private void initOfficialBillAvenueBillers() {
        registerLiveBillAvenueBiller("121F00000NAT4D", "121 Finance Private Limited");
        registerLiveBillAvenueBiller("AADH00000NATPT", "Aadhar Housing Finance Limited");
        registerLiveBillAvenueBiller("AAVA00000NATMF", "AAVAS FINANCIERS LIMITED");
        registerLiveBillAvenueBiller("ABHI00025NATED", "Abhiyan Capital (India) Private Limited");
        registerLiveBillAvenueBiller("ACEN00016MUMHU", "AceN Navadhan");
        registerLiveBillAvenueBiller("ACGL00000NATK9", "ACG Leasing Ltd");
        registerLiveBillAvenueBiller("ACHI00000NATZZ", "Achiievers Finance Personal Loan");
        registerLiveBillAvenueBiller("ADAN00000NATI9", "Tyger Home Finance Private Limited");
        registerLiveBillAvenueBiller("ADAN00000NATO6", "Tyger Capital Private Limited");
        registerLiveBillAvenueBiller("ADIC00021NATZS", "Adi Chitragupta Finance Limited");
        registerLiveBillAvenueBiller("ADIT00000NATRA", "Aditya Birla Housing Finance Limited");
        registerLiveBillAvenueBiller("ADIT00000NATZ1", "Aditya Birla Capital Limited");
        registerLiveBillAvenueBiller("AGOR00000NATQL", "Agora Microfinance India Ltd - AMIL");
        registerLiveBillAvenueBiller("AGRI00000NAT0B", "Agriwise Finserv Limited");
        registerLiveBillAvenueBiller("AKME00025NATN0", "Akme Fintrade (India) Ltd");
        registerLiveBillAvenueBiller("ALTU00000NATG5", "Altum Credo Home Finance");
        registerLiveBillAvenueBiller("AMAR00000RAJI3", "Amarpadma Credits Pvt Ltd");
        registerLiveBillAvenueBiller("AMBI00000NAT2A", "Ambit Finvest Pvt Ltd");
        registerLiveBillAvenueBiller("AMRI00000NATN1", "Amrit Malwa Capital Limited");
        registerLiveBillAvenueBiller("AMUL00000NATJG", "AMU Leasing Pvt Ltd");
        registerLiveBillAvenueBiller("ANAN00022NATQR", "Ananya Finance For Inclusive Growth Private Limited");
        registerLiveBillAvenueBiller("ANKU00000NAT9K", "Ankur Trade Links Pvt Ltd");
        registerLiveBillAvenueBiller("ANNA00000NATMR", "Annapurna Finance Private Limited-MSME");
        registerLiveBillAvenueBiller("ANNA00000NATUO", "Annapurna Finance Private Limited-MFI");
        registerLiveBillAvenueBiller("ANNA00012NAT74", "Annapurna Finance Private Limited - Gold Loan");
        registerLiveBillAvenueBiller("ANSC00000NATB9", "Anscor Capital And Investment Pvt Ltd");
        registerLiveBillAvenueBiller("APAC00000NAT8Q", "APAC Financial Services Pvt Ltd");
        registerLiveBillAvenueBiller("APTU00000NAT2L", "Aptus Value Housing Finance India Limited");
        registerLiveBillAvenueBiller("APTU00000NATP0", "Aptus Finance India Private Limited");
        registerLiveBillAvenueBiller("ARIS00000NATQT", "Revfin Capital");
        registerLiveBillAvenueBiller("ARIS00000WBLB0", "Aris Capital Pvt Limited");
        registerLiveBillAvenueBiller("ARMA00000NATO0", "Arman Financial Services Limited");
        registerLiveBillAvenueBiller("AROH00000WBL0I", "Arohan Financial Services Ltd");
        registerLiveBillAvenueBiller("ARRI00016NAT6P", "Arriba Inclusive Finance Private Limited");
        registerLiveBillAvenueBiller("ARTH00000NAT4D", "ART Housing Finance (India) Limited");
        registerLiveBillAvenueBiller("ARTH00000NATMB", "Arthmate Financing India Private Limited");
        registerLiveBillAvenueBiller("ARTH00000NATMD", "ARTH");
        registerLiveBillAvenueBiller("ARTH00000NATO4", "Arthan Finance Pvt Ltd");
        registerLiveBillAvenueBiller("ASAI00000WBL1A", "ASA International India Microfinance Limited");
        registerLiveBillAvenueBiller("ASCE00000NATGK", "Ascend Capital");
        registerLiveBillAvenueBiller("ASHV00000NATBQ", "Ashv Finance");
        registerLiveBillAvenueBiller("ASIR00000NATCP", "Asirvad Micro Finance Ltd");
        registerLiveBillAvenueBiller("ASSA00025ASMMK", "Assam Gramin Bank");
        registerLiveBillAvenueBiller("AUBA00000NATGM", "AU Bank Loan Repayment");
        registerLiveBillAvenueBiller("AUSM00020NATYQ", "AU SMARTLoan");
        registerLiveBillAvenueBiller("AUXI00000NATKM", "Auxilo Finserve Private Limited");
        registerLiveBillAvenueBiller("AVAN00000NATHI", "Avanse Financial Services Ltd");
        registerLiveBillAvenueBiller("AVAN00000NATJA", "Avanti Finance Private Limited");
        registerLiveBillAvenueBiller("AXIS00000NATJD", "Axis Bank Limited-Microfinance");
        registerLiveBillAvenueBiller("AXIS00000NATLM", "Axis Bank Limited-Digital Loan");
        registerLiveBillAvenueBiller("AXIS00000NATM1", "Axis Bank Limited - Retail Loan");
        registerLiveBillAvenueBiller("AXIS00000NATML", "Axis Bank Ltd - MCA");
        registerLiveBillAvenueBiller("AXIS00000NATN6", "Axis Finance Limited");
        registerLiveBillAvenueBiller("AYAA00000NAT5Y", "Ayaan Finserve India Private LTD");
        registerLiveBillAvenueBiller("AYEF00000NATZB", "Aye Finance Pvt. Ltd.");
        registerLiveBillAvenueBiller("BABA00000MAHWV", "Babasaheb Deshmukh Sahakari Bank Limited Atpadi");
        registerLiveBillAvenueBiller("BAID00000NATWG", "Baid Finserv Limited");
        registerLiveBillAvenueBiller("BAJA00000NATDK", "Bajaj Housing Finance Limited");
        registerLiveBillAvenueBiller("BAJA00000NATSG", "Bajaj Auto Credit Limited");
        registerLiveBillAvenueBiller("BAND00000NAT8K", "Bandhan Bank Loan");
        registerLiveBillAvenueBiller("BAZA00000JODNI", "Bazaari Finance");
        registerLiveBillAvenueBiller("BEHA00024NAT01", "Behariji Dealers Pvt Ltd");
        registerLiveBillAvenueBiller("BELS00000NATD7", "Belstar Microfinance Limited");
        registerLiveBillAvenueBiller("BELS00023NATSL", "Belstar Microfinance Limited Gold Loan");
        registerLiveBillAvenueBiller("BERA00000NATOY", "BERAR Finance Limited");
        registerLiveBillAvenueBiller("BERY00000NATDV", "Beryl Securities");
        registerLiveBillAvenueBiller("BEST00000NATUU", "Best Capital Services Ltd");
        registerLiveBillAvenueBiller("BFL000000NAT01", "Bajaj Finance");
        registerLiveBillAvenueBiller("BHAL00000NATL7", "Bhala Finance Private Limited");
        registerLiveBillAvenueBiller("BHAR00000NAT52", "Bharat Financial Inclusion Ltd");
        registerLiveBillAvenueBiller("BIHA00014BIHXO", "Bihar Gramin Bank");
        registerLiveBillAvenueBiller("BIZL00000NATTU", "Bizloan Private Limited");
        registerLiveBillAvenueBiller("BLAC00000NATEK", "Blackbuck Finserve");
        registerLiveBillAvenueBiller("BSSM00000NATP7", "BSS Microfinance Limited");
        registerLiveBillAvenueBiller("BUSI00014NATZQ", "Business Nextgen Finance Private Limited");
        registerLiveBillAvenueBiller("BUSS00000NATP9", "Fexprime Finance (P) Ltd (Formerly Bussan Auto Finance)");
        registerLiveBillAvenueBiller("BWDA00000TNDSV", "BWDA Finance Ltd");
        registerLiveBillAvenueBiller("CAMD00000NATAI", "ZestMoney");
        registerLiveBillAvenueBiller("CANA00000NATQD", "Canara Bank - Retail Loan");
        registerLiveBillAvenueBiller("CANF00000KARZ2", "Can Fin Homes Ltd");
        registerLiveBillAvenueBiller("CAPI00000NAT64", "Capital Trust Limited");
        registerLiveBillAvenueBiller("CAPI00000NAT7C", "Capital India Home Loans Limited");
        registerLiveBillAvenueBiller("CAPI00000NATHM", "Capital India Finance Limited");
        registerLiveBillAvenueBiller("CAPR00000NATC0", "Capri global Capital Limited (Gold Loan)");
        registerLiveBillAvenueBiller("CAPR00000NATI7", "Capri Global Capital Limited (MSME Loan)");
        registerLiveBillAvenueBiller("CAPR00000NATUB", "Capri Global Housing Finance");
        registerLiveBillAvenueBiller("CAPR00012NATAQ", "Capri Global Capital Limited (Solar Loan)");
        registerLiveBillAvenueBiller("CARS00000NAT4G", "Cars24 Financial Services Private Limited");
        registerLiveBillAvenueBiller("CASH00000NAT0Z", "CASHe");
        registerLiveBillAvenueBiller("CASH00000NATL1", "Cashtree Finance");
        registerLiveBillAvenueBiller("CDLF00000NATZU", "CDL Financial Services Private Limited");
        registerLiveBillAvenueBiller("CEEJ00010NATB2", "Ceejay Microfin Limited");
        registerLiveBillAvenueBiller("CEEJ00013NATPJ", "Ceejay Finance Limited");
        registerLiveBillAvenueBiller("CHAI00000NATHF", "Chaitanya Godavari Grameena Bank");
        registerLiveBillAvenueBiller("CHAI00000NATYY", "Chaitanya India Fin Credit Pvt Ltd");
        registerLiveBillAvenueBiller("CHOI00000NAT0E", "Choice Finserv Pvt Ltd");
        registerLiveBillAvenueBiller("CHOL00000NATSS", "Cholamandalam Investment and Finance Company Limited");
        registerLiveBillAvenueBiller("CLIX00000NATST", "Clix");
        registerLiveBillAvenueBiller("CNHI00000NATNZ", "CNH Industrial Capital Pvt. Ltd.");
        registerLiveBillAvenueBiller("COME00015NAT7H", "Comero Leasing And Financials Private Limited");
        registerLiveBillAvenueBiller("CRED00000NAT0U", "Credit Wise Capital");
        registerLiveBillAvenueBiller("CRED00000NAT35", "CreditAccess Grameen - Retail Finance");
        registerLiveBillAvenueBiller("CRED00000NAT4N", "Credit Saison");
        registerLiveBillAvenueBiller("CRED00000NAT8X", "Grameen Koota Microfinance (CreditAccess Grameen Ltd)");
        registerLiveBillAvenueBiller("CRED00029NATRB", "Credila Financial Services");
        registerLiveBillAvenueBiller("CRIS00000NATYE", "Criss Financial Limited");
        registerLiveBillAvenueBiller("CSLF00000DEL2O", "CSL Finance");
        registerLiveBillAvenueBiller("DADH00000RAJ00", "Dadhich Finserv PVt Ltd");
        registerLiveBillAvenueBiller("DCBB00000NAT2K", "DCB Bank Loan Repayment");
        registerLiveBillAvenueBiller("DECC00000NATT2", "Deccan Finance Limited");
        registerLiveBillAvenueBiller("DELC00000NATJ7", "Del Capital Private Limited");
        registerLiveBillAvenueBiller("DEVF00000NAT0V", "Dev Finance");
        registerLiveBillAvenueBiller("DHAN00000MAPIE", "Dhanmax Finance Private Limited");
        registerLiveBillAvenueBiller("DHAR00000NATNA", "Dhara Motor Finance Ltd");
        registerLiveBillAvenueBiller("DIGA00000NAT3C", "Digamber Capfin Limited");
        registerLiveBillAvenueBiller("DIWA00000NATG5", "Diwakar Tracom Private Limited");
        registerLiveBillAvenueBiller("DMIF00000NATMN", "DMI Finance Private Limited");
        registerLiveBillAvenueBiller("DMIH00000NAT8K", "DMI Housing Finance Pvt. Ltd.");
        registerLiveBillAvenueBiller("DVAR00000NAT2B", "Dvara Kshetriya Gramin Financials Services Private Limited");
        registerLiveBillAvenueBiller("EASY00000MAH6N", "Easy Home Finance Limited");
        registerLiveBillAvenueBiller("EDCL00000NATWS", "EDC Limited");
        registerLiveBillAvenueBiller("EDUV00000NATF1", "Eduvanz Financing Pvt. Ltd.");
        registerLiveBillAvenueBiller("EKAG00000NATI8", "MyShubhLife");
        registerLiveBillAvenueBiller("ELEC00000NATE6", "Electronica Finance Limited");
        registerLiveBillAvenueBiller("EMER00000NAT1T", "Emerald Finance");
        registerLiveBillAvenueBiller("EPIM00000MAHJM", "Epimoney Private Limited");
        registerLiveBillAvenueBiller("EQUI00000NATJH", "Equitas SFB - Microfinance Loan");
        registerLiveBillAvenueBiller("EQUI00000NATQ4", "Equitas Small Finance Bank - Retail Loan");
        registerLiveBillAvenueBiller("ESAF00000NAT5J", "ESAF Small Finance Bank (Micro Loans)");
        registerLiveBillAvenueBiller("ESAF00000NATAQ", "ESAF Small Finance Bank (Retails Loans)");
        registerLiveBillAvenueBiller("ESSK00000NATFR", "SK Finance Ltd.");
        registerLiveBillAvenueBiller("EXCL00028NATNZ", "Exclusive Leasing And Finance Private Limited");
        registerLiveBillAvenueBiller("FAIR00000NAT6Z", "Faircent-Borrower EMI Account");
        registerLiveBillAvenueBiller("FAST00000NAT51", "ITI Housing Finance Limited");
        registerLiveBillAvenueBiller("FEDB00000NATT0", "Fedbank Financial Services Limited");
        registerLiveBillAvenueBiller("FEDE00000NATCY", "Federal Bank Loan Repayment");
        registerLiveBillAvenueBiller("FEEM00000NATZU", "Feemonk");
        registerLiveBillAvenueBiller("FINC00000NATVW", "Fin Coopers Capital Private Limited");
        registerLiveBillAvenueBiller("FINN00000NAT1T", "Finnable");
        registerLiveBillAvenueBiller("FINO00000NATVP", "Finova Capital Private Ltd");
        registerLiveBillAvenueBiller("FIVE00000NAT88", "Five Star Business Finance");
        registerLiveBillAvenueBiller("FLEX00000NAT3Z", "FlexiLoans");
        registerLiveBillAvenueBiller("FLEX00000NATJL", "Flexsalary");
        registerLiveBillAvenueBiller("FLIP00022NATLP", "Flipkart Finance Private Limited");
        registerLiveBillAvenueBiller("FORT00000NATO6", "ITI Credit Limited Erstwhile Fortune Credit Capital Limited");
        registerLiveBillAvenueBiller("FORT00000NATR8", "ITI Finance Limited");
        registerLiveBillAvenueBiller("FULL00000NAT8X", "SMFG India Home Finance Company Limited");
        registerLiveBillAvenueBiller("FULL00000NATD4", "SMFG India Credit Company Limited");
        registerLiveBillAvenueBiller("FUSI00000DEL5E", "Fusion Finance Ltd-MSME");
        registerLiveBillAvenueBiller("FUSI00000NATBS", "Fusion Finance Ltd MFI");
        registerLiveBillAvenueBiller("GAJA00010NATL1", "Gajara Micro Finance Private Limited");
        registerLiveBillAvenueBiller("GEVF00011NATTL", "GEV Focus Capital Private Limited");
        registerLiveBillAvenueBiller("GOLD00000NATIV", "Goldline Finance Private Limited (Capital Now)");
        registerLiveBillAvenueBiller("GROW00000NATN2", "GrowXCD Finance Private Limited");
        registerLiveBillAvenueBiller("GUFI00000NATV8", "G U Financial Services Pvt Ltd");
        registerLiveBillAvenueBiller("HDBF00000NATGJ", "HDB Financial Services Limited");
        registerLiveBillAvenueBiller("HDFC00000NATM1", "HDFC Bank Retail Assets");
        registerLiveBillAvenueBiller("HEDG00000NAT8I", "Hedge Finance Ltd");
        registerLiveBillAvenueBiller("HERO00000NATI6", "Hero FinCorp Limited");
        registerLiveBillAvenueBiller("HERO00000NATKS", "Hero Housing Finance Ltd");
        registerLiveBillAvenueBiller("HIMA00019HIPTX", "Himachal Pradesh Gramin Bank");
        registerLiveBillAvenueBiller("HIND00000NAT1Y", "Hinduja Housing Finance Limited");
        registerLiveBillAvenueBiller("HIND00000NATPC", "Hindon Mercantile Limited - Mufin");
        registerLiveBillAvenueBiller("HIND00000NATYQ", "Hinduja Leyland Finance");
        registerLiveBillAvenueBiller("HIND00012NATIV", "Hinduja Leyland Finance - Loan Against Property");
        registerLiveBillAvenueBiller("HIRA00000NATSP", "Hiranandani Financial Services Pvt  Ltd");
        registerLiveBillAvenueBiller("HMTF00000RAJBN", "HMT Finance Pvt Ltd");
        registerLiveBillAvenueBiller("HOME00000NATVX", "Home First Finance Company India Limited");
        registerLiveBillAvenueBiller("HOME00000NATWT", "Home Credit India Finance Pvt. Ltd");
        registerLiveBillAvenueBiller("HUMA00012NATR0", "Humana Financial Services Pvt Ltd");
        registerLiveBillAvenueBiller("I2IF00000NAT6K", "i2i Funding-Borrower EMI Repayment");
        registerLiveBillAvenueBiller("ICIC00000NATKD", "ICICI Bank Ltd - Loans");
        registerLiveBillAvenueBiller("ICIC00000NATMS", "ICICI BANK - Interest Repayment Loans");
        registerLiveBillAvenueBiller("ICIC00025NATHD", "ICICI Home Finance");
        registerLiveBillAvenueBiller("IDFC00000NATCK", "IDFC FIRST Bank Ltd");
        registerLiveBillAvenueBiller("IDFF00000NAT1B", "IDF Financial Services Private Limited");
        registerLiveBillAvenueBiller("IFFC00000NATJQ", "IFFCO Kisan Finance Limited");
        registerLiveBillAvenueBiller("IFLH00000NAT9E", "IFL Housing Finance Ltd Home Loan");
        registerLiveBillAvenueBiller("IFLH00000NATW9", "IFL Finance Ltd Gold Loan");
        registerLiveBillAvenueBiller("IIFL00000NAT5F", "IIFL Finance Limited");
        registerLiveBillAvenueBiller("IIFL00000NATD9", "IIFL Samasta Finance Ltd - Retail Loans");
        registerLiveBillAvenueBiller("IIFL00000NATMF", "IIFL Home Finance");
        registerLiveBillAvenueBiller("IKFF00000NATGC", "IKF Finance Ltd");
        registerLiveBillAvenueBiller("INCR00000NATJG", "InCred");
        registerLiveBillAvenueBiller("INDE00000NAT8G", "Indel Money Limited");
        registerLiveBillAvenueBiller("INDI00000MAHN7", "Inditrade Microfinance Limited");
        registerLiveBillAvenueBiller("INDI00000NAT12", "India Shelter Finance Corporation Limited");
        registerLiveBillAvenueBiller("INDI00000NATES", "Indian Bank Loan EMI");
        registerLiveBillAvenueBiller("INDI00000NATQF", "India Home Loan Limited");
        registerLiveBillAvenueBiller("INDI00000NATYG", "Sammaan Capital Limited");
        registerLiveBillAvenueBiller("INDI00000NATZE", "Indiabulls Commercial Credit Ltd");
        registerLiveBillAvenueBiller("INDI00018NATQQ", "Indian Overseas Bank - Loan Repayment");
        registerLiveBillAvenueBiller("INDI00025NATW8", "Indi Rupee");
        registerLiveBillAvenueBiller("INDO00000NATCP", "Niwas Housing Finance Pvt Ltd");
        registerLiveBillAvenueBiller("INDO00000NATGP", "Indostar Capital Finance Limited - CV");
        registerLiveBillAvenueBiller("INDO00000NATO3", "Indostar Capital Finance Limited - SME");
        registerLiveBillAvenueBiller("INDU00000NATQH", "INDUSIND BANK - CFD");
        registerLiveBillAvenueBiller("INFI00000NATY9", "Infinity Fincorp Solutions Pvt Ltd");
        registerLiveBillAvenueBiller("INPR00013NAT33", "InPrime Finserv");
        registerLiveBillAvenueBiller("IREP00000NAT4N", "Viksit Capital Private Ltd");
        registerLiveBillAvenueBiller("ITIG00000MAHID", "ITI Gold");
        registerLiveBillAvenueBiller("JADS00016NAT4K", "JADS Services Pvt Ltd (Kredit Venture)");
        registerLiveBillAvenueBiller("JAGA00023NATKQ", "Jagaran Microfin Pvt Ltd");
        registerLiveBillAvenueBiller("JAIN00000NATOA", "Jain Motor Finmart");
        registerLiveBillAvenueBiller("JAIN00000NATVC", "Jain Autofin");
        registerLiveBillAvenueBiller("JAMN00028CHH8Q", "Jamnalal Parekh Finance Private Limited");
        registerLiveBillAvenueBiller("JANA00000NAT6J", "Janasha Finance");
        registerLiveBillAvenueBiller("JANA00000NATO4", "Jana Small Finance Bank");
        registerLiveBillAvenueBiller("JANA00000NATV5", "Janakalyan Financial Services Private Limited");
        registerLiveBillAvenueBiller("JASS00000NATBK", "Jassi Hire Purchase Limited");
        registerLiveBillAvenueBiller("JMFI00000NATZ9", "JM Financial Home Loans Ltd.");
        registerLiveBillAvenueBiller("JOHN00000NATY9", "John Deere Financial India Private Limited");
        registerLiveBillAvenueBiller("KAAB00000NATEW", "Kaabil Finance Private Limited");
        registerLiveBillAvenueBiller("KALL00000NATYA", "Kallada General Finance Private Limited");
        registerLiveBillAvenueBiller("KAMA00000NATQ4", "Kamal Finserve Private Limited");
        registerLiveBillAvenueBiller("KAMA00000RAJGY", "Kamal Autofinance Pvt Ltd");
        registerLiveBillAvenueBiller("KANA00000NATQV", "Kanakadurga Finance Limited - Vehicle Loans");
        registerLiveBillAvenueBiller("KANA00000NATXB", "Kanakadurga Finance Limited - Gold Loans");
        registerLiveBillAvenueBiller("KANN00000KERDB", "Kannattu Fingold Finance Pvt Ltd");
        registerLiveBillAvenueBiller("KARN00000KARQO", "Karnataka Grameena Bank");
        registerLiveBillAvenueBiller("KARP00000TNDP5", "Karpagam Hire Purchase And Finance Pvt Ltd");
        registerLiveBillAvenueBiller("KEER00000NATBH", "Keertana Finserv Limited");
        registerLiveBillAvenueBiller("KERA00000KER1T", "Kerala Gramin Bank");
        registerLiveBillAvenueBiller("KHUS00000NAT1L", "Khush Housing Finance Pvt Ltd");
        registerLiveBillAvenueBiller("KHUS00019NAT15", "Khushbu Auto Finance Limited");
        registerLiveBillAvenueBiller("KIFS00000NATST", "KIFS Housing Finance Ltd");
        registerLiveBillAvenueBiller("KLMA00000NATY0", "KLM Axiva Finvest Limited");
        registerLiveBillAvenueBiller("KOGT00000NATLM", "Kogta Financial India Limited");
        registerLiveBillAvenueBiller("KONA00018NATQS", "Konark Commercial Ltd");
        registerLiveBillAvenueBiller("KOSA00000NATMB", "Kosamattam  Finance  Ltd");
        registerLiveBillAvenueBiller("KOTA00000NATE1", "Kotak Mahindra Prime Limited");
        registerLiveBillAvenueBiller("KOTA00000NATTW", "Kotak Mahindra Bank Ltd.-Loans");
        registerLiveBillAvenueBiller("KRED00000NATSY", "KREDITBEE");
        registerLiveBillAvenueBiller("KUSA00000NATCZ", "Kusalava Finance Limited");
        registerLiveBillAvenueBiller("LAMP00000NAT7E", "L and T Finance Limited");
        registerLiveBillAvenueBiller("LAXM00010NATT2", "Laxmi India Finance Limited");
        registerLiveBillAvenueBiller("LEND00000NAT8L", "Lendingkart Finance Limited");
        registerLiveBillAvenueBiller("LIGH00000NATKW", "Light Microfinance Private Limited");
        registerLiveBillAvenueBiller("LIVF00023NATDM", "Livfin India Private Limited");
        registerLiveBillAvenueBiller("LOAN00000NATDD", "Loanbaba");
        registerLiveBillAvenueBiller("LOAN00000NATE2", "Loan2Wheels");
        registerLiveBillAvenueBiller("LOAN00000NATJ0", "LOANFRONT");
        registerLiveBillAvenueBiller("LOAN00000NATTB", "Loanzen Finance Pvt Ltd");
        registerLiveBillAvenueBiller("LOAN00000NATVP", "LOANTAP CREDIT PRODUCTS PRIVATE LIMITED");
        registerLiveBillAvenueBiller("LOKS00000NATC9", "Loksuvidha");
        registerLiveBillAvenueBiller("LORD00000NAT75", "Lord Krishna Financial Services Limited");
        registerLiveBillAvenueBiller("MAHA00000NATSI", "Mahaveer Finance India Limited");
        registerLiveBillAvenueBiller("MAHI00000NATIC", "Mahindra Home Finance");
        registerLiveBillAvenueBiller("MAHI00000NATKR", "Mahindra and Mahindra Financial Services Limited");
        registerLiveBillAvenueBiller("MAHI00000NATM9", "Mahindra Finance Consumer Loans");
        registerLiveBillAvenueBiller("MAIT00000NATH4", "Maitreya Capital and Business Services Private Limited");
        registerLiveBillAvenueBiller("MANA00000KER83", "Manappuram Asset Finance Ltd Micro Finance");
        registerLiveBillAvenueBiller("MANA00000KERCE", "Manappuram Asset Finance Ltd Two wheeler Loan");
        registerLiveBillAvenueBiller("MANA00000KERDV", "Manappuram Asset Finance Ltd Mortgage Loan");
        registerLiveBillAvenueBiller("MANA00000KERZK", "Manappuram Asset Finance Ltd Vehicle Loan");
        registerLiveBillAvenueBiller("MANA00000NATCH", "Manappuram Finance Limited");
        registerLiveBillAvenueBiller("MANA00000NATM8", "Manappuram Asset Finance Ltd - Gold Loan");
        registerLiveBillAvenueBiller("MANA00000NATVX", "Manappuram Home Finance Ltd");
        registerLiveBillAvenueBiller("MANA00000NATWG", "Manappuram Finance Limited-Vehicle Loan");
        registerLiveBillAvenueBiller("MANA00014NATQ2", "Manappuram Finance Ltd - MSME");
        registerLiveBillAvenueBiller("MANB00000NAT58", "Manba Finance Ltd");
        registerLiveBillAvenueBiller("MANG00000NAT26", "Mangal Credit and Fincorp Limited");
        registerLiveBillAvenueBiller("MANG00000NAT78", "Mangal Vehicle Finance Pvt Ltd");
        registerLiveBillAvenueBiller("MANG00000RAJG6", "Mangala Infin Ltd");
        registerLiveBillAvenueBiller("MANI00020MANLD", "Manipur Rural Bank");
        registerLiveBillAvenueBiller("MASC00024NATSO", "Mascot Projects Private Limited");
        registerLiveBillAvenueBiller("MASF00000NATUF", "MAS Financial Services Limited");
        registerLiveBillAvenueBiller("MASR00000NATYG", "Mas Rural Housing and Mortgage Finance Ltd");
        registerLiveBillAvenueBiller("MAXV00000NAT33", "Maxvalue Credits And Investments Ltd");
        registerLiveBillAvenueBiller("MDFC00000NATHW", "MDFC Financiers Pvt Ltd");
        registerLiveBillAvenueBiller("MEGH00000RAJS8", "Megha Holdings Pvt Ltd");
        registerLiveBillAvenueBiller("MENT00000NATBI", "Mentor Home Loans India Limited");
        registerLiveBillAvenueBiller("MERE00000NATOJ", "Mere Apne Micro Finance");
        registerLiveBillAvenueBiller("METR00000RAJBZ", "Metrocity Finance Pvt Ltd");
        registerLiveBillAvenueBiller("MGCF00000RAJA9", "MGC Finance Private Limited");
        registerLiveBillAvenueBiller("MGMF00000PUD95", "MGM Financiers");
        registerLiveBillAvenueBiller("MIDL00000NATIP", "Midland Microfin Ltd");
        registerLiveBillAvenueBiller("MITR00000NAT6L", "Mitron Capital");
        registerLiveBillAvenueBiller("MITR00000NATJF", "Mitrata Inclusive Financial Services Ltd");
        registerLiveBillAvenueBiller("MONE00000NAT7P", "MoneyTap");
        registerLiveBillAvenueBiller("MONE00000NATK3", "Moneyboxx Finance Limited");
        registerLiveBillAvenueBiller("MONE00000NATMS", "Moneyplus Financial Services Limited");
        registerLiveBillAvenueBiller("MONE00000NATPW", "Moneywise Financial Services Private Limited");
        registerLiveBillAvenueBiller("MONE00000NATX1", "RupeeRedee");
        registerLiveBillAvenueBiller("MONE00000NATZN", "Monedo Financial Services Pvt Ltd");
        registerLiveBillAvenueBiller("MOTI00000NATHD", "Motilal Oswal Home Finance");
        registerLiveBillAvenueBiller("MPEE00017NATER", "MPee Finance Pvt Ltd");
        registerLiveBillAvenueBiller("MSFI00000NAT7B", "MS Fincap Pvt Ltd");
        registerLiveBillAvenueBiller("MUFI00000NATUC", "Mufin Green Finance Limited");
        registerLiveBillAvenueBiller("MUTH00000KERSO", "Muthoot Finance Ltd Loan Against Property");
        registerLiveBillAvenueBiller("MUTH00000NAT0I", "Muthoot Microfin Limited");
        registerLiveBillAvenueBiller("MUTH00000NAT47", "Muthoot Vehicle And Asset Finance Limited Gold Loan");
        registerLiveBillAvenueBiller("MUTH00000NAT9L", "Muthoot Finance InstaPL");
        registerLiveBillAvenueBiller("MUTH00000NATB0", "Muthoot Fincorp Ltd");
        registerLiveBillAvenueBiller("MUTH00000NATBF", "Muthoot Vehicle And Asset Finance Limited");
        registerLiveBillAvenueBiller("MUTH00000NATDE", "Muthoot BL SME");
        registerLiveBillAvenueBiller("MUTH00000NATJO", "Muthoot Housing Finance Company Limited");
        registerLiveBillAvenueBiller("MUTH00000NATLC", "Muthoot Money - Gold Loan");
        registerLiveBillAvenueBiller("MUTH00000NATN4", "Muthoot Homefin Limited");
        registerLiveBillAvenueBiller("MUTH00000NATOI", "Muthoot Finance");
        registerLiveBillAvenueBiller("MUTH00000NATX8", "Muthoot Finance-Personal Loan");
        registerLiveBillAvenueBiller("MUTH00000NATYF", "Muthoot Capital Services Ltd");
        registerLiveBillAvenueBiller("MUTH00027NATH6", "Muthoot MCred EMI");
        registerLiveBillAvenueBiller("MUTH00029NAT1X", "Muthoot MCred Non-EMI");
        registerLiveBillAvenueBiller("NABF00000NATTJ", "NABFINS");
        registerLiveBillAvenueBiller("NAMD00000NATFJ", "Namdev Finvest Limited");
        registerLiveBillAvenueBiller("NAMR00000NATI7", "Namra Finance Ltd");
        registerLiveBillAvenueBiller("NAVA00000KARY7", "Navachetana Microfin Services Pvt Ltd");
        registerLiveBillAvenueBiller("NAVA00000NATO3", "Navadhan Capital");
        registerLiveBillAvenueBiller("NAVI00000NATZH", "Navi Loans");
        registerLiveBillAvenueBiller("NEEL00016NATXC", "Neelanchal LendPlus");
        registerLiveBillAvenueBiller("NEOG00022NAT2I", "NeoGrowth Credit Private Limited");
        registerLiveBillAvenueBiller("NETA00000NATEN", "Netafim Agricultural Financing Agency Pvt. Ltd.");
        registerLiveBillAvenueBiller("NIDH00000NAT9K", "Nidhilakshmi Finance");
        registerLiveBillAvenueBiller("NIPU00020NAT2J", "Nipun Projects and Finance Private Limited");
        registerLiveBillAvenueBiller("NISS00000NAT5D", "Nissan Renault Financial services India Private Limited");
        registerLiveBillAvenueBiller("NMFI00000NATGX", "NM Finance");
        registerLiveBillAvenueBiller("NOVE00000NAT6M", "Novelty Finance Ltd");
        registerLiveBillAvenueBiller("OHMY00000NATFH", "OHMYLOAN");
        registerLiveBillAvenueBiller("OMLP00000NAT0A", "OMLP2P.COM");
        registerLiveBillAvenueBiller("ORAC00026NATL2", "Oracle Marketing Pvt Ltd");
        registerLiveBillAvenueBiller("ORAN00000NATJX", "Orange Retail Finance India Pvt Ltd");
        registerLiveBillAvenueBiller("OROB00000NAT7P", "Oroboro");
        registerLiveBillAvenueBiller("OXYZ00000NATSE", "Oxyzo Financial Services Pvt Ltd");
        registerLiveBillAvenueBiller("PAHA00000NATIV", "Pahal Financial Services Pvt Ltd");
        registerLiveBillAvenueBiller("PAHA00000NATS8", "Pahal Finance IL/SL");
        registerLiveBillAvenueBiller("PAIS00000NATCM", "Paisabuddy Finance Pvt Ltd");
        registerLiveBillAvenueBiller("PAIS00000NATKR", "Paisalo Digital Limited");
        registerLiveBillAvenueBiller("PERF00000NAT5K", "Perfect Finsec Pvt. Ltd.");
        registerLiveBillAvenueBiller("PERF00000NATDQ", "Perfect Capital Services Ltd");
        registerLiveBillAvenueBiller("PHOE00014NATTQ", "Phoenix Capital India");
        registerLiveBillAvenueBiller("PINK00000RAJJK", "Pink City Fincap Pvt Ltd");
    }

    private void initBillers() {
        initOfficialBillAvenueBillers();

        // ── PROMINENT MICROFINANCE INSTITUTIONS (MFIs) & SPECIALIZED NBFCs ────────
        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("ANNA00000NATUO")
                .billerName("Annapurna Finance Private Limited-MFI")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .billerAdhoc(true)
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
                .billerAdhoc(true)
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
                .billerAdhoc(true)
                .supportBillValidation("OPTIONAL")
                .description("DMI Finance personal loans, Samsung Finance+, and digital consumer finance EMIs")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan ID").dataType("ALPHANUMERIC").optional(false).minLength(4).maxLength(30).hint("DMI Loan ID / Account Number (e.g. DMI0057662896)").build(),
                        BbpsDtos.InputParamInfo.builder().paramName("Mobile Number").dataType("NUMERIC").optional(true).minLength(10).maxLength(10).hint("Registered Mobile Number").build()
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
                .billerId("HDFC00000NATM1")
                .billerName("HDFC Bank - Retail Loan Repayment")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("HDFC Bank auto loans, personal loans, home loans, and two-wheeler loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(8).maxLength(20).hint("16-digit Loan Account Number").build()
                ))
                .build(), "HDFC00000NAT64", "HDFC00000NAT01", "HDFCLOAN", "HDFC00000RET01");

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

        // ── ADDITIONAL PROMINENT NBFCs, HOUSING FINANCE & DIGITAL LENDERS ────────
        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("CHOL00000NATSS")
                .billerName("Cholamandalam Investment and Finance Company Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Cholamandalam vehicle finance, home equity, and MSME loan repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(30).hint("Chola Agreement / LAN Number").build()
                ))
                .build(), "CHOL00000NAT18", "CHOL00000NAT01", "CHOLAFIN", "CIFCL0000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("FULL00000NATD4")
                .billerName("SMFG India Credit (formerly Fullerton India)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("SMFG India Credit personal, business, and two-wheeler installment repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("SMFG / Fullerton Loan Account Number").build()
                ))
                .build(), "FULL00000NAT8R", "FULL00000NAT01", "SMFGCREDIT", "FULLERTON");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("CLIX00000NATST")
                .billerName("Clix Capital Services Private Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Clix Capital personal, business, healthcare, and digital loan installments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Clix Loan Account Number").build()
                ))
                .build(), "CLIX00000NAT28", "CLIX00000NAT01", "CLIXCAPITAL");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("FIBE00000NAT39")
                .billerName("Fibe (formerly EarlySalary - Social Worth Technologies)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Fibe instant salary advance, medical loans, and school fee financing")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Fibe / EarlySalary Loan Number").build()
                ))
                .build(), "EARL00000NAT01", "EARLYSALARY", "FIBELOANS");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("INCR00000NATJG")
                .billerName("InCred Financial Services Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("InCred personal loans, education loans, and SME business finance")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("InCred Loan Account Number").build()
                ))
                .build(), "INCR00000NAT82", "INCR00000NAT01", "INCREDFIN");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("FEDB00000NATT0")
                .billerName("Fedbank Financial Services Limited (Fedfina)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Fedfina gold loans, home loans, and business installment repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Fedfina Loan Account Number").build()
                ))
                .build(), "FEDF00000NAT2C", "FEDF00000NAT01", "FEDFINA");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("TATA00000NAT0F")
                .billerName("Tata Motors Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Tata Motors commercial vehicle, passenger vehicle, and fuel financing")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Contract / Agreement Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Contract Number on Tata Motors agreement").build()
                ))
                .build(), "TMFL00000NAT01", "TATAMOTORSFIN");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("FINO00000NATVP")
                .billerName("Finova Capital Private Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Finova Capital MSME, home construction, and small business loan repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Finova Loan Account Number").build()
                ))
                .build(), "FINO00000NAT6F", "FINO00000NAT01", "FINOVACAPITAL");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("AVAN00000NATHI")
                .billerName("Avanse Financial Services Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Avanse higher education loans and school infrastructure financing")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Avanse Loan Account Number").build()
                ))
                .build(), "AVAN00000NAT2M", "AVAN00000NAT01", "AVANSEFIN");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("FIVE00000NAT88")
                .billerName("Five-Star Business Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Five Star small business loans and self-employed enterprise repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Five Star Loan Account Number").build()
                ))
                .build(), "FIVE00000NAT7G", "FIVE00000NAT01", "FIVESTARFIN");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("PNBH00000NAT8L")
                .billerName("PNB Housing Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("PNB Housing individual home loans and loan against property installments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(8).maxLength(25).hint("PNB Housing Loan Account Number").build()
                ))
                .build(), "PNBH00000NAT01", "PNBHOUSING");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("LICH00000NAT08")
                .billerName("LIC Housing Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("LIC Housing individual housing loans, plot purchase, and home improvement loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("NUMERIC").optional(false).minLength(9).maxLength(15).hint("LIC HFL Loan Account Number").build()
                ))
                .build(), "LICH00000NAT01", "LICHOUSING");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("INDI00000NATYG")
                .billerName("Indiabulls Housing Finance Limited (Sammaan Capital)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Indiabulls / Sammaan Capital home loans and mortgage repayments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Indiabulls Loan Account Number").build()
                ))
                .build(), "IBHL00000NAT37", "INDI00000NAT01", "INDIABULLSHFL", "SAMMAANCAPITAL");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("PAYU00000NAT25")
                .billerName("PayU Finance (LazyPay)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("LazyPay credit limit and Buy-Now-Pay-Later bill settlement")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Registered Mobile Number").dataType("NUMERIC").optional(false).minLength(10).maxLength(10).hint("10-digit LazyPay Mobile Number").build()
                ))
                .build(), "PAYU00000NAT01", "LAZYPAY");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("CASH00000NAT0Z")
                .billerName("CASHe (Bhanix Finance and Investment)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("CASHe salaried instant personal loans and credit line installments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan / Mobile Number").dataType("ALPHANUMERIC").optional(false).minLength(8).maxLength(25).hint("CASHe Loan or Mobile Number").build()
                ))
                .build(), "BHAN00000NAT19", "BHAN00000NAT01", "CASHE");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("MAYF00000NAT21")
                .billerName("mPokket (Mayfair Financial Facilities)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("mPokket college student and young professional pocket loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("mPokket Loan / User ID").build()
                ))
                .build(), "MAYF00000NAT01", "MPOKKET");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("HIND00000NATYQ")
                .billerName("Hinduja Leyland Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Hinduja Leyland commercial vehicle, construction equipment, and used vehicle financing")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Proposal / Agreement Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Hinduja Agreement Number").build()
                ))
                .build(), "HIND00000NAT38", "HIND00000NAT01", "HINDUJALEYLAND", "HLFL00000NAT01");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("CAPR00000NATI7")
                .billerName("Capri Global Capital Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Capri Global MSME loans, affordable housing, and construction finance")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Capri Global Loan Account Number").build()
                ))
                .build(), "CAPR00000NAT42", "CAPR00000NAT01", "CAPRIGLOBAL");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("NEOG00022NAT2I")
                .billerName("NeoGrowth Credit Private Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("NeoGrowth digital merchant cash advances and business loan repayment")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("NeoGrowth Loan Account Number").build()
                ))
                .build(), "NEOG00000NAT15", "NEOG00000NAT01", "NEOGROWTH");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("MASF00000NATUF")
                .billerName("MAS Financial Services Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("MAS Financial micro-enterprise, SME, two-wheeler, and commercial vehicle loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("MAS Financial Loan Number").build()
                ))
                .build(), "MASF00000NAT33", "MASF00000NAT01", "MASFINANCIAL");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("UGRO00000NAT29")
                .billerName("UGRO Capital Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("UGRO Capital data-tech driven MSME business loans and supply chain financing")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("UGRO Loan Account Number").build()
                ))
                .build(), "UGRO00000NAT01", "UGROCAPITAL");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("LEND00000NAT8L")
                .billerName("Lendingkart Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Lendingkart collateral-free working capital and business loans for MSMEs")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Lendingkart Application / LAN").build()
                ))
                .build(), "LEND00000NAT17", "LEND00000NAT01", "LENDINGKART");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("AYEF00000NATZB")
                .billerName("Aye Finance Private Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Aye Finance cluster-based micro-enterprise business loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Aye Finance Loan Account Number").build()
                ))
                .build(), "AYEF00000NAT31", "AYEF00000NAT01", "AYEFINANCE");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("AUXI00000NATKM")
                .billerName("Auxilo Finserve Private Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Auxilo higher education loans and educational institution finance")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Auxilo Loan Account Number").build()
                ))
                .build(), "AUXI00000NAT14", "AUXI00000NAT01", "AUXILOFIN");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("THIR00000NAT16")
                .billerName("Varthana (Thirumeni Finance Private Limited)")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Varthana affordable school loans and college student financing")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Varthana Loan Account Number").build()
                ))
                .build(), "THIR00000NAT01", "VARTHANA");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("REPC00000NAT12")
                .billerName("Repco Home Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Repco individual housing loans and property mortgage installments")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Repco Loan Account Number").build()
                ))
                .build(), "REPC00000NAT01", "REPCOHOME");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("GICH00000NAT19")
                .billerName("GIC Housing Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("GIC Housing retail home loans and repair/renovation financing")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("GIC Housing Loan Account Number").build()
                ))
                .build(), "GICH00000NAT01", "GICHOUSING");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("CENT00000NAT22")
                .billerName("Centrum Financial Services Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Centrum MSME business loans, commercial real estate, and structured credit")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Centrum Loan Account Number").build()
                ))
                .build(), "CENT00000NAT01", "CENTRUMFIN");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("INDO00000NATGP")
                .billerName("IndoStar Capital Finance Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("IndoStar commercial vehicle loans, SME loans, and affordable home finance")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("IndoStar Loan Account Number").build()
                ))
                .build(), "INDS00000NAT18", "INDS00000NAT01", "INDOSTAR");

        addBiller(BbpsDtos.LoanBillerInfo.builder()
                .billerId("NORT00000NAT25")
                .billerName("Northern Arc Capital Limited")
                .category("Loan Repayment")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact")
                .supportBillValidation("OPTIONAL")
                .description("Northern Arc retail MSME, vehicle finance, and micro-loans")
                .inputParams(List.of(
                        BbpsDtos.InputParamInfo.builder().paramName("Loan Account Number").dataType("ALPHANUMERIC").optional(false).minLength(6).maxLength(25).hint("Northern Arc Loan Account Number").build()
                ))
                .build(), "NORT00000NAT01", "NORTHERNARC");
    }
}
