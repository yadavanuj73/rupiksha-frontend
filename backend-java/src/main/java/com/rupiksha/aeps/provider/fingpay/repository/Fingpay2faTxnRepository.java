package com.rupiksha.aeps.provider.fingpay.repository;

import com.rupiksha.aeps.provider.fingpay.entity.Fingpay2faTxn;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface Fingpay2faTxnRepository extends JpaRepository<Fingpay2faTxn, Long> {
    Optional<Fingpay2faTxn> findByMerchantTranId(String merchantTranId);
    Optional<Fingpay2faTxn> findTopByUserIdAndServiceTypeAndResponseCodeOrderByCreatedAtDesc(UUID userId, String serviceType, String responseCode);
    Optional<Fingpay2faTxn> findTopByMobileNumberAndServiceTypeAndResponseCodeOrderByCreatedAtDesc(String mobileNumber, String serviceType, String responseCode);
}
