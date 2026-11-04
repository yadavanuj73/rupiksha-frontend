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
 * Official registry of Bharat Connect / BillAvenue NETC FASTag Issuers.
 * Contains all 31 official NPCI / BillAvenue verified FASTag Biller IDs with their
 * exact parameter names (Vehicle Number, VRN, Vehicle Registered Number, etc.) and constraints.
 *
 * Per BillAvenue API doc Version 2.8.7 (Bharat Connect FASTag specification):
 *   - Category: FASTag (NETC Electronic Toll Collection).
 *   - Cooling period for CMS complaints: 0 hours (Page 56).
 *   - Payment modes supported via AGT channel: Cash (with Cash Payment remitter account info).
 *   - Supports dynamic MDM parameter synchronization via BillAvenue MDM Biller Info API.
 *   - Backward-compatibility alias map for legacy biller IDs.
 */
@Component
public class FastagBillerRegistry {

    private static final Pattern VEHICLE_REG_CLEAN_PATTERN = Pattern.compile("[^A-Z0-9]");
    private static final Pattern VEHICLE_NUMBER_PATTERN = Pattern.compile("^[A-Z]{2}[0-9]{1,2}[A-Z]{0,4}[0-9]{4}$");
    private static final Pattern BHARAT_SERIES_PATTERN = Pattern.compile("^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$");

    private final List<BbpsDtos.FastagBillerInfo> billers = new CopyOnWriteArrayList<>();
    private final Map<String, BbpsDtos.FastagBillerInfo> billerMap = new ConcurrentHashMap<>();

    // Backward-compatibility alias map from old/synthetic IDs to official BillAvenue Bharat Connect IDs
    private static final Map<String, String> BILLER_ID_ALIASES = Map.ofEntries(
            Map.entry("ICIC00000NAT01", "TOLL00000NAT72"),
            Map.entry("SBIN00000NAT01", "SBIB00000NAT25"),
            Map.entry("HDFC00000NAT01", "HDFC00000NAT5K"),
            Map.entry("UTIB00000NAT01", "AXIS00000NAT31"),
            Map.entry("AXIS00000NAT01", "AXIS00000NAT31"),
            Map.entry("KKBK00000NAT01", "KOTA00000NATJZ"),
            Map.entry("IDFB00000NAT01", "IDFC00000NATXM"),
            Map.entry("BARB00000NAT01", "BANK00000NATDH"),
            Map.entry("PUNB00000NAT01", "PUNJ00022NATNO"),
            Map.entry("CNRB00000NAT01", "CANA00000NATM9"),
            Map.entry("UBIN00000NAT01", "UNIO00000NATQA"),
            Map.entry("IDIB00000NAT01", "INDI00000NATA0"),
            Map.entry("INDB00000NAT01", "INDU00000NATR2"),
            Map.entry("FDRL00000NAT01", "THEF00000NATZO"),
            Map.entry("IBKL00000NAT01", "IDBI00000NATK7"),
            Map.entry("AIRP00000NAT01", "AIRT00000NATVI"),
            Map.entry("AIRT00000NAT01", "AIRT00000NATVI"),
            Map.entry("YESB00000NAT01", "YESB00000NATOM"),
            Map.entry("AUBK00000NAT01", "AUBA00000NATOF"),
            Map.entry("IOBA00000NAT01", "IOBF00000NATV1"),
            Map.entry("MAHB00000NAT01", "BANK00000NAT4Z"),
            Map.entry("CIUB00000NAT01", "CUBF00016NATVK"),
            Map.entry("CUBK00000NAT01", "CUBF00016NATVK"),
            Map.entry("ESFB00000NAT01", "EQUI00000NATNF"),
            Map.entry("JAKB00000NAT01", "JAMM00000NATWB"),
            Map.entry("JAKA00000NAT01", "JAMM00000NATWB"),
            Map.entry("KARB00000NAT01", "KARN00000NATWS"),
            Map.entry("KVBL00000NAT01", "KVBF00000NATO7"),
            Map.entry("SIBL00000NAT01", "SOUT00000NAT99"),
            Map.entry("UCBA00000NAT01", "UCOB00000NATEH"),
            Map.entry("LIVQ00000NAT01", "LIVQ00000MAHMZ")
    );

