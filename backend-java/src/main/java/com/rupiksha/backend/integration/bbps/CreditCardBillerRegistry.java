package com.rupiksha.backend.integration.bbps;

import com.rupiksha.backend.api.dto.BbpsDtos;
import com.rupiksha.backend.integration.bbps.dto.BillAvenueDtos;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Official registry of Bharat Connect / BillAvenue Credit Card Issuers.
 * Contains all 38 verified Indian Credit Card Billers with exact NPCI 14-character Biller IDs.
 *
 * Per BillAvenue API doc (Section Page 23):
 *   - Payment modes disabled for Credit Card: Credit Card, Wallet, Prepaid Card.
 *   - Use Cash payment mode with initChannel=AGT and paymentAccountInfo="Cash Payment".
 *   - billerFetchRequirement is typically MANDATORY for credit card billers.
 *   - Security: Only the last 4 digits of the card number are persisted. Full PAN and CVV are never stored.
 */
@Component
public class CreditCardBillerRegistry {

    private final List<BbpsDtos.CreditCardBillerInfo> billers = new CopyOnWriteArrayList<>();
    private final Map<String, BbpsDtos.CreditCardBillerInfo> billerMap = new ConcurrentHashMap<>();

    public CreditCardBillerRegistry() {
        initBillers();
    }

    private void add(BbpsDtos.CreditCardBillerInfo biller) {
        String key = biller.getBillerId().toUpperCase();
        if (billerMap.containsKey(key)) {
            return; // Enforce zero duplicates
        }
        billers.add(biller);
        billerMap.put(key, biller);
    }

    private BbpsDtos.InputParamInfo cardNumberParam() {
        return BbpsDtos.InputParamInfo.builder()
                .paramName("Credit Card Number")
                .dataType("NUMERIC")
                .optional(false)
                .minLength(15)
                .maxLength(19)
                .hint("Enter 15 to 19-digit credit card number")
                .build();
    }

    private BbpsDtos.InputParamInfo mobileParam() {
        return BbpsDtos.InputParamInfo.builder()
                .paramName("Mobile Number")
                .dataType("NUMERIC")
                .optional(false)
                .minLength(10)
                .maxLength(10)
                .hint("10-digit registered mobile number")
                .build();
    }

