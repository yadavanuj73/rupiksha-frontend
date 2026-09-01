package com.rupiksha.aeps.service;

import com.rupiksha.aeps.config.AepsProperties;
import com.rupiksha.aeps.dto.AepsTransactionEvent;
import com.rupiksha.aeps.dto.TransactionContext;
import com.rupiksha.aeps.dto.TransactionResult;
import com.rupiksha.aeps.dto.request.AepsTransactionRequest;
import com.rupiksha.aeps.entity.AepsTransactionEngine;
import com.rupiksha.aeps.enums.TransactionWorkflowState;
import com.rupiksha.aeps.exception.AepsException;
import com.rupiksha.aeps.exception.ValidationException;
import com.rupiksha.aeps.provider.fingpay.entity.AepsKyc;
import com.rupiksha.aeps.provider.fingpay.entity.Fingpay2faTxn;
import com.rupiksha.aeps.provider.fingpay.repository.AepsKycRepository;
import com.rupiksha.aeps.provider.fingpay.repository.Fingpay2faTxnRepository;
import com.rupiksha.aeps.repository.AepsTransactionEngineRepository;
import com.rupiksha.aeps.repository.AepsUserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
public class TransactionServiceImpl implements TransactionService {

    private static final ZoneId IST_ZONE = ZoneId.of("Asia/Kolkata");

    private final AepsUserRepository aepsUserRepository;
    private final com.rupiksha.backend.repository.UserRepository mainUserRepository;
    private final AepsTransactionEngineRepository transactionRepository;
    private final TransactionEngine transactionEngine;
    private final ApplicationEventPublisher eventPublisher;
    private final AepsProperties aepsProperties;
    private final com.rupiksha.backend.service.WalletService walletService;
    private final AepsKycRepository aepsKycRepository;
    private final Fingpay2faTxnRepository fingpay2faTxnRepository;

    @org.springframework.beans.factory.annotation.Autowired
    public TransactionServiceImpl(
            @org.springframework.beans.factory.annotation.Qualifier("aepsUserRepository") AepsUserRepository aepsUserRepository,
            @org.springframework.beans.factory.annotation.Qualifier("userRepository") com.rupiksha.backend.repository.UserRepository mainUserRepository,
            AepsTransactionEngineRepository transactionRepository,
            TransactionEngine transactionEngine,
            ApplicationEventPublisher eventPublisher,
            AepsProperties aepsProperties,
            com.rupiksha.backend.service.WalletService walletService,
            AepsKycRepository aepsKycRepository,
            Fingpay2faTxnRepository fingpay2faTxnRepository
    ) {
        this.aepsUserRepository = aepsUserRepository;
        this.mainUserRepository = mainUserRepository;
        this.transactionRepository = transactionRepository;
        this.transactionEngine = transactionEngine;
        this.eventPublisher = eventPublisher;
        this.aepsProperties = aepsProperties;
        this.walletService = walletService;
        this.aepsKycRepository = aepsKycRepository;
        this.fingpay2faTxnRepository = fingpay2faTxnRepository;
    }

    private com.rupiksha.aeps.entity.User getOrSyncAepsUser(String mobile) {
        Optional<com.rupiksha.backend.domain.User> coreUserOpt = mainUserRepository.findByMobile(mobile)
                .or(() -> mainUserRepository.findByUsername(mobile));

        com.rupiksha.aeps.entity.User aepsUser = aepsUserRepository.findByMobile(mobile)
                .or(() -> aepsUserRepository.findByUsername(mobile))
                .orElseGet(com.rupiksha.aeps.entity.User::new);

        if (coreUserOpt.isPresent()) {
            com.rupiksha.backend.domain.User coreUser = coreUserOpt.get();

            aepsUser.setMobile(coreUser.getMobile());
            aepsUser.setUsername(coreUser.getUsername());
            if (aepsUser.getEmail() == null) aepsUser.setEmail(coreUser.getEmail());
            if (aepsUser.getName() == null) aepsUser.setName(coreUser.getFullName());

            // If aepsUser was never explicitly onboarded on Levin, ensure defaults are false
            if (aepsUser.getAepsOnboarded() == null) {
                aepsUser.setAepsOnboarded(false);
            }
            if (aepsUser.getAepsKycDone() == null) {
                aepsUser.setAepsKycDone(false);
            }

            // If aepsAgentId was contaminated with Fingpay outlet / partyCode, purge Fingpay data from Levin record
            if (aepsUser.getAepsAgentId() != null && coreUser.getPartyCode() != null &&
                    (aepsUser.getAepsAgentId().equalsIgnoreCase(coreUser.getPartyCode().trim()) ||
                     aepsUser.getAepsAgentId().toUpperCase().startsWith("RPR"))) {
                aepsUser.setAepsAgentId(null);
                aepsUser.setAepsMerchantId(null);
                aepsUser.setAepsOnboarded(false);
                aepsUser.setAepsKycDone(false);
                aepsUser.setAeps2faAuthenticatedAt(null);
                aepsUser.setAepsAp2faAuthenticatedAt(null);
                aepsUser.setAepsKycTxnId(null);
                aepsUser.setAepsKycRefId(null);
            }

            return aepsUserRepository.save(aepsUser);
        }

        return aepsUser.getId() != null ? aepsUser : null;
    }

