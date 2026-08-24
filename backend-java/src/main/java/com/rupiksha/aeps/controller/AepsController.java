package com.rupiksha.aeps.controller;

import com.rupiksha.aeps.dto.request.BankEkycRequest;
import com.rupiksha.aeps.dto.request.OtpVerifyRequest;
import com.rupiksha.aeps.dto.request.DailyAuthRequest;
import com.rupiksha.aeps.dto.request.KycRequest;
import com.rupiksha.aeps.dto.response.KycResponse;
import com.rupiksha.backend.security.JwtPrincipal;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import com.rupiksha.aeps.dto.ApiResponse;
import com.rupiksha.aeps.dto.request.OnboardingRequest;
import com.rupiksha.aeps.dto.request.RdTestRequest;
import com.rupiksha.aeps.dto.response.OnboardingResponse;
import com.rupiksha.aeps.dto.response.RdTestResponse;
import com.rupiksha.aeps.dto.response.StatusResponse;
import com.rupiksha.aeps.service.AepsService;
import com.rupiksha.aeps.service.TransactionService;
import com.rupiksha.aeps.dto.TransactionResult;
import com.rupiksha.aeps.dto.request.AepsTransactionRequest;
import com.rupiksha.aeps.util.AepsUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.time.LocalDateTime;
import com.rupiksha.aeps.provider.fingpay.repository.FingBankRepository;
import com.rupiksha.aeps.provider.fingpay.entity.FingBank;
import com.rupiksha.aeps.provider.fingpay.service.CdStatusService;
import com.rupiksha.aeps.provider.fingpay.dto.CdStatusRequest;
import com.rupiksha.aeps.provider.fingpay.dto.CdStatusResponse;
import com.rupiksha.aeps.provider.fingpay.repository.FingpayTransactionRepository;
import com.rupiksha.aeps.provider.fingpay.entity.FingpayTransaction;
import com.rupiksha.aeps.repository.AepsTransactionEngineRepository;
import com.rupiksha.aeps.entity.AepsTransactionEngine;
import com.rupiksha.backend.service.WalletService;
import com.rupiksha.backend.domain.WalletTransactionContext;

