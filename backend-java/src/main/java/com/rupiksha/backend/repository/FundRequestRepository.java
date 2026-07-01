package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.FundRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface FundRequestRepository extends JpaRepository<FundRequest, UUID> {
    List<FundRequest> findByStatus(String status);
    List<FundRequest> findByUserId(UUID userId);
}