    @Override
    @Transactional
    public TransactionResult executeTransaction(AepsTransactionRequest request, String mobile) {
        log.info("Executing transactional request for merchant: {}, service: {}, amount: {}", 
                mobile, request.getServiceType(), request.getAmount());

        // 1. Perform DTO validations
        validateRequest(request);

        // 2. Fetch and validate AEPS merchant record
        com.rupiksha.aeps.entity.User aepsUser = getOrSyncAepsUser(mobile);
        if (aepsUser == null) {
            throw new ValidationException("Merchant record not found in AEPS registry.");
        }

        // 3. Fetch and validate Core User record
        com.rupiksha.backend.domain.User mainUser = mainUserRepository.findByMobile(mobile)
                .or(() -> mainUserRepository.findByUsername(mobile))
                .orElseThrow(() -> new ValidationException("Core merchant profile not found."));

        // 4. Resolve Active Provider
        String reqProvider = request.getProvider();
        String activeProvider = (reqProvider != null && !reqProvider.isBlank()) 
                ? reqProvider.toLowerCase() 
                : aepsProperties.getActiveProvider().toLowerCase();

        // 5. Perform security checks strictly isolated per provider
        performSecurityChecks(mainUser, aepsUser, request.getServiceType(), activeProvider);

        // Check wallet balance for CASH_DEPOSIT
        if ("CASH_DEPOSIT".equalsIgnoreCase(request.getServiceType())) {
            var wallet = walletService.getBalance(mainUser.getId().toString());
            if (wallet.balance().compareTo(request.getAmount()) < 0) {
                throw new ValidationException("Insufficient wallet balance for AEPS Cash Deposit.");
            }
        }

        // 6. Resolve Canonical Merchant ID per Provider
        String resolvedMerchantId = aepsUser.getAepsMerchantId();
        if ("fingpay".equalsIgnoreCase(activeProvider)) {
            long uidLong = mainUser.getId().getMostSignificantBits() & Long.MAX_VALUE;
            Optional<AepsKyc> fingKycOpt = aepsKycRepository.findByUid(uidLong)
                    .or(() -> (mainUser.getPartyCode() != null && !mainUser.getPartyCode().isBlank()) ? aepsKycRepository.findByOutlet(mainUser.getPartyCode().trim()) : Optional.empty())
                    .or(() -> (mainUser.getAepsAgentId() != null && !mainUser.getAepsAgentId().isBlank()) ? aepsKycRepository.findByOutlet(mainUser.getAepsAgentId().trim()) : Optional.empty())
                    .or(() -> (mainUser.getAepsMerchantId() != null && !mainUser.getAepsMerchantId().isBlank()) ? aepsKycRepository.findByMerchantId(mainUser.getAepsMerchantId().trim()) : Optional.empty());

            if (fingKycOpt.isPresent()) {
                AepsKyc kyc = fingKycOpt.get();
                if (kyc.getMerchantId() != null && !kyc.getMerchantId().isBlank()) {
                    resolvedMerchantId = kyc.getMerchantId().trim().toUpperCase();
                } else if (kyc.getOutlet() != null && !kyc.getOutlet().isBlank()) {
                    resolvedMerchantId = kyc.getOutlet().trim().toUpperCase();
                }
            }
            if ((resolvedMerchantId == null || resolvedMerchantId.isBlank()) && mainUser.getPartyCode() != null && !mainUser.getPartyCode().isBlank()) {
                resolvedMerchantId = mainUser.getPartyCode().trim().toUpperCase();
            }
            if ((resolvedMerchantId == null || resolvedMerchantId.isBlank()) && mainUser.getAepsAgentId() != null && !mainUser.getAepsAgentId().isBlank()) {
                resolvedMerchantId = mainUser.getAepsAgentId().trim().toUpperCase();
            }
            if ((resolvedMerchantId == null || resolvedMerchantId.isBlank()) && mainUser.getAepsMerchantId() != null && !mainUser.getAepsMerchantId().isBlank()) {
                resolvedMerchantId = mainUser.getAepsMerchantId().trim().toUpperCase();
            }
        }
        if (resolvedMerchantId == null || resolvedMerchantId.isBlank()) {
            resolvedMerchantId = (aepsUser.getAepsMerchantId() != null && !aepsUser.getAepsMerchantId().isBlank())
                    ? aepsUser.getAepsMerchantId()
                    : ("MER" + mobile);
        }

        // 7. Setup unique IDs and Correlation ID
        String correlationId = "CORR" + UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase();
        String referenceNumber = "REF" + System.currentTimeMillis() + (System.nanoTime() % 1000);

        // 8. Persist initial transaction record in DB
        AepsTransactionEngine transaction = AepsTransactionEngine.builder()
                .transactionId(request.getTransactionId())
                .referenceNumber(referenceNumber)
                .provider(activeProvider)
                .serviceType(request.getServiceType().toUpperCase())
                .merchantId(resolvedMerchantId)
                .userId(mainUser.getId())
                .amount(request.getAmount())
                .status("STARTED")
                .workflowState(TransactionWorkflowState.STARTED.name())
                .initiatedAt(LocalDateTime.now())
                .ipAddress(request.getIpAddress())
                .deviceId(request.getDeviceId())
                .latitude(request.getLatitude())
                .longitude(request.getLongitude())
                .correlationId(correlationId)
                .createdBy(mainUser.getUsername())
                .updatedBy(mainUser.getUsername())
                .build();

        transaction = transactionRepository.save(transaction);
        log.info("Initial AEPS transaction record persisted with ID: {}, referenceNumber: {}", 
                transaction.getId(), referenceNumber);

        // 7. Assemble Transaction Context
        TransactionContext context = TransactionContext.builder()
                .user(mainUser)
                .merchant(aepsUser)
                .request(request)
                .provider(activeProvider)
                .workflowState(TransactionWorkflowState.STARTED)
                .correlationId(correlationId)
                .timestamp(LocalDateTime.now())
                .serviceType(request.getServiceType().toUpperCase())
                .build();

        // Execute transaction via the engine
        TransactionResult result = transactionEngine.execute(context, transaction);

        // If provider returned 2FA required (FP069), invalidate active session so user is prompted
        if ("FP069".equalsIgnoreCase(result.getResponseCode()) ||
            (result.getResponseMessage() != null && result.getResponseMessage().toLowerCase().contains("2fa"))) {
            log.warn("Provider returned 2FA required ({}: {}). Resetting 2FA session for user: {}",
                    result.getResponseCode(), result.getResponseMessage(), mainUser.getId());
            if ("AADHAAR_PAY".equalsIgnoreCase(request.getServiceType())) {
                mainUser.setAepsAp2faAuthenticatedAt(null);
                mainUser.setAepsAp2faSessionId(null);
                aepsUser.setAepsAp2faAuthenticatedAt(null);
                aepsUser.setAepsAp2faSessionId(null);
            } else {
                mainUser.setAeps2faAuthenticatedAt(null);
                mainUser.setAeps2faSessionId(null);
                aepsUser.setAeps2faAuthenticatedAt(null);
                aepsUser.setAeps2faSessionId(null);
            }
            mainUserRepository.save(mainUser);
            aepsUserRepository.save(aepsUser);
        }

        // 8. Publish internal dashboard events
        try {
            log.info("Publishing AepsTransactionEvent for transaction: {}", transaction.getTransactionId());
            eventPublisher.publishEvent(new AepsTransactionEvent(this, transaction));
        } catch (Exception e) {
            log.error("Failed to publish post-transaction complete event: {}", e.getMessage(), e);
        }

        return result;
    }

