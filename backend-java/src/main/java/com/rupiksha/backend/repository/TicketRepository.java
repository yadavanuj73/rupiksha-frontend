package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.Ticket;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TicketRepository extends JpaRepository<Ticket, UUID> {
    List<Ticket> findByUserIdOrderByCreatedAtDesc(UUID userId);
}
