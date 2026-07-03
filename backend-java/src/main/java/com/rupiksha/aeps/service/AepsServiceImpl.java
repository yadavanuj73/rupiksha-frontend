package com.rupiksha.aeps.service;

import com.rupiksha.aeps.dto.request.KycRequest;
import com.rupiksha.aeps.dto.request.OtpVerifyRequest;
import com.rupiksha.aeps.dto.request.DailyAuthRequest;
import com.rupiksha.aeps.dto.response.KycResponse;
import com.rupiksha.aeps.dto.response.AepsWorkflowState;
import com.rupiksha.aeps.dto.response.ProviderKycResult;
import com.rupiksha.aeps.entity.User;
import com.rupiksha.aeps.entity.AepsKycHistory;
import com.rupiksha.aeps.repository.AepsUserRepository;
import com.rupiksha.aeps.repository.AepsKycHistoryRepository;
import com.rupiksha.aeps.config.AepsProperties;
import com.rupiksha.aeps.dto.request.OnboardingRequest;
import com.rupiksha.aeps.dto.response.OnboardingResponse;
import com.rupiksha.aeps.dto.response.StatusResponse;
import com.rupiksha.aeps.exception.AepsException;
import com.rupiksha.aeps.provider.AepsProvider;
import com.rupiksha.aeps.provider.fingpay.entity.AepsKyc;
import com.rupiksha.aeps.provider.fingpay.repository.AepsKycRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Slf4j
@Service
public class AepsServiceImpl implements AepsService {

    private final List<AepsProvider> providers;
    private final AepsProperties aepsProperties;
    private final AepsUserRepository aepsUserRepository;
    private final com.rupiksha.backend.repository.UserRepository mainUserRepository;
    private final AepsKycHistoryRepository aepsKycHistoryRepository;
    private final AepsKycRepository aepsKycRepository;

    @Autowired
    public AepsServiceImpl(
            List<AepsProvider> providers,
            AepsProperties aepsProperties,
            @Qualifier("aepsUserRepository") AepsUserRepository aepsUserRepository,
            @Qualifier("userRepository") com.rupiksha.backend.repository.UserRepository mainUserRepository,
            AepsKycHistoryRepository aepsKycHistoryRepository,
            AepsKycRepository aepsKycRepository
    ) {
        this.providers = providers;
        this.aepsProperties = aepsProperties;
        this.aepsUserRepository = aepsUserRepository;
        this.mainUserRepository = mainUserRepository;
        this.aepsKycHistoryRepository = aepsKycHistoryRepository;
        this.aepsKycRepository = aepsKycRepository;
    }

    private User getOrSyncAepsUser(String mobile) {
        Optional<User> userOpt = aepsUserRepository.findByMobile(mobile)
                .or(() -> aepsUserRepository.findByUsername(mobile));
        if (userOpt.isPresent()) {
            return userOpt.get();
        }

        // Try syncing from main core user registry
        Optional<com.rupiksha.backend.domain.User> coreUserOpt = mainUserRepository.findByMobile(mobile)
                .or(() -> mainUserRepository.findByUsername(mobile));
        if (coreUserOpt.isPresent()) {
            com.rupiksha.backend.domain.User coreUser = coreUserOpt.get();
            User aepsUser = new User();
            aepsUser.setMobile(coreUser.getMobile());
            aepsUser.setUsername(coreUser.getUsername());
            aepsUser.setEmail(coreUser.getEmail());
            aepsUser.setName(coreUser.getFullName());
            aepsUser.setAepsAgentId(coreUser.getAepsAgentId());
            aepsUser.setAepsMerchantId(coreUser.getAepsMerchantId());
            aepsUser.setAepsOnboarded(coreUser.getAepsOnboarded());
            aepsUser.setAepsKycDone(coreUser.getAepsKycDone());
            aepsUser.setAepsKycRefId(coreUser.getAepsKycRefId());
            aepsUser.setAepsKycTxnId(coreUser.getAepsKycTxnId());
            if (coreUser.getAepsKycCompletedAt() != null) {
                aepsUser.setAepsKycCompletedAt(java.time.LocalDateTime.ofInstant(coreUser.getAepsKycCompletedAt(), java.time.ZoneId.systemDefault()));
            }
            aepsUser.setAeps2faSessionId(coreUser.getAeps2faSessionId());
            if (coreUser.getAeps2faAuthenticatedAt() != null) {
                aepsUser.setAeps2faAuthenticatedAt(java.time.LocalDateTime.ofInstant(coreUser.getAeps2faAuthenticatedAt(), java.time.ZoneId.systemDefault()));
            }
            log.info("Synchronizing core user to AEPS registry for mobile: {}", mobile);
            return aepsUserRepository.save(aepsUser);
        }
        return null;
    }

