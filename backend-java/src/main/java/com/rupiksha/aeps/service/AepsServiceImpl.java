package com.rupiksha.aeps.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rupiksha.aeps.dto.request.BankEkycRequest;
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
import com.rupiksha.aeps.provider.fingpay.dto.BiometricRequestDTO;
import com.rupiksha.aeps.provider.fingpay.entity.AepsKyc;
import com.rupiksha.aeps.provider.fingpay.entity.Fingpay2faTxn;
import com.rupiksha.aeps.provider.fingpay.repository.AepsKycRepository;
import com.rupiksha.aeps.provider.fingpay.repository.EkycTxnRepo;
import com.rupiksha.aeps.provider.fingpay.repository.Fingpay2faTxnRepository;
import com.rupiksha.aeps.provider.fingpay.service.BiometricService;
import com.rupiksha.aeps.provider.fingpay.service.EkycStatusService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
public class AepsServiceImpl implements AepsService {

    private static final ZoneId IST_ZONE = ZoneId.of("Asia/Kolkata");

    private final List<AepsProvider> providers;
    private final AepsProperties aepsProperties;
    private final AepsUserRepository aepsUserRepository;
    private final com.rupiksha.backend.repository.UserRepository mainUserRepository;
    private final AepsKycHistoryRepository aepsKycHistoryRepository;
    private final AepsKycRepository aepsKycRepository;
    private final Fingpay2faTxnRepository fingpay2faTxnRepository;
    private final EkycStatusService ekycStatusService;
    private final BiometricService biometricService;
    private final EkycTxnRepo ekycTxnRepo;
    private final ObjectMapper objectMapper;

    @Autowired
    public AepsServiceImpl(
            List<AepsProvider> providers,
            AepsProperties aepsProperties,
            @Qualifier("aepsUserRepository") AepsUserRepository aepsUserRepository,
            @Qualifier("userRepository") com.rupiksha.backend.repository.UserRepository mainUserRepository,
            AepsKycHistoryRepository aepsKycHistoryRepository,
            AepsKycRepository aepsKycRepository,
            Fingpay2faTxnRepository fingpay2faTxnRepository,
            EkycStatusService ekycStatusService,
            BiometricService biometricService,
            EkycTxnRepo ekycTxnRepo,
            ObjectMapper objectMapper
    ) {
        this.providers = providers;
        this.aepsProperties = aepsProperties;
        this.aepsUserRepository = aepsUserRepository;
        this.mainUserRepository = mainUserRepository;
        this.aepsKycHistoryRepository = aepsKycHistoryRepository;
        this.aepsKycRepository = aepsKycRepository;
        this.fingpay2faTxnRepository = fingpay2faTxnRepository;
        this.ekycStatusService = ekycStatusService;
        this.biometricService = biometricService;
        this.ekycTxnRepo = ekycTxnRepo;
        this.objectMapper = objectMapper;
    }

    private boolean isFingpayKycCompleted(com.rupiksha.backend.domain.User mainUser) {
        long uidLong = mainUser.getId().getMostSignificantBits() & Long.MAX_VALUE;
        return aepsKycRepository.findByUid(uidLong)
                .map(k -> Boolean.TRUE.equals(k.getKycDone()) || (k.getOutlet() != null && !k.getOutlet().isBlank()))
                .orElse(false);
    }

    private User getOrSyncAepsUser(String mobile) {
        Optional<com.rupiksha.backend.domain.User> coreUserOpt = mainUserRepository.findByMobile(mobile)
                .or(() -> mainUserRepository.findByUsername(mobile));

        User aepsUser = aepsUserRepository.findByMobile(mobile)
                .or(() -> aepsUserRepository.findByUsername(mobile))
                .orElseGet(User::new);

        if (coreUserOpt.isPresent()) {
            com.rupiksha.backend.domain.User coreUser = coreUserOpt.get();
            long uidLong = coreUser.getId().getMostSignificantBits() & Long.MAX_VALUE;
            Optional<AepsKyc> fingKycOpt = aepsKycRepository.findByUid(uidLong);

            boolean kycDone = Boolean.TRUE.equals(coreUser.getAepsKycDone()) ||
                    Boolean.TRUE.equals(aepsUser.getAepsKycDone()) ||
                    fingKycOpt.map(k -> Boolean.TRUE.equals(k.getKycDone()) || (k.getOutlet() != null && !k.getOutlet().isBlank())).orElse(false);

            boolean onboarded = Boolean.TRUE.equals(coreUser.getAepsOnboarded()) ||
                    Boolean.TRUE.equals(aepsUser.getAepsOnboarded()) ||
                    fingKycOpt.isPresent();

            aepsUser.setMobile(coreUser.getMobile());
            aepsUser.setUsername(coreUser.getUsername());
            if (aepsUser.getEmail() == null) aepsUser.setEmail(coreUser.getEmail());
            if (aepsUser.getName() == null) aepsUser.setName(coreUser.getFullName());

            String agentId = coreUser.getAepsAgentId();
            if ((agentId == null || agentId.isBlank()) && fingKycOpt.isPresent()) {
                agentId = fingKycOpt.get().getOutlet();
            }
            if (agentId != null && !agentId.isBlank()) {
                aepsUser.setAepsAgentId(agentId);
                aepsUser.setAepsMerchantId(agentId);
            }

            aepsUser.setAepsOnboarded(onboarded);
            aepsUser.setAepsKycDone(kycDone);

            if (coreUser.getAepsKycRefId() != null) aepsUser.setAepsKycRefId(coreUser.getAepsKycRefId());
            if (coreUser.getAepsKycTxnId() != null) aepsUser.setAepsKycTxnId(coreUser.getAepsKycTxnId());
            if (coreUser.getAepsKycCompletedAt() != null) {
                aepsUser.setAepsKycCompletedAt(java.time.LocalDateTime.ofInstant(coreUser.getAepsKycCompletedAt(), java.time.ZoneId.systemDefault()));
            }
            if (coreUser.getAeps2faAuthenticatedAt() != null) {
                aepsUser.setAeps2faAuthenticatedAt(java.time.LocalDateTime.ofInstant(coreUser.getAeps2faAuthenticatedAt(), java.time.ZoneId.systemDefault()));
            }
            if (coreUser.getAepsAp2faAuthenticatedAt() != null) {
                aepsUser.setAepsAp2faAuthenticatedAt(java.time.LocalDateTime.ofInstant(coreUser.getAepsAp2faAuthenticatedAt(), java.time.ZoneId.systemDefault()));
            }

            return aepsUserRepository.save(aepsUser);
        }

        return aepsUser.getId() != null ? aepsUser : null;
    }

