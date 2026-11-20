package com.rupiksha.aeps.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rupiksha.aeps.config.PayoutProperties;
import com.rupiksha.aeps.dto.BusstoWebhookResponse;
import com.rupiksha.aeps.dto.PayoutResponse;
import com.rupiksha.aeps.entity.PayoutTransaction;
import com.rupiksha.aeps.entity.PayoutWebhookEvent;
import com.rupiksha.aeps.repository.PayoutTransactionRepository;
import com.rupiksha.aeps.repository.PayoutWebhookEventRepository;
import com.rupiksha.aeps.service.impl.BusstoPayoutWebhookServiceImpl;
import com.rupiksha.aeps.util.BusttoCryptoUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BusstoPayoutWebhookServiceTest {

    @Mock
    private PayoutTransactionRepository payoutTransactionRepository;

    @Mock
    private PayoutWebhookEventRepository payoutWebhookEventRepository;

    @Mock
    private PayoutService payoutService;

    @Mock
    private PayoutAuditService payoutAuditService;

    private PayoutProperties payoutProperties;
    private ObjectMapper objectMapper;
    private BusstoPayoutWebhookService webhookService;

    private final String AES_KEY = "12345678901234567890123456789012"; // 32-byte AES key
    private final String WEBHOOK_SECRET = "secret_webhook_test_key_12345";
    private final String API_KEY = "test_bussto_api_key";

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        payoutProperties = new PayoutProperties();
        payoutProperties.setAesKey(AES_KEY);
        payoutProperties.setWebhookSecret(WEBHOOK_SECRET);
        payoutProperties.setApiKey(API_KEY);

        webhookService = new BusstoPayoutWebhookServiceImpl(
                payoutTransactionRepository,
                payoutWebhookEventRepository,
                payoutService,
                payoutAuditService,
                payoutProperties,
                objectMapper
        );
    }

    private PayoutTransaction createPendingTransaction(String orderId, BigDecimal amount) {
        return PayoutTransaction.builder()
                .id(100L)
                .orderId(orderId)
                .userId("ecf4d499-1b8a-4db7-8325-95a874fbae8e")
                .amount(amount)
                .chargeAmount(new BigDecimal("5.50"))
                .gstAmount(new BigDecimal("0.99"))
                .totalChargedAmount(new BigDecimal("6.49"))
                .totalDeductedAmount(amount.add(new BigDecimal("6.49")))
                .beneficiaryName("Anuj Kumar")
                .accountNumber("919876543210")
                .ifsc("SBIN0001234")
                .transferMode("IMPS")
                .status("PENDING")
                .refundStatus("NONE")
                .createdAt(LocalDateTime.now())
                .build();
    }

    private String calculateHmac(String data, String key) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    @DisplayName("Scenario 1: Valid Authenticated Bussto Callback - SUCCESS Transition")
    void validAuthenticatedCallback_success_updatesTransactionStatus() throws Exception {
        String orderId = "PO_20261120113355_BDHB";
        PayoutTransaction txn = createPendingTransaction(orderId, new BigDecimal("10.00"));
        when(payoutTransactionRepository.findWithLockByOrderId(orderId)).thenReturn(Optional.of(txn));

        String rawJson = """
        {
            "external_order_id": "%s",
            "bbTransactionId": "BB_TXN_SUCCESS_999",
            "bbTransactionStatus": "SUCCESS",
            "amount": "10.00",
            "bbUtrNumber": "UTR987654321",
            "bbReason": "Transfer completed successfully",
            "eventId": "EVT_001"
        }
        """.formatted(orderId);

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Webhook-Secret", WEBHOOK_SECRET);

        ResponseEntity<BusstoWebhookResponse> response = webhookService.processWebhook(rawJson, headers, "10.0.0.1");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody().isSuccess());
        assertEquals("SUCCESS", response.getBody().getStatus());
        assertEquals(orderId, response.getBody().getOrderId());

        assertEquals("SUCCESS", txn.getStatus());
        assertEquals("BB_TXN_SUCCESS_999", txn.getProviderTxnId());
        assertEquals("UTR987654321", txn.getUtr());
        verify(payoutTransactionRepository).save(txn);
        verify(payoutAuditService).recordStatusChange(eq(txn), eq("PENDING"), eq("SUCCESS"), eq("SUCCESS"),
                eq("BB_TXN_SUCCESS_999"), eq("UTR987654321"), eq("WEBHOOK:BUSSTO"), anyString());
        // Wallet debit was done on initiation; no second debit or refund should be performed
        verify(payoutService, never()).executeRefund(any(), any(), any());
    }

    @Test
    @DisplayName("Scenario 1b: Valid AES-256-GCM Encrypted Callback - SUCCESS")
    void validEncryptedCallback_success_decryptsAndUpdates() throws Exception {
        String orderId = "PO_20261120113355_BDHB";
        PayoutTransaction txn = createPendingTransaction(orderId, new BigDecimal("10.00"));
        when(payoutTransactionRepository.findWithLockByOrderId(orderId)).thenReturn(Optional.of(txn));

        String plainJson = """
        {
            "external_order_id": "%s",
            "bbTransactionId": "BB_TXN_GCM_888",
            "bbTransactionStatus": "SUCCESS",
            "amount": 10.00,
            "bbUtrNumber": "UTR_GCM_111",
            "bbReason": "Transferred via IMPS"
        }
        """.formatted(orderId);

        String encryptedCipher = BusttoCryptoUtil.encrypt(AES_KEY, plainJson);
        String wrappedJson = "{\"response\": \"" + encryptedCipher + "\"}";

        ResponseEntity<BusstoWebhookResponse> response = webhookService.processWebhook(wrappedJson, new HttpHeaders(), "10.0.0.2");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody().isSuccess());
        assertEquals("SUCCESS", response.getBody().getStatus());
        assertEquals("SUCCESS", txn.getStatus());
        assertEquals("UTR_GCM_111", txn.getUtr());
    }

    @Test
    @DisplayName("Scenario 2: Valid Authenticated Callback - FAILED Transition with Exactly-Once Refund")
    void validAuthenticatedCallback_failed_triggersRefundOnce() throws Exception {
        String orderId = "PO_20261120112621_D2VY";
        PayoutTransaction txn = createPendingTransaction(orderId, new BigDecimal("10.00"));
        when(payoutTransactionRepository.findWithLockByOrderId(orderId)).thenReturn(Optional.of(txn));

        String rawJson = """
        {
            "external_order_id": "%s",
            "bbTransactionId": "BB_TXN_FAILED_777",
            "bbTransactionStatus": "FAILED",
            "amount": "10.00",
            "bbReason": "Beneficiary bank offline",
            "eventId": "EVT_FAIL_01"
        }
        """.formatted(orderId);

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Bustto-Signature", calculateHmac(rawJson, WEBHOOK_SECRET));

        ResponseEntity<BusstoWebhookResponse> response = webhookService.processWebhook(rawJson, headers, "10.0.0.1");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("FAILED", response.getBody().getStatus());
        assertEquals("FAILED", txn.getStatus());

        // Refund must be executed with full deducted amount (₹10.00 + ₹6.49 charges = ₹16.49)
        verify(payoutService, times(1)).executeRefund(eq(txn), eq(new BigDecimal("16.49")), contains("Beneficiary bank offline"));
        verify(payoutAuditService).recordStatusChange(eq(txn), eq("PENDING"), eq("FAILED"), eq("FAILED"),
                eq("BB_TXN_FAILED_777"), isNull(), eq("WEBHOOK:BUSSTO"), anyString());
    }

    @Test
    @DisplayName("Scenario 3: Invalid Callback Signature Rejected")
    void invalidSignature_rejected() {
        String rawJson = "{\"external_order_id\":\"PO_123\",\"bbTransactionStatus\":\"SUCCESS\"}";
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Bustto-Signature", "wrong_signature_abc123");

        ResponseEntity<BusstoWebhookResponse> response = webhookService.processWebhook(rawJson, headers, "1.2.3.4");

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        assertFalse(response.getBody().isSuccess());
        verify(payoutTransactionRepository, never()).findWithLockByOrderId(anyString());
    }

    @Test
    @DisplayName("Scenario 4: Modified Callback Body Rejects Signature")
    void modifiedCallbackBody_signatureFails() throws Exception {
        String originalJson = "{\"external_order_id\":\"PO_123\",\"amount\":10.00,\"status\":\"SUCCESS\"}";
        String sig = calculateHmac(originalJson, WEBHOOK_SECRET);

        // Tampered payload
        String tamperedJson = "{\"external_order_id\":\"PO_123\",\"amount\":1000.00,\"status\":\"SUCCESS\"}";
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Signature", sig);

        ResponseEntity<BusstoWebhookResponse> response = webhookService.processWebhook(tamperedJson, headers, "1.2.3.4");

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        assertFalse(response.getBody().isSuccess());
        verify(payoutTransactionRepository, never()).findWithLockByOrderId(anyString());
    }

    @Test
    @DisplayName("Scenario 5: Forged Callback Rejected When S2S Inquiry Does Not Confirm")
    void forgedSuccessCallback_rejectedWithoutValidS2S() {
        String rawJson = "{\"external_order_id\":\"PO_FORGED_123\",\"bbTransactionStatus\":\"SUCCESS\",\"amount\":10.00}";
        HttpHeaders headers = new HttpHeaders(); // no headers

        PayoutTransaction txn = createPendingTransaction("PO_FORGED_123", BigDecimal.TEN);
        when(payoutTransactionRepository.findWithLockByOrderId("PO_FORGED_123")).thenReturn(Optional.of(txn));
        // S2S returns still PENDING, not SUCCESS
        when(payoutService.checkPayoutStatus("PO_FORGED_123", "WEBHOOK:BUSSTO"))
                .thenReturn(PayoutResponse.builder().status("PENDING").orderId("PO_FORGED_123").build());

        ResponseEntity<BusstoWebhookResponse> response = webhookService.processWebhook(rawJson, headers, "1.2.3.4");

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
        // Status remains PENDING, no forged success!
        assertEquals("PENDING", txn.getStatus());
    }

    @Test
    @DisplayName("Scenario 6: Unknown Transaction Reference Returns 404")
    void unknownTransactionReference_returns404() {
        String rawJson = "{\"external_order_id\":\"PO_NON_EXISTENT_999\",\"status\":\"SUCCESS\"}";
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Webhook-Secret", WEBHOOK_SECRET);

        when(payoutTransactionRepository.findWithLockByOrderId("PO_NON_EXISTENT_999")).thenReturn(Optional.empty());

        ResponseEntity<BusstoWebhookResponse> response = webhookService.processWebhook(rawJson, headers, "1.2.3.4");

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        assertFalse(response.getBody().isSuccess());
    }

    @Test
    @DisplayName("Scenario 7: Amount Mismatch Rejected")
    void amountMismatch_rejected() {
        String orderId = "PO_AMOUNT_TEST";
        PayoutTransaction txn = createPendingTransaction(orderId, new BigDecimal("10.00"));
        when(payoutTransactionRepository.findWithLockByOrderId(orderId)).thenReturn(Optional.of(txn));

        String rawJson = """
        {
            "external_order_id": "%s",
            "amount": "5000.00",
            "status": "SUCCESS"
        }
        """.formatted(orderId);

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Webhook-Secret", WEBHOOK_SECRET);

        ResponseEntity<BusstoWebhookResponse> response = webhookService.processWebhook(rawJson, headers, "1.2.3.4");

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("PENDING", txn.getStatus()); // Untouched
    }

    @Test
    @DisplayName("Scenario 8: Duplicate Callback Idempotency - Returns 200 without Duplicate Financial Updates")
    void duplicateCallback_idempotent() {
        String rawJson = "{\"external_order_id\":\"PO_DUP_123\",\"status\":\"SUCCESS\"}";
        when(payoutWebhookEventRepository.findFirstByPayloadHashAndProcessingStatus(anyString(), eq("PROCESSED")))
                .thenReturn(Optional.of(PayoutWebhookEvent.builder().orderId("PO_DUP_123").providerTxnId("TXN_1").build()));

        ResponseEntity<BusstoWebhookResponse> response = webhookService.processWebhook(rawJson, new HttpHeaders(), "1.2.3.4");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("DUPLICATE", response.getBody().getStatus());
        verify(payoutTransactionRepository, never()).save(any());
        verify(payoutService, never()).executeRefund(any(), any(), any());
    }

    @Test
    @DisplayName("Scenario 9: Delayed PENDING Callback Does Not Downgrade Final SUCCESS")
    void delayedPendingCallback_doesNotDowngradeSuccess() {
        String orderId = "PO_SUCCESS_FINAL";
        PayoutTransaction txn = createPendingTransaction(orderId, BigDecimal.TEN);
        txn.setStatus("SUCCESS"); // Already confirmed SUCCESS
        when(payoutTransactionRepository.findWithLockByOrderId(orderId)).thenReturn(Optional.of(txn));

        String rawJson = """
        {
            "external_order_id": "%s",
            "status": "PENDING",
            "amount": "10.00"
        }
        """.formatted(orderId);

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Webhook-Secret", WEBHOOK_SECRET);

        ResponseEntity<BusstoWebhookResponse> response = webhookService.processWebhook(rawJson, headers, "1.2.3.4");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("SUCCESS", txn.getStatus()); // Stays SUCCESS!
        verify(payoutService, never()).executeRefund(any(), any(), any());
    }

    @Test
    @DisplayName("Scenario 10: Duplicate FAILED Callback Does Not Issue Duplicate Refund")
    void duplicateFailedCallback_doesNotDuplicateRefund() {
        String orderId = "PO_FAILED_FINAL";
        PayoutTransaction txn = createPendingTransaction(orderId, BigDecimal.TEN);
        txn.setStatus("FAILED");
        txn.setRefundStatus("REFUNDED"); // Already refunded
        when(payoutTransactionRepository.findWithLockByOrderId(orderId)).thenReturn(Optional.of(txn));

        String rawJson = """
        {
            "external_order_id": "%s",
            "status": "FAILED",
            "amount": "10.00"
        }
        """.formatted(orderId);

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Webhook-Secret", WEBHOOK_SECRET);

        ResponseEntity<BusstoWebhookResponse> response = webhookService.processWebhook(rawJson, headers, "1.2.3.4");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("FAILED", txn.getStatus());
        verify(payoutService, never()).executeRefund(any(), any(), any());
    }

    @Test
    @DisplayName("Scenario 11: Conflicting FAILED Callback on SUCCESS Transaction Quarantined Without Refund")
    void conflictingFailedCallback_onSuccess_quarantined() {
        String orderId = "PO_CONFLICT_TEST";
        PayoutTransaction txn = createPendingTransaction(orderId, BigDecimal.TEN);
        txn.setStatus("SUCCESS");
        when(payoutTransactionRepository.findWithLockByOrderId(orderId)).thenReturn(Optional.of(txn));

        String rawJson = """
        {
            "external_order_id": "%s",
            "status": "FAILED",
            "amount": "10.00"
        }
        """.formatted(orderId);

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Webhook-Secret", WEBHOOK_SECRET);

        ResponseEntity<BusstoWebhookResponse> response = webhookService.processWebhook(rawJson, headers, "1.2.3.4");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("SUCCESS", txn.getStatus()); // Preserved
        verify(payoutService, never()).executeRefund(any(), any(), any());
        verify(payoutAuditService).recordStatusChange(eq(txn), eq("SUCCESS"), eq("SUCCESS"), any(), any(), any(), eq("WEBHOOK:BUSSTO"), contains("SECURITY CONFLICT"));
    }

    @Test
    @DisplayName("Scenario 12: Empty Callback Body Rejected")
    void emptyBody_rejected() {
        ResponseEntity<BusstoWebhookResponse> response = webhookService.processWebhook("", new HttpHeaders(), "1.2.3.4");
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    @Test
    @DisplayName("Scenario 13: Malformed JSON Rejected")
    void malformedJson_rejected() {
        ResponseEntity<BusstoWebhookResponse> response = webhookService.processWebhook("{bad json...}", new HttpHeaders(), "1.2.3.4");
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    @Test
    @DisplayName("Scenario 14: Missing Identifiers Rejected")
    void missingIdentifiers_rejected() {
        String rawJson = "{\"amount\": 10.00, \"status\": \"SUCCESS\"}";
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Webhook-Secret", WEBHOOK_SECRET);

        ResponseEntity<BusstoWebhookResponse> response = webhookService.processWebhook(rawJson, headers, "1.2.3.4");
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    @Test
    @DisplayName("Scenario 15: Nested TransactionData Structure Parsed Successfully")
    void nestedTransactionData_parsedSuccessfully() {
        String orderId = "PO_NESTED_DATA";
        PayoutTransaction txn = createPendingTransaction(orderId, new BigDecimal("10.00"));
        when(payoutTransactionRepository.findWithLockByOrderId(orderId)).thenReturn(Optional.of(txn));

        String rawJson = """
        {
            "statusCode": 0,
            "status": "SUCCESS",
            "TransactionData": {
                "external_order_id": "%s",
                "bbTransactionId": "BB_NESTED_999",
                "bbTransactionStatus": "SUCCESS",
                "bbUtrNumber": "UTR_NESTED_888",
                "amount": "10.00"
            }
        }
        """.formatted(orderId);

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Webhook-Secret", WEBHOOK_SECRET);

        ResponseEntity<BusstoWebhookResponse> response = webhookService.processWebhook(rawJson, headers, "1.2.3.4");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("SUCCESS", txn.getStatus());
        assertEquals("BB_NESTED_999", txn.getProviderTxnId());
        assertEquals("UTR_NESTED_888", txn.getUtr());
    }

    @Test
    @DisplayName("Scenario 16: Wrong Currency Rejected")
    void wrongCurrency_rejected() {
        String orderId = "PO_CURRENCY_TEST";
        PayoutTransaction txn = createPendingTransaction(orderId, new BigDecimal("10.00"));
        when(payoutTransactionRepository.findWithLockByOrderId(orderId)).thenReturn(Optional.of(txn));

        String rawJson = """
        {
            "external_order_id": "%s",
            "amount": "10.00",
            "currency": "USD",
            "status": "SUCCESS"
        }
        """.formatted(orderId);

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Webhook-Secret", WEBHOOK_SECRET);

        ResponseEntity<BusstoWebhookResponse> response = webhookService.processWebhook(rawJson, headers, "1.2.3.4");

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals("PENDING", txn.getStatus());
    }

    @Test
    @DisplayName("Scenario 17: Matching by providerTxnId When orderId is Absent")
    void matchByProviderTxnId_success() {
        String providerTxnId = "BB_PROVIDER_TXN_456";
        PayoutTransaction txn = createPendingTransaction("PO_MATCH_BY_BB_TXN", new BigDecimal("10.00"));
        txn.setProviderTxnId(providerTxnId);
        when(payoutTransactionRepository.findWithLockByProviderTxnId(providerTxnId)).thenReturn(Optional.of(txn));

        String rawJson = """
        {
            "bbTransactionId": "%s",
            "status": "SUCCESS",
            "amount": "10.00",
            "utr": "UTR_PROV_999"
        }
        """.formatted(providerTxnId);

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Webhook-Secret", WEBHOOK_SECRET);

        ResponseEntity<BusstoWebhookResponse> response = webhookService.processWebhook(rawJson, headers, "1.2.3.4");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("SUCCESS", txn.getStatus());
        assertEquals("UTR_PROV_999", txn.getUtr());
    }

    @Test
    @DisplayName("Scenario 18: Unsupported Status Produces Safe Handling Without Status Change")
    void unsupportedStatus_safeNoStatusChange() {
        String orderId = "PO_UNSUPPORTED_STATUS";
        PayoutTransaction txn = createPendingTransaction(orderId, new BigDecimal("10.00"));
        when(payoutTransactionRepository.findWithLockByOrderId(orderId)).thenReturn(Optional.of(txn));

        String rawJson = """
        {
            "external_order_id": "%s",
            "status": "UNKNOWN_CUSTOM_STATUS_XYZ",
            "amount": "10.00"
        }
        """.formatted(orderId);

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Webhook-Secret", WEBHOOK_SECRET);

        ResponseEntity<BusstoWebhookResponse> response = webhookService.processWebhook(rawJson, headers, "1.2.3.4");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("PENDING", txn.getStatus()); // Remains safe PENDING!
        verify(payoutService, never()).executeRefund(any(), any(), any());
    }
}