    private void initBillers() {
        // 1. AU Bank Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("AUBA00000NAT3Q")
                .billerName("AU Bank Credit Card")
                .issuer("AU Small Finance Bank")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay AU Small Finance Bank Zenith, Vetta, Altura and LIT Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 2. Axis Bank Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("AXIS00000NATKF")
                .billerName("Axis Bank Credit Card")
                .issuer("Axis Bank")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay Axis Bank Magnus, Flipkart, Neo, SELECT, and Vistara Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 3. Bandhan Bank Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("BAND00010NATWS")
                .billerName("Bandhan Bank Credit Card")
                .issuer("Bandhan Bank")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay Bandhan Bank One, Standard Chartered co-brand, and Elite Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 4. BoB Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("BANK00000NATKB")
                .billerName("BoB Credit Card")
                .issuer("Bank of Baroda")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay Bank of Baroda Eterna, Premier, Select, and Easy Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 5. Bank of India Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("BANK00026NATRG")
                .billerName("Bank of India Credit Card")
                .issuer("Bank of India")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay Bank of India India Card, RuPay Platinum, and Visa Gold Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 6. Canara Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("CANA00000NATDO")
                .billerName("Canara Credit Card")
                .issuer("Canara Bank")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay Canara Bank Visa, MasterCard, and RuPay Select Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 7. CSB One Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("CSBO00026NATWL")
                .billerName("CSB One Credit Card")
                .issuer("CSB Bank")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay CSB Bank OneCard Metal and Visa Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 8. CUB Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("CUBC00000NATGR")
                .billerName("CUB Credit Card")
                .issuer("City Union Bank")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay City Union Bank Dhi CUB Visa and RuPay Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 9. DBS Bank Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("DBSB00000NATPR")
                .billerName("DBS Bank Credit Card")
                .issuer("DBS Bank India")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay DBS Bank Spark, Vantage, and Bajaj Finserv DBS 5X/10X Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 10. DCB Bank Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("DCBB00017NATCL")
                .billerName("DCB Bank Credit Card")
                .issuer("DCB Bank")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay DCB Bank PayLess and Secured Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 11. Dhanlaxmi Bank Limited
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("DHAN00000NAT6X")
                .billerName("Dhanlaxmi Bank Limited")
                .issuer("Dhanlaxmi Bank")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay Dhanlaxmi Bank Platinum and Gold Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 12. Edge CSB Bank RuPay Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("EDGE00000NATWS")
                .billerName("Edge CSB Bank RuPay Credit Card")
                .issuer("CSB Bank / Edge")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay Edge CSB Bank RuPay UPI Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 13. ESAF Bank Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("ESAF00000NATPB")
                .billerName("ESAF Bank Credit Card")
                .issuer("ESAF Small Finance Bank")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay ESAF Small Finance Bank RuPay Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 14. Federal Bank Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("FEDE00000NATDL")
                .billerName("Federal Bank Credit Card")
                .issuer("Federal Bank")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay Federal Bank Celesta, Imperio, Signet, and Scapia Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 15. HDFC Bank Pixel Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("HDFC00000NATBH")
                .billerName("HDFC Bank Pixel Credit Card")
                .issuer("HDFC Bank")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay HDFC Bank PIXEL Play and PIXEL Go Digital Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 16. HDFC Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("HDFC00000NATW1")
                .billerName("HDFC Credit Card")
                .issuer("HDFC Bank")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay HDFC Bank Regalia, Millennia, Infinia, Tata Neu, and MoneyBack Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 17. HSBC Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("HSBC00000NAT4M")
                .billerName("HSBC Credit Card")
                .issuer("HSBC India")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay HSBC Cashback, Premier, and Live+ Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 18. ICICI Credit card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("ICIC00000NATSI")
                .billerName("ICICI Credit card")
                .issuer("ICICI Bank")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay ICICI Bank Amazon Pay, Coral, Rubyx, Sapphiro, and Emeralde Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 19. IDBI Bank Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("IDBI00000NAT7G")
                .billerName("IDBI Bank Credit Card")
                .issuer("IDBI Bank")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay IDBI Bank Euphoria, Royale, and Aspire Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 20. IDFC FIRST Bank Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("IDFC00000NATFQ")
                .billerName("IDFC FIRST Bank Credit Card")
                .issuer("IDFC FIRST Bank")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay IDFC FIRST Bank Classic, Select, Wealth, Millennia, and WOW Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 21. Indian Bank One Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("INDI00000NAT8I")
                .billerName("Indian Bank One Credit Card")
                .issuer("Indian Bank")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay Indian Bank OneCard Co-branded Metal Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 22. Indian bank credit card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("INDI00000NATFA")
                .billerName("Indian bank credit card")
                .issuer("Indian Bank")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay Indian Bank Bharat, Classic, Gold, and Platinum Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 23. IndusInd Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("INDU00000NATL1")
                .billerName("IndusInd Credit Card")
                .issuer("IndusInd Bank")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay IndusInd Bank Legend, Nexxt, Platinum, Club Vistara, and EazyDiner Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 24. IOB Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("IOBC00000NATI3")
                .billerName("IOB Credit Card")
                .issuer("Indian Overseas Bank")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay Indian Overseas Bank Visa Classic, Gold, and Platinum Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 25. J And K Bank Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("JAND00020NAT9D")
                .billerName("J And K Bank Credit Card")
                .issuer("Jammu & Kashmir Bank")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay Jammu & Kashmir Bank Blue, Silver, and Gold Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 26. Kotak Mahindra Bank Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("KOTA00000NATED")
                .billerName("Kotak Mahindra Bank Credit Card")
                .issuer("Kotak Mahindra Bank")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay Kotak Mahindra Bank White, Zen, League, Mojo, and Royale Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 27. BOBCARD One Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("ONEB00000NATS1")
                .billerName("BOBCARD One Credit Card")
                .issuer("BOBCARD / OneCard")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay BOBCARD OneCard Metal and RuPay Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 28. Punjab National Bank Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("PUNJ00000NATEY")
                .billerName("Punjab National Bank Credit Card")
                .issuer("Punjab National Bank")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay PNB RuPay Platinum, Select, and Visa Gold Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 29. RBL Bank Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("RBLB00000NATN3")
                .billerName("RBL Bank Credit Card")
                .issuer("RBL Bank")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay RBL Bank ShopRite, World Safari, Cookies, and Bajaj Finserv RBL SuperCard bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 30. Saraswat Co-Operative Bank Ltd
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("SARA00000NAT16")
                .billerName("Saraswat Co-Operative Bank Ltd")
                .issuer("Saraswat Co-Operative Bank")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay Saraswat Co-Operative Bank Platinum and Classic Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 31. SBI Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("SBIC00000NATDN")
                .billerName("SBI Card")
                .issuer("State Bank of India")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay SBI SimplyCLICK, SimplySAVE, PRIME, Elite, Aurum, and Cashback Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 32. SBM Bank India Limited
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("SBMB00000NATX5")
                .billerName("SBM Bank India Limited")
                .issuer("SBM Bank India")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay SBM Bank India OneCard, Credilio, and Secured Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 33. SLICE Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("SLIC00016NAT9L")
                .billerName("SLICE Credit Card")
                .issuer("Slice")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay SLICE RuPay and North East Small Finance Bank Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 34. SIB One Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("SOUT00000NAT68")
                .billerName("SIB One Credit Card")
                .issuer("South Indian Bank")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay South Indian Bank OneCard Metal and Visa Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 35. Suryoday Small Finance Bank Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("SURY00000NATNX")
                .billerName("Suryoday Small Finance Bank Credit Card")
                .issuer("Suryoday Small Finance Bank")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay Suryoday Small Finance Bank RuPay Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 36. Tamilnad Mercantile Bank Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("TAMI00027NAT9C")
                .billerName("Tamilnad Mercantile Bank Credit Card")
                .issuer("Tamilnad Mercantile Bank")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay Tamilnad Mercantile Bank Visa and RuPay Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 37. Union Bank of India Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("UNIO00000NATG9")
                .billerName("Union Bank of India Credit Card")
                .issuer("Union Bank of India")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay Union Bank of India RuPay Select, Platinum, and Visa Signature Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());