    private void validateRequest(AepsTransactionRequest request) {
        if (request.getServiceType() == null || request.getServiceType().isBlank()) {
            throw new ValidationException("Service type is required.");
        }
        
        String type = request.getServiceType().toUpperCase();
        if (!type.equals("CASH_WITHDRAWAL") && !type.equals("BALANCE_INQUIRY") && 
            !type.equals("MINI_STATEMENT") && !type.equals("AADHAAR_PAY") &&
            !type.equals("CASH_DEPOSIT")) {
            throw new ValidationException("Unsupported AEPS service type: " + request.getServiceType());
        }

        if (!type.equals("BALANCE_INQUIRY") && !type.equals("MINI_STATEMENT")) {
            if (request.getAmount() == null) {
                throw new ValidationException("Transaction amount is required.");
            }
            if (request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
                throw new ValidationException("Transaction amount must be positive and non-zero.");
            }
            if (type.equals("CASH_WITHDRAWAL") || type.equals("AADHAAR_PAY")) {
                if (request.getAmount().remainder(new BigDecimal("5")).compareTo(BigDecimal.ZERO) != 0) {
                    throw new ValidationException("Cash withdrawal amount must be a multiple of 5 (e.g. ₹500, ₹505, ₹1,000).");
                }
            }
        } else {
            if (request.getAmount() == null) {
                request.setAmount(BigDecimal.ZERO);
            }
        }

        if (request.getTransactionId() != null && !request.getTransactionId().isBlank()) {
            if (transactionRepository.existsByTransactionId(request.getTransactionId())) {
                throw new ValidationException("Duplicate transaction ID detected: " + request.getTransactionId());
            }
        } else {
            request.setTransactionId("TXN" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase());
        }
    }

