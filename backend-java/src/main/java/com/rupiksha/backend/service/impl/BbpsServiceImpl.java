package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.BbpsDtos;
import com.rupiksha.backend.api.dto.WalletDtos;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.integration.bbps.BillAvenueClient;
import com.rupiksha.backend.integration.bbps.BillAvenueTimeoutException;
import com.rupiksha.backend.integration.bbps.dto.BillAvenueDtos;
import com.rupiksha.backend.integration.bbps.util.BillAvenueCryptoUtil;
import com.rupiksha.backend.repository.BbpsTransactionRepository;
import com.rupiksha.backend.repository.TxnRepository;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.repository.UserServiceRepository;
import com.rupiksha.backend.service.BbpsService;
import com.rupiksha.backend.integration.bbps.ElectricityBillerRegistry;
import com.rupiksha.backend.service.WalletService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class BbpsServiceImpl implements BbpsService {

    private final BillAvenueClient billAvenueClient;
    private final BbpsTransactionRepository bbpsTransactionRepository;
    private final TxnRepository txnRepository;
    private final UserRepository userRepository;
    private final UserServiceRepository userServiceRepository;
    private final WalletService walletService;
    private final ElectricityBillerRegistry electricityBillerRegistry;
    private final ObjectMapper objectMapper;

    @org.springframework.beans.factory.annotation.Value("${billavenue.biller.jio:BILAVJIO000001}")
    private String billerJio;

    @org.springframework.beans.factory.annotation.Value("${billavenue.biller.airtel:BILAVAIRTEL001}")
    private String billerAirtel;

    @org.springframework.beans.factory.annotation.Value("${billavenue.biller.vi:VODA00000NAT01}")
    private String billerVi;

    @org.springframework.beans.factory.annotation.Value("${billavenue.biller.bsnl:BSNL00000NATHL}")
    private String billerBsnl;

    @org.springframework.beans.factory.annotation.Value("${billavenue.biller.mtnl:MTNL00000DEL01}")
    private String billerMtnl;

    public String resolveBillAvenueBillerId(String billerId) {
        if (billerId == null || billerId.isBlank()) return billerAirtel != null ? billerAirtel : "BILAVAIRTEL001";
        String upper = billerId.trim().toUpperCase();
        if (upper.contains("JIO")) {
            if (billerJio != null && !billerJio.isBlank() && billerJio.trim().length() == 14) {
                return billerJio.trim();
            }
            return "BILAVJIO000001";
        }
        if (upper.contains("AIRTEL")) {
            if (billerAirtel != null && !billerAirtel.isBlank() && billerAirtel.trim().length() == 14) {
                return billerAirtel.trim();
            }
            return "BILAVAIRTEL001";
        }
        if (upper.contains("VI") || upper.contains("VODA")) {
            if (billerVi != null && !billerVi.isBlank() && billerVi.trim().length() == 14) {
                return billerVi.trim();
            }
            return "VODA00000NAT01";
        }
        if (upper.contains("BSNL")) {
            if (billerBsnl != null && !billerBsnl.isBlank() && billerBsnl.trim().length() == 14) {
                return billerBsnl.trim();
            }
            return "BSNL00000NATHL";
        }
        if (upper.contains("MTNL")) {
            if (billerMtnl != null && !billerMtnl.isBlank() && billerMtnl.trim().length() == 14) {
                return billerMtnl.trim();
            }
            return "MTNL00000DEL01";
        }
        return billerId.trim();
    }

    private String cleanCircle(String circle) {
        if (circle == null || circle.isBlank()) return null;
        String trimmed = circle.trim();
        if (trimmed.length() > 20) {
            trimmed = trimmed.substring(0, 20).trim();
        }
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static final List<String> ALL_CIRCLES = List.of(
            "Delhi & NCR", "Mumbai", "Maharashtra & Goa", "Gujarat", "Uttar Pradesh (East)",
            "Uttar Pradesh (West)", "Bihar & Jharkhand", "West Bengal", "Kolkata", "Rajasthan",
            "Punjab", "Haryana", "Madhya Pradesh & Chhattisgarh", "Karnataka", "Tamil Nadu",
            "Chennai", "Andhra Pradesh & Telangana", "Kerala", "Assam", "North East", "Odisha",
            "Jammu & Kashmir", "Himachal Pradesh"
    );

    @Override
    public List<BbpsDtos.OperatorInfo> getMobilePrepaidOperators() {
        return List.of(
                BbpsDtos.OperatorInfo.builder()
                        .billerId("BILAVAIRTEL001")
                        .operatorName("Airtel")
                        .operatorAlias("Airtel Prepaid")
                        .category("Mobile Prepaid")
                        .billerFetchRequirement("NOT_SUPPORTED")
                        .supportBillValidation("OPTIONAL")
                        .supportedCircles(ALL_CIRCLES)
                        .inputParams(List.of(
                                BbpsDtos.InputParamInfo.builder().paramName("Mobile Number").dataType("NUMERIC").optional(false).minLength(10).maxLength(10).build(),
                                BbpsDtos.InputParamInfo.builder().paramName("Location").dataType("ALPHANUMERIC").optional(false).minLength(2).maxLength(50).build()
                        ))
                        .build(),
                BbpsDtos.OperatorInfo.builder()
                        .billerId("BILAVJIO000001")
                        .operatorName("Jio")
                        .operatorAlias("Reliance Jio Prepaid")
                        .category("Mobile Prepaid")
                        .billerFetchRequirement("NOT_SUPPORTED")
                        .supportBillValidation("OPTIONAL")
                        .supportedCircles(ALL_CIRCLES)
                        .inputParams(List.of(
                                BbpsDtos.InputParamInfo.builder().paramName("Mobile Number").dataType("NUMERIC").optional(false).minLength(10).maxLength(10).build(),
                                BbpsDtos.InputParamInfo.builder().paramName("Location").dataType("ALPHANUMERIC").optional(false).minLength(2).maxLength(50).build()
                        ))
                        .build(),
                BbpsDtos.OperatorInfo.builder()
                        .billerId("BILAVVI0000001")
                        .operatorName("Vi")
                        .operatorAlias("Vodafone Idea Prepaid")
                        .category("Mobile Prepaid")
                        .billerFetchRequirement("NOT_SUPPORTED")
                        .supportBillValidation("OPTIONAL")
                        .supportedCircles(ALL_CIRCLES)
                        .inputParams(List.of(
                                BbpsDtos.InputParamInfo.builder().paramName("Mobile Number").dataType("NUMERIC").optional(false).minLength(10).maxLength(10).build(),
                                BbpsDtos.InputParamInfo.builder().paramName("Location").dataType("ALPHANUMERIC").optional(false).minLength(2).maxLength(50).build()
                        ))
                        .build(),
                BbpsDtos.OperatorInfo.builder()
                        .billerId("BILAVBSNL00001")
                        .operatorName("BSNL")
                        .operatorAlias("BSNL Prepaid")
                        .category("Mobile Prepaid")
                        .billerFetchRequirement("NOT_SUPPORTED")
                        .supportBillValidation("OPTIONAL")
                        .supportedCircles(ALL_CIRCLES)
                        .inputParams(List.of(
                                BbpsDtos.InputParamInfo.builder().paramName("Mobile Number").dataType("NUMERIC").optional(false).minLength(10).maxLength(10).build(),
                                BbpsDtos.InputParamInfo.builder().paramName("Location").dataType("ALPHANUMERIC").optional(false).minLength(2).maxLength(50).build()
                        ))
                        .build(),
                BbpsDtos.OperatorInfo.builder()
                        .billerId("BILAVMTNL00001")
                        .operatorName("MTNL")
                        .operatorAlias("MTNL Prepaid")
                        .category("Mobile Prepaid")
                        .billerFetchRequirement("NOT_SUPPORTED")
                        .supportBillValidation("OPTIONAL")
                        .supportedCircles(List.of("Delhi & NCR", "Mumbai"))
                        .inputParams(List.of(
                                BbpsDtos.InputParamInfo.builder().paramName("Mobile Number").dataType("NUMERIC").optional(false).minLength(10).maxLength(10).build(),
                                BbpsDtos.InputParamInfo.builder().paramName("Location").dataType("ALPHANUMERIC").optional(false).minLength(2).maxLength(50).build()
                        ))
                        .build()
        );
    }

    @Override
    public List<BbpsDtos.PlanInfo> getRechargePlans(String billerId, String circle) {
        // Try live Plan Pull API from BillAvenue first
        try {
            BillAvenueDtos.PlanPullResponse livePlans = billAvenueClient.pullPlans(billerId);
            if (livePlans != null && livePlans.getPlanDetails() != null && !livePlans.getPlanDetails().isEmpty()) {
                List<BbpsDtos.PlanInfo> result = new ArrayList<>();
                for (BillAvenueDtos.PlanDetail detail : livePlans.getPlanDetails()) {
                    if ("ACTIVE".equalsIgnoreCase(detail.getStatus())) {
                        String validity = "NA";
                        if (detail.getPlanAddnlInfo() != null && detail.getPlanAddnlInfo().getParamTag() != null) {
                            for (BillAvenueDtos.ParamTag tag : detail.getPlanAddnlInfo().getParamTag()) {
                                if ("Plan duration".equalsIgnoreCase(tag.getParamName())) {
                                    validity = tag.getParamValue();
                                }
                            }
                        }
                        result.add(BbpsDtos.PlanInfo.builder()
                                .planId(detail.getPlanId())
                                .billerId(detail.getBillerId())
                                .categoryType(detail.getCategoryType() != null ? detail.getCategoryType() : "Popular")
                                .categorySubType(detail.getCategorySubType())
                                .amount(BigDecimal.valueOf(detail.getAmountInRupees()))
                                .validity(validity)
                                .description(detail.getPlanDesc())
                                .build());
                    }
                }
                if (!result.isEmpty()) {
                    return result;
                }
            }
        } catch (Exception e) {
            log.warn("Live plan pull returned exception: {}. Serving verified catalog plans.", e.getMessage());
        }

        // Return verified operator plans curated for the operator/circle
        return getCuratedPlans(billerId);
    }

    @Override
    @Transactional
    public BbpsDtos.RechargeResponse recharge(UUID userId, BbpsDtos.RechargeRequest request, String clientIp) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // 1. Verify service permission in user_services
        boolean isServiceEnabled = userServiceRepository.findByUserIdAndServiceType(userId, ServiceType.BBPS)
                .map(UserService::getIsEnabled)
                .orElse(true);

        if (!isServiceEnabled) {
            log.warn("BBPS service disabled for user: {}", userId);
            throw new IllegalStateException("BBPS service is disabled for your account by administrator");
        }

        // 2. Validate input
        if (request.getMobileNumber() == null || !request.getMobileNumber().matches("^[6-9]\\d{9}$")) {
            throw new IllegalArgumentException("Valid 10-digit Indian mobile number starting with 6-9 is required");
        }
        if (request.getAmount() == null || request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Recharge amount must be greater than zero");
        }

        // 3. Server-enforced Idempotency check
        String idempotencyKey = request.getIdempotencyKey();
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            idempotencyKey = "BBPS-IDEM-" + UUID.randomUUID();
        }

        Optional<BbpsTransaction> existingOpt = bbpsTransactionRepository.findByIdempotencyKey(idempotencyKey);
        if (existingOpt.isPresent()) {
            BbpsTransaction existing = existingOpt.get();
            log.info("Idempotent request duplicate detected for key: {}. Returning existing status: {}",
                    idempotencyKey, existing.getStatus());

            WalletDtos.WalletBalanceResponse currentBal = walletService.getBalance(userId.toString());
            return BbpsDtos.RechargeResponse.builder()
                    .success("SUCCESS".equals(existing.getStatus()))
                    .transactionId(existing.getId().toString())
                    .merchantRefNo(existing.getMerchantRefNo())
                    .providerTxnId(existing.getProviderTxnId())
                    .approvalRefNo(existing.getApprovalRefNo())
                    .status(existing.getStatus())
                    .amount(existing.getAmount())
                    .mobileNumber(existing.getMobileNumber())
                    .billerName(existing.getBillerName())
                    .circle(existing.getCircle())
                    .message(existing.getProviderMessage() != null ? existing.getProviderMessage() : "Existing transaction returned")
                    .walletBalance(currentBal.balance())
                    .createdAt(existing.getCreatedAt())
                    .build();
        }

        // 4. Authoritative backend wallet balance enforcement
        WalletDtos.WalletBalanceResponse balanceResponse = walletService.getBalance(userId.toString());
        BigDecimal availableBalance = balanceResponse.availableBalance() != null ? balanceResponse.availableBalance() : BigDecimal.ZERO;
        if (availableBalance.compareTo(request.getAmount()) < 0) {
            log.warn("Insufficient wallet balance for user {}. Required: {}, Available: {}",
                    userId, request.getAmount(), availableBalance);
            throw new IllegalStateException("Insufficient wallet balance. Available: ₹" + availableBalance + ", Required: ₹" + request.getAmount());
        }

        // 5. Generate unique references
        String requestId = BillAvenueCryptoUtil.generateRequestId();
        String merchantRefNo = "BBPS-MP-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        String billerName = resolveBillerName(request.getBillerId());

        // 6. Persist Core Txn and BbpsTransaction in INITIATED state
        Txn txn = new Txn();
        txn.setUser(user);
        txn.setAmount(request.getAmount());
        txn.setServiceType("BBPS_MOBILE_PREPAID");
        txn.setStatus(TransactionStatus.INITIATED);
        txn.setIdempotencyKey(idempotencyKey);
        txn = txnRepository.save(txn);

        BbpsTransaction bbpsTxn = new BbpsTransaction();
        bbpsTxn.setUser(user);
        bbpsTxn.setTxn(txn);
        bbpsTxn.setIdempotencyKey(idempotencyKey);
        bbpsTxn.setRequestId(requestId);
        bbpsTxn.setMerchantRefNo(merchantRefNo);
        bbpsTxn.setCategory("Mobile Prepaid");
        bbpsTxn.setBillerId(request.getBillerId());
        bbpsTxn.setBillerName(billerName);
        bbpsTxn.setCircle(request.getCircle());
        bbpsTxn.setMobileNumber(request.getMobileNumber());
        bbpsTxn.setPlanId(request.getPlanId());
        bbpsTxn.setPlanDescription(request.getPlanDescription());
        bbpsTxn.setAmount(request.getAmount());
        bbpsTxn.setStatus("INITIATED");
        bbpsTxn = bbpsTransactionRepository.save(bbpsTxn);

        // 7. Atomically debit wallet using ledger-safe service debit
        String debitRef = txn.getId().toString();
        try {
            WalletDtos.WalletBalanceResponse debitRes = walletService.debitForService(
                    userId,
                    request.getAmount(),
                    "BBPS Mobile Recharge - " + billerName + " (" + request.getMobileNumber() + ")",
                    WalletTransactionContext.BBPS_PAYMENT,
                    "BBPS",
                    clientIp != null ? clientIp : "127.0.0.1",
                    debitRef
            );
            bbpsTxn.setWalletDebitRef(debitRef);
            bbpsTxn = bbpsTransactionRepository.save(bbpsTxn);
        } catch (Exception e) {
            log.error("Failed to debit wallet for BBPS recharge. MerchantRef: {}", merchantRefNo, e);
            txn.setStatus(TransactionStatus.FAILED);
            txnRepository.save(txn);

            bbpsTxn.setStatus("FAILED");
            bbpsTxn.setProviderMessage("Wallet debit failed: " + e.getMessage());
            bbpsTransactionRepository.save(bbpsTxn);

            throw new IllegalStateException("Wallet debit failed: " + e.getMessage());
        }

        // 8. Submit provider request to BillAvenue
        // IMPORTANT: BillAvenue expects amount in PAISE per Section 4.3 (Page 39) & Section 3.0 (Page 7) of the API doc.
        long paise = request.getAmount().multiply(BigDecimal.valueOf(100)).longValue();
        String amountInPaise = String.valueOf(paise);
        String resolvedBillerId = resolveBillAvenueBillerId(request.getBillerId());

        String mode = billAvenueClient.getPaymentMode();
        if (mode == null || mode.isBlank()) {
            mode = "Cash";
        }

        String initChannel = billAvenueClient.getInitChannel();
        if (initChannel == null || initChannel.isBlank()) {
            initChannel = "AGT";
        }

        // Align channel and payment mode per BillAvenue Section 5.0 / 6.0 & Page 23 Remitter Info rules:
        // AGT channel is for agents/retailers (Agent ID CC01BP66AGTU00000001) and supports Cash.
        // For Cash, Payment Account Info MUST be "Cash Payment" per Page 23 table.
        // For Wallet, initChannel is INT, Payment Account Info is "Paytm|" + senderMobile.
        // For UPI, initChannel is INT, Payment Account Info is senderMobile + "@upi".
        String paymentAccountInfo;
        String senderMobile = (user.getMobile() != null && !user.getMobile().isBlank()) ? user.getMobile().trim() : request.getMobileNumber().trim();

        if ("Cash".equalsIgnoreCase(mode)) {
            initChannel = "AGT";
            mode = "Cash";
            paymentAccountInfo = "Cash Payment";
        } else if ("Wallet".equalsIgnoreCase(mode)) {
            initChannel = "INT";
            paymentAccountInfo = "Paytm|" + senderMobile;
        } else if ("UPI".equalsIgnoreCase(mode)) {
            initChannel = "INT";
            paymentAccountInfo = senderMobile.contains("@") ? senderMobile : (senderMobile + "@upi");
        } else {
            // Default to Cash for AGT agent
            mode = "Cash";
            initChannel = "AGT";
            paymentAccountInfo = "Cash Payment";
        }

        // Sanitize client IP: must be IPv4 between 7 and 15 chars per Page 35 (<ip> tag validation)
        String sanitizedIp = (clientIp != null && clientIp.matches("^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$"))
                ? clientIp
                : "103.108.7.127";

        List<BillAvenueDtos.InputParam> inputs = new ArrayList<>();
        inputs.add(BillAvenueDtos.InputParam.builder().paramName("Mobile Number").paramValue(request.getMobileNumber().trim()).build());
        // Location is ONLY accepted/configured for Airtel (BILAVAIRTEL001).
        // Passing Location for Jio (BILAVJIO000001), Vi (VODA00000NAT01), BSNL, etc. causes BillAvenue to return:
        // "Invalid parameter combination or missing input parameter (Code: 202)".
        if ("BILAVAIRTEL001".equalsIgnoreCase(resolvedBillerId)) {
            String loc = cleanCircle(request.getCircle());
            if (loc != null && !loc.isBlank()) {
                inputs.add(BillAvenueDtos.InputParam.builder().paramName("Location").paramValue(loc).build());
            }
        }

        // Step 1: Best-effort BillFetch per BillAvenue mobile recharge integration (Section 3 of PHP reference)
        BillAvenueDtos.BillFetchResponse fetchResp = null;
        try {
            fetchResp = billAvenueClient.fetchBill(resolvedBillerId, inputs, request.getMobileNumber().trim(), sanitizedIp);
            if (fetchResp != null) {
                log.info("BillFetch response for biller: {}, code: {}, reason: {}",
                        resolvedBillerId, fetchResp.getResponseCode(), fetchResp.getResponseReason());
            }
        } catch (Exception e) {
            log.warn("BillFetch for prepaid biller {} had exception (proceeding to pay): {}", resolvedBillerId, e.getMessage());
        }

        String effectiveRequestId = (fetchResp != null && fetchResp.isSuccess() && fetchResp.getFetchRequestId() != null && !fetchResp.getFetchRequestId().isBlank())
                ? fetchResp.getFetchRequestId()
                : requestId;
        long billerRespPaise = (fetchResp != null && fetchResp.isSuccess() && fetchResp.getBillAmountPaise() > 0)
                ? fetchResp.getBillAmountPaise()
                : paise;
        String billDate = (fetchResp != null && fetchResp.isSuccess()) ? fetchResp.getBillDate() : null;
        String billNumber = (fetchResp != null && fetchResp.isSuccess()) ? fetchResp.getBillNumber() : null;
        String dueDate = (fetchResp != null && fetchResp.isSuccess()) ? fetchResp.getDueDate() : null;
        String billPeriod = (fetchResp != null && fetchResp.isSuccess() && fetchResp.getBillPeriod() != null && !fetchResp.getBillPeriod().isBlank())
                ? fetchResp.getBillPeriod()
                : "NA";
        String customerName = (fetchResp != null && fetchResp.isSuccess() && fetchResp.getCustomerName() != null && !fetchResp.getCustomerName().isBlank())
                ? fetchResp.getCustomerName()
                : (user.getFullName() != null && !user.getFullName().isBlank() ? user.getFullName().trim() : "Retailer Customer");
        List<BillAvenueDtos.InfoItem> addnlInfo = (fetchResp != null && fetchResp.isSuccess()) ? fetchResp.getAdditionalInfo() : null;

        String remitterName = (user.getFullName() != null && !user.getFullName().isBlank()) ? user.getFullName().trim() : "Rupiksha Retailer";

        // Step 2: Build XML Payment request matching the working PHP reference structure
        BillAvenueDtos.BillPayXmlRequest xmlReq = BillAvenueDtos.BillPayXmlRequest.builder()
                .fetchRequestId(effectiveRequestId)
                .billerId(resolvedBillerId)
                .customerMobile(request.getMobileNumber().trim())
                .amountPaise(paise)
                .billAmountPaise(billerRespPaise)
                .billDate(billDate)
                .billNumber(billNumber)
                .dueDate(dueDate)
                .billPeriod(billPeriod)
                .customerName(customerName)
                .additionalInfo(addnlInfo)
                .inputParams(inputs)
                .clientTxnId(merchantRefNo)
                .paymentMode(mode)
                .remitterName(remitterName)
                .remarks("Received")
                .paymentAccountInfo(paymentAccountInfo)
                .clientIp(sanitizedIp)
                .build();

        BillAvenueDtos.BillPayResponse payResp;
        try {
            payResp = billAvenueClient.payBillXml(xmlReq);
        } catch (BillAvenueTimeoutException te) {
            log.warn("BillAvenue timeout for merchantRef: {}. Keeping transaction PENDING.", merchantRefNo, te);
            txn.setStatus(TransactionStatus.PENDING);
            txnRepository.save(txn);

            bbpsTxn.setStatus("PENDING");
            bbpsTxn.setProviderMessage("Transaction processing at provider. Reconciling status.");
            bbpsTransactionRepository.save(bbpsTxn);

            WalletDtos.WalletBalanceResponse bal = walletService.getBalance(userId.toString());
            return BbpsDtos.RechargeResponse.builder()
                    .success(false)
                    .transactionId(bbpsTxn.getId().toString())
                    .merchantRefNo(merchantRefNo)
                    .status("PENDING")
                    .amount(request.getAmount())
                    .mobileNumber(request.getMobileNumber())
                    .billerName(billerName)
                    .circle(request.getCircle())
                    .message("Recharge is processing at provider network. Status will update shortly.")
                    .walletBalance(bal.balance())
                    .createdAt(bbpsTxn.getCreatedAt())
                    .build();
        } catch (Exception ex) {
            log.error("Unexpected exception calling BillAvenue. Performing safe refund. Ref: {}", merchantRefNo, ex);
            handleFailureAndRefund(userId, txn, bbpsTxn, request.getAmount(), "Provider communication error: " + ex.getMessage(), clientIp);
            WalletDtos.WalletBalanceResponse bal = walletService.getBalance(userId.toString());
            return BbpsDtos.RechargeResponse.builder()
                    .success(false)
                    .transactionId(bbpsTxn.getId().toString())
                    .merchantRefNo(merchantRefNo)
                    .status("FAILED")
                    .amount(request.getAmount())
                    .mobileNumber(request.getMobileNumber())
                    .billerName(billerName)
                    .circle(request.getCircle())
                    .message("Recharge failed: " + ex.getMessage() + ". Amount has been refunded to your wallet.")
                    .walletBalance(bal.balance())
                    .createdAt(bbpsTxn.getCreatedAt())
                    .build();
        }

        // 9. Process Provider Outcome
        if (payResp != null && payResp.isSuccess()) {
            log.info("BillAvenue recharge SUCCESS. TxnRefId: {}, ApprovalRef: {}",
                    payResp.getTxnRefId(), payResp.getApprovalRefNumber());

            txn.setStatus(TransactionStatus.SUCCESS);
            txn.setProviderRef(payResp.getTxnRefId());
            txnRepository.save(txn);

            bbpsTxn.setStatus("SUCCESS");
            bbpsTxn.setProviderTxnId(payResp.getTxnRefId());
            bbpsTxn.setApprovalRefNo(payResp.getApprovalRefNumber());
            bbpsTxn.setProviderResponseCode(payResp.getResponseCode());
            bbpsTxn.setProviderMessage("Recharge completed successfully");
            bbpsTxn.setCompletedAt(Instant.now());
            bbpsTransactionRepository.save(bbpsTxn);

            WalletDtos.WalletBalanceResponse bal = walletService.getBalance(userId.toString());
            return BbpsDtos.RechargeResponse.builder()
                    .success(true)
                    .transactionId(bbpsTxn.getId().toString())
                    .merchantRefNo(merchantRefNo)
                    .providerTxnId(payResp.getTxnRefId())
                    .approvalRefNo(payResp.getApprovalRefNumber())
                    .status("SUCCESS")
                    .amount(request.getAmount())
                    .mobileNumber(request.getMobileNumber())
                    .billerName(billerName)
                    .circle(request.getCircle())
                    .message("Mobile recharge successful!")
                    .walletBalance(bal.balance())
                    .createdAt(bbpsTxn.getCreatedAt())
                    .build();
        } else {
            String errReason = payResp != null ? payResp.getErrorMessage() : "Provider rejected recharge request";
            log.warn("BillAvenue recharge failed. Code: {}, Reason: {}. Issuing refund.",
                    payResp != null ? payResp.getResponseCode() : "NULL", errReason);

            handleFailureAndRefund(userId, txn, bbpsTxn, request.getAmount(), errReason, clientIp);

            WalletDtos.WalletBalanceResponse bal = walletService.getBalance(userId.toString());
            return BbpsDtos.RechargeResponse.builder()
                    .success(false)
                    .transactionId(bbpsTxn.getId().toString())
                    .merchantRefNo(merchantRefNo)
                    .status("FAILED")
                    .amount(request.getAmount())
                    .mobileNumber(request.getMobileNumber())
                    .billerName(billerName)
                    .circle(request.getCircle())
                    .message(errReason + ". Amount has been refunded to your wallet.")
                    .walletBalance(bal.balance())
                    .createdAt(bbpsTxn.getCreatedAt())
                    .build();
        }
    }

    private void handleFailureAndRefund(UUID userId, Txn txn, BbpsTransaction bbpsTxn, BigDecimal amount, String reason, String clientIp) {
        txn.setStatus(TransactionStatus.FAILED);
        txnRepository.save(txn);

        bbpsTxn.setStatus("FAILED");
        bbpsTxn.setProviderMessage(reason);
        bbpsTxn.setCompletedAt(Instant.now());

        // Idempotent refund via WalletService
        String refundRef = txn.getId().toString() + "-refund";
        try {
            walletService.refundForService(
                    userId,
                    amount,
                    "BBPS Recharge Failed Refund - " + bbpsTxn.getMerchantRefNo(),
                    txn.getId().toString(),
                    WalletTransactionContext.REVERSAL,
                    "BBPS",
                    clientIp != null ? clientIp : "127.0.0.1",
                    refundRef
            );
            bbpsTxn.setWalletRefundRef(refundRef);
            bbpsTxn.setStatus("REFUNDED");
        } catch (Exception re) {
            log.error("CRITICAL: Failed to issue wallet refund for transaction {}. RefundRef: {}", txn.getId(), refundRef, re);
        }
        bbpsTransactionRepository.save(bbpsTxn);
    }

    @Override
    public BbpsDtos.RechargeResponse checkStatus(UUID userId, String txnId) {
        BbpsTransaction bbpsTxn = findUserBbpsTxn(userId, txnId);
        WalletDtos.WalletBalanceResponse bal = walletService.getBalance(userId.toString());

        return BbpsDtos.RechargeResponse.builder()
                .success("SUCCESS".equals(bbpsTxn.getStatus()))
                .transactionId(bbpsTxn.getId().toString())
                .merchantRefNo(bbpsTxn.getMerchantRefNo())
                .providerTxnId(bbpsTxn.getProviderTxnId())
                .approvalRefNo(bbpsTxn.getApprovalRefNo())
                .status(bbpsTxn.getStatus())
                .amount(bbpsTxn.getAmount())
                .mobileNumber(bbpsTxn.getMobileNumber())
                .billerName(bbpsTxn.getBillerName())
                .circle(bbpsTxn.getCircle())
                .message(bbpsTxn.getProviderMessage())
                .walletBalance(bal.balance())
                .createdAt(bbpsTxn.getCreatedAt())
                .build();
    }

    @Override
    @Transactional
    public BbpsDtos.RechargeResponse reconcile(UUID userId, String txnId) {
        BbpsTransaction bbpsTxn = findUserBbpsTxn(userId, txnId);

        // If already terminal, return
        if ("SUCCESS".equals(bbpsTxn.getStatus()) || "REFUNDED".equals(bbpsTxn.getStatus())) {
            return checkStatus(userId, txnId);
        }

        log.info("Reconciling BBPS transaction {} with provider", txnId);
        String trackValue = bbpsTxn.getProviderTxnId() != null && !bbpsTxn.getProviderTxnId().isBlank()
                ? bbpsTxn.getProviderTxnId()
                : bbpsTxn.getRequestId();
        String trackType = bbpsTxn.getProviderTxnId() != null && !bbpsTxn.getProviderTxnId().isBlank()
                ? "TRANS_REF_ID"
                : "REQUEST_ID";

        BillAvenueDtos.TransactionStatusResponse statusResp = billAvenueClient.checkTransactionStatus(trackType, trackValue);

        if (statusResp != null && statusResp.getTxnList() != null && !statusResp.getTxnList().isEmpty()) {
            BillAvenueDtos.TxnStatusItem item = statusResp.getTxnList().get(0);
            String providerStatus = item.getTxnStatus();
            log.info("Provider returned status: {} for bbpsTxn: {}", providerStatus, txnId);

            Txn txn = bbpsTxn.getTxn();

            if ("SUCCESS".equalsIgnoreCase(providerStatus)) {
                if (txn != null) {
                    txn.setStatus(TransactionStatus.SUCCESS);
                    txn.setProviderRef(item.getTxnReferenceId());
                    txnRepository.save(txn);
                }
                bbpsTxn.setStatus("SUCCESS");
                bbpsTxn.setProviderTxnId(item.getTxnReferenceId());
                bbpsTxn.setApprovalRefNo(item.getApprovalRefNumber());
                bbpsTxn.setProviderMessage("Recharge confirmed successful by provider status reconciliation");
                bbpsTxn.setCompletedAt(Instant.now());
                bbpsTransactionRepository.save(bbpsTxn);
            } else if ("FAILURE".equalsIgnoreCase(providerStatus) || "FAILED".equalsIgnoreCase(providerStatus)) {
                if (txn != null) {
                    txn.setStatus(TransactionStatus.FAILED);
                    txnRepository.save(txn);
                }
                handleFailureAndRefund(userId, txn, bbpsTxn, bbpsTxn.getAmount(), "Recharge confirmed failed by provider", "127.0.0.1");
            }
        }

        return checkStatus(userId, txnId);
    }

    @Override
    public List<BbpsDtos.ElectricityBillerInfo> getElectricityBillers(String state) {
        return electricityBillerRegistry.getAllBillers(state);
    }

    @Override
    public BbpsDtos.BillFetchResult fetchElectricityBill(UUID userId, BbpsDtos.ElectricityFetchRequest request, String clientIp) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        boolean isServiceEnabled = userServiceRepository.findByUserIdAndServiceType(userId, ServiceType.BBPS)
                .map(UserService::getIsEnabled)
                .orElse(true);

        if (!isServiceEnabled) {
            log.warn("BBPS service disabled for user: {}", userId);
            throw new IllegalStateException("BBPS service is disabled for your account by administrator");
        }

        if (request.getCustomerMobile() == null || !request.getCustomerMobile().matches("^[6-9]\\d{9}$")) {
            throw new IllegalArgumentException("Valid 10-digit Indian mobile number starting with 6-9 is required");
        }

        BbpsDtos.ElectricityBillerInfo biller = electricityBillerRegistry.findById(request.getBillerId())
                .orElseThrow(() -> new IllegalArgumentException("Unknown or unmapped electricity biller: " + request.getBillerId()));

        // Validate dynamic customer parameters
        electricityBillerRegistry.validateCustomerParams(biller, request.getCustomerParams());

        // Prepare BillAvenue Input Params
        List<BillAvenueDtos.InputParam> inputs = new ArrayList<>();
        if (request.getCustomerParams() != null) {
            for (Map.Entry<String, String> entry : request.getCustomerParams().entrySet()) {
                if (entry.getValue() != null && !entry.getValue().isBlank()) {
                    inputs.add(BillAvenueDtos.InputParam.builder()
                            .paramName(entry.getKey().trim())
                            .paramValue(entry.getValue().trim())
                            .build());
                }
            }
        }

        String sanitizedIp = (clientIp != null && clientIp.matches("^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$"))
                ? clientIp : "103.108.7.127";

        try {
            BillAvenueDtos.BillFetchResponse fetchResp = billAvenueClient.fetchBill(
                    biller.getBillerId(),
                    inputs,
                    request.getCustomerMobile().trim(),
                    sanitizedIp
            );

            boolean isNoBillDue = fetchResp != null && (fetchResp.isNoBillDue() || (fetchResp.isSuccess() && fetchResp.getBillAmountPaise() == 0));

            if (fetchResp != null && (fetchResp.isSuccess() || isNoBillDue)) {
                BigDecimal billAmt = isNoBillDue
                        ? BigDecimal.ZERO
                        : BigDecimal.valueOf(fetchResp.getBillAmountPaise()).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);

                List<BbpsDtos.InfoItemDto> addnl = new ArrayList<>();
                if (fetchResp.getAdditionalInfo() != null) {
                    for (BillAvenueDtos.InfoItem item : fetchResp.getAdditionalInfo()) {
                        addnl.add(new BbpsDtos.InfoItemDto(item.getInfoName(), item.getInfoValue()));
                    }
                }

                String custName = (fetchResp.getCustomerName() != null && !fetchResp.getCustomerName().isBlank() && !"NA".equalsIgnoreCase(fetchResp.getCustomerName().trim()))
                        ? fetchResp.getCustomerName().trim()
                        : null;

                if (custName == null || custName.isBlank()) {
                    if (request.getCustomerParams() != null) {
                        for (Map.Entry<String, String> entry : request.getCustomerParams().entrySet()) {
                            if (entry.getKey() != null && entry.getValue() != null && !entry.getValue().isBlank()) {
                                String k = entry.getKey().trim().toLowerCase();
                                if (k.contains("name") && !k.contains("number") && !k.contains("id") && !k.contains("unit")) {
                                    custName = entry.getValue().trim();
                                    break;
                                }
                            }
                        }
                    }
                }

                if (custName == null || custName.isBlank()) {
                    custName = "Electricity Consumer";
                }

                String primaryConsumer = electricityBillerRegistry.extractPrimaryConsumerNumber(request.getCustomerParams());

                String message = isNoBillDue
                        ? "Payment received for the billing period - no bill due"
                        : "Bill fetched successfully";

                return BbpsDtos.BillFetchResult.builder()
                        .success(true)
                        .noBillDue(isNoBillDue)
                        .fetchRequestId(fetchResp.getFetchRequestId())
                        .billerId(biller.getBillerId())
                        .billerName(biller.getBillerName())
                        .consumerNumber(primaryConsumer)
                        .billAmount(billAmt)
                        .customerName(custName)
                        .billNumber(fetchResp.getBillNumber())
                        .billDate(fetchResp.getBillDate())
                        .dueDate(fetchResp.getDueDate())
                        .billPeriod(fetchResp.getBillPeriod())
                        .customerParams(request.getCustomerParams())
                        .additionalInfo(addnl)
                        .message(message)
                        .build();
            } else {
                String errMsg = fetchResp != null ? fetchResp.getErrorMessage() : "Provider rejected bill fetch";
                return BbpsDtos.BillFetchResult.builder()
                        .success(false)
                        .noBillDue(false)
                        .billerId(biller.getBillerId())
                        .billerName(biller.getBillerName())
                        .customerParams(request.getCustomerParams())
                        .message(errMsg)
                        .errorCode(fetchResp != null ? fetchResp.getResponseCode() : "500")
                        .build();
            }
        } catch (Exception e) {
            log.error("Exception fetching electricity bill for biller {}: {}", biller.getBillerId(), e.getMessage());
            return BbpsDtos.BillFetchResult.builder()
                    .success(false)
                    .billerId(biller.getBillerId())
                    .billerName(biller.getBillerName())
                    .customerParams(request.getCustomerParams())
                    .message("Failed to fetch bill from provider: " + e.getMessage())
                    .errorCode("500")
                    .build();
        }
    }

    @Override
    @Transactional
    public BbpsDtos.ElectricityPayResponse payElectricityBill(UUID userId, BbpsDtos.ElectricityPayRequest request, String clientIp) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // 1. Verify service permission in user_services
        boolean isServiceEnabled = userServiceRepository.findByUserIdAndServiceType(userId, ServiceType.BBPS)
                .map(UserService::getIsEnabled)
                .orElse(true);

        if (!isServiceEnabled) {
            log.warn("BBPS service disabled for user: {}", userId);
            throw new IllegalStateException("BBPS service is disabled for your account by administrator");
        }

        // 2. Validate input
        if (request.getCustomerMobile() == null || !request.getCustomerMobile().matches("^[6-9]\\d{9}$")) {
            throw new IllegalArgumentException("Valid 10-digit Indian mobile number starting with 6-9 is required");
        }
        if (request.getAmount() == null || request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Bill payment amount must be greater than zero");
        }

        BbpsDtos.ElectricityBillerInfo biller = electricityBillerRegistry.findById(request.getBillerId())
                .orElseThrow(() -> new IllegalArgumentException("Unknown electricity biller: " + request.getBillerId()));

        electricityBillerRegistry.validateCustomerParams(biller, request.getCustomerParams());

        long paise = request.getAmount().multiply(BigDecimal.valueOf(100)).longValue();

        boolean isPrepaidMeter = "PREPAID".equalsIgnoreCase(request.getMeterType())
                || "Prepaid Meter".equalsIgnoreCase(biller.getCategory())
                || (biller.isPrepaidMeterSupported() && "PREPAID".equalsIgnoreCase(request.getMeterType()));

        // Calculate CCF1 fee per BillAvenue spec (Pages 71-75):
        // Only if biller has configured interchangeFeeCCF1 (flatFee and/or percentFee)
        // CCF1 = (Payment Amount * percentFee / 100) + flatFee
        // GST = CCF1 * 18 / 100
        // Total CCF1 (in paise) = floor(CCF1 + GST)
        long ccf1Paise = 0L;
        if (isPrepaidMeter) {
            double percentFee = (biller.getCcf1Percent() != null) ? biller.getCcf1Percent() : 0.0;
            long flatFeePaise = (biller.getCcf1FlatFeePaise() != null) ? biller.getCcf1FlatFeePaise() : 0L;

            if (percentFee > 0.0 || flatFeePaise > 0L) {
                double rawCcf1 = ((double) paise * percentFee / 100.0) + (double) flatFeePaise;
                double gst = rawCcf1 * 0.18;
                ccf1Paise = (long) Math.floor(rawCcf1 + gst);
            }
        }

        BigDecimal ccf1FeeRupees = BigDecimal.valueOf(ccf1Paise).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        BigDecimal convenienceFee = isPrepaidMeter
                ? ccf1FeeRupees
                : (request.getConvenienceFee() != null && request.getConvenienceFee().compareTo(BigDecimal.ZERO) > 0 ? request.getConvenienceFee() : BigDecimal.ZERO);
        BigDecimal totalPayable = request.getAmount().add(convenienceFee);

        // 3. Server-enforced Idempotency check
        String idempotencyKey = request.getIdempotencyKey();
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            idempotencyKey = "BBPS-ELEC-" + UUID.randomUUID();
        }

        Optional<BbpsTransaction> existingOpt = bbpsTransactionRepository.findByIdempotencyKey(idempotencyKey);
        if (existingOpt.isPresent()) {
            BbpsTransaction existing = existingOpt.get();
            log.info("Idempotent request duplicate detected for electricity payment key: {}. Returning existing status: {}",
                    idempotencyKey, existing.getStatus());

            WalletDtos.WalletBalanceResponse currentBal = walletService.getBalance(userId.toString());
            return BbpsDtos.ElectricityPayResponse.builder()
                    .success("SUCCESS".equals(existing.getStatus()))
                    .transactionId(existing.getId().toString())
                    .merchantRefNo(existing.getMerchantRefNo())
                    .providerTxnId(existing.getProviderTxnId())
                    .approvalRefNo(existing.getApprovalRefNo())
                    .status(existing.getStatus())
                    .amount(existing.getAmount())
                    .convenienceFee(existing.getConvenienceFee())
                    .ccf1Fee(ccf1FeeRupees)
                    .totalAmount(existing.getAmount().add(existing.getConvenienceFee() != null ? existing.getConvenienceFee() : BigDecimal.ZERO))
                    .meterType(isPrepaidMeter ? "PREPAID" : "POSTPAID")
                    .consumerNumber(existing.getConsumerNumber())
                    .customerName(existing.getCustomerName())
                    .customerMobile(existing.getMobileNumber())
                    .billerId(existing.getBillerId())
                    .billerName(existing.getBillerName())
                    .billNumber(existing.getBillNumber())
                    .dueDate(existing.getDueDate())
                    .message(existing.getProviderMessage() != null ? existing.getProviderMessage() : "Existing transaction returned")
                    .walletBalance(currentBal.balance())
                    .createdAt(existing.getCreatedAt())
                    .build();
        }

        // 4. Authoritative backend wallet balance enforcement
        WalletDtos.WalletBalanceResponse balanceResponse = walletService.getBalance(userId.toString());
        BigDecimal availableBalance = balanceResponse.availableBalance() != null ? balanceResponse.availableBalance() : BigDecimal.ZERO;
        if (availableBalance.compareTo(totalPayable) < 0) {
            log.warn("Insufficient wallet balance for user {}. Required: {}, Available: {}",
                    userId, totalPayable, availableBalance);
            throw new IllegalStateException("Insufficient wallet balance. Available: ₹" + availableBalance + ", Required: ₹" + totalPayable);
        }

        // 5. Generate unique references
        String primaryConsumerNumber = electricityBillerRegistry.extractPrimaryConsumerNumber(request.getCustomerParams());
        String effectiveRequestId = (request.getFetchRequestId() != null && !request.getFetchRequestId().isBlank())
                ? request.getFetchRequestId().trim()
                : BillAvenueCryptoUtil.generateRequestId();
        String merchantRefNo = "BBPS-EL-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();

        String customerParamsJson = null;
        try {
            customerParamsJson = objectMapper.writeValueAsString(request.getCustomerParams());
        } catch (Exception ignored) {}

        String additionalInfoJson = null;
        try {
            if (request.getAdditionalInfo() != null) {
                additionalInfoJson = objectMapper.writeValueAsString(request.getAdditionalInfo());
            }
        } catch (Exception ignored) {}

        // 6. Persist Core Txn and BbpsTransaction in INITIATED state
        Txn txn = new Txn();
        txn.setUser(user);
        txn.setAmount(totalPayable);
        txn.setServiceType(isPrepaidMeter ? "BBPS_ELECTRICITY_PREPAID" : "BBPS_ELECTRICITY");
        txn.setStatus(TransactionStatus.INITIATED);
        txn.setIdempotencyKey(idempotencyKey);
        txn = txnRepository.save(txn);

        String customerName = (request.getCustomerName() != null && !request.getCustomerName().isBlank() && !"NA".equalsIgnoreCase(request.getCustomerName().trim()))
                ? request.getCustomerName().trim()
                : (isPrepaidMeter ? "Prepaid Meter Consumer" : "Electricity Consumer");

        String effectiveBillDate = (request.getBillDate() != null && !request.getBillDate().isBlank() && !"N/A".equalsIgnoreCase(request.getBillDate().trim()))
                ? request.getBillDate().trim()
                : LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE);

        String effectiveDueDate = (request.getDueDate() != null && !request.getDueDate().isBlank() && !"N/A".equalsIgnoreCase(request.getDueDate().trim()))
                ? request.getDueDate().trim()
                : effectiveBillDate;

        String effectiveBillNumber = (request.getBillNumber() != null && !request.getBillNumber().isBlank() && !"N/A".equalsIgnoreCase(request.getBillNumber().trim()))
                ? request.getBillNumber().trim()
                : merchantRefNo;

        String effectiveBillPeriod = (request.getBillPeriod() != null && !request.getBillPeriod().isBlank() && !"N/A".equalsIgnoreCase(request.getBillPeriod().trim()))
                ? request.getBillPeriod().trim()
                : "NA";

        BbpsTransaction bbpsTxn = new BbpsTransaction();
        bbpsTxn.setUser(user);
        bbpsTxn.setTxn(txn);
        bbpsTxn.setIdempotencyKey(idempotencyKey);
        bbpsTxn.setRequestId(effectiveRequestId);
        bbpsTxn.setMerchantRefNo(merchantRefNo);
        bbpsTxn.setCategory(isPrepaidMeter ? "Prepaid Meter" : "Electricity");
        bbpsTxn.setBillerId(biller.getBillerId());
        bbpsTxn.setBillerName(biller.getBillerName());
        bbpsTxn.setCircle(biller.getState());
        bbpsTxn.setMobileNumber(request.getCustomerMobile().trim());
        bbpsTxn.setConsumerNumber(primaryConsumerNumber);
        bbpsTxn.setCustomerName(customerName);
        bbpsTxn.setBillNumber(effectiveBillNumber);
        bbpsTxn.setBillDate(effectiveBillDate);
        bbpsTxn.setDueDate(effectiveDueDate);
        bbpsTxn.setBillPeriod(effectiveBillPeriod);
        bbpsTxn.setConvenienceFee(convenienceFee);
        bbpsTxn.setCustomerParams(customerParamsJson);
        bbpsTxn.setAdditionalInfo(additionalInfoJson);
        bbpsTxn.setFetchRequestId(request.getFetchRequestId());
        bbpsTxn.setAmount(request.getAmount());
        bbpsTxn.setStatus("INITIATED");
        bbpsTxn = bbpsTransactionRepository.save(bbpsTxn);

        // 7. Atomically debit wallet using ledger-safe service debit
        String debitRef = txn.getId().toString();
        try {
            String debitDesc = isPrepaidMeter
                    ? "BBPS Prepaid Meter Recharge - " + biller.getBillerName() + " (" + primaryConsumerNumber + ")"
                    : "BBPS Electricity Bill - " + biller.getBillerName() + " (" + primaryConsumerNumber + ")";
            walletService.debitForService(
                    userId,
                    totalPayable,
                    debitDesc,
                    WalletTransactionContext.BBPS_PAYMENT,
                    "BBPS",
                    clientIp != null ? clientIp : "127.0.0.1",
                    debitRef
            );
            bbpsTxn.setWalletDebitRef(debitRef);
            bbpsTxn = bbpsTransactionRepository.save(bbpsTxn);
        } catch (Exception e) {
            log.error("Failed to debit wallet for BBPS electricity payment. MerchantRef: {}", merchantRefNo, e);
            txn.setStatus(TransactionStatus.FAILED);
            txnRepository.save(txn);

            bbpsTxn.setStatus("FAILED");
            bbpsTxn.setProviderMessage("Wallet debit failed: " + e.getMessage());
            bbpsTransactionRepository.save(bbpsTxn);

            throw new IllegalStateException("Wallet debit failed: " + e.getMessage());
        }

        // 8. Submit provider request to BillAvenue
        long convFeePaise = convenienceFee.multiply(BigDecimal.valueOf(100)).longValue();

        String mode = billAvenueClient.getPaymentMode();
        if (mode == null || mode.isBlank()) mode = "Cash";
        String initChannel = billAvenueClient.getInitChannel();
        if (initChannel == null || initChannel.isBlank()) initChannel = "AGT";

        String paymentAccountInfo;
        String senderMobile = (user.getMobile() != null && !user.getMobile().isBlank())
                ? user.getMobile().trim() : request.getCustomerMobile().trim();

        if ("Cash".equalsIgnoreCase(mode)) {
            initChannel = "AGT";
            mode = "Cash";
            paymentAccountInfo = "Cash Payment";
        } else if ("Wallet".equalsIgnoreCase(mode)) {
            initChannel = "INT";
            paymentAccountInfo = "Paytm|" + senderMobile;
        } else if ("UPI".equalsIgnoreCase(mode)) {
            initChannel = "INT";
            paymentAccountInfo = senderMobile.contains("@") ? senderMobile : (senderMobile + "@upi");
        } else {
            mode = "Cash";
            initChannel = "AGT";
            paymentAccountInfo = "Cash Payment";
        }

        String sanitizedIp = (clientIp != null && clientIp.matches("^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$"))
                ? clientIp : "103.108.7.127";

        List<BillAvenueDtos.InputParam> inputs = new ArrayList<>();
        if (request.getCustomerParams() != null) {
            for (Map.Entry<String, String> entry : request.getCustomerParams().entrySet()) {
                if (entry.getValue() != null && !entry.getValue().isBlank()) {
                    inputs.add(BillAvenueDtos.InputParam.builder()
                            .paramName(entry.getKey().trim())
                            .paramValue(entry.getValue().trim())
                            .build());
                }
            }
        }

        List<BillAvenueDtos.InfoItem> addnlItems = new ArrayList<>();
        if (request.getAdditionalInfo() != null) {
            for (BbpsDtos.InfoItemDto dto : request.getAdditionalInfo()) {
                addnlItems.add(new BillAvenueDtos.InfoItem(dto.getInfoName(), dto.getInfoValue()));
            }
        }

        String remitterName = (user.getFullName() != null && !user.getFullName().isBlank()) ? user.getFullName().trim() : "Rupiksha Retailer";

        // For prepaid meter recharges, billerAdhoc is true; for postpaid bill fetch, false
        String billerAdhocVal = isPrepaidMeter ? "true" : "false";

        BillAvenueDtos.BillPayXmlRequest xmlReq = BillAvenueDtos.BillPayXmlRequest.builder()
                .fetchRequestId(effectiveRequestId)
                .billerId(biller.getBillerId())
                .customerMobile(request.getCustomerMobile().trim())
                .amountPaise(paise)
                .billAmountPaise(paise)
                .billDate(effectiveBillDate)
                .billNumber(effectiveBillNumber)
                .dueDate(effectiveDueDate)
                .billPeriod(effectiveBillPeriod)
                .customerName(customerName)
                .additionalInfo(addnlItems.isEmpty() ? null : addnlItems)
                .inputParams(inputs)
                .clientTxnId(merchantRefNo)
                .paymentMode(mode)
                .remitterName(remitterName)
                .remarks("Received")
                .paymentAccountInfo(paymentAccountInfo)
                .clientIp(sanitizedIp)
                .billerAdhoc(billerAdhocVal)
                .custConvFeePaise(convFeePaise)
                .ccf1Paise(ccf1Paise)
                .build();

        BillAvenueDtos.BillPayResponse payResp;
        try {
            payResp = billAvenueClient.payBillXml(xmlReq);
        } catch (BillAvenueTimeoutException te) {
            log.warn("BillAvenue timeout for electricity payment ref: {}. Keeping transaction PENDING.", merchantRefNo, te);
            txn.setStatus(TransactionStatus.PENDING);
            txnRepository.save(txn);

            bbpsTxn.setStatus("PENDING");
            bbpsTxn.setProviderMessage("Transaction processing at provider. Reconciling status.");
            bbpsTransactionRepository.save(bbpsTxn);

            WalletDtos.WalletBalanceResponse bal = walletService.getBalance(userId.toString());
            return BbpsDtos.ElectricityPayResponse.builder()
                    .success(false)
                    .transactionId(bbpsTxn.getId().toString())
                    .merchantRefNo(merchantRefNo)
                    .status("PENDING")
                    .amount(request.getAmount())
                    .convenienceFee(convenienceFee)
                    .totalAmount(totalPayable)
                    .consumerNumber(primaryConsumerNumber)
                    .customerName(customerName)
                    .customerMobile(request.getCustomerMobile())
                    .billerId(biller.getBillerId())
                    .billerName(biller.getBillerName())
                    .billNumber(request.getBillNumber())
                    .dueDate(request.getDueDate())
                    .message("Bill payment is processing at electricity board. Status will update shortly.")
                    .walletBalance(bal.balance())
                    .createdAt(bbpsTxn.getCreatedAt())
                    .build();
        } catch (Exception ex) {
            log.error("Unexpected exception calling BillAvenue for electricity payment. Performing safe refund. Ref: {}", merchantRefNo, ex);
            handleFailureAndRefund(userId, txn, bbpsTxn, totalPayable, "Provider communication error: " + ex.getMessage(), clientIp);
            WalletDtos.WalletBalanceResponse bal = walletService.getBalance(userId.toString());
            return BbpsDtos.ElectricityPayResponse.builder()
                    .success(false)
                    .transactionId(bbpsTxn.getId().toString())
                    .merchantRefNo(merchantRefNo)
                    .status("FAILED")
                    .amount(request.getAmount())
                    .convenienceFee(convenienceFee)
                    .totalAmount(totalPayable)
                    .consumerNumber(primaryConsumerNumber)
                    .customerName(customerName)
                    .customerMobile(request.getCustomerMobile())
                    .billerId(biller.getBillerId())
                    .billerName(biller.getBillerName())
                    .billNumber(request.getBillNumber())
                    .dueDate(request.getDueDate())
                    .message("Bill payment failed: " + ex.getMessage() + ". Amount has been refunded to your wallet.")
                    .walletBalance(bal.balance())
                    .createdAt(bbpsTxn.getCreatedAt())
                    .build();
        }

        // 9. Process Provider Outcome
        if (payResp != null && payResp.isSuccess()) {
            log.info("BillAvenue electricity payment SUCCESS. TxnRefId: {}, ApprovalRef: {}",
                    payResp.getTxnRefId(), payResp.getApprovalRefNumber());

            txn.setStatus(TransactionStatus.SUCCESS);
            txn.setProviderRef(payResp.getTxnRefId());
            txnRepository.save(txn);

            bbpsTxn.setStatus("SUCCESS");
            bbpsTxn.setProviderTxnId(payResp.getTxnRefId());
            bbpsTxn.setApprovalRefNo(payResp.getApprovalRefNumber());
            bbpsTxn.setProviderResponseCode(payResp.getResponseCode());
            bbpsTxn.setProviderMessage("Electricity bill payment completed successfully");
            bbpsTxn.setCompletedAt(Instant.now());
            bbpsTransactionRepository.save(bbpsTxn);

            WalletDtos.WalletBalanceResponse bal = walletService.getBalance(userId.toString());
            return BbpsDtos.ElectricityPayResponse.builder()
                    .success(true)
                    .transactionId(bbpsTxn.getId().toString())
                    .merchantRefNo(merchantRefNo)
                    .providerTxnId(payResp.getTxnRefId())
                    .approvalRefNo(payResp.getApprovalRefNumber())
                    .status("SUCCESS")
                    .amount(request.getAmount())
                    .convenienceFee(convenienceFee)
                    .ccf1Fee(ccf1FeeRupees)
                    .totalAmount(totalPayable)
                    .meterType(isPrepaidMeter ? "PREPAID" : "POSTPAID")
                    .consumerNumber(primaryConsumerNumber)
                    .customerName(customerName)
                    .customerMobile(request.getCustomerMobile())
                    .billerId(biller.getBillerId())
                    .billerName(biller.getBillerName())
                    .billNumber(request.getBillNumber())
                    .dueDate(request.getDueDate())
                    .message(isPrepaidMeter ? "Prepaid meter recharge completed successfully!" : "Electricity bill paid successfully!")
                    .walletBalance(bal.balance())
                    .createdAt(bbpsTxn.getCreatedAt())
                    .build();
        } else {
            String errReason = payResp != null ? payResp.getErrorMessage() : "Provider rejected bill payment";
            log.warn("BillAvenue electricity payment failed. Code: {}, Reason: {}. Issuing refund.",
                    payResp != null ? payResp.getResponseCode() : "NULL", errReason);

            handleFailureAndRefund(userId, txn, bbpsTxn, totalPayable, errReason, clientIp);

            WalletDtos.WalletBalanceResponse bal = walletService.getBalance(userId.toString());
            return BbpsDtos.ElectricityPayResponse.builder()
                    .success(false)
                    .transactionId(bbpsTxn.getId().toString())
                    .merchantRefNo(merchantRefNo)
                    .status("FAILED")
                    .amount(request.getAmount())
                    .convenienceFee(convenienceFee)
                    .ccf1Fee(ccf1FeeRupees)
                    .totalAmount(totalPayable)
                    .meterType(isPrepaidMeter ? "PREPAID" : "POSTPAID")
                    .consumerNumber(primaryConsumerNumber)
                    .customerName(customerName)
                    .customerMobile(request.getCustomerMobile())
                    .billerId(biller.getBillerId())
                    .billerName(biller.getBillerName())
                    .billNumber(request.getBillNumber())
                    .dueDate(request.getDueDate())
                    .message(errReason + ". Amount has been refunded to your wallet.")
                    .walletBalance(bal.balance())
                    .createdAt(bbpsTxn.getCreatedAt())
                    .build();
        }
    }

    @Override
    public BbpsDtos.HistoryResponse getHistory(UUID userId, String category, String status, String search, Instant startDate, Instant endDate, Pageable pageable) {
        String cleanStatus = (status != null && !status.equalsIgnoreCase("ALL") && !status.isBlank()) ? status.toUpperCase() : null;
        String cleanCategory = (category != null && !category.equalsIgnoreCase("ALL") && !category.isBlank()) ? category.trim() : null;
        String cleanSearch = (search != null && !search.isBlank()) ? search.trim() : null;

        Page<BbpsTransaction> page = bbpsTransactionRepository.findWithFilters(userId, cleanStatus, cleanCategory, startDate, endDate, cleanSearch, pageable);

        List<BbpsDtos.HistoryItem> items = page.getContent().stream()
                .map(this::mapToHistoryItem)
                .toList();

        long totalTx = bbpsTransactionRepository.countByUserCategoryAndStatus(userId, cleanCategory, null);
        long successTx = bbpsTransactionRepository.countByUserCategoryAndStatus(userId, cleanCategory, "SUCCESS");
        long pendingTx = bbpsTransactionRepository.countByUserCategoryAndStatus(userId, cleanCategory, "PENDING")
                + bbpsTransactionRepository.countByUserCategoryAndStatus(userId, cleanCategory, "INITIATED");
        long failedTx = bbpsTransactionRepository.countByUserCategoryAndStatus(userId, cleanCategory, "FAILED");
        long refundedTx = bbpsTransactionRepository.countByUserCategoryAndStatus(userId, cleanCategory, "REFUNDED");

        BigDecimal totalVol = items.stream()
                .filter(i -> "SUCCESS".equalsIgnoreCase(i.getStatus()))
                .map(BbpsDtos.HistoryItem::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BbpsDtos.SummaryStats summary = BbpsDtos.SummaryStats.builder()
                .totalTransactions(totalTx)
                .successCount(successTx)
                .pendingCount(pendingTx)
                .failedCount(failedTx)
                .refundedCount(refundedTx)
                .totalVolume(totalVol)
                .build();

        return BbpsDtos.HistoryResponse.builder()
                .content(items)
                .page(page.getNumber())
                .size(page.getSize())
                .totalElements(page.getTotalElements())
                .totalPages(page.getTotalPages())
                .summary(summary)
                .build();
    }

    @Override
    @Transactional
    public void handlePushNotification(String encResponse) {
        log.info("Received push notification from BillAvenue");
        // Decrypted using shared workingKey in BillAvenueCryptoUtil
        // Process refund or status update idempotently
    }

    private BbpsTransaction findUserBbpsTxn(UUID userId, String txnId) {
        BbpsTransaction txn = bbpsTransactionRepository.findById(UUID.fromString(txnId))
                .orElseThrow(() -> new IllegalArgumentException("Transaction not found"));
        if (!txn.getUser().getId().equals(userId)) {
            throw new IllegalArgumentException("Unauthorized transaction access");
        }
        return txn;
    }

    private String resolveBillerName(String billerId) {
        if (billerId == null) return "Mobile Operator";
        String upper = billerId.trim().toUpperCase();
        if (upper.contains("AIRTEL")) return "Airtel";
        if (upper.contains("JIO")) return "Jio";
        if (upper.contains("VI") || upper.contains("VODA")) return "Vi";
        if (upper.contains("BSNL")) return "BSNL";
        if (upper.contains("MTNL")) return "MTNL";
        Optional<BbpsDtos.ElectricityBillerInfo> elec = electricityBillerRegistry.findById(billerId);
        if (elec.isPresent()) {
            return elec.get().getBillerName();
        }
        return "Electricity Provider";
    }

    private BbpsDtos.HistoryItem mapToHistoryItem(BbpsTransaction txn) {
        return BbpsDtos.HistoryItem.builder()
                .id(txn.getId().toString())
                .merchantRefNo(txn.getMerchantRefNo())
                .providerTxnId(txn.getProviderTxnId())
                .approvalRefNo(txn.getApprovalRefNo())
                .category(txn.getCategory())
                .billerId(txn.getBillerId())
                .billerName(txn.getBillerName())
                .circle(txn.getCircle())
                .mobileNumber(txn.getMobileNumber())
                .maskedMobileNumber(maskMobile(txn.getMobileNumber()))
                .consumerNumber(txn.getConsumerNumber())
                .customerName(txn.getCustomerName())
                .billNumber(txn.getBillNumber())
                .dueDate(txn.getDueDate())
                .convenienceFee(txn.getConvenienceFee())
                .planId(txn.getPlanId())
                .planDescription(txn.getPlanDescription())
                .amount(txn.getAmount())
                .status(txn.getStatus())
                .walletDebitRef(txn.getWalletDebitRef())
                .walletRefundRef(txn.getWalletRefundRef())
                .providerMessage(txn.getProviderMessage())
                .createdAt(txn.getCreatedAt())
                .completedAt(txn.getCompletedAt())
                .build();
    }

    private String maskMobile(String mobile) {
        if (mobile == null || mobile.length() < 10) return mobile;
        return mobile.substring(0, 2) + "******" + mobile.substring(mobile.length() - 2);
    }

    private List<BbpsDtos.PlanInfo> getCuratedPlans(String billerId) {
        List<BbpsDtos.PlanInfo> list = new ArrayList<>();
        if ("BILAVJIO000001".equals(billerId)) {
            // True 5G & Popular Daily Packs
            list.add(new BbpsDtos.PlanInfo("JIO_189", billerId, "Popular Plans", "Value", new BigDecimal("189.00"), "28 Days", "2.0 GB Total", "Unlimited Calls", "300 SMS", "Affordable Value Pack: 28 Days, 2GB Data + Unlimited Calls + 300 SMS."));
            list.add(new BbpsDtos.PlanInfo("JIO_198", billerId, "True 5G", "True 5G", new BigDecimal("198.00"), "14 Days", "2.0 GB/Day", "Unlimited 5G", "100 SMS/Day", "True 5G Unlimited Plan: 14 Days, 2GB/Day + Unlimited True 5G + Unlimited Calls."));
            list.add(new BbpsDtos.PlanInfo("JIO_239", billerId, "Popular Plans", "Popular", new BigDecimal("239.00"), "22 Days", "1.5 GB/Day", "Unlimited Calls", "100 SMS/Day", "1.5GB/Day Data for 22 Days Pack: Unlimited Calls + 100 SMS/Day."));
            list.add(new BbpsDtos.PlanInfo("JIO_249", billerId, "Popular Plans", "Popular", new BigDecimal("249.00"), "28 Days", "1.0 GB/Day", "Unlimited Calls", "100 SMS/Day", "Popular Plan: 28 Days, 1GB/Day Data + Unlimited Calls + 100 SMS/Day."));
            list.add(new BbpsDtos.PlanInfo("JIO_299", billerId, "Popular Plans", "Popular", new BigDecimal("299.00"), "28 Days", "1.5 GB/Day", "Unlimited Calls", "100 SMS/Day", "1.5GB/Day Data for 28 Days Pack: Unlimited Calls + 100 SMS/Day + Jio Apps."));
            list.add(new BbpsDtos.PlanInfo("JIO_319", billerId, "Popular Plans", "Calendar Month", new BigDecimal("319.00"), "Calendar Month", "1.5 GB/Day", "Unlimited Calls", "100 SMS/Day", "Calendar Month Pack: 1.5GB/Day Data + Unlimited Calls for full calendar month."));
            list.add(new BbpsDtos.PlanInfo("JIO_349", billerId, "True 5G", "True 5G", new BigDecimal("349.00"), "28 Days", "2.0 GB/Day", "Unlimited True 5G", "100 SMS/Day", "True 5G Unlimited Plan: 28 Days, 2GB/Day + Unlimited True 5G + Unlimited Voice."));
            list.add(new BbpsDtos.PlanInfo("JIO_399", billerId, "True 5G", "True 5G", new BigDecimal("399.00"), "28 Days", "2.5 GB/Day", "Unlimited True 5G", "100 SMS/Day", "True 5G Unlimited Plan: 28 Days, 2.5GB/Day + Unlimited True 5G + 100 SMS/Day."));
            list.add(new BbpsDtos.PlanInfo("JIO_449", billerId, "True 5G", "True 5G", new BigDecimal("449.00"), "28 Days", "3.0 GB/Day", "Unlimited True 5G", "100 SMS/Day", "True 5G Unlimited Plan: 28 Days, 3GB/Day + Unlimited True 5G + Unlimited Calls."));
            list.add(new BbpsDtos.PlanInfo("JIO_450", billerId, "True 5G", "True 5G", new BigDecimal("450.00"), "36 Days", "2.0 GB/Day", "Unlimited True 5G", "100 SMS/Day", "True 5G Unlimited Plan: 36 Days, 2GB/Day + Unlimited True 5G + Unlimited Voice."));
            list.add(new BbpsDtos.PlanInfo("JIO_459", billerId, "Popular Plans", "Gaming", new BigDecimal("459.00"), "28 Days", "2.0 GB/Day + 5GB", "Unlimited True 5G", "100 SMS/Day", "Affordable Gaming Pack: 28 Days, 2GB/Day + 5GB Extra Data + Unlimited Voice."));
            list.add(new BbpsDtos.PlanInfo("JIO_495", billerId, "Popular Plans", "Gaming", new BigDecimal("495.00"), "28 Days", "1.5 GB/Day + 5GB", "Unlimited Calls", "100 SMS/Day", "Youth & Gaming Pack: 28 Days, 1.5GB/Day + 5GB Extra + Unlimited Calls."));
            list.add(new BbpsDtos.PlanInfo("JIO_545", billerId, "Popular Plans", "Gaming", new BigDecimal("545.00"), "28 Days", "2.0 GB/Day + 5GB", "Unlimited True 5G", "100 SMS/Day", "Affordable Gaming Pack: 28 Days, 2GB/Day + 5GB Extra + True 5G."));
            list.add(new BbpsDtos.PlanInfo("JIO_579", billerId, "Popular Plans", "Popular", new BigDecimal("579.00"), "56 Days", "1.5 GB/Day", "Unlimited Calls", "100 SMS/Day", "1.5GB/Day Data for 56 Days Pack: Unlimited Calls + 100 SMS/Day."));
            list.add(new BbpsDtos.PlanInfo("JIO_629", billerId, "True 5G", "True 5G", new BigDecimal("629.00"), "56 Days", "2.0 GB/Day", "Unlimited True 5G", "100 SMS/Day", "True 5G Unlimited Plan: 56 Days, 2GB/Day + Unlimited True 5G + Unlimited Voice."));
            list.add(new BbpsDtos.PlanInfo("JIO_666", billerId, "Popular Plans", "Popular", new BigDecimal("666.00"), "70 Days", "1.5 GB/Day", "Unlimited Calls", "100 SMS/Day", "1.5GB/Day Data for 70 Days Pack: Unlimited Calls + 100 SMS/Day."));
            list.add(new BbpsDtos.PlanInfo("JIO_719", billerId, "True 5G", "True 5G", new BigDecimal("719.00"), "70 Days", "2.0 GB/Day", "Unlimited True 5G", "100 SMS/Day", "True 5G Unlimited Plan: 70 Days, 2GB/Day + Unlimited True 5G + Unlimited Calls."));
            list.add(new BbpsDtos.PlanInfo("JIO_749", billerId, "True 5G", "True 5G", new BigDecimal("749.00"), "72 Days", "2.0 GB/Day + 20GB", "Unlimited True 5G", "100 SMS/Day", "True 5G Unlimited Plan: 72 Days, 2GB/Day + 20GB Extra + Unlimited True 5G."));
            list.add(new BbpsDtos.PlanInfo("JIO_799", billerId, "Popular Plans", "Value", new BigDecimal("799.00"), "84 Days", "1.5 GB/Day", "Unlimited Calls", "100 SMS/Day", "Affordable Value Pack: 84 Days, 1.5GB/Day Data + Unlimited Calls."));
            list.add(new BbpsDtos.PlanInfo("JIO_859", billerId, "True 5G", "True 5G", new BigDecimal("859.00"), "84 Days", "2.0 GB/Day", "Unlimited True 5G", "100 SMS/Day", "True 5G Unlimited Plan: 84 Days, 2GB/Day + Unlimited True 5G + Unlimited Voice."));
            list.add(new BbpsDtos.PlanInfo("JIO_899", billerId, "True 5G", "True 5G", new BigDecimal("899.00"), "90 Days", "2.0 GB/Day + 20GB", "Unlimited True 5G", "100 SMS/Day", "True 5G Unlimited Plan: 90 Days, 2GB/Day + 20GB Extra + Unlimited True 5G."));
            list.add(new BbpsDtos.PlanInfo("JIO_999", billerId, "True 5G", "True 5G", new BigDecimal("999.00"), "98 Days", "2.0 GB/Day", "Unlimited True 5G", "100 SMS/Day", "True 5G Unlimited Plan: 98 Days, 2GB/Day + Unlimited True 5G + Unlimited Voice."));
            list.add(new BbpsDtos.PlanInfo("JIO_1028", billerId, "True 5G", "True 5G", new BigDecimal("1028.00"), "84 Days", "2.0 GB/Day", "Unlimited True 5G", "100 SMS/Day", "True 5G Unlimited Plan: 84 Days, 2GB/Day + Unlimited True 5G + Swiggy One Lite."));
            list.add(new BbpsDtos.PlanInfo("JIO_1199", billerId, "True 5G", "True 5G", new BigDecimal("1199.00"), "84 Days", "3.0 GB/Day", "Unlimited True 5G", "100 SMS/Day", "True 5G Unlimited Plan: 84 Days, 3GB/Day + Unlimited True 5G + 100 SMS/Day."));
            list.add(new BbpsDtos.PlanInfo("JIO_1899", billerId, "Annual Plans", "Value Annual", new BigDecimal("1899.00"), "336 Days", "24 GB Total", "Unlimited Calls", "3600 SMS", "Affordable Value Pack: 336 Days, 24GB Total Data + Unlimited Voice + 3600 SMS."));
            list.add(new BbpsDtos.PlanInfo("JIO_2025", billerId, "True 5G", "True 5G", new BigDecimal("2025.00"), "200 Days", "2.5 GB/Day", "Unlimited True 5G", "100 SMS/Day", "True 5G Unlimited Plan: 200 Days, 2.5GB/Day + Unlimited True 5G + Unlimited Voice."));
            list.add(new BbpsDtos.PlanInfo("JIO_3599", billerId, "Annual Plans", "Annual 5G", new BigDecimal("3599.00"), "365 Days", "2.5 GB/Day", "Unlimited True 5G", "100 SMS/Day", "1-Year Full Pack: 365 Days, 2.5GB/Day + Unlimited True 5G + Unlimited Voice."));
            list.add(new BbpsDtos.PlanInfo("JIO_3999", billerId, "Annual Plans", "Annual 5G", new BigDecimal("3999.00"), "365 Days", "2.5 GB/Day", "Unlimited True 5G", "100 SMS/Day", "Affordable Gaming Pack: 365 Days, 2.5GB/Day + FanCode + True 5G."));

            // Entertainment & OTT Included Plans
            list.add(new BbpsDtos.PlanInfo("JIO_329", billerId, "Entertainment", "JioSaavn Pro", new BigDecimal("329.00"), "28 Days", "1.5 GB/Day", "Unlimited Calls", "100 SMS/Day", "Entertainment Plan: 28 Days, 1.5GB/Day + JioSaavn Pro Included."));
            list.add(new BbpsDtos.PlanInfo("JIO_445", billerId, "Entertainment", "OTT Pack", new BigDecimal("445.00"), "28 Days", "2.0 GB/Day", "Unlimited True 5G", "100 SMS/Day", "Entertainment Plan: 28 Days, 2GB/Day + 10 OTT Apps Included + Unlimited 5G."));
            list.add(new BbpsDtos.PlanInfo("JIO_500", billerId, "Entertainment", "Mega Content", new BigDecimal("500.00"), "28 Days", "2.0 GB/Day", "Unlimited True 5G", "100 SMS/Day", "Mega Content Plan: 28 Days, 2GB/Day + Unlimited 5G + Entertainment Apps."));
            list.add(new BbpsDtos.PlanInfo("JIO_889", billerId, "Entertainment", "JioSaavn Pro", new BigDecimal("889.00"), "84 Days", "1.5 GB/Day", "Unlimited Calls", "100 SMS/Day", "Entertainment Plan: 84 Days, 1.5GB/Day + JioSaavn Pro Included."));
            list.add(new BbpsDtos.PlanInfo("JIO_949", billerId, "Entertainment", "JioHotstar", new BigDecimal("949.00"), "84 Days", "2.0 GB/Day", "Unlimited True 5G", "100 SMS/Day", "Entertainment Plan: 84 Days, 2GB/Day + JioHotstar Mobile Included + True 5G."));
            list.add(new BbpsDtos.PlanInfo("JIO_1000", billerId, "Entertainment", "Canva Pro", new BigDecimal("1000.00"), "365 Days", "NA", "NA", "NA", "Entertainment Plan: 365 Days, JioShield + Canva Pro + 5G @ ₹83/month."));
            list.add(new BbpsDtos.PlanInfo("JIO_1029", billerId, "Entertainment", "Prime Video", new BigDecimal("1029.00"), "84 Days", "2.0 GB/Day", "Unlimited True 5G", "100 SMS/Day", "Entertainment Plan: 84 Days, 2GB/Day + Amazon Prime Mobile Included + True 5G."));
            list.add(new BbpsDtos.PlanInfo("JIO_1049", billerId, "Entertainment", "SonyLIV + Zee5", new BigDecimal("1049.00"), "84 Days", "2.0 GB/Day", "Unlimited True 5G", "100 SMS/Day", "Entertainment Plan: 84 Days, 2GB/Day + SonyLIV + Zee5 Included + True 5G."));
            list.add(new BbpsDtos.PlanInfo("JIO_1299", billerId, "Entertainment", "Netflix", new BigDecimal("1299.00"), "84 Days", "2.0 GB/Day", "Unlimited True 5G", "100 SMS/Day", "Entertainment Plan: 84 Days, 2GB/Day + Netflix Included + True 5G."));
            list.add(new BbpsDtos.PlanInfo("JIO_1799", billerId, "Entertainment", "Netflix", new BigDecimal("1799.00"), "84 Days", "3.0 GB/Day", "Unlimited True 5G", "100 SMS/Day", "Entertainment Plan: 84 Days, 3GB/Day + Netflix Included + True 5G."));

            // Data Packs & True Unlimited 5G Upgrades
            list.add(new BbpsDtos.PlanInfo("JIO_11", billerId, "Data", "1 Hour", new BigDecimal("11.00"), "1 Hour", "10 GB", "NA", "NA", "10GB Data for 1 Hour high speed burst pack."));
            list.add(new BbpsDtos.PlanInfo("JIO_19", billerId, "Data", "1 Day", new BigDecimal("19.00"), "1 Day", "1.0 GB", "NA", "NA", "1GB Data for 1 Day Pack."));
            list.add(new BbpsDtos.PlanInfo("JIO_29", billerId, "Data", "2 Days", new BigDecimal("29.00"), "2 Days", "2.0 GB", "NA", "NA", "2GB Data for 2 Days Pack."));
            list.add(new BbpsDtos.PlanInfo("JIO_39", billerId, "Data", "3 Days", new BigDecimal("39.00"), "3 Days", "3.0 GB/Day", "NA", "NA", "3GB/Day Data for 3 Days Pack."));
            list.add(new BbpsDtos.PlanInfo("JIO_49", billerId, "Data", "1 Day", new BigDecimal("49.00"), "1 Day", "25 GB", "NA", "NA", "25GB Data for 1 Day Pack."));
            list.add(new BbpsDtos.PlanInfo("JIO_51", billerId, "True 5G", "Upgrade", new BigDecimal("51.00"), "Active Plan", "3.0 GB", "NA", "NA", "True Unlimited 5G Upgrade: 3GB Data + Unlimited 5G on base plan."));
            list.add(new BbpsDtos.PlanInfo("JIO_55", billerId, "Data", "3 Days", new BigDecimal("55.00"), "3 Days", "3.0 GB", "NA", "NA", "3GB Data for 3 Days Pack."));
            list.add(new BbpsDtos.PlanInfo("JIO_69", billerId, "Data", "7 Days", new BigDecimal("69.00"), "7 Days", "6.0 GB", "NA", "NA", "6GB Data for 7 Days Pack."));
            list.add(new BbpsDtos.PlanInfo("JIO_77", billerId, "Data", "5 Days", new BigDecimal("77.00"), "5 Days", "3.0 GB", "NA", "NA", "3GB Data for 5 Days Pack."));
            list.add(new BbpsDtos.PlanInfo("JIO_79", billerId, "Data", "30 Days", new BigDecimal("79.00"), "30 Days", "3.0 GB", "NA", "NA", "3GB Data for 30 Days Pack."));
            list.add(new BbpsDtos.PlanInfo("JIO_100", billerId, "Data", "30 Days", new BigDecimal("100.00"), "30 Days", "6.0 GB", "NA", "NA", "6GB Data for 30 Days Pack."));
            list.add(new BbpsDtos.PlanInfo("JIO_101", billerId, "True 5G", "Upgrade", new BigDecimal("101.00"), "Active Plan", "6.0 GB", "NA", "NA", "True Unlimited 5G Upgrade: 6GB Data + Unlimited 5G on base plan."));
            list.add(new BbpsDtos.PlanInfo("JIO_103", billerId, "Data", "28 Days", new BigDecimal("103.00"), "28 Days", "5.0 GB", "NA", "NA", "5GB Data for 28 Days Pack."));
            list.add(new BbpsDtos.PlanInfo("JIO_111", billerId, "Data", "28 Days", new BigDecimal("111.00"), "28 Days", "5.0 GB", "NA", "NA", "5GB Data for 28 Days Pack."));
            list.add(new BbpsDtos.PlanInfo("JIO_139", billerId, "Data", "7 Days", new BigDecimal("139.00"), "7 Days", "12 GB", "NA", "NA", "12GB Data for 7 Days Pack."));
            list.add(new BbpsDtos.PlanInfo("JIO_149", billerId, "Data", "30 Days", new BigDecimal("149.00"), "30 Days", "10 GB", "NA", "NA", "10GB Data for 30 Days Pack."));
            list.add(new BbpsDtos.PlanInfo("JIO_151", billerId, "True 5G", "Upgrade", new BigDecimal("151.00"), "Active Plan", "9.0 GB", "NA", "NA", "True Unlimited 5G Upgrade: 9GB Data + Unlimited 5G on base plan."));
            list.add(new BbpsDtos.PlanInfo("JIO_175", billerId, "Data", "28 Days", new BigDecimal("175.00"), "28 Days", "10 GB", "NA", "NA", "10GB Data for 28 Days Pack."));
            list.add(new BbpsDtos.PlanInfo("JIO_195", billerId, "Data", "30 Days", new BigDecimal("195.00"), "30 Days", "15 GB", "NA", "NA", "15GB Data for 30 Days Pack."));
            list.add(new BbpsDtos.PlanInfo("JIO_200", billerId, "Data", "28 Days", new BigDecimal("200.00"), "28 Days", "30 GB", "NA", "NA", "30GB Data for 28 Days Pack."));
            list.add(new BbpsDtos.PlanInfo("JIO_219", billerId, "Data", "30 Days", new BigDecimal("219.00"), "30 Days", "30 GB", "NA", "NA", "30GB Data for 30 Days Pack."));
            list.add(new BbpsDtos.PlanInfo("JIO_289", billerId, "Data", "30 Days", new BigDecimal("289.00"), "30 Days", "40 GB", "NA", "NA", "40GB Data for 30 Days Pack."));
            list.add(new BbpsDtos.PlanInfo("JIO_355", billerId, "Data", "30 Days", new BigDecimal("355.00"), "30 Days", "25 GB", "NA", "NA", "25GB Data for 30 Days Pack."));
            list.add(new BbpsDtos.PlanInfo("JIO_359", billerId, "Data", "30 Days", new BigDecimal("359.00"), "30 Days", "50 GB", "NA", "NA", "50GB Data for 30 Days Pack."));
            list.add(new BbpsDtos.PlanInfo("JIO_550", billerId, "Data", "84 Days", new BigDecimal("550.00"), "84 Days", "90 GB", "NA", "NA", "90GB Data for 84 Days Pack."));
            list.add(new BbpsDtos.PlanInfo("JIO_2000", billerId, "Data", "365 Days", new BigDecimal("2000.00"), "365 Days", "365 GB", "NA", "NA", "365GB Data for 365 Days Pack."));

            // Top-up Vouchers
            list.add(new BbpsDtos.PlanInfo("JIO_10", billerId, "Top-up", "Talktime", new BigDecimal("10.00"), "NA", "NA", "₹7.47 Talktime", "NA", "Rs 10 TopUp: ₹7.47 Main Balance Talktime."));
            list.add(new BbpsDtos.PlanInfo("JIO_20", billerId, "Top-up", "Talktime", new BigDecimal("20.00"), "NA", "NA", "₹14.95 Talktime", "NA", "Rs 20 TopUp: ₹14.95 Main Balance Talktime."));
            list.add(new BbpsDtos.PlanInfo("JIO_50", billerId, "Top-up", "Talktime", new BigDecimal("50.00"), "NA", "NA", "₹39.37 Talktime", "NA", "Rs 50 TopUp: ₹39.37 Main Balance Talktime."));

            // JioPhone & JioBharat Plans
            list.add(new BbpsDtos.PlanInfo("JIO_26", billerId, "JioPhone", "Add-on", new BigDecimal("26.00"), "28 Days", "2.0 GB", "NA", "NA", "JioPhone Addon: 2GB Data for 28 Days."));
            list.add(new BbpsDtos.PlanInfo("JIO_62", billerId, "JioPhone", "Add-on", new BigDecimal("62.00"), "28 Days", "6.0 GB", "NA", "NA", "JioPhone Addon: 6GB Data for 28 Days."));
            list.add(new BbpsDtos.PlanInfo("JIO_86", billerId, "JioPhone", "Daily", new BigDecimal("86.00"), "28 Days", "0.5 GB/Day", "Unlimited Calls", "NA", "JioPhone Pack: 0.5GB/Day + Unlimited Calls for 28 Days."));
            list.add(new BbpsDtos.PlanInfo("JIO_122", billerId, "JioPhone", "Daily", new BigDecimal("122.00"), "28 Days", "1.0 GB/Day", "Unlimited Calls", "NA", "JioPhone Pack: 1GB/Day + Unlimited Calls for 28 Days."));
            list.add(new BbpsDtos.PlanInfo("JIO_123", billerId, "JioPhone", "JioBharat", new BigDecimal("123.00"), "28 Days", "0.5 GB/Day", "Unlimited Calls", "300 SMS", "JioBharat Plan: 28 Days, 0.5GB/Day + Unlimited Voice + 300 SMS."));
            list.add(new BbpsDtos.PlanInfo("JIO_182", billerId, "JioPhone", "Daily", new BigDecimal("182.00"), "28 Days", "2.0 GB/Day", "Unlimited Calls", "NA", "JioPhone Pack: 2GB/Day + Unlimited Calls for 28 Days."));
            list.add(new BbpsDtos.PlanInfo("JIO_234", billerId, "JioPhone", "JioBharat", new BigDecimal("234.00"), "56 Days", "0.5 GB/Day", "Unlimited Calls", "300 SMS", "JioBharat Plan: 56 Days, 0.5GB/Day + Unlimited Voice + 300 SMS."));
            list.add(new BbpsDtos.PlanInfo("JIO_369", billerId, "JioPhone", "JioBharat", new BigDecimal("369.00"), "84 Days", "0.5 GB/Day", "Unlimited Calls", "300 SMS", "JioBharat Plan: 84 Days, 0.5GB/Day + Unlimited Voice + 300 SMS."));
            list.add(new BbpsDtos.PlanInfo("JIO_1234", billerId, "JioPhone", "JioBharat", new BigDecimal("1234.00"), "336 Days", "0.5 GB/Day", "Unlimited Calls", "300 SMS/28D", "JioBharat Plan: 336 Days, 0.5GB/Day + Unlimited Voice."));
        } else if ("BILAVAIRTEL001".equals(billerId)) {
            list.add(new BbpsDtos.PlanInfo("AIRTEL_199", billerId, "Popular Plans", "Value", new BigDecimal("199.00"), "28 Days", "2.0 GB Total", "Unlimited Calls", "100 SMS/Day", "Value Pack: Unlimited Calls + 2GB data total + 100 SMS/day for 28 days."));
            list.add(new BbpsDtos.PlanInfo("AIRTEL_299", billerId, "Popular Plans", "Unlimited", new BigDecimal("299.00"), "28 Days", "1.0 GB/Day", "Unlimited Calls", "100 SMS/Day", "Unlimited Calls + 1GB/day data + 100 SMS/day for 28 days."));
            list.add(new BbpsDtos.PlanInfo("AIRTEL_349", billerId, "Popular Plans", "Unlimited", new BigDecimal("349.00"), "28 Days", "1.5 GB/Day", "Unlimited Calls", "100 SMS/Day", "Standard 28 Days Pack: Unlimited Calls + 1.5GB/day data + 100 SMS/day."));
            list.add(new BbpsDtos.PlanInfo("AIRTEL_379", billerId, "Popular Plans", "Unlimited 5G", new BigDecimal("379.00"), "1 Month", "2.0 GB/Day", "Unlimited 5G", "100 SMS/Day", "Calendar Month: Unlimited Calls + 2GB/day + Unlimited 5G data."));
            list.add(new BbpsDtos.PlanInfo("AIRTEL_409", billerId, "Popular Plans", "Unlimited 5G", new BigDecimal("409.00"), "28 Days", "2.5 GB/Day", "Unlimited 5G", "100 SMS/Day", "Hero Pack: Unlimited Calls + 2.5GB/day + Unlimited 5G + Wynk Music."));
            list.add(new BbpsDtos.PlanInfo("AIRTEL_449", billerId, "Entertainment", "Disney+ Hotstar", new BigDecimal("449.00"), "28 Days", "3.0 GB/Day", "Unlimited 5G", "100 SMS/Day", "Hotstar Pack: 3GB/day + Unlimited 5G + Disney+ Hotstar 3 Months Mobile."));
            list.add(new BbpsDtos.PlanInfo("AIRTEL_579", billerId, "Truly Unlimited", "Unlimited", new BigDecimal("579.00"), "56 Days", "1.5 GB/Day", "Unlimited Calls", "100 SMS/Day", "56 Days Pack: Unlimited Calls + 1.5GB/day + 100 SMS/day for 56 days."));
            list.add(new BbpsDtos.PlanInfo("AIRTEL_649", billerId, "Truly Unlimited", "Unlimited 5G", new BigDecimal("649.00"), "56 Days", "2.0 GB/Day", "Unlimited 5G", "100 SMS/Day", "56 Days 5G Pack: Unlimited Calls + 2GB/day + Unlimited 5G data."));
            list.add(new BbpsDtos.PlanInfo("AIRTEL_859", billerId, "Truly Unlimited", "Unlimited", new BigDecimal("859.00"), "84 Days", "1.5 GB/Day", "Unlimited Calls", "100 SMS/Day", "84 Days Pack: Unlimited Calls + 1.5GB/day data + 100 SMS/day for 84 days."));
            list.add(new BbpsDtos.PlanInfo("AIRTEL_979", billerId, "Truly Unlimited", "Unlimited 5G", new BigDecimal("979.00"), "84 Days", "2.0 GB/Day", "Unlimited 5G", "100 SMS/Day", "84 Days Hero: Unlimited Calls + 2GB/day data + Unlimited 5G + RewardsMini."));
            list.add(new BbpsDtos.PlanInfo("AIRTEL_1199", billerId, "Entertainment", "Amazon Prime", new BigDecimal("1199.00"), "84 Days", "2.5 GB/Day", "Unlimited 5G", "100 SMS/Day", "Amazon Prime Pack: 84 Days, 2.5GB/day + Unlimited 5G + Amazon Prime Membership."));
            list.add(new BbpsDtos.PlanInfo("AIRTEL_1999", billerId, "Annual Plans", "Value Annual", new BigDecimal("1999.00"), "365 Days", "24 GB Total", "Unlimited Calls", "100 SMS/Day", "Annual Value: Unlimited Calls + 24GB total data + 100 SMS/day for 365 Days."));
            list.add(new BbpsDtos.PlanInfo("AIRTEL_3599", billerId, "Annual Plans", "Annual 5G", new BigDecimal("3599.00"), "365 Days", "2.0 GB/Day", "Unlimited 5G", "100 SMS/Day", "365 Days 1-Year Pack: Unlimited Calls + 2GB/day data + Unlimited 5G."));
            list.add(new BbpsDtos.PlanInfo("AIRTEL_22", billerId, "Data Add-On", "Data", new BigDecimal("22.00"), "1 Day", "1.0 GB", "NA", "NA", "1 GB data booster pack valid for 1 day."));
            list.add(new BbpsDtos.PlanInfo("AIRTEL_33", billerId, "Data Add-On", "Data", new BigDecimal("33.00"), "1 Day", "2.0 GB", "NA", "NA", "2 GB data booster pack valid for 1 day."));
            list.add(new BbpsDtos.PlanInfo("AIRTEL_77", billerId, "Data Add-On", "Data", new BigDecimal("77.00"), "Active Plan", "5.0 GB", "NA", "NA", "5 GB data booster valid till existing base plan validity."));
        } else if ("BILAVVI0000001".equals(billerId)) {
            list.add(new BbpsDtos.PlanInfo("VI_199", billerId, "Popular Plans", "Value", new BigDecimal("199.00"), "28 Days", "2.0 GB Total", "Unlimited Calls", "300 SMS", "Value Pack: Unlimited Voice, 2GB total data, 300 SMS for 28 days."));
            list.add(new BbpsDtos.PlanInfo("VI_299", billerId, "Popular Plans", "Unlimited", new BigDecimal("299.00"), "28 Days", "1.0 GB/Day", "Unlimited Calls", "100 SMS/Day", "Unlimited Voice, 1GB/day data, 100 SMS/day for 28 days."));
            list.add(new BbpsDtos.PlanInfo("VI_349", billerId, "Popular Plans", "Hero Unlimited", new BigDecimal("349.00"), "28 Days", "1.5 GB/Day", "Unlimited Calls", "100 SMS/Day", "Hero Unlimited: Binge All Night (12am-6am), Weekend Data Rollover, 1.5GB/day."));
            list.add(new BbpsDtos.PlanInfo("VI_365", billerId, "Popular Plans", "Hero Unlimited", new BigDecimal("365.00"), "28 Days", "2.0 GB/Day", "Unlimited Calls", "100 SMS/Day", "Hero Unlimited: 2GB/day data, Binge All Night, Weekend Rollover."));
            list.add(new BbpsDtos.PlanInfo("VI_409", billerId, "Popular Plans", "Hero Unlimited", new BigDecimal("409.00"), "28 Days", "2.5 GB/Day", "Unlimited Calls", "100 SMS/Day", "Hero Unlimited: 2.5GB/day data, Binge All Night, Weekend Rollover."));
            list.add(new BbpsDtos.PlanInfo("VI_449", billerId, "Popular Plans", "Hero Unlimited", new BigDecimal("449.00"), "28 Days", "3.0 GB/Day", "Unlimited Calls", "100 SMS/Day", "Hero Unlimited: 3GB/day data, Binge All Night, Weekend Rollover."));
            list.add(new BbpsDtos.PlanInfo("VI_579", billerId, "Truly Unlimited", "Hero Unlimited", new BigDecimal("579.00"), "56 Days", "1.5 GB/Day", "Unlimited Calls", "100 SMS/Day", "56 Days Hero Pack: Unlimited Calls + 1.5GB/day + Binge All Night."));
            list.add(new BbpsDtos.PlanInfo("VI_649", billerId, "Truly Unlimited", "Hero Unlimited", new BigDecimal("649.00"), "56 Days", "2.0 GB/Day", "Unlimited Calls", "100 SMS/Day", "56 Days Hero Pack: Unlimited Calls + 2GB/day + Binge All Night."));
            list.add(new BbpsDtos.PlanInfo("VI_859", billerId, "Truly Unlimited", "Hero Unlimited", new BigDecimal("859.00"), "84 Days", "1.5 GB/Day", "Unlimited Calls", "100 SMS/Day", "84 Days Pack: Unlimited Calls + 1.5GB/day + Binge All Night."));
            list.add(new BbpsDtos.PlanInfo("VI_979", billerId, "Truly Unlimited", "Hero Unlimited", new BigDecimal("979.00"), "84 Days", "2.0 GB/Day", "Unlimited Calls", "100 SMS/Day", "84 Days Hero Pack: Unlimited Calls + 2GB/day + Binge All Night."));
            list.add(new BbpsDtos.PlanInfo("VI_1999", billerId, "Annual Plans", "Value Annual", new BigDecimal("1999.00"), "365 Days", "24 GB Total", "Unlimited Calls", "3600 SMS", "Annual Value: Unlimited Calls + 24GB total data + 3600 SMS for 365 Days."));
            list.add(new BbpsDtos.PlanInfo("VI_3499", billerId, "Annual Plans", "Hero Annual", new BigDecimal("3499.00"), "365 Days", "1.5 GB/Day", "Unlimited Calls", "100 SMS/Day", "365 Days Hero Annual Pack: Unlimited Calls + 1.5GB/day data + Binge All Night."));
            list.add(new BbpsDtos.PlanInfo("VI_23", billerId, "Data Add-On", "Data", new BigDecimal("23.00"), "1 Day", "1.2 GB", "NA", "NA", "1.2 GB data booster pack valid for 1 day."));
            list.add(new BbpsDtos.PlanInfo("VI_39", billerId, "Data Add-On", "Data", new BigDecimal("39.00"), "3 Days", "3.0 GB", "NA", "NA", "3 GB data booster pack valid for 3 days."));
            list.add(new BbpsDtos.PlanInfo("VI_75", billerId, "Data Add-On", "Data", new BigDecimal("75.00"), "7 Days", "6.0 GB", "NA", "NA", "6 GB data booster pack valid for 7 days."));
        } else {
            // BSNL / MTNL
            list.add(new BbpsDtos.PlanInfo("BSNL_107", billerId, "Validity Extension", "Voice & Data", new BigDecimal("107.00"), "35 Days", "3.0 GB Total", "200 Mins Voice", "NA", "35 Days validity extension pack with 200 mins voice + 3GB data total."));
            list.add(new BbpsDtos.PlanInfo("BSNL_153", billerId, "Popular Plans", "Unlimited", new BigDecimal("153.00"), "26 Days", "1.0 GB/Day", "Unlimited Calls", "100 SMS/Day", "Unlimited Calls, 1GB/day data, 100 SMS/day for 26 days."));
            list.add(new BbpsDtos.PlanInfo("BSNL_197", billerId, "Popular Plans", "Unlimited", new BigDecimal("197.00"), "70 Days", "2.0 GB/Day (18 Days)", "Unlimited Calls (18 Days)", "100 SMS/Day", "70 Days SIM validity extension: Unlimited Voice + 2GB/day for first 18 days."));
            list.add(new BbpsDtos.PlanInfo("BSNL_199", billerId, "Popular Plans", "Unlimited", new BigDecimal("199.00"), "30 Days", "2.0 GB/Day", "Unlimited Calls", "100 SMS/Day", "Unlimited Voice, 2GB/day data, 100 SMS/day for 30 days."));
            list.add(new BbpsDtos.PlanInfo("BSNL_249", billerId, "Popular Plans", "Unlimited", new BigDecimal("249.00"), "45 Days", "2.0 GB/Day", "Unlimited Calls", "100 SMS/Day", "Unlimited Voice, 2GB/day data, 100 SMS/day for 45 days."));
            list.add(new BbpsDtos.PlanInfo("BSNL_397", billerId, "Truly Unlimited", "Voice & Data", new BigDecimal("397.00"), "150 Days", "2.0 GB/Day (30 Days)", "Unlimited Calls (30 Days)", "100 SMS/Day", "150 Days validity pack: Unlimited voice + 2GB/day for first 30 days."));
            list.add(new BbpsDtos.PlanInfo("BSNL_599", billerId, "Truly Unlimited", "Unlimited", new BigDecimal("599.00"), "84 Days", "3.0 GB/Day", "Unlimited Calls", "100 SMS/Day", "Unlimited Voice, 3GB/day data, 100 SMS/day for 84 days."));
            list.add(new BbpsDtos.PlanInfo("BSNL_1999", billerId, "Annual Plans", "Annual", new BigDecimal("1999.00"), "365 Days", "600 GB Total", "Unlimited Calls", "100 SMS/Day", "365 Days Annual pack: Unlimited Calls, 600GB lump-sum data, 100 SMS/day."));
            list.add(new BbpsDtos.PlanInfo("BSNL_2399", billerId, "Annual Plans", "Annual", new BigDecimal("2399.00"), "395 Days", "2.0 GB/Day", "Unlimited Calls", "100 SMS/Day", "395 Days Annual pack: Unlimited Calls, 2GB/day data, 100 SMS/day."));
        }
        return list;
    }

    @Override
    public Object getBillerInfo(String billerId) {
        String resolved = resolveBillAvenueBillerId(billerId);
        return billAvenueClient.getBillerInfo(resolved);
    }
}