    @Override
    public StatusResponse getAgentStatus(String mobile, String provider) {
        log.info("Checking AEPS status details for mobile: {}, provider: {}", mobile, provider);
        
        Optional<com.rupiksha.backend.domain.User> coreUserOpt = mainUserRepository.findByMobile(mobile)
                .or(() -> mainUserRepository.findByUsername(mobile));
        if (coreUserOpt.isEmpty()) {
            return StatusResponse.builder().onboarded(false).kycDone(false).aeps2faDone(false).build();
        }
        com.rupiksha.backend.domain.User coreUser = coreUserOpt.get();
        long uidLong = coreUser.getId().getMostSignificantBits() & Long.MAX_VALUE;

        if ("fingpay".equalsIgnoreCase(provider)) {
            Optional<AepsKyc> kycOpt = aepsKycRepository.findByUid(uidLong);
            if (kycOpt.isPresent()) {
                AepsKyc kyc = kycOpt.get();
                boolean hasValidSession = false;
                if (coreUser.getAeps2faSessionId() != null && coreUser.getAeps2faSessionId().startsWith("FGP") && coreUser.getAeps2faAuthenticatedAt() != null) {
                    java.time.LocalDate authenticatedDate = coreUser.getAeps2faAuthenticatedAt().atZone(java.time.ZoneId.systemDefault()).toLocalDate();
                    java.time.LocalDate today = java.time.LocalDate.now();
                    hasValidSession = authenticatedDate.isEqual(today);
                }

                return StatusResponse.builder()
                        .onboarded(true)
                        .kycDone(kyc.getKycDone() != null && kyc.getKycDone())
                        .aeps2faDone(hasValidSession)
                        .agentId(kyc.getOutlet())
                        .merchantId(kyc.getMerchantId() != null ? kyc.getMerchantId() : kyc.getOutlet())
                        .build();
            } else {
                return StatusResponse.builder()
                        .onboarded(false)
                        .kycDone(false)
                        .aeps2faDone(false)
                        .build();
            }
        } else {
            // Default to Levin
            User user = getOrSyncAepsUser(mobile);
            if (user != null) {
                boolean hasValidSession = false;
                if (user.getAeps2faSessionId() != null && !user.getAeps2faSessionId().startsWith("FGP") && user.getAeps2faAuthenticatedAt() != null) {
                    java.time.LocalDate authenticatedDate = user.getAeps2faAuthenticatedAt().toLocalDate();
                    java.time.LocalDate today = java.time.LocalDate.now();
                    hasValidSession = authenticatedDate.isEqual(today);
                }

                return StatusResponse.builder()
                        .onboarded(user.getAepsOnboarded() != null && user.getAepsOnboarded())
                        .kycDone(user.getAepsKycDone() != null && user.getAepsKycDone())
                        .aeps2faDone(hasValidSession)
                        .agentId(user.getAepsAgentId())
                        .merchantId(user.getAepsMerchantId())
                        .build();
            }
            return StatusResponse.builder()
                    .onboarded(false)
                    .kycDone(false)
                    .aeps2faDone(false)
                    .build();
        }
    }

