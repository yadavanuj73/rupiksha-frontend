package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.service.WalletRealtimeService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class WalletRealtimeServiceImpl implements WalletRealtimeService {

    // 2 minutes emitter timeout before clean auto-reconnect
    private static final long EMITTER_TIMEOUT_MS = 120_000L;

    private final ConcurrentHashMap<UUID, Set<SseEmitter>> connections = new ConcurrentHashMap<>();

    @Override
    public SseEmitter createConnection(UUID userId) {
        if (userId == null) {
            throw new IllegalArgumentException("User ID cannot be null for wallet SSE connection");
        }

        SseEmitter emitter = new SseEmitter(EMITTER_TIMEOUT_MS);
        Set<SseEmitter> userEmitters = connections.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet());
        userEmitters.add(emitter);

        log.debug("Registered new SSE emitter for user {}. Active for user: {}", userId, userEmitters.size());

        emitter.onCompletion(() -> removeEmitter(userId, emitter, "completed"));
        emitter.onTimeout(() -> removeEmitter(userId, emitter, "timed out"));
        emitter.onError(ex -> removeEmitter(userId, emitter, "error: " + (ex != null ? ex.getMessage() : "unknown")));

        // Send initial handshake event
        try {
            Map<String, Object> handshake = new HashMap<>();
            handshake.put("type", "CONNECTED");
            handshake.put("userId", userId.toString());
            handshake.put("timestamp", Instant.now().toEpochMilli());

            emitter.send(SseEmitter.event()
                    .name("CONNECTED")
                    .data(handshake, MediaType.APPLICATION_JSON));
        } catch (Exception e) {
            log.warn("Failed to send initial SSE handshake to user {}: {}", userId, e.getMessage());
            removeEmitter(userId, emitter, "handshake failed");
        }

        return emitter;
    }

    @Override
    public void sendBalanceChangedEvent(UUID userId, String reference, String context, Instant timestamp) {
        if (userId == null) {
            return;
        }

        Set<SseEmitter> userEmitters = connections.get(userId);
        if (userEmitters == null || userEmitters.isEmpty()) {
            log.debug("No active real-time SSE sessions for user {}", userId);
            return;
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "WALLET_BALANCE_CHANGED");
        payload.put("userId", userId.toString());
        payload.put("reference", reference != null ? reference : "");
        payload.put("context", context != null ? context : "WALLET_MUTATION");
        payload.put("timestamp", timestamp != null ? timestamp.toEpochMilli() : Instant.now().toEpochMilli());
        payload.put("version", 1);

        List<SseEmitter> deadEmitters = new ArrayList<>();
        for (SseEmitter emitter : userEmitters) {
            try {
                emitter.send(SseEmitter.event()
                        .name("WALLET_BALANCE_CHANGED")
                        .data(payload, MediaType.APPLICATION_JSON));
            } catch (Exception ex) {
                log.debug("Failed sending WALLET_BALANCE_CHANGED to emitter for user {}: {}", userId, ex.getMessage());
                deadEmitters.add(emitter);
            }
        }

        for (SseEmitter dead : deadEmitters) {
            removeEmitter(userId, dead, "send failed");
        }
    }

    @Override
    public int getActiveConnectionCount(UUID userId) {
        if (userId == null) return 0;
        Set<SseEmitter> set = connections.get(userId);
        return set != null ? set.size() : 0;
    }

    @Scheduled(fixedRate = 20000)
    public void sendHeartbeat() {
        if (connections.isEmpty()) {
            return;
        }

        for (Map.Entry<UUID, Set<SseEmitter>> entry : connections.entrySet()) {
            UUID userId = entry.getKey();
            Set<SseEmitter> userEmitters = entry.getValue();
            List<SseEmitter> deadEmitters = new ArrayList<>();

            for (SseEmitter emitter : userEmitters) {
                try {
                    emitter.send(SseEmitter.event().comment("ping"));
                } catch (Exception ex) {
                    deadEmitters.add(emitter);
                }
            }

            for (SseEmitter dead : deadEmitters) {
                removeEmitter(userId, dead, "heartbeat failed");
            }
        }
    }

    private void removeEmitter(UUID userId, SseEmitter emitter, String reason) {
        Set<SseEmitter> set = connections.get(userId);
        if (set != null) {
            set.remove(emitter);
            if (set.isEmpty()) {
                connections.remove(userId);
            }
            log.debug("Removed SSE emitter for user {} (reason: {}). Remaining: {}",
                    userId, reason, set.size());
        }
    }
}