@Slf4j
@RestController
@RequestMapping("/api/v1/aeps")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AepsController {

    private final AepsService aepsService;
    private final TransactionService transactionService;
    private final com.rupiksha.aeps.provider.fingpay.service.BankSyncService bankSyncService;
    private final FingBankRepository bankRepo;
    private final AepsTransactionEngineRepository engineTxnRepo;
    private final FingpayTransactionRepository txnRepo;
    private final CdStatusService cdStatusService;
    private final com.rupiksha.aeps.provider.fingpay.service.CwStatusService cwStatusService;
    private final WalletService walletService;



    /**
     * Checks the agent onboarding and KYC status in the database.
     */
    @GetMapping("/status")
    public ResponseEntity<StatusResponse> getStatus(
            @RequestParam String mobile,
            @RequestParam(required = false) String provider
    ) {
        log.info("REST request to check AEPS status for: {}, provider: {}", mobile, provider);
        StatusResponse response = aepsService.getAgentStatus(mobile, provider);
        return ResponseEntity.ok(response);
    }

    /**
     * Test active AEPS provider connectivity.
     */
    @GetMapping("/test-provider")
    public ResponseEntity<ApiResponse<Boolean>> testProvider() {
        boolean connected = aepsService.testActiveProvider();
        return ResponseEntity.ok(ApiResponse.success("Connection test completed successfully", connected));
    }

    /**
     * Performs merchant onboarding with the active AEPS provider.
     */
    @PostMapping("/onboard")
    public ResponseEntity<ApiResponse<OnboardingResponse>> onboard(@Valid @RequestBody OnboardingRequest request) {
        log.info("REST request to perform AEPS onboarding for mobile: {}", request.getAepsMobile());
        OnboardingResponse response = aepsService.onboard(request);

        boolean isSuccess = (response.getStatusId() != null && response.getStatusId() == 1) ||
                (response.getMessage() != null && response.getMessage().toLowerCase().contains("already"));

        if (isSuccess) {
            return ResponseEntity.ok(ApiResponse.success(
                    response.getMessage() != null ? response.getMessage() : "Onboarding completed successfully",
                    response
            ));
        } else {
            return ResponseEntity.badRequest().body(ApiResponse.error(
                    response.getMessage() != null ? response.getMessage() : "Onboarding failed"
            ));
        }
    }

    /**
     * Diagnostic endpoint validating local Mantra MFS110 RD capture PID XML.
     */
    @PostMapping("/rd/test")
    public ResponseEntity<ApiResponse<RdTestResponse>> validateRdTest(
            @Valid @RequestBody RdTestRequest request,
            jakarta.servlet.http.HttpServletRequest httpRequest) {
        
        // Audit log allowed attempt
        org.springframework.security.core.Authentication auth =
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        String userId = "unknown";
        String username = "unknown";
        java.util.List<String> roles = java.util.List.of();
        if (auth != null && auth.getPrincipal() instanceof com.rupiksha.backend.security.JwtPrincipal principal) {
            userId = principal.userId();
            username = principal.username();
            roles = principal.roles();
        }

        String ipAddress = httpRequest.getHeader("X-Forwarded-For");
        if (ipAddress == null || ipAddress.isBlank()) {
            ipAddress = httpRequest.getRemoteAddr();
        }

        log.info("ACCESS ATTEMPT ALLOWED: path=/api/v1/aeps/rd/test, userId={}, username={}, roles={}, ip={}, result=ALLOWED, timestamp={}",
                userId, username, roles, ipAddress, java.time.Instant.now());

        log.info("REST request to validate captured PID XML structure.");
        String pidXml = request.getPidXml();

        try {
            // Mask sensitive parts of raw XML before logging
            String maskedXml = AepsUtil.maskSensitiveData(pidXml);
            log.info("Incoming raw PID XML content (masked): {}", maskedXml);

            // Configure secure DOM DocumentBuilder (prevent XXE vulnerability)
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            DocumentBuilder builder = factory.newDocumentBuilder();
            Document doc = builder.parse(new ByteArrayInputStream(pidXml.getBytes(StandardCharsets.UTF_8)));

            Element root = doc.getDocumentElement();
            if (!"PidData".equalsIgnoreCase(root.getTagName())) {
                return ResponseEntity.badRequest().body(ApiResponse.error("Invalid XML: Root element must be 'PidData'"));
            }

            // Extract Resp node attributes
            NodeList respList = root.getElementsByTagName("Resp");
            if (respList.getLength() == 0) {
                return ResponseEntity.badRequest().body(ApiResponse.error("Invalid XML: Missing child element 'Resp'"));
            }
            Element resp = (Element) respList.item(0);
            String errCode = resp.getAttribute("errCode");
            String errInfo = resp.getAttribute("errInfo");
            String qScoreStr = resp.getAttribute("qScore");

            // Verify standard child elements: Skey, Hmac, DeviceInfo
            NodeList skeyList = root.getElementsByTagName("Skey");
            boolean hasSkey = skeyList.getLength() > 0 && !skeyList.item(0).getTextContent().isBlank();

            NodeList hmacList = root.getElementsByTagName("Hmac");
            boolean hasHmac = hmacList.getLength() > 0 && !hmacList.item(0).getTextContent().isBlank();

            NodeList devInfoList = root.getElementsByTagName("DeviceInfo");
            boolean hasDevInfo = devInfoList.getLength() > 0;
            String rdsVer = "";
            if (hasDevInfo) {
                Element devInfo = (Element) devInfoList.item(0);
                rdsVer = devInfo.getAttribute("rdsVer");
            }

            int quality = 0;
            if (qScoreStr != null && !qScoreStr.isBlank()) {
                try {
                    quality = Integer.parseInt(qScoreStr);
                } catch (NumberFormatException nfe) {
                    log.warn("Failed to parse qScore attribute: {}", qScoreStr);
                }
            }

            boolean isValid = "0".equals(errCode) && hasSkey && hasHmac && hasDevInfo;
            String message = isValid ? "PID XML validation checks passed successfully" : "PID XML structural checks failed. Error: " + errInfo;

            RdTestResponse payload = RdTestResponse.builder()
                    .success(isValid)
                    .rdVersion(rdsVer)
                    .pidVersion(root.getAttribute("ver"))
                    .captureQuality(quality)
                    .timestamp(resp.getAttribute("fNm")) // Use UIDAI timestamp flag
                    .message(message)
                    .build();

            return ResponseEntity.ok(ApiResponse.success(message, payload));

        } catch (Exception e) {
            log.error("XML validation error: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(ApiResponse.error("Failed to parse XML: " + e.getMessage()));
        }
    }

    /* --- Core AEPS KYC Flow --- */

    @PostMapping("/aeps-kyc")
    public ResponseEntity<ApiResponse<KycResponse>> kyc(@Valid @RequestBody KycRequest request) {
        log.info("REST request to submit AEPS biometric KYC.");

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof JwtPrincipal)) {
            return ResponseEntity.status(401).body(ApiResponse.error("Merchant session is unauthenticated or expired."));
        }
        JwtPrincipal principal = (JwtPrincipal) auth.getPrincipal();
        String mobile = principal.username(); // CustomUserDetailsService maps username to mobile
        if (mobile == null || mobile.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Failed to resolve mobile number from auth token."));
        }

        KycResponse response = aepsService.kyc(request, mobile);

        if (response.isSuccess()) {
            return ResponseEntity.ok(ApiResponse.success(response.getMessage(), response));
        } else {
            return ResponseEntity.badRequest().body(ApiResponse.error(response.getMessage(), response));
        }
    }

    @PostMapping("/otp-verify")
    public ResponseEntity<ApiResponse<KycResponse>> verifyKycOtp(@Valid @RequestBody OtpVerifyRequest request) {
        log.info("REST request to verify AEPS biometric KYC OTP.");

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof JwtPrincipal)) {
            return ResponseEntity.status(401).body(ApiResponse.error("Merchant session is unauthenticated or expired."));
        }
        JwtPrincipal principal = (JwtPrincipal) auth.getPrincipal();
        String mobile = principal.username(); // CustomUserDetailsService maps username to mobile
        if (mobile == null || mobile.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Failed to resolve mobile number from auth token."));
        }

        KycResponse response = aepsService.verifyOtp(request, mobile);

        if (response.isSuccess()) {
            return ResponseEntity.ok(ApiResponse.success(response.getMessage(), response));
        } else {
            return ResponseEntity.badRequest().body(ApiResponse.error(response.getMessage(), response));
        }
    }

    @PostMapping("/daily-authenticate")
    public ResponseEntity<ApiResponse<KycResponse>> dailyAuthenticate(@Valid @RequestBody DailyAuthRequest request) {
        log.info("REST request to submit AEPS Daily 2FA authentication.");

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof JwtPrincipal)) {
            return ResponseEntity.status(401).body(ApiResponse.error("Merchant session is unauthenticated or expired."));
        }
        JwtPrincipal principal = (JwtPrincipal) auth.getPrincipal();
        String mobile = principal.username(); // CustomUserDetailsService maps username to mobile
        if (mobile == null || mobile.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Failed to resolve mobile number from auth token."));
        }

        KycResponse response = aepsService.dailyAuthenticate(request, mobile);

        if (response.isSuccess()) {
            return ResponseEntity.ok(ApiResponse.success(response.getMessage(), response));
        } else {
            return ResponseEntity.badRequest().body(ApiResponse.error(response.getMessage(), response));
        }
    }

    /**
     * Submits biometric fingerprint for the mandatory Bank eKYC (BeKYC) step.
     * Must be called when the merchant's workflow state is BANK_EKYC_REQUIRED.
     */
    @PostMapping("/bank-ekyc")
    public ResponseEntity<ApiResponse<KycResponse>> completeBankEkyc(@RequestBody BankEkycRequest request) {
        log.info("REST request to submit Bank eKYC biometric.");

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof JwtPrincipal)) {
            return ResponseEntity.status(401).body(ApiResponse.error("Merchant session is unauthenticated or expired."));
        }
        JwtPrincipal principal = (JwtPrincipal) auth.getPrincipal();
        String mobile = principal.username();
        if (mobile == null || mobile.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Failed to resolve mobile number from auth token."));
        }

        KycResponse response = aepsService.completeBankEkyc(request, mobile);

        if (response.isSuccess()) {
            return ResponseEntity.ok(ApiResponse.success(response.getMessage(), response));
        } else {
            return ResponseEntity.badRequest().body(ApiResponse.error(response.getMessage(), response));
        }
    }

    /**
     * Checks the eKYC or Bank eKYC status from Fingpay.
     * kycType = "EKYC" for standard eKYC, "BeKYC" for bank eKYC.
     */
    @PostMapping("/ekyc-status")
    public ResponseEntity<ApiResponse<KycResponse>> checkEkycStatus(@RequestBody Map<String, String> body) {
        log.info("REST request to check eKYC status.");

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof JwtPrincipal)) {
            return ResponseEntity.status(401).body(ApiResponse.error("Merchant session is unauthenticated or expired."));
        }
        JwtPrincipal principal = (JwtPrincipal) auth.getPrincipal();
        String mobile = principal.username();
        if (mobile == null || mobile.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Failed to resolve mobile number from auth token."));
        }

        String kycType = body.getOrDefault("kycType", "EKYC");
        KycResponse response = aepsService.checkEkycStatus(mobile, kycType);

        if (response.isSuccess()) {
            return ResponseEntity.ok(ApiResponse.success(response.getMessage(), response));
        } else {
            return ResponseEntity.badRequest().body(ApiResponse.error(response.getMessage(), response));
        }
    }

    /**
     * Generates customer Aadhaar OTP for CW / AP transactions with amount > 5000.
     */
    @PostMapping("/send-txn-otp")
    public ResponseEntity<ApiResponse<com.rupiksha.aeps.dto.response.AepsTxnOtpResponse>> sendTxnOtp(@Valid @RequestBody com.rupiksha.aeps.dto.request.AepsTxnOtpRequest request) {
        log.info("REST request to send transaction OTP for amount > 5000: amount={}, service={}", request.getAmount(), request.getServiceType());

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof JwtPrincipal)) {
            return ResponseEntity.status(401).body(ApiResponse.error("Merchant session is unauthenticated or expired."));
        }
        JwtPrincipal principal = (JwtPrincipal) auth.getPrincipal();
        String mobile = principal.username();
        if (mobile == null || mobile.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Failed to resolve mobile number from auth token."));
        }

        com.rupiksha.aeps.dto.response.AepsTxnOtpResponse response = aepsService.sendTxnOtp(request, mobile);

        if (response.isSuccess()) {
            return ResponseEntity.ok(ApiResponse.success(response.getMessage(), response));
        } else {
            return ResponseEntity.badRequest().body(ApiResponse.error(response.getMessage(), response));
        }
    }

    @PostMapping("/transaction")
    public ResponseEntity<ApiResponse<TransactionResult>> transact(@Valid @RequestBody AepsTransactionRequest request) {
        log.info("REST request to execute AEPS transaction.");

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof JwtPrincipal)) {
            return ResponseEntity.status(401).body(ApiResponse.error("Merchant session is unauthenticated or expired."));
        }
        JwtPrincipal principal = (JwtPrincipal) auth.getPrincipal();
        String mobile = principal.username(); // CustomUserDetailsService maps username to mobile
        if (mobile == null || mobile.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Failed to resolve mobile number from auth token."));
        }

        TransactionResult result = transactionService.executeTransaction(request, mobile);

        if ("SUCCESS".equalsIgnoreCase(result.getStatus())) {
            return ResponseEntity.ok(ApiResponse.success(
                    result.getResponseMessage() != null ? result.getResponseMessage() : "Transaction approved successfully", 
                    result
            ));
        } else {
            return ResponseEntity.badRequest().body(ApiResponse.error(
                    result.getResponseMessage() != null ? result.getResponseMessage() : "Transaction failed", 
                    result
            ));
        }
    }


    @PostMapping("/transaction-status")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getTransactionStatus(@RequestBody Map<String, String> reqBody) {
        String transactionId = reqBody.get("transactionId");
        log.info("REST request to reconcile transaction status for: {}", transactionId);
        
        AepsTransactionEngine engineTxn = engineTxnRepo.findByTransactionId(transactionId)
                .orElseThrow(() -> new RuntimeException("Transaction not found for ID: " + transactionId));
        
        String provider = engineTxn.getProvider() != null ? engineTxn.getProvider().toLowerCase() : "levin";
        String serviceType = engineTxn.getServiceType() != null ? engineTxn.getServiceType().toUpperCase() : "";
        
        Map<String, Object> result = new HashMap<>();
        result.put("transactionId", transactionId);
        result.put("serviceType", serviceType);
        result.put("provider", provider);
        
        if ("fingpay".equals(provider)) {
            long uidLong = engineTxn.getUserId().getMostSignificantBits() & Long.MAX_VALUE;
            
            if ("CASH_DEPOSIT".equals(serviceType)) {
                CdStatusRequest request = new CdStatusRequest();
                request.setUid(uidLong);
                request.setMerchantTranId(transactionId);
                
                CdStatusResponse resp = cdStatusService.checkStatus(request);
                result.put("status", resp.getTransactionStatus());
                result.put("message", resp.getTransactionStatusMessage());
                result.put("rrn", resp.getBankRRN());
                result.put("fpTxnId", resp.getFingpayTransactionId());
                result.put("amount", resp.getTransactionAmount());
                
                reconcileCdStatus(engineTxn, resp);
            } else if ("CASH_WITHDRAWAL".equals(serviceType)) {
                com.rupiksha.aeps.provider.fingpay.dto.CwStatusRequest request = new com.rupiksha.aeps.provider.fingpay.dto.CwStatusRequest();
                request.setUid(uidLong);
                request.setMerchantTranId(transactionId);
                
                com.rupiksha.aeps.provider.fingpay.dto.CwStatusResponse resp = cwStatusService.checkStatus(request);
                result.put("apiStatus", resp.isApiStatus());
                result.put("message", resp.getApiStatusMessage());
                result.put("data", resp.getData());
                
                reconcileCwStatus(engineTxn, resp);
                result.put("status", engineTxn.getStatus());
                result.put("message", engineTxn.getProviderMessage());
            } else {
                result.put("status", engineTxn.getStatus());
                result.put("message", engineTxn.getProviderMessage());
            }
        } else {
            result.put("status", engineTxn.getStatus());
            result.put("message", engineTxn.getProviderMessage());
        }
        
        result.put("reconciledStatus", engineTxn.getStatus());
        return ResponseEntity.ok(ApiResponse.success("Status reconciled successfully", result));
    }

    private void reconcileCdStatus(AepsTransactionEngine engineTxn, CdStatusResponse resp) {
        String currentStatus = engineTxn.getStatus();
        String providerStatus = resp.getTransactionStatus();
        
        if ("SUCCESS".equalsIgnoreCase(providerStatus) || "00".equals(resp.getTransactionStatusCode())) {
            if (!"SUCCESS".equalsIgnoreCase(currentStatus)) {
                engineTxn.setStatus("SUCCESS");
                engineTxn.setWorkflowState("SUCCESS");
                engineTxn.setProviderReference(resp.getFingpayTransactionId());
                engineTxn.setProviderStatus("SUCCESS");
                engineTxn.setProviderMessage(resp.getTransactionStatusMessage() != null ? resp.getTransactionStatusMessage() : "Approved");
                engineTxn.setCompletedAt(LocalDateTime.now());
                engineTxnRepo.save(engineTxn);
                
                txnRepo.findByTxnid(engineTxn.getTransactionId()).ifPresent(t -> {
                    t.setStatus("SUCCESS");
                    t.setMessage(resp.getTransactionStatusMessage());
                    t.setRrn(resp.getBankRRN());
                    t.setFtxnin(resp.getFingpayTransactionId());
                    txnRepo.save(t);
                });
            }
        } else if ("FAILED".equalsIgnoreCase(providerStatus) || "FAILURE".equalsIgnoreCase(providerStatus) ||
                   ("00".equals(resp.getTransactionStatusCode()) == false && "FP009".equalsIgnoreCase(resp.getTransactionStatusCode()) == false && resp.getTransactionStatusCode() != null && !resp.getTransactionStatusCode().isEmpty() && !resp.getTransactionStatusCode().equalsIgnoreCase("null"))) {
            if (!"FAILED".equalsIgnoreCase(currentStatus)) {
                engineTxn.setStatus("FAILED");
                engineTxn.setWorkflowState("FAILED");
                engineTxn.setProviderReference(resp.getFingpayTransactionId());
                engineTxn.setProviderStatus("FAILED");
                engineTxn.setProviderMessage(resp.getTransactionStatusMessage() != null ? resp.getTransactionStatusMessage() : "Failed");
                engineTxn.setCompletedAt(LocalDateTime.now());
                engineTxnRepo.save(engineTxn);
                
                txnRepo.findByTxnid(engineTxn.getTransactionId()).ifPresent(t -> {
                    t.setStatus("FAILED");
                    t.setMessage(resp.getTransactionStatusMessage());
                    txnRepo.save(t);
                });

                try {
                    log.info("Refunding wallet for failed AEPS Cash Deposit (reconciliation): {}, user: {}, amount: {}", 
                            engineTxn.getTransactionId(), engineTxn.getUserId(), engineTxn.getAmount());
                    walletService.refundForService(
                            engineTxn.getUserId(),
                            engineTxn.getAmount(),
                            "AEPS Cash Deposit Reversal - " + engineTxn.getTransactionId(),
                            engineTxn.getTransactionId(),
                            WalletTransactionContext.REVERSAL,
                            "AEPS",
                            engineTxn.getIpAddress() != null ? engineTxn.getIpAddress() : "127.0.0.1",
                            "REF-" + engineTxn.getTransactionId()
                    );
                    log.info("Successfully refunded wallet for failed AEPS Cash Deposit (reconciliation): {}", engineTxn.getTransactionId());
                } catch (Exception e) {
                    log.error("Failed to refund wallet during reconciliation for {}: {}", engineTxn.getTransactionId(), e.getMessage());
                }
            }
        }
    }

    private void reconcileCwStatus(AepsTransactionEngine engineTxn, com.rupiksha.aeps.provider.fingpay.dto.CwStatusResponse resp) {
        if (!resp.isApiStatus() || resp.getData() == null) {
            return;
        }

        try {
            boolean isApproved = false;
            boolean isDeclined = false;
            String bankRrn = null;
            String fpTxnId = null;
            String statusMsg = null;

            if (resp.getData() instanceof java.util.List<?> list && !list.isEmpty()) {
                Object item = list.get(0);
                if (item instanceof Map<?, ?> map) {
                    Object txnStatus = map.get("transactionStatus");
                    Object code = map.get("transactionStatusCode");
                    bankRrn = map.get("bankRRN") != null ? String.valueOf(map.get("bankRRN")) : null;
                    fpTxnId = map.get("fingpayTransactionId") != null ? String.valueOf(map.get("fingpayTransactionId")) : null;
                    statusMsg = map.get("transactionStatusMessage") != null ? String.valueOf(map.get("transactionStatusMessage")) : null;

                    if (Boolean.TRUE.equals(txnStatus) || "00".equals(code)) {
                        isApproved = true;
                    } else if (Boolean.FALSE.equals(txnStatus) || ("FP009".equals(code) == false && code != null)) {
                        isDeclined = true;
                    }
                }
            } else if (resp.getData() instanceof Map<?, ?> map) {
                Object txnStatus = map.get("transactionStatus");
                Object code = map.get("transactionStatusCode");
                bankRrn = map.get("bankRRN") != null ? String.valueOf(map.get("bankRRN")) : null;
                fpTxnId = map.get("fingpayTransactionId") != null ? String.valueOf(map.get("fingpayTransactionId")) : null;
                statusMsg = map.get("transactionStatusMessage") != null ? String.valueOf(map.get("transactionStatusMessage")) : null;

                if (Boolean.TRUE.equals(txnStatus) || "00".equals(code)) {
                    isApproved = true;
                } else if (Boolean.FALSE.equals(txnStatus) || ("FP009".equals(code) == false && code != null)) {
                    isDeclined = true;
                }
            }

            String currentStatus = engineTxn.getStatus();
            if (isApproved && !"SUCCESS".equalsIgnoreCase(currentStatus)) {
                engineTxn.setStatus("SUCCESS");
                engineTxn.setWorkflowState("SUCCESS");
                if (fpTxnId != null) engineTxn.setProviderReference(fpTxnId);
                engineTxn.setProviderStatus("SUCCESS");
                engineTxn.setProviderMessage(statusMsg != null ? statusMsg : "Approved");
                engineTxn.setCompletedAt(LocalDateTime.now());
                engineTxnRepo.save(engineTxn);

                final String finalRrn = bankRrn;
                final String finalFpTxnId = fpTxnId;
                final String finalMsg = statusMsg;

                txnRepo.findByTxnid(engineTxn.getTransactionId()).ifPresent(t -> {
                    t.setStatus("SUCCESS");
                    if (finalMsg != null) t.setMessage(finalMsg);
                    if (finalRrn != null) t.setRrn(finalRrn);
                    if (finalFpTxnId != null) t.setFtxnin(finalFpTxnId);
                    txnRepo.save(t);
                });

                // Credit retailer wallet if not already credited
                try {
                    log.info("Crediting wallet for reconciled successful AEPS Cash Withdrawal: {}, user: {}, amount: {}",
                            engineTxn.getTransactionId(), engineTxn.getUserId(), engineTxn.getAmount());
                    walletService.creditForService(
                            engineTxn.getUserId(),
                            engineTxn.getAmount(),
                            "AEPS Cash Withdrawal (Reconciled) - " + engineTxn.getTransactionId(),
                            WalletTransactionContext.AEPS_CASH_WITHDRAWAL,
                            "AEPS",
                            engineTxn.getIpAddress() != null ? engineTxn.getIpAddress() : "127.0.0.1",
                            engineTxn.getTransactionId()
                    );
                    log.info("Successfully credited wallet for reconciled AEPS Cash Withdrawal: {}", engineTxn.getTransactionId());
                } catch (Exception e) {
                    log.error("Failed to credit wallet during CW reconciliation for {}: {}", engineTxn.getTransactionId(), e.getMessage());
                }
            } else if (isDeclined && !"FAILED".equalsIgnoreCase(currentStatus)) {
                engineTxn.setStatus("FAILED");
                engineTxn.setWorkflowState("FAILED");
                if (fpTxnId != null) engineTxn.setProviderReference(fpTxnId);
                engineTxn.setProviderStatus("FAILED");
                engineTxn.setProviderMessage(statusMsg != null ? statusMsg : "Failed");
                engineTxn.setCompletedAt(LocalDateTime.now());
                engineTxnRepo.save(engineTxn);

                final String finalMsg = statusMsg;
                txnRepo.findByTxnid(engineTxn.getTransactionId()).ifPresent(t -> {
                    t.setStatus("FAILED");
                    if (finalMsg != null) t.setMessage(finalMsg);
                    txnRepo.save(t);
                });
            }
        } catch (Exception e) {
            log.error("Failed to reconcile CW status for {}: {}", engineTxn.getTransactionId(), e.getMessage(), e);
        }
    }


    /**
     * Retrieves the list of Fingpay banks.
     */
    @GetMapping("/banks")
    public ResponseEntity<ApiResponse<List<FingBank>>> getBanks() {
        log.info("REST request to fetch Fingpay banks list.");
        List<FingBank> banks = bankRepo.findAll();
        if (banks.isEmpty() || banks.size() <= 5) {
            try {
                int count = bankSyncService.syncBanks();
                log.info("Auto-synced {} banks from Fingpay live API", count);
                banks = bankRepo.findAll();
            } catch (Exception e) {
                log.warn("Auto sync banks from Fingpay failed: {}", e.getMessage());
            }
        }
        return ResponseEntity.ok(ApiResponse.success("Banks retrieved successfully", banks));
    }

    @GetMapping("/sync-banks")
    public ResponseEntity<ApiResponse<String>> syncBanks() {
        log.info("REST request to sync Fingpay banks.");
        try {
            int count = bankSyncService.syncBanks();
            return ResponseEntity.ok(ApiResponse.success("Successfully synchronized " + count + " banks from Fingpay API", "Synced " + count + " banks"));
        } catch (Exception e) {
            log.error("Failed to synchronize banks from Fingpay API", e);
            return ResponseEntity.internalServerError().body(ApiResponse.error("Bank synchronization failed: " + e.getMessage()));
        }
    }
}