    @Override
    public boolean testActiveProvider() {
        log.info("Testing active provider connection...");
        try {
            AepsProvider active = getActiveProvider();
            return active.testConnection();
        } catch (Exception e) {
            log.error("Active provider connection test failed: {}", e.getMessage());
            return false;
        }
    }

    @Override
    @Transactional
    public OnboardingResponse onboard(OnboardingRequest request) {
        log.info("Executing transactional onboarding via service layers...");
        AepsProvider activeProvider = getActiveProvider();
        OnboardingResponse response = activeProvider.onboard(request);
        
        boolean isSuccess = (response.getStatusId() != null && response.getStatusId() == 1) ||
                (response.getMessage() != null && response.getMessage().toLowerCase().contains("already"));
                
        if (isSuccess) {
            log.info("Onboarding succeeded. Registering details in databases...");
            String agentId = response.getAgentId();
            String merchantId = response.getMerchantId();
            
            // 1. Update AEPS Module User
            User aepsUser = getOrSyncAepsUser(request.getAepsMobile());
            if (aepsUser == null) {
                aepsUser = new User();
                aepsUser.setMobile(request.getAepsMobile());
                aepsUser.setUsername(request.getAepsMobile());
                aepsUser.setEmail(request.getEmail());
                aepsUser.setName(request.getFname() + " " + request.getLname());
            }
            aepsUser.setAepsAgentId(agentId);
            aepsUser.setAepsMerchantId(merchantId);
            aepsUser.setAepsOnboarded(true);
            aepsUserRepository.save(aepsUser);
            log.info("AEPS module user table updated successfully for mobile: {}", request.getAepsMobile());
            
            // 2. Update Main Core User
            Optional<com.rupiksha.backend.domain.User> mainUserOpt = mainUserRepository.findByMobile(request.getAepsMobile());
            if (mainUserOpt.isPresent()) {
                com.rupiksha.backend.domain.User mainUser = mainUserOpt.get();
                mainUser.setAepsAgentId(agentId);
                mainUser.setAepsMerchantId(merchantId);
                mainUser.setAepsOnboarded(true);
                mainUserRepository.save(mainUser);
                log.info("Main backend user table updated successfully for mobile: {}", request.getAepsMobile());
            } else {
                log.warn("Main backend user record not found for mobile: {}. Skipping main table update.", request.getAepsMobile());
            }
        } else {
            log.warn("Onboarding response indicated failure. No database updates performed.");
        }
        
        return response;
    }

