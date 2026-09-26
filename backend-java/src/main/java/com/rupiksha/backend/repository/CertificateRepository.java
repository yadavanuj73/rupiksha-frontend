package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.Certificate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface CertificateRepository extends JpaRepository<Certificate, UUID> {
    Optional<Certificate> findByUserId(UUID userId);
    Optional<Certificate> findByPartyCode(String partyCode);
    Optional<Certificate> findByCertificateNumber(String certificateNumber);
}
