package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.RetailerServiceDtos;
import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.domain.Ticket;
import com.rupiksha.backend.repository.TicketRepository;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.security.JwtPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/tickets")
@RequiredArgsConstructor
public class TicketController {
    private final TicketRepository ticketRepository;
    private final UserRepository userRepository;
    private final AppProperties appProperties;

    @PostMapping
    public Map<String, Object> create(
            @AuthenticationPrincipal JwtPrincipal principal,
            @Valid @RequestBody RetailerServiceDtos.TicketCreateRequest request
    ) {
        validateUser(principal, request.userId());
        if (!appProperties.services().ticketsEnabled()) {
            return Map.of("success", false, "message", "Ticket service disabled by configuration");
        }
        Ticket ticket = new Ticket();
        ticket.setUser(userRepository.findById(UUID.fromString(request.userId()))
                .orElseThrow(() -> new IllegalArgumentException("User not found")));
        ticket.setSubject(request.subject());
        ticket.setDescription(request.description());
        ticket.setPriority(request.priority() == null || request.priority().isBlank() ? "MEDIUM" : request.priority().toUpperCase());
        ticket.setStatus("OPEN");
        ticketRepository.save(ticket);
        return Map.of("success", true, "ticketId", ticket.getId().toString(), "status", ticket.getStatus());
    }

    @GetMapping("/mine")
    public RetailerServiceDtos.TicketListResponse mine(
            @AuthenticationPrincipal JwtPrincipal principal,
            @RequestParam String userId
    ) {
        validateUser(principal, userId);
        if (!appProperties.services().ticketsEnabled()) {
            return new RetailerServiceDtos.TicketListResponse(false, List.of());
        }
        List<RetailerServiceDtos.TicketResponse> tickets = ticketRepository.findByUserIdOrderByCreatedAtDesc(UUID.fromString(userId))
                .stream()
                .map(t -> new RetailerServiceDtos.TicketResponse(
                        t.getId().toString(),
                        t.getUser().getId().toString(),
                        t.getSubject(),
                        t.getDescription(),
                        t.getStatus(),
                        t.getPriority(),
                        t.getCreatedAt()
                )).toList();
        return new RetailerServiceDtos.TicketListResponse(true, tickets);
    }

    private void validateUser(JwtPrincipal principal, String userId) {
        if (principal == null || !principal.userId().toString().equals(userId)) {
            throw new IllegalArgumentException("Invalid user context");
        }
    }
}
