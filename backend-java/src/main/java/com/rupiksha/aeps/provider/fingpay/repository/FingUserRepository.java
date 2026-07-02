package com.rupiksha.aeps.provider.fingpay.repository;

import com.rupiksha.aeps.provider.fingpay.entity.FingUser;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FingUserRepository extends JpaRepository<FingUser, Long> {
}