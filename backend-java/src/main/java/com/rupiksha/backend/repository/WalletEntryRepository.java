package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.WalletEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface WalletEntryRepository extends JpaRepository<WalletEntry, UUID> {
}

