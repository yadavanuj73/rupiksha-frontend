package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.UserMappingDtos.*;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.UserMappingRepository;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.security.JwtPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.*;

import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserMappingServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private UserMappingRepository userMappingRepository;

    private UserMappingServiceImpl userMappingService;

    private User adminUser;
    private User retailerUser;
    private User distributorUser;
    private User superDistributorUser;
    private JwtPrincipal adminPrincipal;

    @BeforeEach
    void setUp() {
        userMappingService = new UserMappingServiceImpl(userRepository, userMappingRepository);

        Role adminRole = new Role();
        adminRole.setName(RoleName.ADMIN);

        Role retailerRole = new Role();
        retailerRole.setName(RoleName.RETAILER);

        Role distRole = new Role();
        distRole.setName(RoleName.DISTRIBUTOR);

        Role sdRole = new Role();
        sdRole.setName(RoleName.SUPER_DISTRIBUTOR);

        adminUser = new User();
        adminUser.setId(UUID.randomUUID());
        adminUser.setUsername("admin");
        adminUser.setFullName("System Admin");
        adminUser.setMobile("9999999999");
        adminUser.setPartyCode("RPADM00001");
        adminUser.setStatus(UserStatus.ACTIVE);
        adminUser.setRoles(Set.of(adminRole));

        retailerUser = new User();
        retailerUser.setId(UUID.randomUUID());
        retailerUser.setUsername("9876543210");
        retailerUser.setFullName("Ramesh Retailer");
        retailerUser.setMobile("9876543210");
        retailerUser.setPartyCode("RPRBR10001");
        retailerUser.setShopAddress("Boring Road, Patna");
        retailerUser.setCity("Patna");
        retailerUser.setStateName("Bihar");
        retailerUser.setStatus(UserStatus.ACTIVE);
        retailerUser.setRoles(Set.of(retailerRole));

        distributorUser = new User();
        distributorUser.setId(UUID.randomUUID());
        distributorUser.setUsername("8888888888");
        distributorUser.setFullName("Dinesh Distributor");
        distributorUser.setMobile("8888888888");
        distributorUser.setPartyCode("RPDBR20002");
        distributorUser.setShopAddress("Kankarbagh, Patna");
        distributorUser.setStatus(UserStatus.ACTIVE);
        distributorUser.setRoles(Set.of(distRole));

        superDistributorUser = new User();
        superDistributorUser.setId(UUID.randomUUID());
        superDistributorUser.setUsername("7777777777");
        superDistributorUser.setFullName("Suresh SuperDistributor");
        superDistributorUser.setMobile("7777777777");
        superDistributorUser.setPartyCode("RPSDBR30003");
        superDistributorUser.setStatus(UserStatus.ACTIVE);
        superDistributorUser.setRoles(Set.of(sdRole));

        adminPrincipal = new JwtPrincipal(adminUser.getId().toString(), "admin", List.of("ROLE_ADMIN"));
    }

    @Test
    @DisplayName("Search Retailers - Should sanitize query and return eligible retailers with non-sensitive fields")
    void testSearchRetailers() {
        Pageable pageable = PageRequest.of(0, 10);
        when(userRepository.findByRoleAndSearch(eq(RoleName.RETAILER), eq("9876543210"), eq(pageable)))
                .thenReturn(new PageImpl<>(List.of(retailerUser), pageable, 1));

        Page<UserMappingSearchDto> result = userMappingService.searchRetailers("+91 9876543210", pageable);

        assertThat(result.getContent()).hasSize(1);
        UserMappingSearchDto dto = result.getContent().get(0);
        assertThat(dto.getFullName()).isEqualTo("Ramesh Retailer");
        assertThat(dto.getMobile()).isEqualTo("9876543210");
        assertThat(dto.getPartyCode()).isEqualTo("RPRBR10001");
        assertThat(dto.getRole()).isEqualTo("RETAILER");
    }

    @Test
    @DisplayName("Search Distributors - Should return only active/approved distributors")
    void testSearchDistributors() {
        Pageable pageable = PageRequest.of(0, 10);
        when(userRepository.findEligibleParentsByRoleAndSearch(eq(RoleName.DISTRIBUTOR), eq("RPDBR"), eq(pageable)))
                .thenReturn(new PageImpl<>(List.of(distributorUser), pageable, 1));

        Page<UserMappingSearchDto> result = userMappingService.searchDistributors("RPDBR", pageable);

        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).getPartyCode()).isEqualTo("RPDBR20002");
        assertThat(result.getContent().get(0).getRole()).isEqualTo("DISTRIBUTOR");
    }

    @Test
    @DisplayName("Map User to Admin - Should update parentUser to Admin and record UserMapping audit")
    void testMapUserToAdmin_Success() {
        retailerUser.setParentUser(distributorUser);
        retailerUser.setAddedByRole("DISTRIBUTOR");
        retailerUser.setAddedByName("Dinesh Distributor");

        when(userRepository.findById(retailerUser.getId())).thenReturn(Optional.of(retailerUser));
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(adminUser));
        when(userMappingRepository.findAllByUserIdAndStatus(retailerUser.getId(), "ACTIVE"))
                .thenReturn(Collections.emptyList());
        when(userMappingRepository.save(any(UserMapping.class))).thenAnswer(inv -> {
            UserMapping um = inv.getArgument(0);
            um.setId(UUID.randomUUID());
            um.setCreatedAt(Instant.now());
            return um;
        });

        UserMappingRequest req = UserMappingRequest.builder()
                .retailerId(retailerUser.getId())
                .targetRole("ADMIN")
                .reason("Direct admin mapping requested")
                .build();

        UserMappingResponseDto response = userMappingService.mapUser(req, adminPrincipal);

        assertThat(response).isNotNull();
        assertThat(response.getParentRole()).isEqualTo("ADMIN");
        assertThat(retailerUser.getParentUser()).isEqualTo(adminUser);
        assertThat(retailerUser.getAddedByRole()).isEqualTo("ADMIN");

        verify(userRepository).save(retailerUser);
        verify(userMappingRepository).save(any(UserMapping.class));
    }

    @Test
    @DisplayName("Map User to Distributor - Should update hierarchy and record UserMapping audit with REMAPPING")
    void testMapUserToDistributor_Success() {
        when(userRepository.findById(retailerUser.getId())).thenReturn(Optional.of(retailerUser));
        when(userRepository.findById(distributorUser.getId())).thenReturn(Optional.of(distributorUser));
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(adminUser));

        UserMapping existingActive = UserMapping.builder()
                .id(UUID.randomUUID())
                .user(retailerUser)
                .status("ACTIVE")
                .build();
        when(userMappingRepository.findAllByUserIdAndStatus(retailerUser.getId(), "ACTIVE"))
                .thenReturn(List.of(existingActive));
        when(userMappingRepository.save(any(UserMapping.class))).thenAnswer(inv -> {
            UserMapping um = inv.getArgument(0);
            if (um.getId() == null) um.setId(UUID.randomUUID());
            um.setCreatedAt(Instant.now());
            return um;
        });

        UserMappingRequest req = UserMappingRequest.builder()
                .retailerId(retailerUser.getId())
                .targetRole("DISTRIBUTOR")
                .targetParentId(distributorUser.getId())
                .reason("Assigned to regional distributor")
                .build();

        UserMappingResponseDto response = userMappingService.mapUser(req, adminPrincipal);

        assertThat(response.getParentRole()).isEqualTo("DISTRIBUTOR");
        assertThat(response.getParentId()).isEqualTo(distributorUser.getId());
        assertThat(retailerUser.getParentUser()).isEqualTo(distributorUser);
        assertThat(retailerUser.getAddedByRole()).isEqualTo("DISTRIBUTOR");
        assertThat(existingActive.getStatus()).isEqualTo("SUPERSEDED");

        ArgumentCaptor<UserMapping> captor = ArgumentCaptor.forClass(UserMapping.class);
        verify(userMappingRepository, atLeastOnce()).save(captor.capture());
        UserMapping savedMapping = captor.getValue();
        assertThat(savedMapping.getStatus()).isEqualTo("ACTIVE");
        assertThat(savedMapping.getNewParentRole()).isEqualTo("DISTRIBUTOR");
        assertThat(savedMapping.getNewParent()).isEqualTo(distributorUser);
    }

    @Test
    @DisplayName("Map User to Super Distributor - Should update hierarchy directly under Super Distributor")
    void testMapUserToSuperDistributor_Success() {
        when(userRepository.findById(retailerUser.getId())).thenReturn(Optional.of(retailerUser));
        when(userRepository.findById(superDistributorUser.getId())).thenReturn(Optional.of(superDistributorUser));
        when(userRepository.findByUsername("admin")).thenReturn(Optional.of(adminUser));
        when(userMappingRepository.findAllByUserIdAndStatus(retailerUser.getId(), "ACTIVE"))
                .thenReturn(Collections.emptyList());
        when(userMappingRepository.save(any(UserMapping.class))).thenAnswer(inv -> {
            UserMapping um = inv.getArgument(0);
            um.setId(UUID.randomUUID());
            um.setCreatedAt(Instant.now());
            return um;
        });

        UserMappingRequest req = UserMappingRequest.builder()
                .retailerId(retailerUser.getId())
                .targetRole("SUPER_DISTRIBUTOR")
                .targetParentId(superDistributorUser.getId())
                .reason("Direct super distributor mapping")
                .build();

        UserMappingResponseDto response = userMappingService.mapUser(req, adminPrincipal);

        assertThat(response.getParentRole()).isEqualTo("SUPER_DISTRIBUTOR");
        assertThat(retailerUser.getParentUser()).isEqualTo(superDistributorUser);
        assertThat(retailerUser.getAddedByRole()).isEqualTo("SUPER_DISTRIBUTOR");
    }

    @Test
    @DisplayName("Map User to Themselves - Should throw IllegalArgumentException")
    void testMapUser_SelfMapping_Rejected() {
        when(userRepository.findById(retailerUser.getId())).thenReturn(Optional.of(retailerUser));

        UserMappingRequest req = UserMappingRequest.builder()
                .retailerId(retailerUser.getId())
                .targetRole("DISTRIBUTOR")
                .targetParentId(retailerUser.getId())
                .build();

        assertThatThrownBy(() -> userMappingService.mapUser(req, adminPrincipal))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Cannot map a user to themselves");
    }

    @Test
    @DisplayName("Map User Circular Hierarchy - Should throw IllegalStateException")
    void testMapUser_CircularHierarchy_Rejected() {
        distributorUser.setParentUser(retailerUser); // Circular dependency

        when(userRepository.findById(retailerUser.getId())).thenReturn(Optional.of(retailerUser));
        when(userRepository.findById(distributorUser.getId())).thenReturn(Optional.of(distributorUser));

        UserMappingRequest req = UserMappingRequest.builder()
                .retailerId(retailerUser.getId())
                .targetRole("DISTRIBUTOR")
                .targetParentId(distributorUser.getId())
                .build();

        assertThatThrownBy(() -> userMappingService.mapUser(req, adminPrincipal))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Circular hierarchy relationship detected");
    }

    @Test
    @DisplayName("Map User to Inactive Parent - Should throw IllegalStateException")
    void testMapUser_InactiveParent_Rejected() {
        distributorUser.setStatus(UserStatus.REJECTED);

        when(userRepository.findById(retailerUser.getId())).thenReturn(Optional.of(retailerUser));
        when(userRepository.findById(distributorUser.getId())).thenReturn(Optional.of(distributorUser));

        UserMappingRequest req = UserMappingRequest.builder()
                .retailerId(retailerUser.getId())
                .targetRole("DISTRIBUTOR")
                .targetParentId(distributorUser.getId())
                .build();

        assertThatThrownBy(() -> userMappingService.mapUser(req, adminPrincipal))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Cannot map under an inactive or rejected Distributor");
    }

    @Test
    @DisplayName("Map User with Duplicate Mapping - Should throw IllegalStateException")
    void testMapUser_DuplicateMapping_Rejected() {
        retailerUser.setParentUser(distributorUser);

        when(userRepository.findById(retailerUser.getId())).thenReturn(Optional.of(retailerUser));
        when(userRepository.findById(distributorUser.getId())).thenReturn(Optional.of(distributorUser));

        UserMappingRequest req = UserMappingRequest.builder()
                .retailerId(retailerUser.getId())
                .targetRole("DISTRIBUTOR")
                .targetParentId(distributorUser.getId())
                .build();

        assertThatThrownBy(() -> userMappingService.mapUser(req, adminPrincipal))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("already mapped under the selected user");
    }

    @Test
    @DisplayName("Get Current Mappings List - Should return paginated items with mapped parent")
    void testGetCurrentMappingsList() {
        retailerUser.setParentUser(distributorUser);
        Pageable pageable = PageRequest.of(0, 10);

        when(userRepository.findByRoleAndSearch(eq(RoleName.RETAILER), eq(""), eq(pageable)))
                .thenReturn(new PageImpl<>(List.of(retailerUser), pageable, 1));
        when(userMappingRepository.findTopByUserIdAndStatusOrderByCreatedAtDesc(retailerUser.getId(), "ACTIVE"))
                .thenReturn(Optional.empty());

        Page<UserMappingTableItemDto> result = userMappingService.getCurrentMappingsList("", "ALL", pageable);

        assertThat(result.getContent()).hasSize(1);
        UserMappingTableItemDto item = result.getContent().get(0);
        assertThat(item.getRetailerName()).isEqualTo("Ramesh Retailer");
        assertThat(item.getMappedUnder()).isEqualTo("DISTRIBUTOR");
        assertThat(item.getParentName()).isEqualTo("Dinesh Distributor");
    }

    @Test
    @DisplayName("Get Mapping History - Should return paginated audit logs")
    void testGetMappingHistory() {
        UserMapping historyItem = UserMapping.builder()
                .id(UUID.randomUUID())
                .user(retailerUser)
                .newParentRole("DISTRIBUTOR")
                .newParentName("Dinesh Distributor")
                .actionType("REMAPPING")
                .mappedByAdminUsername("admin")
                .status("ACTIVE")
                .createdAt(Instant.now())
                .build();

        Pageable pageable = PageRequest.of(0, 10);
        when(userMappingRepository.findHistoryWithFilters(eq(retailerUser.getId()), eq(""), eq(pageable)))
                .thenReturn(new PageImpl<>(List.of(historyItem), pageable, 1));

        Page<UserMappingHistoryDto> result = userMappingService.getMappingHistory("", retailerUser.getId(), pageable);

        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).getActionType()).isEqualTo("REMAPPING");
        assertThat(result.getContent().get(0).getNewParentRole()).isEqualTo("DISTRIBUTOR");
    }
}