    @Override
    @Transactional
    public KycResponse kyc(KycRequest request, String mobile) {
        log.info("Initiating biometric KYC submission flow for mobile: {}", mobile);
        AepsProvider activeProvider = getActiveProvider();

        // 1. Fetch and validate AEPS User record
        User aepsUser = getOrSyncAepsUser(mobile);
        if (aepsUser == null) {
            throw new AepsException("Merchant record not found in AEPS registry for mobile: " + mobile);
        }
        if (aepsUser.getAepsOnboarded() == null || !aepsUser.getAepsOnboarded()) {
            throw new AepsException("Merchant must complete onboarding before initiating KYC.");
        }
        if (aepsUser.getAepsAgentId() == null || aepsUser.getAepsMerchantId() == null) {
            throw new AepsException("Merchant registration properties are missing in database.");
        }

        // 2. Fetch and validate Core User record
        Optional<com.rupiksha.backend.domain.User> mainUserOpt = mainUserRepository.findByMobile(mobile);
        if (mainUserOpt.isEmpty()) {
            throw new AepsException("Core user record not found for mobile: " + mobile);
        }
        com.rupiksha.backend.domain.User mainUser = mainUserOpt.get();
        if (mainUser.getAadhaarNumber() == null || mainUser.getAadhaarNumber().isBlank()) {
            throw new AepsException("Core Aadhaar number is not registered for user profile.");
        }

        // Validate basic PID XML elements in request
        String pidXml = request.getPidXml();
        if (pidXml == null || pidXml.isBlank() || !pidXml.contains("<PidData>")) {
            throw new AepsException("Provided biometric XML payload is invalid or empty.");
        }

        // 3. Initialize dynamic audit history record
        AepsKycHistory history = AepsKycHistory.builder()
                .userId(mainUser.getId())
                .provider(activeProvider.getProviderName().toUpperCase())
                .merchantId(aepsUser.getAepsMerchantId())
                .workflowState(AepsWorkflowState.ONBOARDING_REQUIRED.name())
                .status("STARTED")
                .remarks("Biometric KYC capture submitted.")
                .createdBy(mainUser.getUsername())
                .build();
        history = aepsKycHistoryRepository.save(history);

        // 4. Map and execute active provider biometric submit API
        // Raw pidXml is passed in the providerRequest, decoupling encoding from business layer
        com.rupiksha.aeps.dto.request.AepsKycRequest providerRequest = com.rupiksha.aeps.dto.request.AepsKycRequest.builder()
                .aepsAgentId(aepsUser.getAepsAgentId())
                .merchantId(aepsUser.getAepsMerchantId())
                .aadharNumber(mainUser.getAadhaarNumber())
                .pidXml(pidXml)
                .biometricType(request.getBiometricType())
                .mobile(mobile)
                .build();

        ProviderKycResult providerResult;
        try {
            providerResult = activeProvider.kyc(providerRequest);
        } catch (Exception e) {
            log.error("Active provider kyc invocation threw exception: {}", e.getMessage(), e);
            history.setWorkflowState(AepsWorkflowState.FAILED.name());
            history.setStatus("FAILED");
            history.setRemarks("Provider invocation exception: " + e.getMessage());
            aepsKycHistoryRepository.save(history);
            return KycResponse.builder()
                    .success(false)
                    .workflowState(AepsWorkflowState.FAILED.name())
                    .message("Biometric KYC submission failed: " + e.getMessage())
                    .provider(activeProvider.getProviderName().toUpperCase())
                    .build();
        }

        // 5. Evaluate workflowState from ProviderKycResult
        AepsWorkflowState workflowState = providerResult.getWorkflowState();
        boolean isSuccess = workflowState == AepsWorkflowState.READY_FOR_DAILY_2FA;
        boolean otpRequired = workflowState == AepsWorkflowState.OTP_VERIFICATION_REQUIRED;

        if (isSuccess) {
            log.info("Biometric KYC completed instantly. Updating database records...");
            
            if ("fingpay".equalsIgnoreCase(activeProvider.getProviderName())) {
                long uidLong = mainUser.getId().getMostSignificantBits() & Long.MAX_VALUE;
                AepsKyc aepsKyc = aepsKycRepository.findByUid(uidLong)
                        .orElseThrow(() -> new AepsException("Fingpay merchant profile not found."));
                aepsKyc.setKycDone(true);
                aepsKycRepository.save(aepsKyc);
            } else {
                // Update AEPS user
                aepsUser.setAepsKycDone(true);
                aepsUser.setAepsKycCompletedAt(java.time.LocalDateTime.now());
                aepsUser.setAepsKycRefId(providerResult.getProviderReference());
                aepsUser.setAepsKycTxnId(providerResult.getProviderTxnId());
                aepsUserRepository.save(aepsUser);

                // Update main core user
                mainUser.setAepsKycDone(true);
                mainUser.setAepsKycCompletedAt(java.time.Instant.now());
                mainUser.setAepsKycRefId(providerResult.getProviderReference());
                mainUser.setAepsKycTxnId(providerResult.getProviderTxnId());
                mainUserRepository.save(mainUser);
            }

            // Update audit history log
            history.setWorkflowState(AepsWorkflowState.READY_FOR_DAILY_2FA.name());
            history.setStatus("SUCCESS");
            history.setProviderReference(providerResult.getProviderTxnId());
            history.setCompletedAt(java.time.LocalDateTime.now());
            history.setRemarks("Biometric KYC successfully validated on " + activeProvider.getProviderName().toUpperCase() + ".");
            aepsKycHistoryRepository.save(history);

            return KycResponse.builder()
                    .success(true)
                    .workflowState(workflowState.name())
                    .message("Biometric KYC verified successfully.")
                    .providerReference(providerResult.getProviderTxnId())
                    .provider(activeProvider.getProviderName().toUpperCase())
                    .build();

        } else if (otpRequired) {
            log.info("Biometric KYC requires OTP verification. Saving references: refid={}, txnid={}",
                    providerResult.getProviderReference(), providerResult.getProviderTxnId());

            // Save reference parameters to allow validation during OTP phase later
            aepsUser.setAepsKycRefId(providerResult.getProviderReference());
            aepsUser.setAepsKycTxnId(providerResult.getProviderTxnId());
            aepsUserRepository.save(aepsUser);

            mainUser.setAepsKycRefId(providerResult.getProviderReference());
            mainUser.setAepsKycTxnId(providerResult.getProviderTxnId());
            mainUserRepository.save(mainUser);

            // Update audit history log
            history.setWorkflowState(AepsWorkflowState.OTP_VERIFICATION_REQUIRED.name());
            history.setStatus("PENDING_OTP");
            history.setProviderReference(providerResult.getProviderTxnId());
            history.setRemarks(providerResult.getMessage());
            aepsKycHistoryRepository.save(history);

            return KycResponse.builder()
                    .success(true)
                    .workflowState(workflowState.name())
                    .message(providerResult.getMessage() != null ? providerResult.getMessage() : "OTP sent to registered mobile.")
                    .providerReference(providerResult.getProviderTxnId())
                    .provider(activeProvider.getProviderName().toUpperCase())
                    .build();

        } else {
            log.warn("Levin KYC API execution returned failure workflowState: {}", workflowState);

            // Update audit history log
            history.setWorkflowState(workflowState.name());
            history.setStatus("FAILED");
            history.setProviderReference(providerResult.getProviderTxnId());
            history.setRemarks(providerResult.getMessage());
            aepsKycHistoryRepository.save(history);

            return KycResponse.builder()
                    .success(false)
                    .workflowState(workflowState.name())
                    .message(providerResult.getMessage() != null ? providerResult.getMessage() : "Biometric KYC submission failed.")
                    .providerReference(providerResult.getProviderTxnId())
                    .provider(activeProvider.getProviderName().toUpperCase())
                    .build();
        }
    }