    private boolean isSessionValid(Instant authenticatedAt) {
        if (authenticatedAt == null) {
            return false;
        }
        Instant now = Instant.now();
        if (authenticatedAt.isAfter(now)) {
            return false;
        }
        LocalDate authDate = authenticatedAt.atZone(IST_ZONE).toLocalDate();
        LocalDate today = LocalDate.now(IST_ZONE);
        return authDate.isEqual(today);
    }

    private boolean isSessionValid(LocalDateTime authenticatedAt) {
        if (authenticatedAt == null) {
            return false;
        }
        LocalDate authDate = authenticatedAt.toLocalDate();
        LocalDate today = LocalDate.now(IST_ZONE);
        return authDate.isEqual(today);
    }

    private void performSecurityChecks(com.rupiksha.backend.domain.User mainUser, com.rupiksha.aeps.entity.User aepsUser, String serviceType, String activeProvider) {
        // 1. Main Core User Active Gate
        if (mainUser.getStatus() == null || !mainUser.getStatus().name().equalsIgnoreCase("ACTIVE")) {
            throw new ValidationException("Merchant account is inactive or pending approval.");
        }

        boolean isFingpay = "fingpay".equalsIgnoreCase(activeProvider);

        if (isFingpay) {
            long uidLong = mainUser.getId().getMostSignificantBits() & Long.MAX_VALUE;
            Optional<AepsKyc> fingKycOpt = aepsKycRepository.findByUid(uidLong)
                    .or(() -> (mainUser.getPartyCode() != null && !mainUser.getPartyCode().isBlank()) ? aepsKycRepository.findByOutlet(mainUser.getPartyCode().trim()) : Optional.empty())
                    .or(() -> (mainUser.getAepsAgentId() != null && !mainUser.getAepsAgentId().isBlank()) ? aepsKycRepository.findByOutlet(mainUser.getAepsAgentId().trim()) : Optional.empty());

            // Fingpay Onboarding Gate
            boolean isOnboarded = fingKycOpt.isPresent() || (mainUser.getPartyCode() != null && !mainUser.getPartyCode().isBlank());
            if (!isOnboarded) {
                throw new ValidationException("Merchant is not onboarded with Fingpay AEPS. Please complete Fingpay onboarding first.");
            }

            // Fingpay KYC Gate
            boolean isKycDone = fingKycOpt.map(k -> Boolean.TRUE.equals(k.getKycDone()) || Boolean.TRUE.equals(k.getBankEkycDone()) || (k.getOutlet() != null && !k.getOutlet().isBlank())).orElse(false);
            if (!isKycDone) {
                throw new ValidationException("Merchant biometric KYC is not complete for Fingpay AEPS.");
            }

            // Fingpay Daily 2FA Gate
            boolean isAadhaarPay = "AADHAAR_PAY".equalsIgnoreCase(serviceType);
            boolean hasValidSession = false;

            if (isAadhaarPay) {
                hasValidSession = isSessionValid(mainUser.getAepsAp2faAuthenticatedAt());
                if (!hasValidSession && fingpay2faTxnRepository != null) {
                    Optional<Fingpay2faTxn> apTxnOpt = fingpay2faTxnRepository
                            .findTopByUserIdAndServiceTypeAndResponseCodeOrderByCreatedAtDesc(mainUser.getId(), "AP", "00")
                            .or(() -> fingpay2faTxnRepository.findTopByMobileNumberAndServiceTypeAndResponseCodeOrderByCreatedAtDesc(mainUser.getMobile(), "AP", "00"));
                    
                    if (apTxnOpt.isPresent() && isSessionValid(apTxnOpt.get().getAuthenticatedAt())) {
                        hasValidSession = true;
                        mainUser.setAepsAp2faAuthenticatedAt(apTxnOpt.get().getAuthenticatedAt().atZone(IST_ZONE).toInstant());
                        mainUserRepository.save(mainUser);
                    }
                }
            } else {
                hasValidSession = isSessionValid(mainUser.getAeps2faAuthenticatedAt());
                if (!hasValidSession && fingpay2faTxnRepository != null) {
                    Optional<Fingpay2faTxn> aepsTxnOpt = fingpay2faTxnRepository
                            .findTopByUserIdAndServiceTypeAndResponseCodeOrderByCreatedAtDesc(mainUser.getId(), "AEPS", "00")
                            .or(() -> fingpay2faTxnRepository.findTopByMobileNumberAndServiceTypeAndResponseCodeOrderByCreatedAtDesc(mainUser.getMobile(), "AEPS", "00"));
                    
                    if (aepsTxnOpt.isPresent() && isSessionValid(aepsTxnOpt.get().getAuthenticatedAt())) {
                        hasValidSession = true;
                        mainUser.setAeps2faAuthenticatedAt(aepsTxnOpt.get().getAuthenticatedAt().atZone(IST_ZONE).toInstant());
                        mainUserRepository.save(mainUser);
                    }
                }
            }

            if (!hasValidSession) {
                throw new ValidationException("Merchant Daily 2FA session is expired or not authenticated for Fingpay. Please complete Daily 2FA.");
            }
        } else {
            // Levin AEPS (AEPS 2)
            boolean isLevinOnboarded = aepsUser != null && Boolean.TRUE.equals(aepsUser.getAepsOnboarded());
            if (!isLevinOnboarded) {
                throw new ValidationException("Merchant is not onboarded with Levin AEPS. Please complete Levin onboarding first.");
            }

            boolean isLevinKycDone = aepsUser != null && Boolean.TRUE.equals(aepsUser.getAepsKycDone());
            if (!isLevinKycDone) {
                throw new ValidationException("Merchant biometric KYC is not complete for Levin AEPS. Please complete Levin KYC first.");
            }

            boolean isAadhaarPay = "AADHAAR_PAY".equalsIgnoreCase(serviceType);
            boolean hasValidSession = aepsUser != null && (isAadhaarPay 
                    ? isSessionValid(aepsUser.getAepsAp2faAuthenticatedAt())
                    : isSessionValid(aepsUser.getAeps2faAuthenticatedAt()));

            if (!hasValidSession) {
                throw new ValidationException("Merchant Daily 2FA session is expired or not authenticated for Levin. Please complete Daily 2FA.");
            }
        }
    }
}