    public FastagBillerRegistry() {
        initBillers();
    }

    private void add(BbpsDtos.FastagBillerInfo biller) {
        String key = biller.getBillerId().toUpperCase();
        if (billerMap.containsKey(key)) {
            return; // Enforce zero duplicates
        }
        billers.add(biller);
        billerMap.put(key, biller);
    }

    public List<BbpsDtos.FastagBillerInfo> getAllBillers(String search) {
        if (search == null || search.isBlank()) {
            return Collections.unmodifiableList(billers);
        }
        String clean = search.trim().toLowerCase();
        return billers.stream()
                .filter(b -> (b.getBillerName() != null && b.getBillerName().toLowerCase().contains(clean)) ||
                             (b.getBankName() != null && b.getBankName().toLowerCase().contains(clean)) ||
                             (b.getBillerId() != null && b.getBillerId().toLowerCase().contains(clean)))
                .toList();
    }

    public Optional<BbpsDtos.FastagBillerInfo> findById(String billerId) {
        if (billerId == null || billerId.isBlank()) return Optional.empty();
        String clean = billerId.trim().toUpperCase();

        // 1. Direct match on official ID
        BbpsDtos.FastagBillerInfo found = billerMap.get(clean);
        if (found != null) {
            return Optional.of(found);
        }

        // 2. Alias resolution
        String aliasedId = BILLER_ID_ALIASES.get(clean);
        if (aliasedId != null) {
            BbpsDtos.FastagBillerInfo aliasedBiller = billerMap.get(aliasedId);
            if (aliasedBiller != null) {
                return Optional.of(aliasedBiller);
            }
        }

        // 3. Fallback: If it's a valid 14-character BBPS biller ID, create a generic fetch-enabled FASTag biller info on the fly
        if (clean.matches("^[A-Z0-9]{14}$")) {
            return Optional.of(BbpsDtos.FastagBillerInfo.builder()
                    .billerId(clean)
                    .billerName("FASTag Issuer (" + clean + ")")
                    .bankName("FASTag Bank")
                    .category("FASTag")
                    .billerFetchRequirement("MANDATORY")
                    .billerPaymentExactness("Exact and above")
                    .supportBillValidation("OPTIONAL")
                    .billerAdhoc(true)
                    .minAmount(BigDecimal.valueOf(100))
                    .maxAmount(BigDecimal.valueOf(50000))
                    .inputParams(defaultFastagParams())
                    .description("National Electronic Toll Collection (NETC) FASTag")
                    .build());
        }
        return Optional.empty();
    }

    private BbpsDtos.InputParamInfo vehicleParam(String name, int min, int max) {
        return BbpsDtos.InputParamInfo.builder()
                .paramName(name)
                .dataType("ALPHANUMERIC")
                .optional(false)
                .minLength(min)
                .maxLength(max)
                .regEx("^[A-Z0-9]{" + min + "," + max + "}$")
                .hint("e.g. KA03HW5924 or MP41ZF5048")
                .build();
    }

    private BbpsDtos.InputParamInfo mobileParam() {
        return BbpsDtos.InputParamInfo.builder()
                .paramName("Mobile Number")
                .dataType("NUMERIC")
                .optional(true)
                .minLength(10)
                .maxLength(10)
                .regEx("^[6-9]\\d{9}$")
                .hint("10-digit registered mobile number")
                .build();
    }

    public List<BbpsDtos.InputParamInfo> defaultFastagParams() {
        return List.of(vehicleParam("Vehicle Number", 4, 20), mobileParam());
    }

