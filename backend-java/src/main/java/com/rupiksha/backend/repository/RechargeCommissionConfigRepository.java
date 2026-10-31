package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.RechargeCommissionConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RechargeCommissionConfigRepository extends JpaRepository<RechargeCommissionConfig, UUID> {

    @Query("SELECT c FROM RechargeCommissionConfig c JOIN FETCH c.plan p WHERE c.serviceType = :serviceType AND c.operatorCode = :operatorCode ORDER BY p.price ASC")
    List<RechargeCommissionConfig> findByServiceTypeAndOperatorCodeWithPlan(
            @Param("serviceType") String serviceType,
            @Param("operatorCode") String operatorCode
    );

    List<RechargeCommissionConfig> findByServiceTypeAndOperatorCode(String serviceType, String operatorCode);

    List<RechargeCommissionConfig> findByServiceType(String serviceType);

    Optional<RechargeCommissionConfig> findByServiceTypeAndOperatorCodeAndPlan_PlanCode(
            String serviceType,
            String operatorCode,
            String planCode
    );

    Optional<RechargeCommissionConfig> findByServiceTypeAndOperatorCodeAndPlan_Id(
            String serviceType,
            String operatorCode,
            UUID planId
    );

    boolean existsByServiceTypeAndOperatorCode(String serviceType, String operatorCode);

    @Query("SELECT DISTINCT c.operatorCode FROM RechargeCommissionConfig c WHERE c.serviceType = :serviceType")
    List<String> findDistinctOperatorCodesByServiceType(@Param("serviceType") String serviceType);
}

