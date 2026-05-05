package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.PaymentDtos;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.TxnRepository;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.service.PaymentService;
import com.rupiksha.backend.service.WalletService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PaymentServiceImpl implements PaymentService {
    private final PaymentProviderRouter paymentProviderRouter;
    private final TxnRepository txnRepository;
    private final UserRepository userRepository;
    private final WalletService walletService;
    private final KycAccessGuard kycAccessGuard;

    @Override
    @Transactional
    public PaymentDtos.CreateOrderResponse createOrder(PaymentDtos.CreateOrderRequest request) {
        User user = kycAccessGuard.requireServiceEnabledUser(UUID.fromString(request.userId()));

        String idempotency = UUID.randomUUID().toString();

        Txn txn = new Txn();
        txn.setUser(user);
        txn.setAmount(request.amount());
        txn.setServiceType(request.purpose());
        txn.setStatus(TransactionStatus.INITIATED);
        txn.setIdempotencyKey(idempotency);
        txnRepository.save(txn);

        var providerResponse = paymentProviderRouter.current().createOrder(
                txn.getId().toString(),
                request.amount(),
                request.purpose()
        );

        txn.setProviderRef(providerResponse.orderId());
        txnRepository.save(txn);

        return new PaymentDtos.CreateOrderResponse(
                providerResponse.orderId(),
                providerResponse.provider(),
                providerResponse.status(),
                request.amount(),
                providerResponse.payload()
        );
    }

    @Override
    @Transactional
    public PaymentDtos.WebhookResponse handleWebhook(String rawPayload, Map<String, String> headers) {
        return processWebhookEvent(paymentProviderRouter.current().parseWebhookEvent(rawPayload, headers));
    }

    @Override
    @Transactional
    public PaymentDtos.WebhookResponse handleWebhook(String provider, String rawPayload, Map<String, String> headers) {
        return processWebhookEvent(paymentProviderRouter.byNameOrDefault(provider).parseWebhookEvent(rawPayload, headers));
    }

    private PaymentDtos.WebhookResponse processWebhookEvent(com.rupiksha.backend.integration.payment.PaymentGatewayProvider.WebhookEvent event) {
        if (!event.valid()) return new PaymentDtos.WebhookResponse(false, event.message());
        if (event.orderId() == null || event.orderId().isBlank()) return new PaymentDtos.WebhookResponse(false, "Missing order id");

        txnRepository.findByProviderRef(event.orderId()).ifPresent(txn -> {
            if (event.success() && txn.getStatus() != TransactionStatus.SUCCESS) {
                txn.setStatus(TransactionStatus.SUCCESS);
                txnRepository.save(txn);
                walletService.credit(new com.rupiksha.backend.api.dto.WalletDtos.WalletEntryRequest(
                        txn.getUser().getId().toString(),
                        txn.getAmount(),
                        "Gateway topup success: " + event.orderId()
                ));
            } else if (!event.success() && txn.getStatus() == TransactionStatus.INITIATED) {
                txn.setStatus(TransactionStatus.FAILED);
                txnRepository.save(txn);
            }
        });
        return new PaymentDtos.WebhookResponse(true, event.message());
    }

    @Override
    @Transactional
    public boolean verifyPayment(Map<String, Object> payload) {
        boolean verified = paymentProviderRouter.current().verifyPaymentSignature(payload);
        if (!verified) return false;
        String orderId = String.valueOf(
                payload.getOrDefault("razorpay_order_id",
                        payload.getOrDefault("order_id",
                                payload.getOrDefault("merchantTransactionId", "")))
        );
        if (orderId.isBlank()) return false;
        txnRepository.findByProviderRef(orderId).ifPresent(txn -> {
            if (txn.getStatus() != TransactionStatus.SUCCESS) {
                txn.setStatus(TransactionStatus.SUCCESS);
                txn.setProviderRef(String.valueOf(payload.getOrDefault("razorpay_payment_id", txn.getProviderRef())));
                txnRepository.save(txn);
                walletService.credit(new com.rupiksha.backend.api.dto.WalletDtos.WalletEntryRequest(
                        txn.getUser().getId().toString(),
                        txn.getAmount(),
                        "Gateway topup success: " + orderId
                ));
            }
        });
        return true;
    }

    @Transactional
    public PaymentDtos.CreateOrderResponse createOrderCompat(BigDecimal amount, String customerId, String purpose) {
        User user = userRepository.findByUsername(customerId)
                .or(() -> userRepository.findByMobile(customerId))
                .orElseThrow(() -> new IllegalArgumentException("User not found for customer_id"));
        kycAccessGuard.requireServiceEnabledUser(user.getId());
        return createOrder(new PaymentDtos.CreateOrderRequest(user.getId().toString(), amount, purpose));
    }
}