    /**
     * Updates biller schema dynamically if BillAvenue MDM provides updated parameter details.
     */
    public void updateFromMdm(String billerId, BillAvenueDtos.BillerInfoResponse mdm) {
        if (mdm == null || !mdm.isSuccess() || mdm.getInputParams() == null || mdm.getInputParams().isEmpty()) {
            return;
        }
        Optional<BbpsDtos.FastagBillerInfo> opt = findById(billerId);
        if (opt.isPresent()) {
            BbpsDtos.FastagBillerInfo existing = opt.get();
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

    /**
     * Extracts and standardizes vehicle registration number from customer parameters.
     */
    public String extractVehicleNumber(Map<String, String> customerParams) {
        if (customerParams == null || customerParams.isEmpty()) {
            return null;
        }
        for (Map.Entry<String, String> entry : customerParams.entrySet()) {
            String key = entry.getKey() == null ? "" : entry.getKey().toLowerCase();
            if (key.contains("vehicle") || key.contains("vrn") || key.contains("reg") || key.contains("car") || key.contains("plate") || key.contains("chassis") || key.contains("wallet")) {
                if (entry.getValue() != null && !entry.getValue().isBlank()) {
                    return cleanVehicleNumber(entry.getValue());
                }
            }
        }
        // Fallback: search any non-mobile alphanumeric value
        for (Map.Entry<String, String> entry : customerParams.entrySet()) {
            String key = entry.getKey() == null ? "" : entry.getKey().toLowerCase();
            if (!key.contains("mobile") && !key.contains("phone") && entry.getValue() != null && !entry.getValue().isBlank()) {
                return cleanVehicleNumber(entry.getValue());
            }
        }
        return null;
    }

    public String cleanVehicleNumber(String raw) {
        if (raw == null) return null;
        return VEHICLE_REG_CLEAN_PATTERN.matcher(raw.toUpperCase()).replaceAll("").trim();
    }

    public boolean isValidVehicleNumber(String vrn) {
        if (vrn == null || vrn.length() < 3 || vrn.length() > 30) {
            return false;
        }
        String clean = cleanVehicleNumber(vrn);
        if (clean.length() < 3 || clean.length() > 30) {
            return false;
        }
        return VEHICLE_NUMBER_PATTERN.matcher(clean).matches()
                || BHARAT_SERIES_PATTERN.matcher(clean).matches()
                || clean.matches("^[A-Z0-9]{3,30}$");
    }

    /**
     * Validates client-supplied customer parameters against the FASTag biller's documented schema.
     */
    public void validateCustomerParams(BbpsDtos.FastagBillerInfo biller, Map<String, String> customerParams) {
        if (biller == null) {
            throw new IllegalArgumentException("Invalid or unknown FASTag biller");
        }
        if (customerParams == null || customerParams.isEmpty()) {
            throw new IllegalArgumentException("Customer parameters cannot be empty");
        }

        String vrn = extractVehicleNumber(customerParams);
        if (vrn == null || vrn.isBlank()) {
            throw new IllegalArgumentException("Vehicle Registration Number is required for FASTag recharge");
        }

        if (!isValidVehicleNumber(vrn)) {
            throw new IllegalArgumentException("Invalid Vehicle Registration Number format (expected format like KA03HW5924 or MP41ZF5048)");
        }

        List<BbpsDtos.InputParamInfo> expectedParams = biller.getInputParams();
        if (expectedParams == null || expectedParams.isEmpty()) {
            return;
        }

        for (BbpsDtos.InputParamInfo param : expectedParams) {
            if (param.isOptional()) continue;

            String val = resolveCustomerParamValue(param.getParamName(), customerParams, vrn);
            if (val == null || val.isBlank()) {
                throw new IllegalArgumentException("Missing mandatory input parameter: " + param.getParamName());
            }

            if (param.getMinLength() > 0 && val.length() < param.getMinLength()) {
                throw new IllegalArgumentException("Parameter '" + param.getParamName() + "' must be at least " + param.getMinLength() + " characters");
            }
            if (param.getMaxLength() > 0 && val.length() > param.getMaxLength()) {
                throw new IllegalArgumentException("Parameter '" + param.getParamName() + "' cannot exceed " + param.getMaxLength() + " characters");
            }
        }
    }

    private String resolveCustomerParamValue(String targetParamName, Map<String, String> incoming, String vrn) {
        if (incoming == null) return null;
        String direct = incoming.get(targetParamName);
        if (direct != null && !direct.isBlank()) return direct.trim();

        for (Map.Entry<String, String> e : incoming.entrySet()) {
            if (e.getKey() != null && e.getKey().equalsIgnoreCase(targetParamName)) {
                if (e.getValue() != null && !e.getValue().isBlank()) return e.getValue().trim();
            }
        }

        String targetLower = targetParamName.toLowerCase();
        if (targetLower.contains("vehicle") || targetLower.contains("vrn") || targetLower.contains("reg") || targetLower.contains("car") || targetLower.contains("wallet")) {
            return vrn;
        }
        return null;
    }

    /**
     * Builds standard BillAvenue InputParam list compliant with official BBPS v2.8.7 spec.
     */
    public List<BillAvenueDtos.InputParam> buildFastagInputParams(
            BbpsDtos.FastagBillerInfo biller,
            Map<String, String> customerParams,
            String customerMobile
    ) {
        List<BillAvenueDtos.InputParam> inputs = new ArrayList<>();
        String vrn = extractVehicleNumber(customerParams);

        Map<String, String> normalizedIncoming = new LinkedHashMap<>();
        if (customerParams != null) {
            customerParams.forEach((k, v) -> {
                if (k != null && v != null) normalizedIncoming.put(k.trim(), v.trim());
            });
        }

        List<BbpsDtos.InputParamInfo> schema = (biller != null && biller.getInputParams() != null && !biller.getInputParams().isEmpty())
                ? biller.getInputParams()
                : defaultFastagParams();

        for (BbpsDtos.InputParamInfo paramInfo : schema) {
            String pName = paramInfo.getParamName();
            String pNameLower = pName.toLowerCase();
            String directVal = normalizedIncoming.get(pName);

            if (pNameLower.contains("vehicle") || pNameLower.contains("vrn") || pNameLower.contains("reg") || pNameLower.contains("plate") || pNameLower.contains("chassis") || pNameLower.contains("wallet")) {
                inputs.add(BillAvenueDtos.InputParam.builder()
                        .paramName(pName)
                        .paramValue(vrn != null ? vrn : (directVal != null ? cleanVehicleNumber(directVal) : ""))
                        .build());
            } else if (pNameLower.contains("mobile") || pNameLower.contains("phone")) {
                String mob = (directVal != null && !directVal.isBlank())
                        ? directVal.replaceAll("\\D", "")
                        : (customerMobile != null ? customerMobile.replaceAll("\\D", "") : "");
                if (!mob.isEmpty()) {
                    inputs.add(BillAvenueDtos.InputParam.builder()
                            .paramName(pName)
                            .paramValue(mob)
                            .build());
                }
            } else {
                String val = directVal != null ? directVal : normalizedIncoming.getOrDefault(pName, "");
                if (!val.isBlank() || !paramInfo.isOptional()) {
                    inputs.add(BillAvenueDtos.InputParam.builder()
                            .paramName(pName)
                            .paramValue(val)
                            .build());
                }
            }
        }

        if (inputs.isEmpty() && vrn != null) {
            inputs.add(BillAvenueDtos.InputParam.builder().paramName("Vehicle Number").paramValue(vrn).build());
        }

        return inputs;
    }

    /**
     * Returns sanitized customer params for responses and database persistence.
     */
    public Map<String, String> sanitizeCustomerParams(Map<String, String> params, String customerMobile) {
        String vrn = extractVehicleNumber(params);
        String mobile = customerMobile != null ? customerMobile.replaceAll("\\D", "") : "";

        Map<String, String> safe = new LinkedHashMap<>();
        if (vrn != null) {
            safe.put("Vehicle Registration Number", vrn);
        }
        if (!mobile.isBlank()) {
            safe.put("Mobile Number", mobile);
        }
        return safe;
    }

    private void initBillers() {
        // 1. State Bank of India (SBI) FASTag — Biller ID: SBIB00000NAT25, Param: "Vehicle Number" (5-15)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("SBIB00000NAT25")
                .billerName("State Bank of India (SBI) FASTag")
                .bankName("State Bank of India")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Number", 5, 15),
                        mobileParam()
                ))
                .description("SBI National Electronic Toll Collection FASTag")
                .build());

