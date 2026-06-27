package com.rupiksha.aeps.repository;

import com.rupiksha.aeps.entity.AepsKycHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AepsKycHistoryRepository extends JpaRepository<AepsKycHistory, Long> {
    List<AepsKycHistory> findByUserId(UUID userId);
}
