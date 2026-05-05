package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.ServiceType;
import com.rupiksha.backend.domain.UserService;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserServiceRepository extends JpaRepository<UserService, UUID> {
    List<UserService> findByUserId(UUID userId);
    Optional<UserService> findByUserIdAndServiceType(UUID userId, ServiceType serviceType);
    boolean existsByUserIdAndServiceType(UUID userId, ServiceType serviceType);
}