        // 2. ICICI Bank FASTag — Biller ID: TOLL00000NAT72, Param: "Vehicle Number" (7-10)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("TOLL00000NAT72")
                .billerName("ICICI Bank FASTag")
                .bankName("ICICI Bank")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Number", 7, 10),
                        mobileParam()
                ))
                .description("ICICI Bank NETC FASTag Recharge")
                .build());

        // 3. HDFC Bank FASTag — Biller ID: HDFC00000NAT5K, Param: "Vehicle Registration Number" (7-30)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("HDFC00000NAT5K")
                .billerName("HDFC Bank FASTag")
                .bankName("HDFC Bank")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Registration Number", 7, 30),
                        mobileParam()
                ))
                .description("HDFC Bank NETC FASTag")
                .build());

        // 4. Axis Bank FASTag — Biller ID: AXIS00000NAT31, Param: "Vehicle Registration Number" (8-20)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("AXIS00000NAT31")
                .billerName("Axis Bank FASTag")
                .bankName("Axis Bank")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Registration Number", 8, 20),
                        mobileParam()
                ))
                .description("Axis Bank FASTag Toll Collection")
                .build());

        // 5. Kotak Mahindra Bank FASTag — Biller ID: KOTA00000NATJZ, Param: "Vehicle Registered Number" (7-10)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("KOTA00000NATJZ")
                .billerName("Kotak Mahindra Bank FASTag")
                .bankName("Kotak Mahindra Bank")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Registered Number", 7, 10),
                        mobileParam()
                ))
                .description("Kotak NETC FASTag Toll Collection")
                .build());

        // 6. IDFC FIRST Bank FASTag — Biller ID: IDFC00000NATXM, Param: "Vehicle Number" (7-10)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("IDFC00000NATXM")
                .billerName("IDFC FIRST Bank FASTag")
                .bankName("IDFC FIRST Bank")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Number", 7, 10),
                        mobileParam()
                ))
                .description("IDFC FIRST Bank FASTag Recharge")
                .build());

        // 7. Bank of Baroda FASTag — Biller ID: BANK00000NATDH, Param: "Vehicle Number" (7-10)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("BANK00000NATDH")
                .billerName("Bank of Baroda FASTag")
                .bankName("Bank of Baroda")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Number", 7, 10),
                        mobileParam()
                ))
                .description("Bank of Baroda NETC FASTag")
                .build());

        // 8. Punjab National Bank (PNB) FASTag — Biller ID: PUNJ00022NATNO, Param: "Vehicle Registered Number" (3-25)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("PUNJ00022NATNO")
                .billerName("Punjab National Bank (PNB) FASTag")
                .bankName("Punjab National Bank")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Registered Number", 3, 25),
                        mobileParam()
                ))
                .description("Punjab National Bank NETC FASTag")
                .build());

        // 9. Canara Bank FASTag — Biller ID: CANA00000NATM9, Param: "Vehicle Number" (7-10)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("CANA00000NATM9")
                .billerName("Canara Bank FASTag")
                .bankName("Canara Bank")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Number", 7, 10),
                        mobileParam()
                ))
                .description("Canara Bank FASTag")
                .build());

        // 10. Union Bank of India FASTag — Biller ID: UNIO00000NATQA, Param: "Vehicle Registration Number" (5-20)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("UNIO00000NATQA")
                .billerName("Union Bank of India FASTag")
                .bankName("Union Bank of India")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Registration Number", 5, 20),
                        mobileParam()
                ))
                .description("Union Bank of India FASTag")
                .build());

        // 11. Indian Bank FASTag — Biller ID: INDI00000NATA0, Param: "VRN" (7-20)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("INDI00000NATA0")
                .billerName("Indian Bank FASTag")
                .bankName("Indian Bank")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("VRN", 7, 20),
                        mobileParam()
                ))
                .description("Indian Bank NETC FASTag")
                .build());

        // 12. IndusInd Bank FASTag — Biller ID: INDU00000NATR2, Param: "Vehicle Registration Number" (4-10)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("INDU00000NATR2")
                .billerName("IndusInd Bank FASTag")
                .bankName("IndusInd Bank")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Registration Number", 4, 10),
                        mobileParam()
                ))
                .description("IndusInd Bank FASTag Recharge")
                .build());

        // 13. Federal Bank FASTag — Biller ID: THEF00000NATZO, Param: "Vehicle Registration Number ID" (4-12)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("THEF00000NATZO")
                .billerName("Federal Bank FASTag")
                .bankName("Federal Bank")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Registration Number ID", 4, 12),
                        mobileParam()
                ))
                .description("Federal Bank NETC FASTag Recharge")
                .build());

        // 14. IDBI Bank FASTag — Biller ID: IDBI00000NATK7, Param: "Vehicle Number" (7-50)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("IDBI00000NATK7")
                .billerName("IDBI Bank FASTag")
                .bankName("IDBI Bank")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Number", 7, 50),
                        mobileParam()
                ))
                .description("IDBI Bank NETC FASTag")
                .build());

        // 15. Airtel Payments Bank FASTag — Biller ID: AIRT00000NATVI, Param: "Vehicle Registration Number" (4-20)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("AIRT00000NATVI")
                .billerName("Airtel Payments Bank FASTag")
                .bankName("Airtel Payments Bank")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Registration Number", 4, 20),
                        mobileParam()
                ))
                .description("Airtel Payments Bank NETC FASTag")
                .build());

        // 16. Bajaj Pay FASTag — Biller ID: BAJA00000NAT9J, Param: "Vehicle Registration Number" (7-12)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("BAJA00000NAT9J")
                .billerName("Bajaj Pay FASTag")
                .bankName("Bajaj Finance")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Registration Number", 7, 12),
                        mobileParam()
                ))
                .description("Bajaj Finance NETC FASTag")
                .build());

        // 17. Bandhan Bank FASTag — Biller ID: BAND00000NATEO, Param: "Vehicle Registration Number (VRN)" (4-20)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("BAND00000NATEO")
                .billerName("Bandhan Bank FASTag")
                .bankName("Bandhan Bank")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Registration Number (VRN)", 4, 20),
                        mobileParam()
                ))
                .description("Bandhan Bank NETC FASTag")
                .build());

        // 18. Bank of Maharashtra FASTag — Biller ID: BANK00000NAT4Z, Param: "Vehicle Registration Number" (7-12)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("BANK00000NAT4Z")
                .billerName("Bank of Maharashtra FASTag")
                .bankName("Bank of Maharashtra")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Registration Number", 7, 12),
                        mobileParam()
                ))
                .description("Bank of Maharashtra FASTag")
                .build());

        // 19. BlackBuck FASTag — Biller ID: BLAC00015NATKL, Param: "Vehicle Number" (7-14)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("BLAC00015NATKL")
                .billerName("BlackBuck FASTag")
                .bankName("BlackBuck")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Number", 7, 14),
                        mobileParam()
                ))
                .description("BlackBuck Commercial FASTag")
                .build());

        // 20. City Union Bank (CUB) FASTag — Biller ID: CUBF00016NATVK, Param: "Vehicle Registration Number" (7-10)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("CUBF00016NATVK")
                .billerName("City Union Bank (CUB) FASTag")
                .bankName("City Union Bank")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Registration Number", 7, 10),
                        mobileParam()
                ))
                .description("City Union Bank NETC FASTag")
                .build());

        // 21. Equitas Small Finance Bank FASTag — Biller ID: EQUI00000NATNF, Param: "Vehicle Registration Number" (7-10)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("EQUI00000NATNF")
                .billerName("Equitas Small Finance Bank FASTag")
                .bankName("Equitas Small Finance Bank")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Registration Number", 7, 10),
                        mobileParam()
                ))
                .description("Equitas Small Finance Bank FASTag")
                .build());

        // 22. IHMCL FASTag — Biller ID: INDI00000NATTR, Param: "Vehicle Registration Number" (4-10)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("INDI00000NATTR")
                .billerName("IHMCL FASTag")
                .bankName("IHMCL")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Registration Number", 4, 10),
                        mobileParam()
                ))
                .description("Indian Highway Management Company Limited FASTag")
                .build());

        // 23. Indian Overseas Bank (IOB) FASTag — Biller ID: IOBF00000NATV1, Param: "Vehicle Registration Number (VRN)" (5-50)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("IOBF00000NATV1")
                .billerName("Indian Overseas Bank (IOB) FASTag")
                .bankName("Indian Overseas Bank")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Registration Number (VRN)", 5, 50),
                        mobileParam()
                ))
                .description("Indian Overseas Bank NETC FASTag")
                .build());

        // 24. J&K Bank FASTag — Biller ID: JAMM00000NATWB, Param: "Vehicle Registration Number/Wallet Number" (7-20)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("JAMM00000NATWB")
                .billerName("Jammu & Kashmir Bank FASTag")
                .bankName("J&K Bank")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Registration Number/Wallet Number", 7, 20),
                        mobileParam()
                ))
                .description("Jammu & Kashmir Bank NETC FASTag")
                .build());

        // 25. Karnataka Bank FASTag — Biller ID: KARN00000NATWS, Param: "Vehicle Registration Number/Wallet Number" (7-20)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("KARN00000NATWS")
                .billerName("Karnataka Bank FASTag")
                .bankName("Karnataka Bank")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Registration Number/Wallet Number", 7, 20),
                        mobileParam()
                ))
                .description("Karnataka Bank FASTag")
                .build());

        // 26. Karur Vysya Bank (KVB) FASTag — Biller ID: KVBF00000NATO7, Param: "Vehicle Registration Number" (7-12)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("KVBF00000NATO7")
                .billerName("Karur Vysya Bank (KVB) FASTag")
                .bankName("Karur Vysya Bank")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Registration Number", 7, 12),
                        mobileParam()
                ))
                .description("Karur Vysya Bank NETC FASTag")
                .build());

        // 27. South Indian Bank FASTag — Biller ID: SOUT00000NAT99, Param: "Vehicle Registration Number ID" (4-12)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("SOUT00000NAT99")
                .billerName("South Indian Bank FASTag")
                .bankName("South Indian Bank")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Registration Number ID", 4, 12),
                        mobileParam()
                ))
                .description("South Indian Bank FASTag")
                .build());

        // 28. UCO Bank FASTag — Biller ID: UCOB00000NATEH, Param: "Vehicle Registration Number/Wallet Number" (4-20)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("UCOB00000NATEH")
                .billerName("UCO Bank FASTag")
                .bankName("UCO Bank")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Registration Number/Wallet Number", 4, 20),
                        mobileParam()
                ))
                .description("UCO Bank NETC FASTag")
                .build());

        // 29. Yes Bank FASTag — Biller ID: YESB00000NATOM, Param: "Vehicle Number" (6-10)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("YESB00000NATOM")
                .billerName("Yes Bank FASTag")
                .bankName("Yes Bank")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Number", 6, 10),
                        mobileParam()
                ))
                .description("Yes Bank NETC FASTag Recharge")
                .build());

        // 30. AU Small Finance Bank FASTag — Biller ID: AUBA00000NATOF, Param: "Vehicle Registration Number" (4-20)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("AUBA00000NATOF")
                .billerName("AU Small Finance Bank FASTag")
                .bankName("AU Small Finance Bank")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Registration Number", 4, 20),
                        mobileParam()
                ))
                .description("AU Small Finance Bank FASTag")
                .build());

        // 31. LivQuik / EROUTE FASTag — Biller ID: LIVQ00000MAHMZ, Param: "Vehicle Number" (6-22)
        add(BbpsDtos.FastagBillerInfo.builder()
                .billerId("LIVQ00000MAHMZ")
                .billerName("LivQuik / EROUTE FASTag")
                .bankName("LivQuik Technology (EROUTE)")
                .category("FASTag")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .billerAdhoc(true)
                .minAmount(BigDecimal.valueOf(100))
                .maxAmount(BigDecimal.valueOf(100000))
                .inputParams(List.of(
                        vehicleParam("Vehicle Number", 6, 22),
                        mobileParam()
                ))
                .description("LivQuik / EROUTE Prepaid NETC FASTag")
                .build());
    }
}
