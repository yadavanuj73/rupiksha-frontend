package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.WalletDtos;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.WalletRealtimeService;
import com.rupiksha.backend.service.WalletService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WalletControllerRealtimeTest {

    @Mock
    private WalletService walletService;

    @Mock
    private WalletRealtimeService walletRealtimeService;

    private WalletController walletController;

    private UUID userId;
    private UsernamePasswordAuthenticationToken auth;

    @BeforeEach
    void setUp() {
        walletController = new WalletController(walletService, walletRealtimeService);
        userId = UUID.randomUUID();
        JwtPrincipal principal = new JwtPrincipal(userId.toString(), "testuser", List.of("RETAILER"));
        auth = new UsernamePasswordAuthenticationToken(
                principal,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_RETAILER"))
        );
    }

    @Test
    void streamWalletEvents_setsHeadersAndReturnsEmitter() {
        MockHttpServletResponse response = new MockHttpServletResponse();
        SseEmitter expectedEmitter = new SseEmitter();
        when(walletRealtimeService.createConnection(eq(userId))).thenReturn(expectedEmitter);

        SseEmitter actual = walletController.streamWalletEvents(auth, response);

        assertNotNull(actual);
        assertSame(expectedEmitter, actual);
        assertEquals("no-cache, no-transform", response.getHeader("Cache-Control"));
        assertEquals("no", response.getHeader("X-Accel-Buffering"));
        verify(walletRealtimeService).createConnection(eq(userId));
    }

    @Test
    void myBalance_returnsBalanceForAuthenticatedUser() {
        WalletDtos.WalletBalanceResponse expected = new WalletDtos.WalletBalanceResponse(
                userId.toString(), "Test User", "testuser", "9876543210", "RETAILER",
                new BigDecimal("500.00"), BigDecimal.ZERO, new BigDecimal("500.00"),
                BigDecimal.ZERO, "ACTIVE"
        );
        when(walletService.getBalance(eq(userId.toString()))).thenReturn(expected);

        WalletDtos.WalletBalanceResponse actual = walletController.myBalance(auth);

        assertNotNull(actual);
        assertEquals(new BigDecimal("500.00"), actual.balance());
        verify(walletService).getBalance(eq(userId.toString()));
    }
}
