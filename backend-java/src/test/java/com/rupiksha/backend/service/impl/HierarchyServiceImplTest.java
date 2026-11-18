package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.domain.Role;
import com.rupiksha.backend.domain.RoleName;
import com.rupiksha.backend.domain.User;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.security.JwtPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.access.AccessDeniedException;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class HierarchyServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private HierarchyServiceImpl hierarchyService;

    private User adminUser;
    private User superDistributor;
    private User distributor;
    private User retailer;
    private User strangerUser;

    private UUID adminId;
    private UUID sdId;
    private UUID distId;
    private UUID retId;
    private UUID strangerId;

    @BeforeEach
    void setUp() {
        adminId = UUID.randomUUID();
        sdId = UUID.randomUUID();
        distId = UUID.randomUUID();
        retId = UUID.randomUUID();
        strangerId = UUID.randomUUID();

        Role adminRole = new Role();
        adminRole.setName(RoleName.ADMIN);

        Role sdRole = new Role();
        sdRole.setName(RoleName.SUPER_DISTRIBUTOR);

        Role distRole = new Role();
        distRole.setName(RoleName.DISTRIBUTOR);

        Role retRole = new Role();
        retRole.setName(RoleName.RETAILER);

        adminUser = new User();
        adminUser.setId(adminId);
        adminUser.setUsername("admin_user");
        adminUser.getRoles().add(adminRole);

        superDistributor = new User();
        superDistributor.setId(sdId);
        superDistributor.setUsername("super_dist");
        superDistributor.getRoles().add(sdRole);

        distributor = new User();
        distributor.setId(distId);
        distributor.setUsername("dist_user");
        distributor.setParentUser(superDistributor);
        distributor.setAddedByUserRef(sdId.toString());
        distributor.getRoles().add(distRole);

        retailer = new User();
        retailer.setId(retId);
        retailer.setUsername("retailer_user");
        retailer.setParentUser(distributor);
        retailer.setAddedByUserRef(distId.toString());
        retailer.getRoles().add(retRole);

        strangerUser = new User();
        strangerUser.setId(strangerId);
        strangerUser.setUsername("stranger_user");
        strangerUser.getRoles().add(retRole);

        when(userRepository.findById(adminId)).thenReturn(Optional.of(adminUser));
        when(userRepository.findById(sdId)).thenReturn(Optional.of(superDistributor));
        when(userRepository.findById(distId)).thenReturn(Optional.of(distributor));
        when(userRepository.findById(retId)).thenReturn(Optional.of(retailer));
        when(userRepository.findById(strangerId)).thenReturn(Optional.of(strangerUser));
    }

    @Test
    @DisplayName("Admin has universal hierarchy access to all users")
    void testAdminHasUniversalAccess() {
        assertTrue(hierarchyService.isAdmin(adminUser));
        assertTrue(hierarchyService.isUserInHierarchy(adminUser, retailer));
        assertTrue(hierarchyService.isUserInHierarchy(adminUser, strangerUser));

        JwtPrincipal adminPrincipal = new JwtPrincipal(adminId.toString(), "admin_user", List.of("ADMIN"));
        assertTrue(hierarchyService.isAdmin(adminPrincipal));
        assertDoesNotThrow(() -> hierarchyService.validateHierarchyAccess(adminPrincipal, strangerId));
    }

    @Test
    @DisplayName("User always has access to self")
    void testSelfHierarchyAccess() {
        assertTrue(hierarchyService.isUserInHierarchy(distributor, distributor));
        assertTrue(hierarchyService.isUserInHierarchy(retailer, retailer));
    }

    @Test
    @DisplayName("Super Distributor can access direct and indirect downline members")
    void testSuperDistributorDownlineAccess() {
        assertTrue(hierarchyService.isUserInHierarchy(superDistributor, distributor));
        assertTrue(hierarchyService.isUserInHierarchy(superDistributor, retailer));
        assertTrue(hierarchyService.isUserInHierarchy(sdId, retId));
    }

    @Test
    @DisplayName("Distributor can access their Retailer but cannot access stranger or sibling distributor")
    void testDistributorHierarchyBoundaries() {
        assertTrue(hierarchyService.isUserInHierarchy(distributor, retailer));
        assertFalse(hierarchyService.isUserInHierarchy(distributor, strangerUser));

        assertThrows(AccessDeniedException.class, () ->
                hierarchyService.validateHierarchyAccess(distributor, strangerUser)
        );
    }

    @Test
    @DisplayName("Retailer cannot access other retailers or parent distributor")
    void testRetailerCannotAccessOthers() {
        assertFalse(hierarchyService.isUserInHierarchy(retailer, strangerUser));
        assertFalse(hierarchyService.isUserInHierarchy(retailer, distributor));

        assertThrows(AccessDeniedException.class, () ->
                hierarchyService.validateHierarchyAccess(retailer, strangerUser)
        );
    }
}
