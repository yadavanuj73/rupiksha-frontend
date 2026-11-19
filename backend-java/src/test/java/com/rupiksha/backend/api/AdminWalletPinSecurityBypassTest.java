package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.WalletDtos;
import com.rupiksha.backend.domain.Role;
import com.rupiksha.backend.domain.RoleName;
import com.rupiksha.backend.domain.User;
import com.rupiksha.backend.domain.WalletStatus;
import com.rupiksha.backend.exception.AdminWalletPinLockedException;
import com.rupiksha.backend.exception.AdminWalletPinSecretUnavailableException;
import com.rupiksha.backend.exception.AdminWalletPinValidationException;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.AdminWalletActionPinService;
import com.rupiksha.backend.service.WalletService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AdminWalletPinSecurityBypassTest {

    @Mock
    private WalletService walletService;

    @Mock
    private Authentication auth;

    @Mock
    private HttpServletRequest servletRequest;

    @InjectMocks
    private WalletController walletController;

    private UUID adminId;
    private JwtPrincipal adminPrincipal;

    @BeforeEach
    void setUp() {
        adminId = UUID.randomUUID();
        adminPrincipal = new JwtPrincipal(
                adminId.toString(),
                "admin",
                java.util.List.of("ROLE_ADMIN")
        );

        lenient().when(auth.getPrincipal()).thenReturn(adminPrincipal);
        lenient().when(servletRequest.getRemoteAddr()).thenReturn("127.0.0.1");
    }

    @Test
    @DisplayName("Scenario 1 & 7: Call /wallet/credit without PIN in header or body")
    void testCreditWithoutPinFails() {
        WalletDtos.WalletEntryRequest request = new WalletDtos.WalletEntryRequest(
                UUID.randomUUID().toString(), BigDecimal.valueOf(100.00), "Credit test"
        );
        when(servletRequest.getHeader("X-Admin-PIN")).thenReturn(null);
        when(servletRequest.getHeader("X-Admin-Wallet-Pin")).thenReturn(null);

        when(walletService.credit(any(), any(), any(), any(), isNull()))
                .thenThrow(new AdminWalletPinValidationException("Admin wallet transaction PIN is required."));

        assertThrows(AdminWalletPinValidationException.class, () ->
                walletController.credit(request, auth, servletRequest));
    }

    @Test
    @DisplayName("Scenario 2: Call /wallet/debit with incorrect PIN")
    void testDebitWithIncorrectPinFails() {
        WalletDtos.WalletEntryRequest request = new WalletDtos.WalletEntryRequest(
                UUID.randomUUID().toString(), BigDecimal.valueOf(50.00), "Debit test"
        );
        when(servletRequest.getHeader("X-Admin-PIN")).thenReturn("000000");

        when(walletService.debit(any(), any(), any(), any(), eq("000000")))
                .thenThrow(new AdminWalletPinValidationException("Invalid PIN. Operation rejected."));

        assertThrows(AdminWalletPinValidationException.class, () ->
                walletController.debit(request, auth, servletRequest));
    }

    @Test
    @DisplayName("Scenario 4 & 5: Call /wallet/lock with invalid length PIN")
    void testLockWithInvalidLengthPinFails() {
        WalletDtos.WalletEntryRequest request = new WalletDtos.WalletEntryRequest(
                UUID.randomUUID().toString(), BigDecimal.valueOf(20.00), "Lock test"
        );
        when(servletRequest.getHeader("X-Admin-PIN")).thenReturn("123");

        when(walletService.lock(any(), any(), any(), any(), eq("123")))
                .thenThrow(new AdminWalletPinValidationException("Invalid PIN format. PIN must be exactly 6 numeric digits."));

        assertThrows(AdminWalletPinValidationException.class, () ->
                walletController.lock(request, auth, servletRequest));
    }

    @Test
    @DisplayName("Scenario 6: Call /wallet/release with alphanumeric PIN")
    void testReleaseWithAlphanumericPinFails() {
        WalletDtos.WalletEntryRequest request = new WalletDtos.WalletEntryRequest(
                UUID.randomUUID().toString(), BigDecimal.valueOf(20.00), "Release test"
        );
        when(servletRequest.getHeader("X-Admin-PIN")).thenReturn("12A456");

        when(walletService.release(any(), any(), any(), any(), eq("12A456")))
                .thenThrow(new AdminWalletPinValidationException("Invalid PIN format. PIN must be exactly 6 numeric digits."));

        assertThrows(AdminWalletPinValidationException.class, () ->
                walletController.release(request, auth, servletRequest));
    }

    @Test
    @DisplayName("Scenario 10: Call /wallet/status (Freeze) when locked out returns 429 exception")
    void testFreezeWhenLockedOutFails() {
        WalletDtos.WalletStatusUpdateRequest request = new WalletDtos.WalletStatusUpdateRequest(
                UUID.randomUUID().toString(), "FROZEN", "Suspicious activity", "852963"
        );

        when(walletService.updateWalletStatus(any(), any(), any(), eq("852963")))
                .thenThrow(new AdminWalletPinLockedException("Account temporarily locked due to multiple failed PIN attempts. Please try again later."));

        assertThrows(AdminWalletPinLockedException.class, () ->
                walletController.status(request, auth, servletRequest));
    }

    @Test
    @DisplayName("Scenario 13: Call /admin/wallet/approve-request when Secret Manager secret is missing")
    void testApproveRequestWhenSecretMissingFailsClosed() {
        WalletDtos.FundRequestProcessRequest request = new WalletDtos.FundRequestProcessRequest(
                UUID.randomUUID().toString(), "Approve with valid pin", "852963"
        );

        when(walletService.approveFundRequest(any(), any(), any(), any(), eq("852963")))
                .thenThrow(new AdminWalletPinSecretUnavailableException("Admin wallet transaction PIN service is currently unavailable."));

        assertThrows(AdminWalletPinSecretUnavailableException.class, () ->
                walletController.approveFundRequest(request, auth, servletRequest));
    }

    @Test
    @DisplayName("Scenario 14: Call /admin/wallet/reject-request with valid PIN succeeds")
    void testRejectRequestWithValidPinSucceeds() {
        UUID reqId = UUID.randomUUID();
        WalletDtos.FundRequestProcessRequest request = new WalletDtos.FundRequestProcessRequest(
                reqId.toString(), "Payment not received", "852963"
        );

        WalletDtos.FundRequestResponse mockResponse = new WalletDtos.FundRequestResponse(
                reqId.toString(), UUID.randomUUID().toString(), "retailer1", "Retailer One",
                BigDecimal.valueOf(500.00), "REJECTED", "UTR123", "UPI", "remark",
                "Rejected by admin", "admin", null, null
        );

        when(walletService.rejectFundRequest(eq(reqId), eq("Payment not received"), any(), any(), eq("852963")))
                .thenReturn(mockResponse);

        ResponseEntity<Map<String, Object>> res = walletController.rejectFundRequest(request, auth, servletRequest);
        assertNotNull(res);
        assertEquals(200, res.getStatusCode().value());
        assertTrue((Boolean) res.getBody().get("success"));
    }

    @Test
    @DisplayName("Scenario 17: Non-admin caller receives AccessDeniedException")
    void testNonAdminCallerDenied() {
        JwtPrincipal retailerPrincipal = new JwtPrincipal(
                UUID.randomUUID().toString(),
                "retailer1",
                java.util.List.of("ROLE_RETAILER")
        );
        when(auth.getPrincipal()).thenReturn(retailerPrincipal);

        WalletDtos.WalletEntryRequest request = new WalletDtos.WalletEntryRequest(
                UUID.randomUUID().toString(), BigDecimal.valueOf(100.00), "Credit test"
        );

        when(walletService.credit(any(), any(), any(), any(), any()))
                .thenThrow(new AccessDeniedException("Access denied: only administrators can perform manual wallet mutations"));

        assertThrows(AccessDeniedException.class, () ->
                walletController.credit(request, auth, servletRequest));
    }
}