    @Override
    @Transactional
    public KycResponse verifyOtp(OtpVerifyRequest request, String mobile) {
        log.info("Initiating OTP verification flow for mobile: {}", mobile);
        AepsProvider activeProvider = getActiveProvider();

        // 1. Fetch and validate AEPS User record
        User aepsUser = getOrSyncAepsUser(mobile);
        if (aepsUser == null) {
            throw new AepsException("Merchant record not found in AEPS registry for mobile: " + mobile);
        }
        if (aepsUser.getAepsOnboarded() == null || !aepsUser.getAepsOnboarded()) {
            throw new AepsException("Merchant must complete onboarding before verifying OTP.");
        }
        if (aepsUser.getAepsKycRefId() == null || aepsUser.getAepsKycTxnId() == null) {
            throw new AepsException("No pending KYC references found. Biometric capture must be completed first.");
        }
        if (aepsUser.getAepsKycDone() != null && aepsUser.getAepsKycDone()) {
            return KycResponse.builder()
                    .success(true)
                    .workflowState(AepsWorkflowState.READY_FOR_DAILY_2FA.name())
                    .message("Biometric KYC is already verified for this merchant.")
                    .providerReference(aepsUser.getAepsKycTxnId())
                    .provider(activeProvider.getProviderName().toUpperCase())
                    .build();
        }

        // 2. Fetch and validate Core User record
        Optional<com.rupiksha.backend.domain.User> mainUserOpt = mainUserRepository.findByMobile(mobile);
        if (mainUserOpt.isEmpty()) {
            throw new AepsException("Core user record not found for mobile: " + mobile);
        }
        com.rupiksha.backend.domain.User mainUser = mainUserOpt.get();

        // 3. Initialize dynamic audit history log
        AepsKycHistory history = AepsKycHistory.builder()
                .userId(mainUser.getId())
                .provider(activeProvider.getProviderName().toUpperCase())
                .merchantId(aepsUser.getAepsMerchantId())
                .providerReference(aepsUser.getAepsKycTxnId())
                .workflowState(AepsWorkflowState.OTP_VERIFICATION_REQUIRED.name())
                .status("OTP_SUBMITTED")
                .remarks("Merchant submitted OTP verification request.")
                .createdBy(mainUser.getUsername())
                .build();
        history = aepsKycHistoryRepository.save(history);

        // 4. Map and execute active provider OTP verify API
        com.rupiksha.aeps.dto.request.AepsOtpVerifyRequest providerRequest = com.rupiksha.aeps.dto.request.AepsOtpVerifyRequest.builder()
                .verifyKycOtp(request.getOtp())
                .email(aepsUser.getEmail())
                .contactNumber(mobile)
                .kycRefId(aepsUser.getAepsKycTxnId())
                .clientRefId(aepsUser.getAepsKycRefId())
                .aepsAgentId(aepsUser.getAepsAgentId())
                .merchantId(aepsUser.getAepsMerchantId())
                .build();

        ProviderKycResult providerResult;
        try {
            providerResult = activeProvider.verifyOtp(providerRequest);
        } catch (Exception e) {
            log.error("Active provider verifyOtp invocation threw exception: {}", e.getMessage(), e);
            history.setWorkflowState(AepsWorkflowState.FAILED.name());
            history.setStatus("OTP_FAILED");
            history.setRemarks("OTP provider exception: " + e.getMessage());
            aepsKycHistoryRepository.save(history);
            return KycResponse.builder()
                    .success(false)
                    .workflowState(AepsWorkflowState.FAILED.name())
                    .message("OTP verification failed: " + e.getMessage())
                    .provider(activeProvider.getProviderName().toUpperCase())
                    .build();
        }

        // 5. Handle response flags
        AepsWorkflowState workflowState = providerResult.getWorkflowState();
        boolean isSuccess = workflowState == AepsWorkflowState.READY_FOR_DAILY_2FA;

        if (isSuccess) {
            log.info("OTP verified successfully. Updating database records to active KYC status...");

            if ("fingpay".equalsIgnoreCase(activeProvider.getProviderName())) {
                long uidLong = mainUser.getId().getMostSignificantBits() & Long.MAX_VALUE;
                AepsKyc aepsKyc = aepsKycRepository.findByUid(uidLong)
                        .orElseThrow(() -> new AepsException("Fingpay merchant profile not found."));
                aepsKyc.setKycDone(true);
                aepsKycRepository.save(aepsKyc);
            } else {
                // Update AEPS user
                aepsUser.setAepsKycDone(true);
                aepsUser.setAepsKycCompletedAt(java.time.LocalDateTime.now());
                aepsUserRepository.save(aepsUser);

                // Update main core user
                mainUser.setAepsKycDone(true);
                mainUser.setAepsKycCompletedAt(java.time.Instant.now());
                mainUserRepository.save(mainUser);
            }

            // Update audit history log
            history.setWorkflowState(AepsWorkflowState.READY_FOR_DAILY_2FA.name());
            history.setStatus("OTP_SUCCESS");
            history.setRemarks("OTP successfully verified on " + activeProvider.getProviderName().toUpperCase() + ". KYC Activated.");
            history.setCompletedAt(java.time.LocalDateTime.now());
            aepsKycHistoryRepository.save(history);

            return KycResponse.builder()
                    .success(true)
                    .workflowState(workflowState.name())
                    .message("OTP verification successful. AEPS terminal activated.")
                    .providerReference(aepsUser.getAepsKycTxnId())
                    .provider(activeProvider.getProviderName().toUpperCase())
                    .build();
        } else {
            log.warn("OTP verification rejected by provider with state: {}", workflowState);

            // Update audit history log
            history.setWorkflowState(workflowState.name());
            history.setStatus("OTP_FAILED");
            history.setRemarks(providerResult.getMessage());
            aepsKycHistoryRepository.save(history);

            return KycResponse.builder()
                    .success(false)
                    .workflowState(workflowState.name())
                    .message(providerResult.getMessage() != null ? providerResult.getMessage() : "OTP verification failed.")
                    .providerReference(aepsUser.getAepsKycTxnId())
                    .provider(activeProvider.getProviderName().toUpperCase())
                    .build();
        }
    }

