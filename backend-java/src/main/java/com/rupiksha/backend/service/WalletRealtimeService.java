package com.rupiksha.backend.service;

import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.Instant;
import java.util.UUID;

public interface WalletRealtimeService {

    SseEmitter createConnection(UUID userId);

    void sendBalanceChangedEvent(UUID userId, String reference, String context, Instant timestamp);

    int getActiveConnectionCount(UUID userId);
}