        // 38. Yes Bank Credit Card
        add(BbpsDtos.CreditCardBillerInfo.builder()
                .billerId("YESB00000NAT8U")
                .billerName("Yes Bank Credit Card")
                .issuer("Yes Bank")
                .billerFetchRequirement("MANDATORY")
                .billerPaymentExactness("Exact and above")
                .supportBillValidation("OPTIONAL")
                .description("Pay Yes Bank Marquee, Reserv, ACE, BYOC, and Prosperity Credit Card bills")
                .inputParams(List.of(cardNumberParam(), mobileParam()))
                .build());
    }

    /**
     * Returns all registered credit card issuers, optionally filtered by a case-insensitive search string.
     */
    public List<BbpsDtos.CreditCardBillerInfo> getAllBillers(String searchFilter) {
        if (searchFilter == null || searchFilter.isBlank()) {
            return Collections.unmodifiableList(billers);
        }
        String clean = searchFilter.trim().toLowerCase();
        List<BbpsDtos.CreditCardBillerInfo> direct = billers.stream()
                .filter(b -> (b.getBillerName() != null && b.getBillerName().toLowerCase().contains(clean))
                        || (b.getIssuer() != null && b.getIssuer().toLowerCase().contains(clean))
                        || (b.getBillerId() != null && b.getBillerId().toLowerCase().contains(clean))
                        || (b.getDescription() != null && b.getDescription().toLowerCase().contains(clean)))
                .toList();
        if (!direct.isEmpty()) return direct;

        // Token-based fuzzy match
        String[] tokens = clean.replaceAll("[^a-z0-9]", " ").split("\\s+");
        List<String> validTokens = Arrays.stream(tokens).filter(t -> t.length() >= 2).toList();
        if (!validTokens.isEmpty()) {
            return billers.stream()
                    .filter(b -> {
                        String full = ((b.getBillerName() != null ? b.getBillerName() : "") + " "
                                + (b.getIssuer() != null ? b.getIssuer() : "") + " "
                                + (b.getBillerId() != null ? b.getBillerId() : "")).toLowerCase();
                        return validTokens.stream().anyMatch(full::contains);
                    })
                    .toList();
        }
        return Collections.emptyList();
    }

    /**
     * Looks up biller by exact Bharat Connect billerId.
     * Enforces deduplication when registering on-the-fly dynamically.
     */
    public Optional<BbpsDtos.CreditCardBillerInfo> findById(String billerId) {
        if (billerId == null || billerId.isBlank()) return Optional.empty();
        String clean = billerId.trim().toUpperCase();
        BbpsDtos.CreditCardBillerInfo found = billerMap.get(clean);
        if (found != null) return Optional.of(found);

        // Dynamic on-the-fly registration for unknown valid BBPS Biller IDs with concurrency protection
        if (clean.matches("^[A-Z0-9]{14}$")) {
            synchronized (this) {
                if (billerMap.containsKey(clean)) {
                    return Optional.of(billerMap.get(clean));
                }
                BbpsDtos.CreditCardBillerInfo dynamic = BbpsDtos.CreditCardBillerInfo.builder()
                        .billerId(clean)
                        .billerName("Credit Card Issuer (" + clean + ")")
                        .issuer("Unknown Issuer")
                        .billerFetchRequirement("MANDATORY")
                        .billerPaymentExactness("Exact and above")
                        .supportBillValidation("OPTIONAL")
                        .description("Bharat Connect registered credit card biller")
                        .inputParams(List.of(cardNumberParam(), mobileParam()))
                        .build();
                billerMap.put(clean, dynamic);
                billers.add(dynamic);
                return Optional.of(dynamic);
            }
        }
        return Optional.empty();
    }

    public void validateCustomerParams(BbpsDtos.CreditCardBillerInfo biller, Map<String, String> params) {
        if (biller == null || biller.getInputParams() == null) return;
        List<String> errors = new ArrayList<>();
        for (BbpsDtos.InputParamInfo param : biller.getInputParams()) {
            String val = params != null ? (params.get(param.getParamName()) != null ? params.get(param.getParamName()).trim() : "") : "";
            // Strip spaces for card number check
            if (param.getParamName().toLowerCase().contains("card") && param.getParamName().toLowerCase().contains("number")) {
                val = val.replaceAll("\\D", "");
            }
            if (!param.isOptional() && val.isEmpty()) {
                errors.add(param.getParamName() + " is required");
            } else if (!val.isEmpty()) {
                if (param.getMinLength() > 0 && val.length() < param.getMinLength()) {
                    errors.add(param.getParamName() + " must be at least " + param.getMinLength() + " digits");
                }
                if (param.getMaxLength() > 0 && val.length() > param.getMaxLength()) {
                    errors.add(param.getParamName() + " cannot exceed " + param.getMaxLength() + " digits");
                }
            }
        }
        if (!errors.isEmpty()) {
            throw new IllegalArgumentException("Credit card validation failed: " + String.join(", ", errors));
        }
    }

    /**
     * Extracts the last 4 digits from the card number in customerParams for safe storage.
     * SECURITY: Only last 4 digits are persisted — never CVV, expiry, or full PAN.
     */
    public String extractCardLastFour(Map<String, String> params) {
        if (params == null) return null;
        for (Map.Entry<String, String> entry : params.entrySet()) {
            String key = entry.getKey().toLowerCase();
            String val = entry.getValue();
            if (val != null && !val.isBlank() && key.contains("card") && key.contains("number")) {
                String digits = val.replaceAll("\\D", "");
                if (digits.length() >= 4) {
                    return digits.substring(digits.length() - 4);
                }
            }
        }
        return null;
    }

    /**
     * Builds BillAvenue InputParam list from customer params for Credit Card bill fetch/pay.
     * Credit Card billers accept: Credit Card Number, Mobile Number as primary identifiers.
     */
    public List<BillAvenueDtos.InputParam> buildCreditCardInputParams(BbpsDtos.CreditCardBillerInfo biller, Map<String, String> params, String customerMobile) {
        List<BillAvenueDtos.InputParam> inputs = new ArrayList<>();
        if (params == null || params.isEmpty()) {
            inputs.add(BillAvenueDtos.InputParam.builder().paramName("Mobile Number").paramValue(customerMobile != null ? customerMobile.trim() : "").build());
            return inputs;
        }
        if (biller.getInputParams() != null) {
            for (BbpsDtos.InputParamInfo paramInfo : biller.getInputParams()) {
                String val = params.get(paramInfo.getParamName());
                if (val != null && !val.isBlank()) {
                    String cleanVal = paramInfo.getParamName().toLowerCase().contains("card")
                            ? val.replaceAll("\\D", "")
                            : val.trim();
                    inputs.add(BillAvenueDtos.InputParam.builder()
                            .paramName(paramInfo.getParamName())
                            .paramValue(cleanVal)
                            .build());
                }
            }
        } else {
            for (Map.Entry<String, String> entry : params.entrySet()) {
                if (entry.getValue() != null && !entry.getValue().isBlank()) {
                    inputs.add(BillAvenueDtos.InputParam.builder()
                            .paramName(entry.getKey().trim())
                            .paramValue(entry.getValue().trim())
                            .build());
                }
            }
        }
        // Ensure mobile is included
        boolean hasMobile = inputs.stream().anyMatch(i -> "Mobile Number".equalsIgnoreCase(i.getParamName()));
        if (!hasMobile && customerMobile != null && !customerMobile.isBlank()) {
            inputs.add(BillAvenueDtos.InputParam.builder().paramName("Mobile Number").paramValue(customerMobile.trim()).build());
        }
        return inputs;
    }
}
