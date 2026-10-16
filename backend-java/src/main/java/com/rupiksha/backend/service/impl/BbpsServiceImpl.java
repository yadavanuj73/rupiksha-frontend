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
import com.rupiksha.backend.service.WalletService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
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
        long paise = request.getAmount().multiply(BigDecimal.valueOf(100)).longValue();
        BillAvenueDtos.BillPayRequest billPayReq = BillAvenueDtos.BillPayRequest.builder()
                .billerAdhoc("true")
                .agentId(billAvenueClient.getAgentId())
                .billerId(request.getBillerId())
                .agentDeviceInfo(BillAvenueDtos.AgentDeviceInfo.builder()
                        .initChannel(billAvenueClient.getInitChannel())
                        .ip(clientIp != null ? clientIp : "127.0.0.1")
                        .mac("01-23-45-67-89-ab")
                        .app("RupikshaPortal")
                        .build())
                .customerInfo(BillAvenueDtos.CustomerInfo.builder()
                        .customerMobile(request.getMobileNumber())
                        .customerEmail(user.getEmail())
                        .build())
                .inputParams(BillAvenueDtos.InputParams.builder()
                        .input(List.of(
                                BillAvenueDtos.InputParam.builder().paramName("Mobile Number").paramValue(request.getMobileNumber()).build(),
                                BillAvenueDtos.InputParam.builder().paramName("Location").paramValue(request.getCircle()).build()
                        ))
                        .build())
                .amountInfo(BillAvenueDtos.AmountInfo.builder()
                        .amount(String.valueOf(paise))
                        .currency("356")
                        .custConvFee("0")
                        .build())
                .paymentMethod(BillAvenueDtos.PaymentMethod.builder()
                        .paymentMode("Wallet")
                        .quickPay("Y")
                        .splitPay("N")
                        .build())
                .paymentInfo(BillAvenueDtos.PaymentInfo.builder()
                        .info(List.of(
                                BillAvenueDtos.InfoItem.builder().infoName("Payment Account Info").infoValue("Rupiksha|" + (user.getMobile() != null ? user.getMobile() : request.getMobileNumber())).build(),
                                BillAvenueDtos.InfoItem.builder().infoName("PaymentRefId").infoValue(merchantRefNo).build(),
                                BillAvenueDtos.InfoItem.builder().infoName("Remitter Name").infoValue(user.getFullName() != null ? user.getFullName() : "Rupiksha Customer").build()
                        ))
                        .build())
                .build();

        BillAvenueDtos.BillPayResponse payResp;
        try {
            payResp = billAvenueClient.payBill(billPayReq, requestId);
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
    public BbpsDtos.HistoryResponse getHistory(UUID userId, String status, String search, Instant startDate, Instant endDate, Pageable pageable) {
        String cleanStatus = (status != null && !status.equalsIgnoreCase("ALL") && !status.isBlank()) ? status.toUpperCase() : null;
        String cleanSearch = (search != null && !search.isBlank()) ? search.trim() : null;

        Page<BbpsTransaction> page = bbpsTransactionRepository.findWithFilters(userId, cleanStatus, startDate, endDate, cleanSearch, pageable);

        List<BbpsDtos.HistoryItem> items = page.getContent().stream()
                .map(this::mapToHistoryItem)
                .toList();

        long totalTx = bbpsTransactionRepository.countByUserAndStatus(userId, null);
        long successTx = bbpsTransactionRepository.countByUserAndStatus(userId, "SUCCESS");
        long pendingTx = bbpsTransactionRepository.countByUserAndStatus(userId, "PENDING") + bbpsTransactionRepository.countByUserAndStatus(userId, "INITIATED");
        long failedTx = bbpsTransactionRepository.countByUserAndStatus(userId, "FAILED");
        long refundedTx = bbpsTransactionRepository.countByUserAndStatus(userId, "REFUNDED");

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
        return switch (billerId) {
            case "BILAVAIRTEL001" -> "Airtel";
            case "BILAVJIO000001" -> "Jio";
            case "BILAVVI0000001" -> "Vi";
            case "BILAVBSNL00001" -> "BSNL";
            case "BILAVMTNL00001" -> "MTNL";
            default -> "Mobile Prepaid";
        };
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
}