    @Override
    @Transactional
    public KycResponse dailyAuthenticate(DailyAuthRequest request, String mobile) {
        log.info("Initiating Daily 2FA authentication flow for mobile: {}", mobile);
        AepsProvider activeProvider = getActiveProvider();

        // 1. Fetch and validate AEPS User record
        User aepsUser = getOrSyncAepsUser(mobile);
        if (aepsUser == null) {
            throw new AepsException("Merchant record not found in AEPS registry for mobile: " + mobile);
        }
        if (aepsUser.getAepsOnboarded() == null || !aepsUser.getAepsOnboarded()) {
            throw new AepsException("Merchant must complete onboarding before executing Daily 2FA.");
        }
        if (aepsUser.getAepsKycDone() == null || !aepsUser.getAepsKycDone()) {
            throw new AepsException("Merchant must complete biometric KYC before executing Daily 2FA.");
        }

        // Check if session is already active today (same calendar day)
        boolean hasValidSession = false;
        if (aepsUser.getAeps2faSessionId() != null && aepsUser.getAeps2faAuthenticatedAt() != null) {
            java.time.LocalDate authenticatedDate = aepsUser.getAeps2faAuthenticatedAt().toLocalDate();
            java.time.LocalDate today = java.time.LocalDate.now();
            hasValidSession = authenticatedDate.isEqual(today);
        }
        if (hasValidSession) {
            log.info("Daily session already active for merchant: {}. Skipping API call.", mobile);
            return KycResponse.builder()
                    .success(true)
                    .workflowState(AepsWorkflowState.READY_FOR_TRANSACTIONS.name())
                    .message("Daily 2FA session is already active.")
                    .providerReference(aepsUser.getAeps2faSessionId())
                    .provider(activeProvider.getProviderName().toUpperCase())
                    .build();
        }

        // 2. Fetch and validate Core User record
        Optional<com.rupiksha.backend.domain.User> mainUserOpt = mainUserRepository.findByMobile(mobile);
        if (mainUserOpt.isEmpty()) {
            throw new AepsException("Core user record not found for mobile: " + mobile);
        }
        com.rupiksha.backend.domain.User mainUser = mainUserOpt.get();

        // 3. Initialize dynamic audit history log
        AepsKycHistory history = AepsKycHistory.builder()
                .userId(mainUser.getId())
                .provider(activeProvider.getProviderName().toUpperCase())
                .merchantId(aepsUser.getAepsMerchantId())
                .workflowState(AepsWorkflowState.READY_FOR_DAILY_2FA.name())
                .status("DAILY_AUTH_STARTED")
                .remarks("Merchant initiated Daily 2FA session capture.")
                .createdBy(mainUser.getUsername())
                .build();
        history = aepsKycHistoryRepository.save(history);

        // 4. Map and execute active provider Daily 2FA API
        com.rupiksha.aeps.dto.request.AepsDailyAuthRequest providerRequest = com.rupiksha.aeps.dto.request.AepsDailyAuthRequest.builder()
                .mobileNumber(mobile)
                .adharNumber(mainUser.getAadhaarNumber() != null ? mainUser.getAadhaarNumber() : "")
                .pidXml(request.getPidXml())
                .merchantId(aepsUser.getAepsMerchantId())
                .latitude(request.getLatitude())
                .longitude(request.getLongitude())
                .biometricType(request.getBiometricType())
                .build();

        ProviderKycResult providerResult;
        try {
            providerResult = activeProvider.dailyAuthenticate(providerRequest);
        } catch (Exception e) {
            log.error("Active provider dailyAuthenticate invocation threw exception: {}", e.getMessage(), e);
            history.setWorkflowState(AepsWorkflowState.FAILED.name());
            history.setStatus("DAILY_AUTH_FAILED");
            history.setRemarks("Daily 2FA provider exception: " + e.getMessage());
            aepsKycHistoryRepository.save(history);
            return KycResponse.builder()
                    .success(false)
                    .workflowState(AepsWorkflowState.FAILED.name())
                    .message("Daily 2FA authentication failed: " + e.getMessage())
                    .provider(activeProvider.getProviderName().toUpperCase())
                    .build();
        }

        // 5. Handle response flags
        AepsWorkflowState workflowState = providerResult.getWorkflowState();
        boolean isSuccess = workflowState == AepsWorkflowState.READY_FOR_TRANSACTIONS;

        if (isSuccess) {
            log.info("Daily 2FA session successfully verified! Generating daily session reference...");

            // Use returned txnid or generate local session reference
            String sessionRef = providerResult.getProviderTxnId() != null 
                    ? String.valueOf(providerResult.getProviderTxnId()) 
                    : String.valueOf(System.currentTimeMillis());

            // Update AEPS user
            aepsUser.setAeps2faSessionId(sessionRef);
            aepsUser.setAeps2faAuthenticatedAt(java.time.LocalDateTime.now());
            aepsUserRepository.save(aepsUser);

            // Update main core user
            mainUser.setAeps2faSessionId(sessionRef);
            mainUser.setAeps2faAuthenticatedAt(java.time.Instant.now());
            mainUserRepository.save(mainUser);

            // Update audit history log
            history.setWorkflowState(AepsWorkflowState.READY_FOR_TRANSACTIONS.name());
            history.setStatus("DAILY_AUTH_SUCCESS");
            history.setProviderReference(sessionRef);
            history.setRemarks("Daily 2FA success. Session ID registered: " + sessionRef);
            history.setCompletedAt(java.time.LocalDateTime.now());
            aepsKycHistoryRepository.save(history);

            // Append another record for session creation trace
            AepsKycHistory sessionHistory = AepsKycHistory.builder()
                    .userId(mainUser.getId())
                    .provider(activeProvider.getProviderName().toUpperCase())
                    .merchantId(aepsUser.getAepsMerchantId())
                    .providerReference(sessionRef)
                    .workflowState(AepsWorkflowState.READY_FOR_TRANSACTIONS.name())
                    .status("SESSION_CREATED")
                    .remarks("New operational session mapped successfully.")
                    .createdBy(mainUser.getUsername())
                    .completedAt(java.time.LocalDateTime.now())
                    .build();
            aepsKycHistoryRepository.save(sessionHistory);

            return KycResponse.builder()
                    .success(true)
                    .workflowState(workflowState.name())
                    .message("Daily authentication completed successfully.")
                    .providerReference(sessionRef)
                    .provider(activeProvider.getProviderName().toUpperCase())
                    .build();
        } else {
            log.warn("Daily 2FA authentication rejected by provider with state: {}", workflowState);

            // Update audit history log
            history.setWorkflowState(workflowState.name());
            history.setStatus("DAILY_AUTH_FAILED");
            history.setRemarks(providerResult.getMessage());
            aepsKycHistoryRepository.save(history);

            return KycResponse.builder()
                    .success(false)
                    .workflowState(workflowState.name())
                    .message(providerResult.getMessage() != null ? providerResult.getMessage() : "Daily 2FA authentication failed.")
                    .provider(activeProvider.getProviderName().toUpperCase())
                    .build();
        }
    }

    /**
     * Resolves the active AEPS provider dynamically using configurations.
     */
    private AepsProvider getActiveProvider() {
        String activeName = aepsProperties.getActiveProvider();
        return providers.stream()
                .filter(p -> p.getProviderName().equalsIgnoreCase(activeName))
                .findFirst()
                .orElseThrow(() -> new AepsException("Active AEPS provider strategy not registered: " + activeName));
    }
}
