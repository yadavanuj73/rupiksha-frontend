package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.FundRequest;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface FundRequestRepository extends JpaRepository<FundRequest, UUID> {
    List<FundRequest> findByStatus(String status);
    List<FundRequest> findByStatusOrderByCreatedAtDesc(String status);
    List<FundRequest> findByUserId(UUID userId);
    List<FundRequest> findByUserIdOrderByCreatedAtDesc(UUID userId);
    List<FundRequest> findAllByOrderByCreatedAtDesc();
    boolean existsByUtrNumberIgnoreCaseAndStatusIn(String utrNumber, List<String> statuses);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select fr from FundRequest fr where fr.id = :id")
    Optional<FundRequest> findByIdForUpdate(UUID id);
}
