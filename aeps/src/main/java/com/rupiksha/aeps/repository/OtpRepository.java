package com.rupiksha.aeps.repository;

import com.rupiksha.aeps.entity.OtpLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OtpRepository extends JpaRepository<OtpLog, Long> {

    Optional<OtpLog> findTopByMobileOrderByIdDesc(String mobile);

}