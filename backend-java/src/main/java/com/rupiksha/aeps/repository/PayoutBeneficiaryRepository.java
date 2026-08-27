package com.rupiksha.aeps.repository;

import com.rupiksha.aeps.entity.PayoutBeneficiary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PayoutBeneficiaryRepository extends JpaRepository<PayoutBeneficiary, Long> {

    List<PayoutBeneficiary> findByUserIdOrderByCreatedAtDesc(String userId);

    List<PayoutBeneficiary> findByUserIdAndStatusOrderByCreatedAtDesc(String userId, String status);

    Optional<PayoutBeneficiary> findByIdAndUserId(Long id, String userId);

    Optional<PayoutBeneficiary> findFirstByUserIdAndAccountNumberAndIfsc(String userId, String accountNumber, String ifsc);

    boolean existsByUserIdAndAccountNumberAndIfsc(String userId, String accountNumber, String ifsc);

    void deleteByIdAndUserId(Long id, String userId);

    List<PayoutBeneficiary> findAllByOrderByCreatedAtDesc();

    List<PayoutBeneficiary> findByStatusOrderByCreatedAtDesc(String status);

    long countByStatus(String status);
}
