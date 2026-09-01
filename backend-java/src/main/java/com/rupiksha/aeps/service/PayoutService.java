package com.rupiksha.aeps.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rupiksha.aeps.config.PayoutProperties;
import com.rupiksha.aeps.dto.BankVerificationRequest;
import com.rupiksha.aeps.dto.BankVerificationResponse;
import com.rupiksha.aeps.dto.PayoutRequest;
import com.rupiksha.aeps.dto.PayoutResponse;
import com.rupiksha.aeps.dto.PayoutBeneficiaryDto;
import com.rupiksha.aeps.dto.PayoutChargeSlabDto;
import com.rupiksha.aeps.entity.PayoutChargeSlab;
import com.rupiksha.aeps.repository.PayoutChargeSlabRepository;
import com.rupiksha.aeps.entity.PayoutBeneficiary;
import com.rupiksha.aeps.repository.PayoutBeneficiaryRepository;
import com.rupiksha.aeps.entity.PayoutTransaction;
import com.rupiksha.aeps.repository.PayoutTransactionRepository;
import com.rupiksha.aeps.util.BusttoCryptoUtil;
import com.rupiksha.aeps.util.BusttoJwtUtil;
import com.rupiksha.backend.domain.User;
import com.rupiksha.backend.domain.WalletTransactionContext;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.service.WalletService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@Service
public class PayoutService {

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final PayoutProperties payoutProperties;
    private final PayoutTransactionRepository payoutTransactionRepository;
    private final PayoutBeneficiaryRepository payoutBeneficiaryRepository;
    private final PayoutChargeSlabRepository payoutChargeSlabRepository;
    private final WalletService walletService;
    private final UserRepository userRepository;

    public PayoutService(
            ObjectMapper objectMapper,
            PayoutProperties payoutProperties,
            PayoutTransactionRepository payoutTransactionRepository,
            PayoutBeneficiaryRepository payoutBeneficiaryRepository,
            PayoutChargeSlabRepository payoutChargeSlabRepository,
            WalletService walletService,
            UserRepository userRepository
    ) {
        this.objectMapper = objectMapper;
        this.payoutProperties = payoutProperties;
        this.payoutTransactionRepository = payoutTransactionRepository;
        this.payoutBeneficiaryRepository = payoutBeneficiaryRepository;
        this.payoutChargeSlabRepository = payoutChargeSlabRepository;
        this.walletService = walletService;
        this.userRepository = userRepository;

        // Dedicated RestTemplate for Payout with standard HTTP error propagation and timeouts
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(15000);
        factory.setReadTimeout(30000);
        this.restTemplate = new RestTemplate(factory);
    }

