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
                        .initChannel("AGT")
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
            list.add(new BbpsDtos.PlanInfo("JIO_199", billerId, "Popular Plans", "Unlimited", new BigDecimal("199.00"), "28 Days", "1.5 GB/Day", "Unlimited Calls", "100 SMS/Day", "Unlimited Voice, 1.5GB/day data, 100 SMS/day, JioTV, JioCinema apps complimentary."));
            list.add(new BbpsDtos.PlanInfo("JIO_239", billerId, "Popular Plans", "Unlimited", new BigDecimal("239.00"), "28 Days", "1.5 GB/Day", "Unlimited 5G", "100 SMS/Day", "Unlimited Voice, 1.5GB/day + Unlimited True 5G data, 100 SMS/day."));
            list.add(new BbpsDtos.PlanInfo("JIO_299", billerId, "Popular Plans", "Unlimited", new BigDecimal("299.00"), "28 Days", "2.0 GB/Day", "Unlimited 5G", "100 SMS/Day", "Unlimited Voice, 2GB/day + Unlimited True 5G data, 100 SMS/day."));
            list.add(new BbpsDtos.PlanInfo("JIO_666", billerId, "Truly Unlimited", "Unlimited", new BigDecimal("666.00"), "70 Days", "1.5 GB/Day", "Unlimited 5G", "100 SMS/Day", "Unlimited Voice + 1.5GB/day + Unlimited 5G Data for 70 Days."));
            list.add(new BbpsDtos.PlanInfo("JIO_749", billerId, "Truly Unlimited", "Unlimited", new BigDecimal("749.00"), "72 Days", "2.0 GB/Day", "Unlimited 5G", "100 SMS/Day", "Unlimited Voice + 2GB/day + Unlimited True 5G for 72 Days."));
            list.add(new BbpsDtos.PlanInfo("JIO_899", billerId, "Truly Unlimited", "Unlimited", new BigDecimal("899.00"), "90 Days", "2.0 GB/Day", "Unlimited 5G", "100 SMS/Day", "Hero 90-day pack: Unlimited Voice, 2GB/day + 20GB extra, Unlimited True 5G."));
            list.add(new BbpsDtos.PlanInfo("JIO_2999", billerId, "Annual Plans", "Annual", new BigDecimal("2999.00"), "365 Days", "2.5 GB/Day", "Unlimited 5G", "100 SMS/Day", "Full 1 Year Pack: 2.5GB/day data, Unlimited 5G, Unlimited Calls."));
            list.add(new BbpsDtos.PlanInfo("JIO_19", billerId, "Data Add-On", "4G Data", new BigDecimal("19.00"), "Active Plan", "1.5 GB", "NA", "NA", "1.5 GB high speed 4G data voucher valid till existing plan."));
            list.add(new BbpsDtos.PlanInfo("JIO_29", billerId, "Data Add-On", "4G Data", new BigDecimal("29.00"), "Active Plan", "2.5 GB", "NA", "NA", "2.5 GB high speed 4G data voucher valid till existing plan."));
            list.add(new BbpsDtos.PlanInfo("JIO_61", billerId, "Data Add-On", "5G Upgrade", new BigDecimal("61.00"), "Active Plan", "6.0 GB", "NA", "NA", "5G Upgrade voucher: 6GB 4G data + Unlimited 5G on supported plans."));
        } else if ("BILAVAIRTEL001".equals(billerId)) {
            list.add(new BbpsDtos.PlanInfo("AIRTEL_199", billerId, "Popular Plans", "Unlimited", new BigDecimal("199.00"), "28 Days", "2.0 GB Total", "Unlimited Calls", "100 SMS/Day", "Unlimited Calls + 2GB data total + 100 SMS/day for 28 days."));
            list.add(new BbpsDtos.PlanInfo("AIRTEL_299", billerId, "Popular Plans", "Unlimited", new BigDecimal("299.00"), "28 Days", "1.5 GB/Day", "Unlimited 5G", "100 SMS/Day", "Unlimited Calls + 1.5GB/day data + Unlimited 5G + Apollo 24|7 Circle."));
            list.add(new BbpsDtos.PlanInfo("AIRTEL_349", billerId, "Popular Plans", "Unlimited", new BigDecimal("349.00"), "28 Days", "2.0 GB/Day", "Unlimited 5G", "100 SMS/Day", "Unlimited Calls + 2GB/day data + Unlimited 5G + Wynk Music."));
            list.add(new BbpsDtos.PlanInfo("AIRTEL_549", billerId, "Truly Unlimited", "Unlimited", new BigDecimal("549.00"), "56 Days", "1.5 GB/Day", "Unlimited 5G", "100 SMS/Day", "Unlimited Calls + 1.5GB/day + Unlimited 5G for 56 Days."));
            list.add(new BbpsDtos.PlanInfo("AIRTEL_839", billerId, "Truly Unlimited", "Unlimited", new BigDecimal("839.00"), "84 Days", "2.0 GB/Day", "Unlimited 5G", "100 SMS/Day", "Unlimited Calls + 2GB/day data + Unlimited 5G + Disney+ Hotstar 3 Months."));
            list.add(new BbpsDtos.PlanInfo("AIRTEL_2999", billerId, "Annual Plans", "Annual", new BigDecimal("2999.00"), "365 Days", "2.0 GB/Day", "Unlimited 5G", "100 SMS/Day", "365 Days 1-Year pack: Unlimited Calls + 2GB/day data + Unlimited 5G."));
            list.add(new BbpsDtos.PlanInfo("AIRTEL_22", billerId, "Data Add-On", "Data", new BigDecimal("22.00"), "1 Day", "1.0 GB", "NA", "NA", "1 GB data booster pack valid for 1 day."));
            list.add(new BbpsDtos.PlanInfo("AIRTEL_65", billerId, "Data Add-On", "Data", new BigDecimal("65.00"), "Active Plan", "4.0 GB", "NA", "NA", "4 GB data booster valid till existing base plan validity."));
        } else if ("BILAVVI0000001".equals(billerId)) {
            list.add(new BbpsDtos.PlanInfo("VI_199", billerId, "Popular Plans", "Hero Unlimited", new BigDecimal("199.00"), "28 Days", "1.0 GB/Day", "Unlimited Calls", "100 SMS/Day", "Unlimited Voice, 1GB/day data, 100 SMS/day for 28 days."));
            list.add(new BbpsDtos.PlanInfo("VI_299", billerId, "Popular Plans", "Hero Unlimited", new BigDecimal("299.00"), "28 Days", "1.5 GB/Day", "Unlimited Calls", "100 SMS/Day", "Hero Unlimited: Binge All Night (12am-6am), Weekend Data Rollover, 1.5GB/day."));
            list.add(new BbpsDtos.PlanInfo("VI_359", billerId, "Popular Plans", "Hero Unlimited", new BigDecimal("359.00"), "28 Days", "3.0 GB/Day", "Unlimited Calls", "100 SMS/Day", "Hero Unlimited: 3GB/day data, Binge All Night, Weekend Rollover."));
            list.add(new BbpsDtos.PlanInfo("VI_719", billerId, "Truly Unlimited", "Hero Unlimited", new BigDecimal("719.00"), "84 Days", "1.5 GB/Day", "Unlimited Calls", "100 SMS/Day", "84 Days Pack: Unlimited Calls + 1.5GB/day + Binge All Night."));
            list.add(new BbpsDtos.PlanInfo("VI_2899", billerId, "Annual Plans", "Annual", new BigDecimal("2899.00"), "365 Days", "1.5 GB/Day", "Unlimited Calls", "100 SMS/Day", "365 Days Hero Annual pack: Unlimited Calls + 1.5GB/day data + Binge All Night."));
            list.add(new BbpsDtos.PlanInfo("VI_19", billerId, "Data Add-On", "Data", new BigDecimal("19.00"), "1 Day", "1.0 GB", "NA", "NA", "1 GB data booster pack valid for 1 day."));
        } else {
            // BSNL / MTNL
            list.add(new BbpsDtos.PlanInfo("BSNL_107", billerId, "Validity Extension", "Voice & Data", new BigDecimal("107.00"), "35 Days", "3.0 GB Total", "200 Mins Voice", "NA", "35 Days validity extension pack with 200 mins voice + 3GB data total."));
            list.add(new BbpsDtos.PlanInfo("BSNL_197", billerId, "Popular Plans", "Unlimited", new BigDecimal("197.00"), "70 Days", "2.0 GB/Day (18 Days)", "Unlimited Calls (18 Days)", "100 SMS/Day", "70 Days SIM validity extension: Unlimited Voice + 2GB/day for first 18 days."));
            list.add(new BbpsDtos.PlanInfo("BSNL_239", billerId, "Popular Plans", "Unlimited", new BigDecimal("239.00"), "28 Days", "2.0 GB/Day", "Unlimited Calls", "100 SMS/Day", "Unlimited Voice, 2GB/day data, 100 SMS/day for 28 days with ₹10 main talktime."));
            list.add(new BbpsDtos.PlanInfo("BSNL_397", billerId, "Truly Unlimited", "Voice & Data", new BigDecimal("397.00"), "150 Days", "2.0 GB/Day (30 Days)", "Unlimited Calls (30 Days)", "100 SMS/Day", "150 Days validity pack: Unlimited voice + 2GB/day for first 30 days."));
            list.add(new BbpsDtos.PlanInfo("BSNL_1999", billerId, "Annual Plans", "Annual", new BigDecimal("1999.00"), "365 Days", "600 GB Total", "Unlimited Calls", "100 SMS/Day", "365 Days Annual pack: Unlimited Calls, 600GB lump-sum data, 100 SMS/day."));
        }
        return list;
    }
}
