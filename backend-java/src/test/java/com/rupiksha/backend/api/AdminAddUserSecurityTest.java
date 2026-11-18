package com.rupiksha.backend.api;

import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.RoleRepository;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.repository.UserServiceRepository;
import com.rupiksha.backend.repository.WalletRepository;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.lang.reflect.Method;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminAddUserSecurityTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private RoleRepository roleRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private JwtService jwtService;
    @Mock
    private WalletRepository walletRepository;
    @Mock
    private UserServiceRepository userServiceRepository;
    @Mock
    private com.rupiksha.backend.service.HierarchyService hierarchyService;

    private AdminController adminController;

    @BeforeEach
    void setUp() {
        adminController = new AdminController(
                userRepository,
                roleRepository,
                passwordEncoder,
                jwtService,
                walletRepository,
                userServiceRepository,
                hierarchyService,
                null
        );
    }

    @Test
    @DisplayName("AdminController.addUser is strictly protected with @PreAuthorize(\"hasRole('ADMIN')\")")
    void addUser_hasAdminPreAuthorizeAnnotation() throws NoSuchMethodException {
        Method addUserMethod = AdminController.class.getMethod("addUser", Map.class, JwtPrincipal.class);
        PreAuthorize annotation = addUserMethod.getAnnotation(PreAuthorize.class);

        assertThat(annotation).isNotNull();
        assertThat(annotation.value()).isEqualTo("hasRole('ADMIN')");
    }

    @Test
    @DisplayName("Admin can successfully provision a new member with wallet and audit fields")
    void addUser_byAdmin_createsMemberAndWallet() {
        JwtPrincipal adminPrincipal = new JwtPrincipal(UUID.randomUUID().toString(), "admin_master", List.of("ROLE_ADMIN"));

        Role retailerRole = new Role();
        retailerRole.setName(RoleName.RETAILER);
        when(roleRepository.findByName(RoleName.RETAILER)).thenReturn(Optional.of(retailerRole));
        when(userRepository.findByUsername("9876543210")).thenReturn(Optional.empty());
        when(userRepository.findByMobile("9876543210")).thenReturn(Optional.empty());
        when(userRepository.findByEmail("9876543210@rupiksha.local")).thenReturn(Optional.empty());
        when(passwordEncoder.encode("Secret123")).thenReturn("encodedSecret");

        UUID generatedId = UUID.randomUUID();
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(generatedId);
            return u;
        });
        when(walletRepository.findByUserId(generatedId)).thenReturn(Optional.empty());

        Map<String, Object> body = Map.of(
                "phone", "9876543210",
                "password", "Secret123",
                "fullName", "Retailer One",
                "role", "RETAILER"
        );

        ResponseEntity<Map<String, Object>> response = adminController.addUser(body, adminPrincipal);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("success")).isEqualTo(true);
        assertThat(response.getBody().get("role")).isEqualTo("RETAILER");

        verify(userRepository).save(any(User.class));
        verify(walletRepository).save(any(Wallet.class));
    }

    @Test
    @DisplayName("Admin addUser rejects duplicate phone number")
    void addUser_duplicateMobile_returnsBadRequest() {
        JwtPrincipal adminPrincipal = new JwtPrincipal(UUID.randomUUID().toString(), "admin_master", List.of("ROLE_ADMIN"));

        Role retailerRole = new Role();
        retailerRole.setName(RoleName.RETAILER);
        when(roleRepository.findByName(RoleName.RETAILER)).thenReturn(Optional.of(retailerRole));
        when(userRepository.findByMobile("9876543210")).thenReturn(Optional.of(new User()));

        Map<String, Object> body = Map.of(
                "phone", "9876543210",
                "password", "Secret123",
                "fullName", "Retailer Duplicate",
                "role", "RETAILER"
        );

        ResponseEntity<Map<String, Object>> response = adminController.addUser(body, adminPrincipal);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("error")).isEqualTo("User already exists with this mobile / username / email.");
        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Admin addUser rejects password shorter than 6 characters")
    void addUser_shortPassword_returnsBadRequest() {
        JwtPrincipal adminPrincipal = new JwtPrincipal(UUID.randomUUID().toString(), "admin_master", List.of("ROLE_ADMIN"));

        Map<String, Object> body = Map.of(
                "phone", "9876543210",
                "password", "123",
                "fullName", "Retailer One",
                "role", "RETAILER"
        );

        ResponseEntity<Map<String, Object>> response = adminController.addUser(body, adminPrincipal);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().get("error")).isEqualTo("Password must be at least 6 characters.");
        verify(userRepository, never()).save(any());
    }
}