    private String cleanUserIdString(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("User ID is required");
        }
        String s = raw.trim();
        if (s.contains("userId=")) {
            int start = s.indexOf("userId=") + 7;
            int end = s.indexOf(",", start);
            if (end == -1) end = s.indexOf("]", start);
            if (end != -1) {
                return s.substring(start, end).trim();
            }
        }
        return s;
    }

    private UUID parseUserUuid(String raw) {
        String clean = cleanUserIdString(raw);
        return UUID.fromString(clean);
    }

    public List<PayoutChargeSlabDto> getPayoutChargeSlabs() {
        List<PayoutChargeSlab> slabs = payoutChargeSlabRepository.findAllByIsActiveTrueOrderByMinAmountAsc();
        if (slabs.isEmpty()) {
            return List.of(
                    PayoutChargeSlabDto.builder()
                            .id(1L)
                            .minAmount(new BigDecimal("500.00"))
                            .maxAmount(new BigDecimal("24999.00"))
                            .baseCharge(new BigDecimal("5.50"))
                            .gstRate(new BigDecimal("18.00"))
                            .gstAmount(new BigDecimal("0.99"))
                            .totalCharge(new BigDecimal("6.49"))
                            .isActive(true)
                            .build(),
                    PayoutChargeSlabDto.builder()
                            .id(2L)
                            .minAmount(new BigDecimal("25000.00"))
                            .maxAmount(new BigDecimal("100000.00"))
                            .baseCharge(new BigDecimal("10.50"))
                            .gstRate(new BigDecimal("18.00"))
                            .gstAmount(new BigDecimal("1.89"))
                            .totalCharge(new BigDecimal("12.39"))
                            .isActive(true)
                            .build()
            );
        }
        return slabs.stream().map(s -> PayoutChargeSlabDto.builder()
                .id(s.getId())
                .minAmount(s.getMinAmount())
                .maxAmount(s.getMaxAmount())
                .baseCharge(s.getBaseCharge())
                .gstRate(s.getGstRate())
                .gstAmount(s.getGstAmount())
                .totalCharge(s.getTotalCharge())
                .isActive(s.getIsActive())
                .build()).toList();
    }

    public List<PayoutChargeSlabDto> updatePayoutChargeSlabs(List<PayoutChargeSlabDto> dtoList) {
        if (dtoList == null || dtoList.isEmpty()) {
            throw new IllegalArgumentException("Payout charge slabs list cannot be empty");
        }

        List<PayoutChargeSlab> savedList = new ArrayList<>();
        for (PayoutChargeSlabDto dto : dtoList) {
            BigDecimal base = dto.getBaseCharge() != null ? dto.getBaseCharge() : BigDecimal.ZERO;
            BigDecimal gstRate = dto.getGstRate() != null ? dto.getGstRate() : new BigDecimal("18.00");
            BigDecimal gstAmount = base.multiply(gstRate).divide(new BigDecimal("100"), 2, java.math.RoundingMode.HALF_UP);
            BigDecimal totalCharge = base.add(gstAmount);

            PayoutChargeSlab slab;
            if (dto.getId() != null) {
                slab = payoutChargeSlabRepository.findById(dto.getId()).orElse(new PayoutChargeSlab());
            } else {
                slab = new PayoutChargeSlab();
            }

            slab.setMinAmount(dto.getMinAmount() != null ? dto.getMinAmount() : BigDecimal.ZERO);
            slab.setMaxAmount(dto.getMaxAmount() != null ? dto.getMaxAmount() : new BigDecimal("100000.00"));
            slab.setBaseCharge(base);
            slab.setGstRate(gstRate);
            slab.setGstAmount(gstAmount);
            slab.setTotalCharge(totalCharge);
            slab.setIsActive(dto.getIsActive() != null ? dto.getIsActive() : true);

            savedList.add(payoutChargeSlabRepository.save(slab));
        }

        return savedList.stream().map(s -> PayoutChargeSlabDto.builder()
                .id(s.getId())
                .minAmount(s.getMinAmount())
                .maxAmount(s.getMaxAmount())
                .baseCharge(s.getBaseCharge())
                .gstRate(s.getGstRate())
                .gstAmount(s.getGstAmount())
                .totalCharge(s.getTotalCharge())
                .isActive(s.getIsActive())
                .build()).toList();
    }

    public PayoutChargeSlabDto calculatePayoutCharge(BigDecimal transferAmount) {
        if (transferAmount == null) return null;
        List<PayoutChargeSlabDto> slabs = getPayoutChargeSlabs();
        for (PayoutChargeSlabDto slab : slabs) {
            if (transferAmount.compareTo(slab.getMinAmount()) >= 0 && transferAmount.compareTo(slab.getMaxAmount()) <= 0) {
                return slab;
            }
        }
        if (transferAmount.compareTo(new BigDecimal("25000")) >= 0) {
            return PayoutChargeSlabDto.builder()
                    .baseCharge(new BigDecimal("10.50"))
                    .gstRate(new BigDecimal("18.00"))
                    .gstAmount(new BigDecimal("1.89"))
                    .totalCharge(new BigDecimal("12.39"))
                    .build();
        } else {
            return PayoutChargeSlabDto.builder()
                    .baseCharge(new BigDecimal("5.50"))
                    .gstRate(new BigDecimal("18.00"))
                    .gstAmount(new BigDecimal("0.99"))
                    .totalCharge(new BigDecimal("6.49"))
                    .build();
        }
    }

    /**
     * Initiates an instant payout transfer to beneficiary bank account.
     * Enforces atomic wallet balance check and deduction, encrypted API communication,
     * duplicate submission prevention, and instant auto-refund on failure.
     */
    public PayoutResponse initiatePayout(PayoutRequest request, String rawUserId) {
        String cleanUserId = cleanUserIdString(rawUserId);
        UUID userUuid = parseUserUuid(cleanUserId);

        String orderId = request.getOrderId();
        if (orderId == null || orderId.isBlank()) {
            orderId = generateOrderId(cleanUserId);
        }

        // 1. Guard against duplicate orderId
        if (payoutTransactionRepository.existsByOrderId(orderId)) {
            throw new IllegalArgumentException("Duplicate transaction orderId: " + orderId);
        }

        BigDecimal amount = request.getAmount();
        if (amount == null || amount.compareTo(BigDecimal.valueOf(500)) < 0) {
            throw new IllegalArgumentException("Payout amount must be at least ₹500.00");
        }

        // Calculate payout charge & 18% GST
        PayoutChargeSlabDto chargeSlab = calculatePayoutCharge(amount);
        BigDecimal baseCharge = chargeSlab != null && chargeSlab.getBaseCharge() != null ? chargeSlab.getBaseCharge() : BigDecimal.ZERO;
        BigDecimal gstAmount = chargeSlab != null && chargeSlab.getGstAmount() != null ? chargeSlab.getGstAmount() : BigDecimal.ZERO;
        BigDecimal totalCharge = chargeSlab != null && chargeSlab.getTotalCharge() != null ? chargeSlab.getTotalCharge() : BigDecimal.ZERO;
        BigDecimal totalDeduction = amount.add(totalCharge);

        String rawAcc = request.getAccountNumber() != null ? request.getAccountNumber().trim() : "";
        String cleanAcc = rawAcc.replaceAll("[^0-9]", "");
        String rawIfsc = request.getIfsc() != null ? request.getIfsc().toUpperCase().trim() : "";

        // Verify recipient account has been APPROVED by Admin
        Optional<PayoutBeneficiary> approvedBene = payoutBeneficiaryRepository.findFirstByUserIdAndAccountNumberAndIfsc(cleanUserId, cleanAcc, rawIfsc);
        if (approvedBene.isEmpty() || !"APPROVED".equalsIgnoreCase(approvedBene.get().getStatus())) {
            throw new IllegalArgumentException("Payout transfer is only allowed to an Admin-Approved bank beneficiary. Please submit and wait for Admin approval.");
        }

        // Length validation as specified in Bustto documentation (bank_name max 20, bene_address max 54)
        String bankName = request.getBankName() != null && !request.getBankName().isBlank()
                ? request.getBankName().trim() : "Bank Transfer";
        if (bankName.length() > 20) {
            bankName = bankName.substring(0, 20);
        }

        String branchName = request.getBranchName() != null && !request.getBranchName().isBlank()
                ? request.getBranchName().trim() : "Branch";

        String beneAddress = request.getAddress() != null && !request.getAddress().isBlank()
                ? request.getAddress().trim() : "India";
        if (beneAddress.length() > 54) {
            beneAddress = beneAddress.substring(0, 54);
        }

        String mobile = request.getMobileNumber() != null && !request.getMobileNumber().isBlank()
                ? request.getMobileNumber().replaceAll("[^0-9]", "") : "";
        if (mobile.length() != 10) {
            try {
                User user = userRepository.findById(userUuid).orElse(null);
                if (user != null && user.getMobile() != null && !user.getMobile().isBlank()) {
                    String userMobile = user.getMobile().replaceAll("[^0-9]", "");
                    if (userMobile.length() >= 10) {
                        mobile = userMobile.substring(userMobile.length() - 10);
                    }
                }
            } catch (Exception e) {
                log.warn("Failed to fetch retailer mobile number from DB for user {}: {}", userUuid, e.getMessage());
            }
        }
        if (mobile.length() != 10) {
            mobile = "9876543210";
        }

        // 2. Persist initial PENDING transaction record
        PayoutTransaction transaction = PayoutTransaction.builder()
                .orderId(orderId)
                .userId(cleanUserId)
                .amount(amount)
                .chargeAmount(baseCharge)
                .gstAmount(gstAmount)
                .totalChargedAmount(totalCharge)
                .totalDeductedAmount(totalDeduction)
                .beneficiaryName(request.getBeneficiaryName())
                .accountNumber(cleanAcc)
                .ifsc(rawIfsc)
                .bankName(bankName)
                .transferMode(request.getTransferMode() != null ? request.getTransferMode() : "IMPS")
                .remarks(request.getRemarks())
                .mobileNumber(mobile)
                .status("PENDING")
                .build();

        payoutTransactionRepository.save(transaction);

        // 3. Atomically debit user's wallet (Transfer Amount + Payout Charges)
        try {
            walletService.debitForService(
                    userUuid,
                    totalDeduction,
                    "Payout of ₹" + amount + " to " + request.getBeneficiaryName() + " (" + cleanAcc + ") + Charges ₹" + totalCharge,
                    WalletTransactionContext.PAYOUT,
                    "PAYOUT",
                    "127.0.0.1",
                    orderId
            );
        } catch (Exception e) {
            log.error("Wallet debit failed for payout order {}: {}", orderId, e.getMessage());
            transaction.setStatus("FAILED");
            transaction.setResponseMessage(e.getMessage());
            payoutTransactionRepository.save(transaction);
            return PayoutResponse.builder()
                    .success(false)
                    .statusCode("WALLET_DEBIT_FAILED")
                    .status("FAILED")
                    .message(e.getMessage() != null && e.getMessage().contains("Insufficient")
                            ? "Insufficient wallet balance for payout. Required ₹" + totalDeduction + " (including ₹" + totalCharge + " payout charges)."
                            : "Could not process wallet deduction: " + e.getMessage())
                    .orderId(orderId)
                    .amount(amount)
                    .build();
        }

        // 4. Build payload matching provider specification
        Map<String, Object> rawPayload = new HashMap<>();
        rawPayload.put("amount", amount.doubleValue());
        rawPayload.put("external_order_id", orderId);
        rawPayload.put("bene_name", request.getBeneficiaryName().trim());
        rawPayload.put("bene_account_number", cleanAcc);
        rawPayload.put("bene_mobile", mobile.startsWith("+91") ? mobile : "+91" + mobile);
        rawPayload.put("bene_ifsc", rawIfsc);
        rawPayload.put("bank_name", bankName);
        rawPayload.put("branch_name", branchName);
        rawPayload.put("payment_mode", request.getTransferMode() != null ? request.getTransferMode() : "IMPS");
        rawPayload.put("bene_address", beneAddress);
        rawPayload.put("trn_rmks", request.getRemarks() != null && !request.getRemarks().isBlank()
                ? request.getRemarks() : "Payout transfer");

        String payoutUrl = payoutProperties.getFullPayoutUrl();
        HttpHeaders headers = createAuthHeaders();

        // 5. Execute Payout API call
        try {
            String rawJson = objectMapper.writeValueAsString(rawPayload);
            HttpEntity<?> entity;

            if (payoutProperties.isEncryptionEnabled() && payoutProperties.getAesKey() != null && !payoutProperties.getAesKey().isBlank()) {
                // Encrypted mode: wrap in {"request": "<encrypted>"}
                String encryptedBody = BusttoCryptoUtil.encrypt(payoutProperties.getAesKey(), rawJson);
                Map<String, String> requestBody = Map.of("request", encryptedBody);
                entity = new HttpEntity<>(requestBody, headers);
                log.info("Sending ENCRYPTED payout request to {} for orderId {}", payoutUrl, orderId);
            } else {
                // Plain JSON mode: send raw payload directly (BuckBox supports this per doc)
                entity = new HttpEntity<>(rawPayload, headers);
                log.info("Sending PLAIN JSON payout request to {} for orderId {}", payoutUrl, orderId);
            }
            ResponseEntity<String> response = restTemplate.exchange(payoutUrl, HttpMethod.POST, entity, String.class);

            String decryptedResponse = decryptResponseBody(response.getBody());
            log.info("Payout decrypted response for orderId {}: {}", orderId, decryptedResponse);

            JsonNode root = objectMapper.readTree(decryptedResponse);
            int statusCode = root.path("bbStatusCode").asInt(root.path("statusCode").asInt(-1));
            String statusMsg = root.path("bbStatusMsg").asText(root.path("status").asText("UNKNOWN"));
            JsonNode txnData = root.path("TransactionData");

            String bbTxnId = txnData.path("bbTransactionId").asText(txnData.path("transaction_id").asText(""));
            String bbTxnStatus = txnData.path("bbTransactionStatus").asText(txnData.path("status").asText(""));
            String bbReason = txnData.path("bbReason").asText(statusMsg);
            String utr = txnData.path("bbUtrNumber").asText(txnData.path("utr").asText(""));
            if ((utr == null || utr.isBlank()) && bbTxnId != null && !bbTxnId.isBlank()) {
                utr = bbTxnId;
            }

            transaction.setStatusCode(String.valueOf(statusCode));
            transaction.setResponseData(decryptedResponse);
            transaction.setUtr(utr);

            boolean isSuccess = statusCode == 0
                    || "INITIATED".equalsIgnoreCase(bbTxnStatus)
                    || "SUCCESS".equalsIgnoreCase(bbTxnStatus)
                    || "Successful".equalsIgnoreCase(bbTxnStatus)
                    || "SUCCESS".equalsIgnoreCase(statusMsg);

            if (isSuccess) {
                transaction.setStatus("SUCCESS");
                transaction.setResponseMessage(bbReason != null && !bbReason.isBlank() ? bbReason : "Transfer initiated successfully");
                payoutTransactionRepository.save(transaction);

                if (Boolean.TRUE.equals(request.getSaveBeneficiary())) {
                    autoSaveBeneficiary(request, cleanUserId);
                }

                return PayoutResponse.builder()
                        .success(true)
                        .statusCode(String.valueOf(statusCode))
                        .status("SUCCESS")
                        .message(bbReason != null && !bbReason.isBlank() ? bbReason : "Payout transferred successfully")
                        .orderId(orderId)
                        .transactionId(bbTxnId != null && !bbTxnId.isBlank() ? bbTxnId : orderId)
                        .utr(utr)
                        .amount(amount)
                        .beneficiaryName(request.getBeneficiaryName())
                        .accountNumber(cleanAcc)
                        .ifsc(rawIfsc)
                        .bankName(bankName)
                        .transferMode(request.getTransferMode())
                        .timestamp(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")))
                        .build();
            } else {
                String errorDetail = extractErrorMessage(root, decryptedResponse);
                log.warn("Payout rejected by provider for orderId {}: {}", orderId, errorDetail);

                transaction.setStatus("FAILED");
                transaction.setResponseMessage(errorDetail);
                payoutTransactionRepository.save(transaction);

                executeRefund(cleanUserId, totalDeduction, orderId, "Payout rejected: " + errorDetail);

                return PayoutResponse.builder()
                        .success(false)
                        .statusCode(String.valueOf(statusCode))
                        .status("FAILED")
                        .message(errorDetail)
                        .orderId(orderId)
                        .amount(amount)
                        .build();
            }

        } catch (HttpClientErrorException | HttpServerErrorException e) {
            String errorBody = e.getResponseBodyAsString();
            String decryptedError = decryptResponseBody(errorBody);
            log.error("Payout HTTP error {} for orderId {}: {}", e.getStatusCode(), orderId, decryptedError);

            String errorMsg = "Transfer failed with banking rail";
            try {
                JsonNode errRoot = objectMapper.readTree(decryptedError);
                errorMsg = extractErrorMessage(errRoot, decryptedError);
            } catch (Exception ignored) {}

            transaction.setStatus("FAILED");
            transaction.setStatusCode(String.valueOf(e.getStatusCode().value()));
            transaction.setResponseMessage(errorMsg);
            payoutTransactionRepository.save(transaction);

            executeRefund(cleanUserId, totalDeduction, orderId, "Payout failed: " + errorMsg);

            return PayoutResponse.builder()
                    .success(false)
                    .statusCode(String.valueOf(e.getStatusCode().value()))
                    .status("FAILED")
                    .message(errorMsg)
                    .orderId(orderId)
                    .amount(amount)
                    .build();

        } catch (Exception e) {
            log.error("Payout unexpected exception for orderId {}: {}", orderId, e.getMessage(), e);

            transaction.setStatus("FAILED");
            transaction.setStatusCode("500");
            transaction.setResponseMessage(e.getMessage());
            payoutTransactionRepository.save(transaction);

            executeRefund(cleanUserId, totalDeduction, orderId, "Payout error: " + e.getMessage());

            return PayoutResponse.builder()
                    .success(false)
                    .statusCode("500")
                    .status("FAILED")
                    .message("Payout request encountered an error: " + e.getMessage())
                    .orderId(orderId)
                    .amount(amount)
                    .build();
        }
    }

    /**
     * Bank Account Verification (Penny-less / Penny-drop).
     * Validates if the bank account exists and returns the legal Name At Bank.
     */
    public BankVerificationResponse verifyBankAccount(BankVerificationRequest request, String rawUserId) {
        try {
            Map<String, Object> rawPayload = new HashMap<>();
            rawPayload.put("account_number", request.getAccountNumber().trim());
            rawPayload.put("ifsc_code", request.getIfsc().toUpperCase().trim());

            String rawJson = objectMapper.writeValueAsString(rawPayload);
            HttpHeaders headers = createAuthHeaders();
            HttpEntity<?> entity;

            if (payoutProperties.isEncryptionEnabled() && payoutProperties.getAesKey() != null && !payoutProperties.getAesKey().isBlank()) {
                String encryptedBody = BusttoCryptoUtil.encrypt(payoutProperties.getAesKey(), rawJson);
                Map<String, String> requestBody = Map.of("request", encryptedBody);
                entity = new HttpEntity<>(requestBody, headers);
            } else {
                entity = new HttpEntity<>(rawPayload, headers);
            }

            String url = "penny-drop".equalsIgnoreCase(request.getMethod())
                    ? payoutProperties.getFullPennyDropUrl()
                    : payoutProperties.getFullPennyLessUrl();

            log.info("Verifying bank account with {} for ifsc {}", url, request.getIfsc());
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);

            String decryptedResponse = decryptResponseBody(response.getBody());
            log.info("Bank verification response: {}", decryptedResponse);

            JsonNode root = objectMapper.readTree(decryptedResponse);
            int statusCode = root.path("bbStatusCode").asInt(root.path("statusCode").asInt(-1));
            String statusMsg = root.path("bbStatusMsg").asText(root.path("status").asText(""));
            JsonNode txnData = root.path("TransactionData");

            String nameAtBank = txnData.path("nameAtBank").asText(
                    txnData.path("name_at_bank").asText(
                            txnData.path("beneficiary_name").asText(
                                    root.path("nameAtBank").asText(
                                            root.path("name_at_bank").asText("")
                                    )
                            )
                    )
            );

            String acValidationStatus = txnData.path("acValidationStatus").asText(
                    txnData.path("status").asText(
                            root.path("acValidationStatus").asText("ACCOUNT_VALID")
                    )
            );

            String verificationId = txnData.path("verification_id").asText(
                    txnData.path("verificationId").asText(
                            root.path("verification_id").asText("")
                    )
            );

            String utr = txnData.path("utr").asText(root.path("utr").asText(""));

            boolean isSuccess = statusCode == 0
                    || "SUCCESS".equalsIgnoreCase(statusMsg)
                    || "ACCEPTED".equalsIgnoreCase(statusMsg)
                    || "ACCEPTED".equalsIgnoreCase(txnData.path("status").asText())
                    || "ACCOUNT_VALID".equalsIgnoreCase(acValidationStatus)
                    || (!nameAtBank.isBlank() && !"null".equalsIgnoreCase(nameAtBank));

            if (isSuccess) {
                return BankVerificationResponse.builder()
                        .success(true)
                        .statusCode(statusCode >= 0 ? String.valueOf(statusCode) : "0")
                        .status("SUCCESS")
                        .message("Bank account verified successfully")
                        .nameAtBank(nameAtBank)
                        .acValidationStatus(acValidationStatus.isBlank() ? "ACCOUNT_VALID" : acValidationStatus)
                        .verificationId(verificationId)
                        .custAcctNo(request.getAccountNumber())
                        .custIfsc(request.getIfsc())
                        .utr(utr)
                        .build();
            } else {
                String errorMsg = extractErrorMessage(root, decryptedResponse);
                return BankVerificationResponse.builder()
                        .success(false)
                        .statusCode(String.valueOf(statusCode))
                        .status("FAILED")
                        .message(errorMsg)
                        .build();
            }

        } catch (HttpClientErrorException | HttpServerErrorException e) {
            String errorBody = e.getResponseBodyAsString();
            String decryptedError = decryptResponseBody(errorBody);
            log.error("Bank verification HTTP error {}: {}", e.getStatusCode(), decryptedError);

            String errorMsg = "Account verification failed";
            try {
                JsonNode errRoot = objectMapper.readTree(decryptedError);
                errorMsg = extractErrorMessage(errRoot, decryptedError);
            } catch (Exception ignored) {}

            return BankVerificationResponse.builder()
                    .success(false)
                    .statusCode(String.valueOf(e.getStatusCode().value()))
                    .status("FAILED")
                    .message(errorMsg)
                    .build();
        } catch (Exception e) {
            log.error("Bank verification unexpected error: {}", e.getMessage(), e);
            return BankVerificationResponse.builder()
                    .success(false)
                    .statusCode("500")
                    .status("FAILED")
                    .message("Failed to verify bank account: " + e.getMessage())
                    .build();
        }
    }

    /**
     * Checks real-time status of payout transaction.
     */
    public PayoutResponse checkPayoutStatus(String orderId, String rawUserId) {
        String cleanUserId = cleanUserIdString(rawUserId);
        PayoutTransaction txn = payoutTransactionRepository.findByOrderId(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Transaction not found: " + orderId));

        if (!cleanUserIdString(txn.getUserId()).equals(cleanUserId)) {
            throw new IllegalArgumentException("Unauthorized transaction access");
        }

        try {
            HttpHeaders headers = createAuthHeaders();
            HttpEntity<String> entity = new HttpEntity<>("{}", headers);

            String statusUrl = payoutProperties.getFullStatusUrl(txn.getOrderId());
            ResponseEntity<String> response = restTemplate.exchange(statusUrl, HttpMethod.GET, entity, String.class);
            String decryptedResponse = decryptResponseBody(response.getBody());

            JsonNode root = objectMapper.readTree(decryptedResponse);
            int statusCode = root.path("bbStatusCode").asInt(root.path("statusCode").asInt(-1));
            JsonNode txnData = root.path("TransactionData");

            String bbStatus = txnData.path("bbTransactionStatus").asText(txnData.path("status").asText(""));
            String utr = txnData.path("bbUtrNumber").asText(txnData.path("utr").asText(""));

            if (statusCode == 0 && ("Successful".equalsIgnoreCase(bbStatus) || "SUCCESS".equalsIgnoreCase(bbStatus))) {
                txn.setStatus("SUCCESS");
                if (utr != null && !utr.isBlank()) txn.setUtr(utr);
                payoutTransactionRepository.save(txn);
            } else if ("Failed".equalsIgnoreCase(bbStatus) || "FAILED".equalsIgnoreCase(bbStatus)) {
                if (!"FAILED".equalsIgnoreCase(txn.getStatus())) {
                    txn.setStatus("FAILED");
                    payoutTransactionRepository.save(txn);
                    BigDecimal refundAmt = txn.getTotalDeductedAmount() != null ? txn.getTotalDeductedAmount() : txn.getAmount();
                    executeRefund(cleanUserId, refundAmt, orderId, "Status check returned failed");
                }
            }

            return PayoutResponse.builder()
                    .success("SUCCESS".equalsIgnoreCase(txn.getStatus()))
                    .statusCode(String.valueOf(statusCode))
                    .status(txn.getStatus())
                    .message("Status: " + txn.getStatus())
                    .orderId(txn.getOrderId())
                    .utr(txn.getUtr())
                    .amount(txn.getAmount())
                    .beneficiaryName(txn.getBeneficiaryName())
                    .accountNumber(txn.getAccountNumber())
                    .ifsc(txn.getIfsc())
                    .build();

        } catch (Exception e) {
            log.error("Failed to query status for payout {}: {}", orderId, e.getMessage());
            return PayoutResponse.builder()
                    .success("SUCCESS".equalsIgnoreCase(txn.getStatus()))
                    .status(txn.getStatus())
                    .message("Current stored status: " + txn.getStatus())
                    .orderId(txn.getOrderId())
                    .utr(txn.getUtr())
                    .amount(txn.getAmount())
                    .build();
        }
    }

    public List<PayoutTransaction> getUserTransactions(String rawUserId) {
        String cleanUserId = cleanUserIdString(rawUserId);
        return payoutTransactionRepository.findByUserId(cleanUserId);
    }

    public PayoutTransaction getTransactionByOrderId(String orderId) {
        return payoutTransactionRepository.findByOrderId(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Transaction not found: " + orderId));
    }

    public String generateOrderId(String rawUserId) {
        String cleanUserId = cleanUserIdString(rawUserId);
        String dateStr = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        String randStr = UUID.randomUUID().toString().replace("-", "").substring(0, 4).toUpperCase();
        return "PO_" + dateStr + "_" + randStr;
    }

    private HttpHeaders createAuthHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(List.of(MediaType.APPLICATION_JSON));
        
        String apiKey = payoutProperties.getApiKey() != null ? payoutProperties.getApiKey().trim() : "";
        headers.set("Api-Key", apiKey);

        String jwtToken = BusttoJwtUtil.generateOrGetToken(
                payoutProperties.getJwtSecret(),
                payoutProperties.getMerchantId(),
                payoutProperties.getMerchantName(),
                payoutProperties.getMerchantEmail()
        );
        headers.set("Authorization", "Bearer " + jwtToken);
        return headers;
    }

    private String decryptResponseBody(String body) {
        if (body == null || body.isBlank()) return "{}";
        String trimmed = body.trim();
        try {
            if (trimmed.startsWith("{")) {
                JsonNode node = objectMapper.readTree(trimmed);
                if (node.has("response") && !node.get("response").isNull()) {
                    String cipher = node.get("response").asText();
                    return BusttoCryptoUtil.decrypt(payoutProperties.getAesKey(), cipher);
                }
                if (node.has("encrypted_payload") && !node.get("encrypted_payload").isNull()) {
                    String cipher = node.get("encrypted_payload").asText();
                    return BusttoCryptoUtil.decrypt(payoutProperties.getAesKey(), cipher);
                }
                if (node.has("request") && !node.get("request").isNull()) {
                    String cipher = node.get("request").asText();
                    return BusttoCryptoUtil.decrypt(payoutProperties.getAesKey(), cipher);
                }
                if (node.has("bbStatusCode") || node.has("status") || node.has("statusCode") || node.has("error") || node.has("detail") || node.has("TransactionData")) {
                    return trimmed;
                }
            }
            return BusttoCryptoUtil.decrypt(payoutProperties.getAesKey(), trimmed);
        } catch (Exception e) {
            log.warn("Payload decryption fallback to raw text: {}", e.getMessage());
            return trimmed;
        }
    }

    private String extractErrorMessage(JsonNode root, String rawBody) {
        if (root == null || root.isNull() || root.isMissingNode()) {
            return (rawBody != null && !rawBody.isBlank()) ? rawBody : "Transaction could not be processed";
        }
        
        // 1. Check bbErrorMsg
        JsonNode errNode = root.path("bbErrorMsg");
        if (errNode.isTextual() && !errNode.asText().isBlank() && !"{}".equals(errNode.asText().trim())) {
            return errNode.asText();
        }
        if (errNode.isObject() && errNode.size() > 0) {
            List<String> errors = new ArrayList<>();
            errNode.fieldNames().forEachRemaining(field -> {
                JsonNode val = errNode.get(field);
                if (val.isArray() && val.size() > 0) {
                    errors.add(field + ": " + val.get(0).asText());
                } else if (val.isTextual()) {
                    errors.add(field + ": " + val.asText());
                } else {
                    errors.add(field + ": " + val.toString());
                }
            });
            if (!errors.isEmpty()) {
                return String.join(", ", errors);
            }
        }
        if (errNode.isArray() && errNode.size() > 0) {
            return errNode.get(0).asText();
        }

        // 2. Check all standard error / message fields
        for (String key : List.of("bbStatusMsg", "message", "error", "detail", "bbReason", "status", "non_field_errors", "msg")) {
            JsonNode node = root.path(key);
            if (node.isTextual() && !node.asText().isBlank() && !"SUCCESS".equalsIgnoreCase(node.asText()) && !"{}".equals(node.asText().trim())) {
                return node.asText();
            }
            if (node.isArray() && node.size() > 0) {
                return key + ": " + node.get(0).asText();
            }
            if (node.isObject() && node.size() > 0) {
                return key + ": " + node.toString();
            }
        }

        // 3. Scan all root field names for array error messages
        List<String> fieldErrors = new ArrayList<>();
        root.fieldNames().forEachRemaining(fieldName -> {
            if (!"bbStatusCode".equals(fieldName) && !"statusCode".equals(fieldName) && !"TransactionData".equals(fieldName)) {
                JsonNode val = root.get(fieldName);
                if (val.isArray() && val.size() > 0) {
                    fieldErrors.add(fieldName + ": " + val.get(0).asText());
                } else if (val.isTextual() && !val.asText().isBlank() && !"SUCCESS".equalsIgnoreCase(val.asText())) {
                    fieldErrors.add(fieldName + ": " + val.asText());
                }
            }
        });
        if (!fieldErrors.isEmpty()) {
            return String.join(", ", fieldErrors);
        }

        if (rawBody != null && !rawBody.isBlank() && !"{}".equals(rawBody.trim())) {
            return rawBody;
        }

        return "Transaction rejected by provider";
    }

    private void executeRefund(String rawUserId, BigDecimal amount, String orderId, String reason) {
        try {
            UUID userUuid = parseUserUuid(rawUserId);
            walletService.refundForService(
                    userUuid,
                    amount,
                    reason,
                    orderId,
                    WalletTransactionContext.PAYOUT_REFUND,
                    "PAYOUT",
                    "127.0.0.1",
                    orderId + "_REFUND"
            );
            log.info("Successfully refunded ₹{} for payout order {}", amount, orderId);
        } catch (Exception e) {
            log.error("Automatic refund failed for order {}: {}", orderId, e.getMessage(), e);
        }
    }

    /**
     * Get all saved beneficiaries for user
     */
    public List<PayoutBeneficiaryDto> getBeneficiaries(String rawUserId) {
        String cleanUserId = cleanUserIdString(rawUserId);
        List<PayoutBeneficiary> list = payoutBeneficiaryRepository.findByUserIdOrderByCreatedAtDesc(cleanUserId);
        return list.stream().map(this::mapToBeneficiaryDto).toList();
    }

    /**
     * Add a new saved beneficiary (submitted as PENDING for admin approval)
     */
    public PayoutBeneficiaryDto addBeneficiary(PayoutBeneficiaryDto request, String rawUserId) {
        String cleanUserId = cleanUserIdString(rawUserId);
        String cleanAcc = request.getAccountNumber().trim();
        String rawIfsc = request.getIfsc().trim().toUpperCase();

        if (payoutBeneficiaryRepository.existsByUserIdAndAccountNumberAndIfsc(cleanUserId, cleanAcc, rawIfsc)) {
            throw new IllegalArgumentException("This bank account has already been registered in your beneficiaries.");
        }

        PayoutBeneficiary beneficiary = PayoutBeneficiary.builder()
                .userId(cleanUserId)
                .beneficiaryName(request.getBeneficiaryName().trim())
                .accountNumber(cleanAcc)
                .ifsc(rawIfsc)
                .bankName(request.getBankName() != null ? request.getBankName().trim() : null)
                .nickName(request.getNickName() != null ? request.getNickName().trim() : null)
                .isVerified(Boolean.TRUE.equals(request.getIsVerified()))
                .status("PENDING")
                .build();

        PayoutBeneficiary saved = payoutBeneficiaryRepository.save(beneficiary);
        log.info("Registered beneficiary {} (account: {}) for user {} with status PENDING", saved.getBeneficiaryName(), saved.getAccountNumber(), cleanUserId);
        return mapToBeneficiaryDto(saved);
    }

    /**
     * Delete a saved beneficiary
     */
    public void deleteBeneficiary(Long id, String rawUserId) {
        String cleanUserId = cleanUserIdString(rawUserId);
        PayoutBeneficiary bene = payoutBeneficiaryRepository.findByIdAndUserId(id, cleanUserId)
                .orElseThrow(() -> new IllegalArgumentException("Beneficiary not found or unauthorized"));
        payoutBeneficiaryRepository.delete(bene);
        log.info("Deleted beneficiary id {} for user {}", id, cleanUserId);
    }

    /**
     * Get all beneficiaries for Admin review with user details
     */
    public List<PayoutBeneficiaryDto> getAllBeneficiariesForAdmin() {
        List<PayoutBeneficiary> list = payoutBeneficiaryRepository.findAllByOrderByCreatedAtDesc();
        return list.stream().map(this::mapToBeneficiaryDtoWithUser).toList();
    }

    /**
     * Get beneficiary counts for Admin KPI
     */
    public Map<String, Long> getBeneficiaryStatsForAdmin() {
        Map<String, Long> stats = new HashMap<>();
        stats.put("pending", payoutBeneficiaryRepository.countByStatus("PENDING"));
        stats.put("approved", payoutBeneficiaryRepository.countByStatus("APPROVED"));
        stats.put("rejected", payoutBeneficiaryRepository.countByStatus("REJECTED"));
        stats.put("total", payoutBeneficiaryRepository.count());
        return stats;
    }

    /**
     * Admin approves a beneficiary
     */
    public PayoutBeneficiaryDto adminApproveBeneficiary(Long id, String adminId) {
        PayoutBeneficiary bene = payoutBeneficiaryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Beneficiary not found with ID: " + id));
        bene.setStatus("APPROVED");
        bene.setIsVerified(true);
        bene.setRejectionReason(null);
        bene.setActionedAt(LocalDateTime.now());
        bene.setActionedBy(adminId);
        PayoutBeneficiary saved = payoutBeneficiaryRepository.save(bene);
        log.info("Admin {} APPROVED beneficiary ID {} ({}) for user {}", adminId, id, saved.getBeneficiaryName(), saved.getUserId());
        return mapToBeneficiaryDtoWithUser(saved);
    }

    /**
     * Admin rejects a beneficiary
     */
    public PayoutBeneficiaryDto adminRejectBeneficiary(Long id, String reason, String adminId) {
        PayoutBeneficiary bene = payoutBeneficiaryRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Beneficiary not found with ID: " + id));
        bene.setStatus("REJECTED");
        bene.setRejectionReason(reason != null && !reason.isBlank() ? reason.trim() : "Details did not match banking records");
        bene.setActionedAt(LocalDateTime.now());
        bene.setActionedBy(adminId);
        PayoutBeneficiary saved = payoutBeneficiaryRepository.save(bene);
        log.info("Admin {} REJECTED beneficiary ID {} for user {} (Reason: {})", adminId, id, saved.getUserId(), bene.getRejectionReason());
        return mapToBeneficiaryDtoWithUser(saved);
    }

    /**
     * Automatically save beneficiary if not already present
     */
    private void autoSaveBeneficiary(PayoutRequest req, String userId) {
        try {
            String cleanAcc = req.getAccountNumber().trim();
            String rawIfsc = req.getIfsc().trim().toUpperCase();
            if (!payoutBeneficiaryRepository.existsByUserIdAndAccountNumberAndIfsc(userId, cleanAcc, rawIfsc)) {
                PayoutBeneficiary beneficiary = PayoutBeneficiary.builder()
                        .userId(userId)
                        .beneficiaryName(req.getBeneficiaryName().trim())
                        .accountNumber(cleanAcc)
                        .ifsc(rawIfsc)
                        .bankName(req.getBankName() != null ? req.getBankName().trim() : null)
                        .isVerified(true)
                        .status("APPROVED")
                        .build();
                payoutBeneficiaryRepository.save(beneficiary);
                log.info("Auto-saved new beneficiary {} ({}) for user {}", beneficiary.getBeneficiaryName(), cleanAcc, userId);
            }
        } catch (Exception e) {
            log.warn("Could not auto-save beneficiary: {}", e.getMessage());
        }
    }

    private PayoutBeneficiaryDto mapToBeneficiaryDto(PayoutBeneficiary bene) {
        return PayoutBeneficiaryDto.builder()
                .id(bene.getId())
                .userId(bene.getUserId())
                .beneficiaryName(bene.getBeneficiaryName())
                .accountNumber(bene.getAccountNumber())
                .ifsc(bene.getIfsc())
                .bankName(bene.getBankName())
                .nickName(bene.getNickName())
                .isVerified(bene.getIsVerified())
                .status(bene.getStatus())
                .rejectionReason(bene.getRejectionReason())
                .actionedAt(bene.getActionedAt())
                .actionedBy(bene.getActionedBy())
                .createdAt(bene.getCreatedAt())
                .build();
    }

    private PayoutBeneficiaryDto mapToBeneficiaryDtoWithUser(PayoutBeneficiary bene) {
        PayoutBeneficiaryDto dto = mapToBeneficiaryDto(bene);
        try {
            if (bene.getUserId() != null) {
                UUID uUuid = UUID.fromString(bene.getUserId().trim());
                userRepository.findById(uUuid).ifPresent(u -> {
                    dto.setUserPartyCode(u.getPartyCode() != null ? u.getPartyCode() : u.getUsername());
                    dto.setUserFullName(u.getFullName());
                    dto.setUserEmail(u.getEmail());
                    dto.setUserMobile(u.getMobile());
                });
            }
        } catch (Exception ignored) {}
        return dto;
    }
}
