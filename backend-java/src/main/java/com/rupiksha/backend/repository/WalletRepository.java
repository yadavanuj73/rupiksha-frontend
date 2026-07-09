package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.Wallet;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WalletRepository extends JpaRepository<Wallet, UUID> {
    Optional<Wallet> findByUserId(UUID userId);

    /**
     * Batch-load wallets for multiple user IDs in a single query.
     * Used by Members listing to avoid N+1 wallet queries.
     */
    @Query("select w from Wallet w where w.user.id in :userIds")
    List<Wallet> findByUserIdIn(@Param("userIds") Collection<UUID> userIds);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select w from Wallet w where w.user.id = :userId")
    Optional<Wallet> findByUserIdWithLock(UUID userId);
}

