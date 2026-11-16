package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.UserMapping;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserMappingRepository extends JpaRepository<UserMapping, UUID> {

    Optional<UserMapping> findTopByUserIdAndStatusOrderByCreatedAtDesc(UUID userId, String status);

    List<UserMapping> findAllByUserIdAndStatus(UUID userId, String status);

    @Query("SELECT um FROM UserMapping um WHERE " +
           "(:userId IS NULL OR um.user.id = :userId) AND (" +
           ":search IS NULL OR :search = '' OR " +
           "LOWER(um.user.fullName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(um.user.mobile) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "(um.user.partyCode IS NOT NULL AND LOWER(um.user.partyCode) LIKE LOWER(CONCAT('%', :search, '%'))) OR " +
           "(um.newParentName IS NOT NULL AND LOWER(um.newParentName) LIKE LOWER(CONCAT('%', :search, '%'))) OR " +
           "(um.newParentPartyCode IS NOT NULL AND LOWER(um.newParentPartyCode) LIKE LOWER(CONCAT('%', :search, '%'))) OR " +
           "(um.mappedByAdminUsername IS NOT NULL AND LOWER(um.mappedByAdminUsername) LIKE LOWER(CONCAT('%', :search, '%')))) " +
           "ORDER BY um.createdAt DESC")
    Page<UserMapping> findHistoryWithFilters(@Param("userId") UUID userId,
                                            @Param("search") String search,
                                            Pageable pageable);

    @Query("SELECT um FROM UserMapping um WHERE um.status = 'ACTIVE' AND (" +
           ":roleFilter IS NULL OR :roleFilter = 'ALL' OR UPPER(um.newParentRole) = UPPER(:roleFilter)) AND (" +
           ":search IS NULL OR :search = '' OR " +
           "LOWER(um.user.fullName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(um.user.mobile) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "(um.user.partyCode IS NOT NULL AND LOWER(um.user.partyCode) LIKE LOWER(CONCAT('%', :search, '%'))) OR " +
           "(um.newParentName IS NOT NULL AND LOWER(um.newParentName) LIKE LOWER(CONCAT('%', :search, '%'))) OR " +
           "(um.newParentPartyCode IS NOT NULL AND LOWER(um.newParentPartyCode) LIKE LOWER(CONCAT('%', :search, '%')))) " +
           "ORDER BY um.createdAt DESC")
    Page<UserMapping> findActiveMappingsWithFilters(@Param("roleFilter") String roleFilter,
                                                   @Param("search") String search,
                                                   Pageable pageable);
}
