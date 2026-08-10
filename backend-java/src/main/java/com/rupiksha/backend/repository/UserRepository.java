package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.User;
import com.rupiksha.backend.domain.KycStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.rupiksha.backend.domain.RoleName;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByUsername(String username);

    @Query(value = "SELECT * FROM users u WHERE u.email = :email ORDER BY u.created_at ASC LIMIT 1", nativeQuery = true)
    Optional<User> findByEmail(@Param("email") String email);

    @Query(value = "SELECT * FROM users u WHERE u.mobile = :mobile ORDER BY u.created_at ASC LIMIT 1", nativeQuery = true)
    Optional<User> findByMobile(@Param("mobile") String mobile);

    Optional<User> findByPartyCode(String partyCode);
    boolean existsByPartyCode(String partyCode);
    List<User> findByKycStatus(KycStatus kycStatus);

    @Query("SELECT u FROM User u JOIN u.roles r WHERE u.mobile = :mobile AND r.name = :role")
    Optional<User> findByMobileAndRole(@Param("mobile") String mobile, @Param("role") RoleName role);

    @Query("SELECT u FROM User u JOIN u.roles r WHERE u.email = :email AND r.name = :role")
    Optional<User> findByEmailAndRole(@Param("email") String email, @Param("role") RoleName role);

    @Query("SELECT u FROM User u JOIN u.roles r WHERE u.username = :username AND r.name = :role")
    Optional<User> findByUsernameAndRole(@Param("username") String username, @Param("role") RoleName role);
    
    @Query("SELECT u FROM User u WHERE " +
           "LOWER(u.username) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(u.fullName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(u.mobile) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(u.email) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<User> findBySearch(@Param("search") String search, Pageable pageable);
}

