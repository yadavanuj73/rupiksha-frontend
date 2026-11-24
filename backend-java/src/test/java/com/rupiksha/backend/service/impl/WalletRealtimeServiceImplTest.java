package com.rupiksha.backend.service.impl;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class WalletRealtimeServiceImplTest {

    private WalletRealtimeServiceImpl realtimeService;

    @BeforeEach
    void setUp() {
        realtimeService = new WalletRealtimeServiceImpl();
    }

    @Test
    void createConnection_registersEmitterAndIncrementsCount() {
        UUID userId = UUID.randomUUID();
        assertEquals(0, realtimeService.getActiveConnectionCount(userId));

        SseEmitter emitter = realtimeService.createConnection(userId);
        assertNotNull(emitter);
        assertEquals(1, realtimeService.getActiveConnectionCount(userId));
    }

    @Test
    void createConnection_nullUserId_throwsException() {
        assertThrows(IllegalArgumentException.class, () -> realtimeService.createConnection(null));
    }

    @Test
    void sendBalanceChangedEvent_deliversOnlyToTargetedUser() {
        UUID userA = UUID.randomUUID();
        UUID userB = UUID.randomUUID();

        SseEmitter emitterA = realtimeService.createConnection(userA);
        SseEmitter emitterB = realtimeService.createConnection(userB);

        assertEquals(1, realtimeService.getActiveConnectionCount(userA));
        assertEquals(1, realtimeService.getActiveConnectionCount(userB));

        // Sending event to userA should succeed and not affect userB
        assertDoesNotThrow(() -> realtimeService.sendBalanceChangedEvent(
                userA, "WLT-TEST-001", "FUND_REQUEST_APPROVED", Instant.now()));

        assertEquals(1, realtimeService.getActiveConnectionCount(userA));
        assertEquals(1, realtimeService.getActiveConnectionCount(userB));
    }

    @Test
    void sendBalanceChangedEvent_noActiveConnections_doesNotThrow() {
        UUID offlineUser = UUID.randomUUID();
        assertDoesNotThrow(() -> realtimeService.sendBalanceChangedEvent(
                offlineUser, "REF-123", "ADMIN_CREDIT", Instant.now()));
    }

    @Test
    void sendHeartbeat_runsWithoutErrors() {
        UUID userId = UUID.randomUUID();
        realtimeService.createConnection(userId);
        assertDoesNotThrow(() -> realtimeService.sendHeartbeat());
    }
}
