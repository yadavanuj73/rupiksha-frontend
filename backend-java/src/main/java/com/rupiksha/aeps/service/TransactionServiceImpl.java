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
import com.rupiksha.aeps.repository.AepsTransactionEngineRepository;
import com.rupiksha.aeps.repository.AepsUserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
public class TransactionServiceImpl implements TransactionService {

    private final AepsUserRepository aepsUserRepository;
    private final com.rupiksha.backend.repository.UserRepository mainUserRepository;
    private final AepsTransactionEngineRepository transactionRepository;
    private final TransactionEngine transactionEngine;
    private final ApplicationEventPublisher eventPublisher;
    private final AepsProperties aepsProperties;

    @org.springframework.beans.factory.annotation.Autowired
    public TransactionServiceImpl(
            @org.springframework.beans.factory.annotation.Qualifier("aepsUserRepository") AepsUserRepository aepsUserRepository,
            @org.springframework.beans.factory.annotation.Qualifier("userRepository") com.rupiksha.backend.repository.UserRepository mainUserRepository,
            AepsTransactionEngineRepository transactionRepository,
            TransactionEngine transactionEngine,
            ApplicationEventPublisher eventPublisher,
            AepsProperties aepsProperties
    ) {
        this.aepsUserRepository = aepsUserRepository;
        this.mainUserRepository = mainUserRepository;
        this.transactionRepository = transactionRepository;
        this.transactionEngine = transactionEngine;
        this.eventPublisher = eventPublisher;
        this.aepsProperties = aepsProperties;
    }


    @Override
    @Transactional
    public TransactionResult executeTransaction(AepsTransactionRequest request, String mobile) {
        log.info("Executing transactional request for merchant: {}, service: {}, amount: {}", 
                mobile, request.getServiceType(), request.getAmount());

        // 1. Perform DTO validations
        validateRequest(request);

        // 2. Fetch and validate AEPS merchant record
        com.rupiksha.aeps.entity.User aepsUser = aepsUserRepository.findByMobile(mobile)
                .or(() -> aepsUserRepository.findByUsername(mobile))
                .orElseThrow(() -> new ValidationException("Merchant record not found in AEPS registry."));

        // 3. Fetch and validate Core User record
        com.rupiksha.backend.domain.User mainUser = mainUserRepository.findByMobile(mobile)
                .orElseThrow(() -> new ValidationException("Core merchant profile not found."));

        // 4. Perform security checks
        performSecurityChecks(mainUser, aepsUser);

        // 5. Setup unique IDs and Correlation ID
        String correlationId = "CORR" + UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase();
        String referenceNumber = "REF" + System.currentTimeMillis() + (System.nanoTime() % 1000);

        // 6. Persist initial transaction record in DB
        AepsTransactionEngine transaction = AepsTransactionEngine.builder()
                .transactionId(request.getTransactionId())
                .referenceNumber(referenceNumber)
                .provider(aepsProperties.getActiveProvider().toLowerCase())
                .serviceType(request.getServiceType().toUpperCase())
                .merchantId(aepsUser.getAepsMerchantId())
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
                .workflowState(TransactionWorkflowState.STARTED)
                .correlationId(correlationId)
                .timestamp(LocalDateTime.now())
                .serviceType(request.getServiceType().toUpperCase())
                .build();
        
        // Temporarily hold engine transaction reference in context properties mapping if needed, 
        // or we can subclass context. Let's add a transactional attribute to context.
        // We will update context structure to support the database entity.

        // Execute transaction via the engine
        TransactionResult result = transactionEngine.execute(context, transaction);

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
        if (request.getAmount() == null) {
            throw new ValidationException("Transaction amount is required.");
        }
        if (request.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new ValidationException("Transaction amount must be positive and non-zero.");
        }
        if (request.getServiceType() == null || request.getServiceType().isBlank()) {
            throw new ValidationException("Service type is required.");
        }
        
        // Reject unsupported service types at validation step (optional but ensures clean gates)
        String type = request.getServiceType().toUpperCase();
        if (!type.equals("CASH_WITHDRAWAL") && !type.equals("BALANCE_INQUIRY") && 
            !type.equals("MINI_STATEMENT") && !type.equals("AADHAAR_PAY")) {
            throw new ValidationException("Unsupported AEPS service type: " + request.getServiceType());
        }

        if (request.getTransactionId() != null && !request.getTransactionId().isBlank()) {
            if (transactionRepository.existsByTransactionId(request.getTransactionId())) {
                throw new ValidationException("Duplicate transaction ID detected: " + request.getTransactionId());
            }
        } else {
            // Generate a unique ID if not provided
            request.setTransactionId("TXN" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase());
        }
    }

    private void performSecurityChecks(com.rupiksha.backend.domain.User mainUser, com.rupiksha.aeps.entity.User aepsUser) {
        // Main Core User Active Gate
        if (mainUser.getStatus() == null || !mainUser.getStatus().name().equalsIgnoreCase("ACTIVE")) {
            throw new ValidationException("Merchant account is inactive or pending approval.");
        }

        // Onboarding Gate
        if (aepsUser.getAepsOnboarded() == null || !aepsUser.getAepsOnboarded()) {
            throw new ValidationException("Merchant is not onboarded with the AEPS provider.");
        }

        // KYC Gate
        if (aepsUser.getAepsKycDone() == null || !aepsUser.getAepsKycDone()) {
            throw new ValidationException("Merchant biometric KYC is not complete.");
        }

        // Daily 2FA Session Gate
        boolean hasValidSession = false;
        if (aepsUser.getAeps2faSessionId() != null && aepsUser.getAeps2faAuthenticatedAt() != null) {
            java.time.LocalDate authenticatedDate = aepsUser.getAeps2faAuthenticatedAt().toLocalDate();
            java.time.LocalDate today = java.time.LocalDate.now();
            hasValidSession = authenticatedDate.isEqual(today);
        }
        if (!hasValidSession) {
            throw new ValidationException("Merchant Daily 2FA session is not authenticated for today.");
        }
    }
}
