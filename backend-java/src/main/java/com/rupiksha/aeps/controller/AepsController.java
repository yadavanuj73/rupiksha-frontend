package com.rupiksha.aeps.controller;

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

@Slf4j
@RestController
@RequestMapping("/api/v1/aeps")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class AepsController {

    private final AepsService aepsService;
    private final TransactionService transactionService;
    private final com.rupiksha.aeps.provider.fingpay.service.BankSyncService bankSyncService;


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
    public ResponseEntity<ApiResponse<String>> getTransactionStatus() {
        return ResponseEntity.ok(ApiResponse.success("AEPS Transaction status query endpoint active (Placeholder). Implementation pending."));
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
