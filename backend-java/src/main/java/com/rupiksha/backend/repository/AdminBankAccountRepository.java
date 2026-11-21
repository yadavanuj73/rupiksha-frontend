package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.AdminBankAccount;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AdminBankAccountRepository extends JpaRepository<AdminBankAccount, UUID> {
    List<AdminBankAccount> findByIsActiveTrueOrderByCreatedAtDesc();
    List<AdminBankAccount> findAllByOrderByCreatedAtDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from AdminBankAccount b where b.id = :id")
    Optional<AdminBankAccount> findByIdForUpdate(UUID id);
}
