package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.Aeps2faChargeTxn;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface Aeps2faChargeTxnRepository extends JpaRepository<Aeps2faChargeTxn, UUID>, JpaSpecificationExecutor<Aeps2faChargeTxn> {

    boolean existsByOriginal2faReference(String original2faReference);

    Optional<Aeps2faChargeTxn> findByChargeReference(String chargeReference);

    Optional<Aeps2faChargeTxn> findByOriginal2faReference(String original2faReference);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Aeps2faChargeTxn c WHERE c.user.id = :userId AND c.outstandingAmount > 0 ORDER BY c.createdAt ASC")
    List<Aeps2faChargeTxn> findUnsettledByUserIdForUpdate(@Param("userId") UUID userId);

    @Query("SELECT COALESCE(SUM(c.outstandingAmount), 0) FROM Aeps2faChargeTxn c WHERE c.user.id = :userId AND c.outstandingAmount > 0")
    BigDecimal sumOutstandingAmountByUserId(@Param("userId") UUID userId);

    Page<Aeps2faChargeTxn> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);
}