    private boolean isSessionValid(Instant authenticatedAt) {
        if (authenticatedAt == null) {
            return false;
        }
        Instant now = Instant.now();
        if (authenticatedAt.isAfter(now)) {
            return false;
        }
        long hours = Duration.between(authenticatedAt, now).toHours();
        if (hours < 24) {
            return true;
        }
        LocalDate authDate = authenticatedAt.atZone(IST_ZONE).toLocalDate();
        LocalDate today = LocalDate.now(IST_ZONE);
        return authDate.isEqual(today);
    }

    private boolean isSessionValid(LocalDateTime authenticatedAt) {
        if (authenticatedAt == null) {
            return false;
        }
        LocalDateTime now = LocalDateTime.now();
        if (authenticatedAt.isAfter(now)) {
            return false;
        }
        long hours = Duration.between(authenticatedAt, now).toHours();
        if (hours < 24) {
            return true;
        }
        LocalDate authDate = authenticatedAt.toLocalDate();
        LocalDate today = LocalDate.now();
        return authDate.isEqual(today);
    }

    @Override
    public StatusResponse getAgentStatus(String mobile, String provider) {
        log.info("Checking AEPS status details for mobile: {}, provider: {}", mobile, provider);
        
        Optional<com.rupiksha.backend.domain.User> coreUserOpt = mainUserRepository.findByMobile(mobile)
                .or(() -> mainUserRepository.findByUsername(mobile));
        if (coreUserOpt.isEmpty()) {
            return StatusResponse.builder().onboarded(false).kycDone(false).aeps2faDone(false).ap2faDone(false).build();
        }
        com.rupiksha.backend.domain.User coreUser = coreUserOpt.get();
        long uidLong = coreUser.getId().getMostSignificantBits() & Long.MAX_VALUE;

        if ("fingpay".equalsIgnoreCase(provider)) {
            Optional<AepsKyc> kycOpt = aepsKycRepository.findByUid(uidLong);
            if (kycOpt.isPresent()) {
                AepsKyc kyc = kycOpt.get();

                // 1. Check standard AEPS 2FA validity
                boolean hasValidSession = isSessionValid(coreUser.getAeps2faAuthenticatedAt());
                if (!hasValidSession) {
                    Optional<Fingpay2faTxn> txn2faOpt = fingpay2faTxnRepository
                            .findTopByUserIdAndServiceTypeAndResponseCodeOrderByCreatedAtDesc(coreUser.getId(), "AEPS", "00")
                            .or(() -> fingpay2faTxnRepository.findTopByMobileNumberAndServiceTypeAndResponseCodeOrderByCreatedAtDesc(mobile, "AEPS", "00"));
                    
                    if (txn2faOpt.isPresent()) {
                        Fingpay2faTxn txn = txn2faOpt.get();
                        if (isSessionValid(txn.getAuthenticatedAt())) {
                            hasValidSession = true;
                            String ref = txn.getFingpayTransactionId();
                            if (ref == null || ref.isBlank()) {
                                ref = txn.getMerchantTranId();
                            }
                            coreUser.setAeps2faSessionId("FGP-" + ref);
                            coreUser.setAeps2faAuthenticatedAt(txn.getAuthenticatedAt().atZone(IST_ZONE).toInstant());
                            mainUserRepository.save(coreUser);
                        }
                    }
                }

                // 2. Check AP (Aadhaar Pay) 2FA validity
                boolean hasValidApSession = isSessionValid(coreUser.getAepsAp2faAuthenticatedAt());
                if (!hasValidApSession) {
                    Optional<Fingpay2faTxn> txnApOpt = fingpay2faTxnRepository
                            .findTopByUserIdAndServiceTypeAndResponseCodeOrderByCreatedAtDesc(coreUser.getId(), "AP", "00")
                            .or(() -> fingpay2faTxnRepository.findTopByMobileNumberAndServiceTypeAndResponseCodeOrderByCreatedAtDesc(mobile, "AP", "00"));
                    
                    if (txnApOpt.isPresent()) {
                        Fingpay2faTxn txn = txnApOpt.get();
                        if (isSessionValid(txn.getAuthenticatedAt())) {
                            hasValidApSession = true;
                            String ref = txn.getFingpayTransactionId();
                            if (ref == null || ref.isBlank()) {
                                ref = txn.getMerchantTranId();
                            }
                            coreUser.setAepsAp2faSessionId("FGP-" + ref);
                            coreUser.setAepsAp2faAuthenticatedAt(txn.getAuthenticatedAt().atZone(IST_ZONE).toInstant());
                            mainUserRepository.save(coreUser);
                        }
                    }
                }

                boolean isKycDone = Boolean.TRUE.equals(kyc.getKycDone()) || Boolean.TRUE.equals(coreUser.getAepsKycDone());
                if (!Boolean.TRUE.equals(kyc.getKycDone()) && isKycDone) {
                    kyc.setKycDone(true);
                    aepsKycRepository.save(kyc);
                }

                boolean isBankEkycDone = Boolean.TRUE.equals(kyc.getBankEkycDone());

                return StatusResponse.builder()
                        .onboarded(true)
                        .kycDone(isKycDone)
                        .bankEkycDone(isBankEkycDone)
                        .aeps2faDone(hasValidSession)
                        .ap2faDone(hasValidApSession)
                        .agentId(kyc.getOutlet())
                        .merchantId(kyc.getMerchantId() != null ? kyc.getMerchantId() : kyc.getOutlet())
                        .build();
            } else {
                return StatusResponse.builder()
                        .onboarded(false)
                        .kycDone(false)
                        .aeps2faDone(false)
                        .ap2faDone(false)
                        .build();
            }
        } else {
            // Default to Levin
            User user = getOrSyncAepsUser(mobile);
            if (user != null) {
                boolean hasValidSession = isSessionValid(user.getAeps2faAuthenticatedAt()) || isSessionValid(coreUser.getAeps2faAuthenticatedAt());
                boolean hasValidApSession = isSessionValid(user.getAepsAp2faAuthenticatedAt()) || isSessionValid(coreUser.getAepsAp2faAuthenticatedAt());

                return StatusResponse.builder()
                        .onboarded(Boolean.TRUE.equals(user.getAepsOnboarded()))
                        .kycDone(Boolean.TRUE.equals(user.getAepsKycDone()))
                        .aeps2faDone(hasValidSession)
                        .ap2faDone(hasValidApSession)
                        .agentId(user.getAepsAgentId())
                        .merchantId(user.getAepsMerchantId())
                        .build();
            }
            return StatusResponse.builder()
                    .onboarded(false)
                    .kycDone(false)
                    .aeps2faDone(false)
                    .ap2faDone(false)
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
        AepsProvider activeProvider = getActiveProvider(request.getProvider());
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
        AepsProvider activeProvider = getActiveProvider(request.getProvider());

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

        // For Fingpay, resolve merchant identifiers from canonical fingpay profile table.
        String resolvedAgentId = aepsUser.getAepsAgentId();
        String resolvedMerchantId = aepsUser.getAepsMerchantId();
        if ("fingpay".equalsIgnoreCase(activeProvider.getProviderName())) {
            long uidLong = mainUser.getId().getMostSignificantBits() & Long.MAX_VALUE;
            AepsKyc aepsKyc = aepsKycRepository.findByUid(uidLong)
                    .orElseThrow(() -> new AepsException("Fingpay merchant profile not found."));

            resolvedAgentId = aepsKyc.getOutlet();
            resolvedMerchantId = (aepsKyc.getMerchantId() != null && !aepsKyc.getMerchantId().isBlank())
                    ? aepsKyc.getMerchantId()
                    : aepsKyc.getOutlet();

            if (resolvedAgentId == null || resolvedAgentId.isBlank()) {
                throw new AepsException("Fingpay merchant login ID is missing. Please complete onboarding again.");
            }

            // Keep mirrored AEPS/main user IDs aligned to avoid provider ID drift.
            if (!resolvedAgentId.equals(aepsUser.getAepsAgentId())
                    || (resolvedMerchantId != null && !resolvedMerchantId.equals(aepsUser.getAepsMerchantId()))) {
                aepsUser.setAepsAgentId(resolvedAgentId);
                aepsUser.setAepsMerchantId(resolvedMerchantId);
                aepsUserRepository.save(aepsUser);

                mainUser.setAepsAgentId(resolvedAgentId);
                mainUser.setAepsMerchantId(resolvedMerchantId);
                mainUserRepository.save(mainUser);
            }
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
            .aepsAgentId(resolvedAgentId)
            .merchantId(resolvedMerchantId)
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
        boolean bankEkycRequired = workflowState == AepsWorkflowState.BANK_EKYC_REQUIRED;

        if (isSuccess) {
            log.info("Biometric KYC completed instantly. Updating database records...");
            
            if ("fingpay".equalsIgnoreCase(activeProvider.getProviderName())) {
                long uidLong = mainUser.getId().getMostSignificantBits() & Long.MAX_VALUE;
                AepsKyc aepsKyc = aepsKycRepository.findByUid(uidLong)
                        .orElseThrow(() -> new AepsException("Fingpay merchant profile not found."));
                aepsKyc.setKycDone(true);
                aepsKycRepository.save(aepsKyc);

                aepsUser.setAepsKycDone(true);
                aepsUser.setAepsKycCompletedAt(java.time.LocalDateTime.now());
                aepsUser.setAepsKycRefId(providerResult.getProviderReference());
                aepsUser.setAepsKycTxnId(providerResult.getProviderTxnId());
                aepsUserRepository.save(aepsUser);

                mainUser.setAepsKycDone(true);
                mainUser.setAepsKycCompletedAt(java.time.Instant.now());
                mainUser.setAepsKycRefId(providerResult.getProviderReference());
                mainUser.setAepsKycTxnId(providerResult.getProviderTxnId());
                mainUserRepository.save(mainUser);
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
                    .providerReference(providerResult.getProviderReference())
                    .providerTxnId(providerResult.getProviderTxnId())
                    .provider(activeProvider.getProviderName().toUpperCase())
                    .build();

        } else if (bankEkycRequired) {
            log.warn("Fingpay KYC is blocked on Bank eKYC requirement: {}", providerResult.getMessage());
            history.setWorkflowState(AepsWorkflowState.BANK_EKYC_REQUIRED.name());
            history.setStatus("BANK_EKYC_REQUIRED");
            history.setProviderReference(providerResult.getProviderTxnId());
            history.setRemarks(providerResult.getMessage());
            aepsKycHistoryRepository.save(history);

            // Save primaryKeyId + encodeFPTxnId on AepsKyc so the Bank eKYC
            // biometric submission step can retrieve them.
            if ("fingpay".equalsIgnoreCase(activeProvider.getProviderName())) {
                long uidLong = mainUser.getId().getMostSignificantBits() & Long.MAX_VALUE;
                aepsKycRepository.findByUid(uidLong).ifPresent(kyc -> {
                    String encodedTxnId = providerResult.getProviderTxnId();
                    String primaryKeyStr = providerResult.getProviderReference();
                    if (encodedTxnId != null && !encodedTxnId.isBlank()) {
                        kyc.setBankEkycEncodeFPTxnId(encodedTxnId);
                    }
                    if (primaryKeyStr != null && !primaryKeyStr.isBlank()) {
                        try {
                            kyc.setBankEkycPrimaryKeyId(Long.parseLong(primaryKeyStr));
                        } catch (NumberFormatException ignored) { }
                    }
                    aepsKycRepository.save(kyc);
                    log.info("Saved bank eKYC references: primaryKeyId={}, encodeFPTxnId={}",
                            kyc.getBankEkycPrimaryKeyId(), kyc.getBankEkycEncodeFPTxnId());
                });
            }

            return KycResponse.builder()
                    .success(false)
                    .workflowState(workflowState.name())
                    .message(providerResult.getMessage() != null ? providerResult.getMessage() : "Bank eKYC is required before transactions can be enabled.")
                    .providerReference(providerResult.getProviderTxnId())
                    .provider(activeProvider.getProviderName().toUpperCase())
                    .build();
        } else {
            log.warn("Fingpay KYC API execution returned failure workflowState: {}", workflowState);

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
        AepsProvider activeProvider = getActiveProvider(request.getProvider());

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

        String resolvedAgentId = aepsUser.getAepsAgentId();
        String resolvedMerchantId = aepsUser.getAepsMerchantId();
        if ("fingpay".equalsIgnoreCase(activeProvider.getProviderName())) {
            long uidLong = mainUser.getId().getMostSignificantBits() & Long.MAX_VALUE;
            AepsKyc aepsKyc = aepsKycRepository.findByUid(uidLong)
                    .orElseThrow(() -> new AepsException("Fingpay merchant profile not found."));

            resolvedAgentId = aepsKyc.getOutlet();
            resolvedMerchantId = (aepsKyc.getMerchantId() != null && !aepsKyc.getMerchantId().isBlank())
                    ? aepsKyc.getMerchantId()
                    : aepsKyc.getOutlet();

            if (resolvedAgentId == null || resolvedAgentId.isBlank()) {
                throw new AepsException("Fingpay merchant login ID is missing. Please complete onboarding again.");
            }
        }

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
            .aepsAgentId(resolvedAgentId)
            .merchantId(resolvedMerchantId)
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

                aepsUser.setAepsKycDone(true);
                aepsUser.setAepsKycCompletedAt(java.time.LocalDateTime.now());
                aepsUserRepository.save(aepsUser);

                mainUser.setAepsKycDone(true);
                mainUser.setAepsKycCompletedAt(java.time.Instant.now());
                mainUserRepository.save(mainUser);
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
        AepsProvider activeProvider = getActiveProvider(request.getProvider());

        // 1. Fetch and validate AEPS User record
        User aepsUser = getOrSyncAepsUser(mobile);
        if (aepsUser == null) {
            throw new AepsException("Merchant record not found in AEPS registry for mobile: " + mobile);
        }
        if (aepsUser.getAepsOnboarded() == null || !aepsUser.getAepsOnboarded()) {
            throw new AepsException("Merchant must complete onboarding before executing Daily 2FA.");
        }

        Optional<com.rupiksha.backend.domain.User> mainUserOpt = mainUserRepository.findByMobile(mobile)
                .or(() -> mainUserRepository.findByUsername(mobile));
        if (mainUserOpt.isEmpty()) {
            throw new AepsException("Core user record not found for mobile: " + mobile);
        }
        com.rupiksha.backend.domain.User mainUser = mainUserOpt.get();

        boolean hasKycDone = Boolean.TRUE.equals(aepsUser.getAepsKycDone());
        if ("fingpay".equalsIgnoreCase(activeProvider.getProviderName())) {
            hasKycDone = hasKycDone || isFingpayKycCompleted(mainUser);
        }
        if (!hasKycDone) {
            throw new AepsException("Merchant must complete biometric KYC before executing Daily 2FA.");
        }

        // Check if session is already active (valid for 24 hours / today)
        boolean isAp = "AadhaarPay".equalsIgnoreCase(request.getServiceType()) || "AP".equalsIgnoreCase(request.getServiceType());
        boolean hasValidSession = isAp
                ? (isSessionValid(aepsUser.getAepsAp2faAuthenticatedAt()) || isSessionValid(mainUser.getAepsAp2faAuthenticatedAt()))
                : (isSessionValid(aepsUser.getAeps2faAuthenticatedAt()) || isSessionValid(mainUser.getAeps2faAuthenticatedAt()));

        if (hasValidSession) {
            log.info("Daily session already active for merchant: {}, serviceType: {}. Skipping API call.", mobile, request.getServiceType());
            return KycResponse.builder()
                    .success(true)
                    .workflowState(AepsWorkflowState.READY_FOR_TRANSACTIONS.name())
                    .message("Daily 2FA session is already active.")
                    .providerReference(isAp ? aepsUser.getAepsAp2faSessionId() : aepsUser.getAeps2faSessionId())
                    .provider(activeProvider.getProviderName().toUpperCase())
                    .build();
        }

        // 2. Fetch and validate Core User record
        // already resolved above for KYC gate checks
        String resolvedAgentId = aepsUser.getAepsAgentId();
        String resolvedMerchantId = aepsUser.getAepsMerchantId();
        if ("fingpay".equalsIgnoreCase(activeProvider.getProviderName())) {
            long uidLong = mainUser.getId().getMostSignificantBits() & Long.MAX_VALUE;
            Optional<AepsKyc> aepsKycOpt = aepsKycRepository.findByUid(uidLong);
            if (aepsKycOpt.isPresent()) {
                AepsKyc aepsKyc = aepsKycOpt.get();
                if (aepsKyc.getOutlet() != null && !aepsKyc.getOutlet().isBlank()) {
                    resolvedAgentId = aepsKyc.getOutlet().trim();
                }
                if (aepsKyc.getMerchantId() != null && !aepsKyc.getMerchantId().isBlank()) {
                    resolvedMerchantId = aepsKyc.getMerchantId().trim();
                }
            }
            if ((resolvedAgentId == null || resolvedAgentId.isBlank()) && mainUser.getPartyCode() != null && !mainUser.getPartyCode().isBlank()) {
                resolvedAgentId = mainUser.getPartyCode().trim();
            }
            if (resolvedMerchantId == null || resolvedMerchantId.isBlank()) {
                resolvedMerchantId = resolvedAgentId;
            }
        }

        // 3. Initialize dynamic audit history log
        AepsKycHistory history = AepsKycHistory.builder()
                .userId(mainUser.getId())
                .provider(activeProvider.getProviderName().toUpperCase())
                .merchantId(resolvedMerchantId != null ? resolvedMerchantId : aepsUser.getAepsMerchantId())
                .workflowState(AepsWorkflowState.READY_FOR_DAILY_2FA.name())
                .status("DAILY_AUTH_STARTED")
                .remarks("Merchant initiated Daily 2FA session capture for " + (isAp ? "AadhaarPay" : "AEPS"))
                .createdBy(mainUser.getUsername())
                .build();
        history = aepsKycHistoryRepository.save(history);

        // 4. Map and execute active provider Daily 2FA API
        com.rupiksha.aeps.dto.request.AepsDailyAuthRequest providerRequest = com.rupiksha.aeps.dto.request.AepsDailyAuthRequest.builder()
                .mobileNumber(mobile)
                .adharNumber(mainUser.getAadhaarNumber() != null ? mainUser.getAadhaarNumber() : "")
                .pidXml(request.getPidXml())
                .merchantId(resolvedMerchantId)
                .aepsAgentId(resolvedAgentId)
                .latitude(request.getLatitude())
                .longitude(request.getLongitude())
                .biometricType(request.getBiometricType())
                .serviceType(request.getServiceType())
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
            String txnId = providerResult.getProviderTxnId();
            String sessionRef;
            if (txnId != null && !txnId.isBlank()) {
                sessionRef = "FGP-" + txnId.trim();
            } else {
                sessionRef = "FGP-" + System.currentTimeMillis();
            }

            LocalDateTime nowLdt = LocalDateTime.now();
            Instant nowInstant = Instant.now();

            if (isAp) {
                // Update AEPS user
                aepsUser.setAepsAp2faSessionId(sessionRef);
                aepsUser.setAepsAp2faAuthenticatedAt(nowLdt);
                aepsUserRepository.save(aepsUser);

                // Update main core user
                mainUser.setAepsAp2faSessionId(sessionRef);
                mainUser.setAepsAp2faAuthenticatedAt(nowInstant);
                mainUserRepository.save(mainUser);
            } else {
                // Update AEPS user
                aepsUser.setAeps2faSessionId(sessionRef);
                aepsUser.setAeps2faAuthenticatedAt(nowLdt);
                aepsUserRepository.save(aepsUser);

                // Update main core user
                mainUser.setAeps2faSessionId(sessionRef);
                mainUser.setAeps2faAuthenticatedAt(nowInstant);
                mainUserRepository.save(mainUser);
            }

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

            String failMsg = providerResult.getMessage();

            // Update audit history log
            history.setWorkflowState(workflowState.name());
            history.setStatus("DAILY_AUTH_FAILED");
            history.setRemarks(failMsg);
            aepsKycHistoryRepository.save(history);

            return KycResponse.builder()
                    .success(false)
                    .workflowState(workflowState.name())
                    .message(failMsg != null ? failMsg : "Daily 2FA authentication failed.")
                    .provider(activeProvider.getProviderName().toUpperCase())
                    .build();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // BANK eKYC — Mandatory step for all new merchants per updated Fingpay doc
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public KycResponse completeBankEkyc(BankEkycRequest request, String mobile) {
        log.info("[BANK-EKYC] Starting bank eKYC biometric submission for mobile: {}", mobile);

        // 1. Resolve core user
        com.rupiksha.backend.domain.User mainUser = mainUserRepository.findByMobile(mobile)
                .or(() -> mainUserRepository.findByUsername(mobile))
                .orElseThrow(() -> new AepsException("Core user not found for mobile: " + mobile));

        long uidLong = mainUser.getId().getMostSignificantBits() & Long.MAX_VALUE;

        AepsKyc aepsKyc = aepsKycRepository.findByUid(uidLong)
                .orElseThrow(() -> new AepsException("Fingpay merchant profile not found. Please complete onboarding."));

        String merchantLoginId = aepsKyc.getOutlet();
        if (merchantLoginId == null || merchantLoginId.isBlank()) {
            throw new AepsException("Fingpay merchant login ID is missing. Please complete onboarding again.");
        }

        // Use stored bank eKYC references (saved when BANK_EKYC_REQUIRED was returned)
        Long primaryKeyId = aepsKyc.getBankEkycPrimaryKeyId();
        String encodeFPTxnId = aepsKyc.getBankEkycEncodeFPTxnId();

        if (primaryKeyId == null || primaryKeyId == 0 || encodeFPTxnId == null || encodeFPTxnId.isBlank()) {
            // If references missing, initiate a fresh sendOTP for bank eKYC first
            log.info("[BANK-EKYC] No stored bank eKYC references found. Initiating fresh sendOTP...");
            throw new AepsException("Bank eKYC session references not found. Please restart the eKYC process from Step 1 (fingerprint scan).");
        }

        String pidXml = request.getPidXml();
        if (pidXml == null || pidXml.isBlank() || !pidXml.contains("<PidData>")) {
            throw new AepsException("Biometric XML payload is invalid or empty for bank eKYC submission.");
        }

        // 2. Parse PID XML to extract biometric fields
        Map<String, String> parsed;
        try {
            parsed = parsePidXml(pidXml);
        } catch (Exception e) {
            throw new AepsException("Failed to parse biometric XML for bank eKYC: " + e.getMessage());
        }

        // 3. Build biometric DTO — same structure as regular eKYC biometric API
        BiometricRequestDTO biometricDto = new BiometricRequestDTO();
        biometricDto.setMerchantLoginId(merchantLoginId);
        biometricDto.setPrimaryKeyId(primaryKeyId.intValue());
        biometricDto.setEncodeFPTxnId(encodeFPTxnId);
        biometricDto.setRequestRemarks("Bank eKYC Biometric Verification");

        BiometricRequestDTO.CardnumberORUID card = new BiometricRequestDTO.CardnumberORUID();
        String aadhaar = mainUser.getAadhaarNumber();
        if (aadhaar == null || aadhaar.isBlank()) {
            throw new AepsException("Aadhaar number not found in merchant profile for bank eKYC.");
        }
        card.setAdhaarNumber(aadhaar);
        card.setIndicatorforUID("0");  // Per doc: constant '0' for Aadhaar payment
        card.setNationalBankIdentificationNumber("");
        biometricDto.setCardnumberORUID(card);

        // Populate capture response from parsed PID XML
        String nmPoints = parsed.getOrDefault("nmPoints", "36");
        if (nmPoints.isBlank() || "0".equals(nmPoints)) nmPoints = "36";
        String qScore = parsed.getOrDefault("qScore", "76");
        if (qScore.isBlank() || "0".equals(qScore)) qScore = "76";

        BiometricRequestDTO.CaptureResponse capture = new BiometricRequestDTO.CaptureResponse();
        capture.setErrCode(parsed.get("errCode"));
        capture.setErrInfo(parsed.get("errInfo"));
        capture.setFCount(parsed.getOrDefault("fCount", "1"));
        capture.setFType("2");
        capture.setICount(parsed.getOrDefault("iCount", "0"));
        capture.setIType(parsed.getOrDefault("iType", "0"));
        capture.setPCount(parsed.getOrDefault("pCount", "0"));
        capture.setPType(parsed.getOrDefault("pType", "0"));
        capture.setNmPoints(nmPoints);
        capture.setQScore(qScore);
        capture.setDpID(parsed.get("dpID"));
        capture.setRdsID(parsed.get("rdsID"));
        capture.setRdsVer(parsed.get("rdsVer"));
        capture.setDc(parsed.get("dc"));
        capture.setMi(parsed.get("mi"));
        capture.setMc(parsed.get("mc"));
        capture.setCi(parsed.get("ci"));
        capture.setSessionKey(parsed.get("sessionKey"));
        capture.setHmac(parsed.get("hmac"));
        capture.setPidDatatype(parsed.getOrDefault("PidDatatype", "FMR"));
        capture.setPiddata(parsed.get("Piddata"));
        biometricDto.setCaptureResponse(capture);

        // 4. Submit biometric to Fingpay bank eKYC endpoint
        try {
            String rawResponse = biometricService.biometric(biometricDto);
            JsonNode node = objectMapper.readTree(rawResponse);

            boolean success = node.path("statusId").asInt(0) == 1
                    || node.path("status").asText("").equalsIgnoreCase("SUCCESS");

            // Also check kycResponseCode: "0" means success per API doc
            String kycResponseCode = node.path("data").path("kycResponseCode").asText("");
            if (!success && "0".equals(kycResponseCode)) {
                success = true;
            }

            String responseMessage = node.path("message").asText("");
            if (responseMessage.isBlank() && node.has("data")) {
                responseMessage = node.path("data").path("responseMessage").asText("");
            }

            if (success) {
                log.info("[BANK-EKYC] Biometric submission succeeded for mobile: {}", mobile);

                // Mark bank eKYC as done
                aepsKyc.setBankEkycDone(true);
                // Clear the temporary references
                aepsKyc.setBankEkycPrimaryKeyId(null);
                aepsKyc.setBankEkycEncodeFPTxnId(null);
                aepsKycRepository.save(aepsKyc);

                // Also update main user KYC done flag (bank eKYC implies full KYC completion)
                mainUser.setAepsKycDone(true);
                mainUser.setAepsKycCompletedAt(java.time.Instant.now());
                mainUserRepository.save(mainUser);

                // Audit history
                AepsKycHistory history = AepsKycHistory.builder()
                        .userId(mainUser.getId())
                        .provider("FINGPAY")
                        .merchantId(merchantLoginId)
                        .workflowState(AepsWorkflowState.READY_FOR_DAILY_2FA.name())
                        .status("BANK_EKYC_SUCCESS")
                        .remarks("Bank eKYC biometric completed successfully.")
                        .completedAt(LocalDateTime.now())
                        .createdBy(mainUser.getUsername())
                        .build();
                aepsKycHistoryRepository.save(history);

                return KycResponse.builder()
                        .success(true)
                        .workflowState(AepsWorkflowState.READY_FOR_DAILY_2FA.name())
                        .message("Bank eKYC completed successfully. You can now proceed with Daily 2FA.")
                        .providerReference(encodeFPTxnId)
                        .provider("FINGPAY")
                        .build();

            } else {
                String errMsg = responseMessage.isBlank() ? "Bank eKYC biometric submission failed." : responseMessage;
                log.warn("[BANK-EKYC] Biometric submission failed for mobile: {}, message: {}", mobile, errMsg);

                return KycResponse.builder()
                        .success(false)
                        .workflowState(AepsWorkflowState.BANK_EKYC_REQUIRED.name())
                        .message(errMsg)
                        .providerReference(encodeFPTxnId)
                        .provider("FINGPAY")
                        .build();
            }

        } catch (Exception e) {
            log.error("[BANK-EKYC] Exception during biometric submission for mobile: {}", mobile, e);
            return KycResponse.builder()
                    .success(false)
                    .workflowState(AepsWorkflowState.BANK_EKYC_REQUIRED.name())
                    .message("Bank eKYC submission failed: " + e.getMessage())
                    .provider("FINGPAY")
                    .build();
        }
    }

    /**
     * Parses raw PID XML string into a flat key→value map of biometric fields.
     * (Shared with FingpayProvider — kept here to avoid circular dependency.)
     */
    private Map<String, String> parsePidXml(String pidXml) throws Exception {
        Map<String, String> result = new HashMap<>();
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        DocumentBuilder builder = factory.newDocumentBuilder();
        Document doc = builder.parse(new ByteArrayInputStream(pidXml.getBytes(StandardCharsets.UTF_8)));
        Element root = doc.getDocumentElement();

        extractRespAttributes(root, result);
        extractDeviceInfo(root, result);
        extractSkeyHmac(root, result);
        extractData(root, result);

        return result;
    }

    private void extractRespAttributes(Element root, Map<String, String> result) {
        NodeList respList = root.getElementsByTagName("Resp");
        if (respList.getLength() > 0) {
            Element resp = (Element) respList.item(0);
            result.put("errCode", resp.getAttribute("errCode"));
            result.put("errInfo", resp.getAttribute("errInfo"));
            result.put("fCount", resp.getAttribute("fCount"));
            result.put("iCount", resp.getAttribute("iCount"));
            result.put("pCount", resp.getAttribute("pCount"));
            result.put("nmPoints", resp.getAttribute("nmPoints"));
            result.put("qScore", resp.getAttribute("qScore"));
        }
    }

    private void extractDeviceInfo(Element root, Map<String, String> result) {
        NodeList devInfoList = root.getElementsByTagName("DeviceInfo");
        if (devInfoList.getLength() > 0) {
            Element devInfo = (Element) devInfoList.item(0);
            result.put("dpID", devInfo.getAttribute("dpId"));
            result.put("rdsID", devInfo.getAttribute("rdsId"));
            result.put("rdsVer", devInfo.getAttribute("rdsVer"));
            result.put("dc", devInfo.getAttribute("dc"));
            result.put("mi", devInfo.getAttribute("mi"));
            result.put("mc", devInfo.getAttribute("mc"));
            result.put("ci", devInfo.getAttribute("ci"));
        }
    }

    private void extractSkeyHmac(Element root, Map<String, String> result) {
        NodeList skeyList = root.getElementsByTagName("Skey");
        if (skeyList.getLength() > 0) {
            result.put("sessionKey", skeyList.item(0).getTextContent().trim());
        }
        NodeList hmacList = root.getElementsByTagName("Hmac");
        if (hmacList.getLength() > 0) {
            result.put("hmac", hmacList.item(0).getTextContent().trim());
        }
    }

    private void extractData(Element root, Map<String, String> result) {
        NodeList dataList = root.getElementsByTagName("Data");
        if (dataList.getLength() > 0) {
            Element dataEl = (Element) dataList.item(0);
            result.put("PidDatatype", dataEl.getAttribute("type"));
            result.put("Piddata", dataEl.getTextContent().trim());
        }
    }

    @Override
    public KycResponse checkEkycStatus(String mobile, String kycType) {
        log.info("[EKYC-STATUS] Checking {} status for mobile: {}", kycType, mobile);

        com.rupiksha.backend.domain.User mainUser = mainUserRepository.findByMobile(mobile)
                .or(() -> mainUserRepository.findByUsername(mobile))
                .orElseThrow(() -> new AepsException("Core user not found for mobile: " + mobile));

        long uidLong = mainUser.getId().getMostSignificantBits() & Long.MAX_VALUE;
        AepsKyc aepsKyc = aepsKycRepository.findByUid(uidLong)
                .orElseThrow(() -> new AepsException("Fingpay merchant profile not found."));

        String merchantLoginId = aepsKyc.getOutlet();
        if (merchantLoginId == null || merchantLoginId.isBlank()) {
            throw new AepsException("Fingpay merchant login ID not found.");
        }

        try {
            String rawResponse;
            boolean isBeKyc = "BeKYC".equalsIgnoreCase(kycType);

            if (isBeKyc) {
                rawResponse = ekycStatusService.checkBankEkycStatus(
                        merchantLoginId,
                        aepsKyc.getBankEkycPrimaryKeyId(),
                        aepsKyc.getBankEkycEncodeFPTxnId()
                );
            } else {
                rawResponse = ekycStatusService.checkStatus(merchantLoginId);
            }

            JsonNode node = objectMapper.readTree(rawResponse);
            boolean statusOk = node.path("status").asBoolean(false);
            long statusCode = node.path("statusCode").asLong(0);
            String message = node.path("message").asText("");

            boolean isDone = statusOk && statusCode == 10000;

            if (isBeKyc && isDone && !Boolean.TRUE.equals(aepsKyc.getBankEkycDone())) {
                // Sync DB if Fingpay confirms bank eKYC is done
                aepsKyc.setBankEkycDone(true);
                aepsKycRepository.save(aepsKyc);
                mainUser.setAepsKycDone(true);
                mainUser.setAepsKycCompletedAt(java.time.Instant.now());
                mainUserRepository.save(mainUser);
                log.info("[EKYC-STATUS] Bank eKYC confirmed done via status check for mobile: {}", mobile);
            }

            return KycResponse.builder()
                    .success(isDone)
                    .workflowState(isDone ? AepsWorkflowState.READY_FOR_DAILY_2FA.name() : AepsWorkflowState.BANK_EKYC_REQUIRED.name())
                    .message(message.isBlank() ? (isDone ? "eKYC status verified successfully." : "eKYC not completed yet.") : message)
                    .provider("FINGPAY")
                    .build();

        } catch (Exception e) {
            log.error("[EKYC-STATUS] Exception checking {} status for mobile: {}", kycType, mobile, e);
            return KycResponse.builder()
                    .success(false)
                    .workflowState(AepsWorkflowState.FAILED.name())
                    .message("eKYC status check failed: " + e.getMessage())
                    .provider("FINGPAY")
                    .build();
        }
    }

    /**
     * Resolves the active AEPS provider dynamically using configurations.
     */
    private AepsProvider getActiveProvider() {
        return getActiveProvider(null);
    }

    private AepsProvider getActiveProvider(String requestedProvider) {
        String activeName = (requestedProvider != null && !requestedProvider.isBlank()) 
                ? requestedProvider 
                : aepsProperties.getActiveProvider();
        return providers.stream()
                .filter(p -> p.getProviderName().equalsIgnoreCase(activeName))
                .findFirst()
                .orElseThrow(() -> new AepsException("Active AEPS provider strategy not registered: " + activeName));
    }
}
