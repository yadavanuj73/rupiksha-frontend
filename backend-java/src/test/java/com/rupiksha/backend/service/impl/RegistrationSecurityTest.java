package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.AuthDtos;
import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.*;
import com.rupiksha.backend.security.JwtService;
import com.rupiksha.backend.service.OtpService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RegistrationSecurityTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private RoleRepository roleRepository;
    @Mock
    private RefreshTokenRepository refreshTokenRepository;
    @Mock
    private WalletRepository walletRepository;
    @Mock
    private UserServiceRepository userServiceRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private JwtService jwtService;
    @Mock
    private OtpService otpService;
    @Mock
    private AppProperties appProperties;
    @Mock
    private RegistrationRateLimiter registrationRateLimiter;

    private AuthServiceImpl authService;

    @BeforeEach
    void setUp() {
        authService = new AuthServiceImpl(
                userRepository,
                roleRepository,
                refreshTokenRepository,
                walletRepository,
                userServiceRepository,
                passwordEncoder,
                jwtService,
                otpService,
                appProperties,
                registrationRateLimiter
        );
    }

    private AuthDtos.RegisterRequest createSampleRequest(String role, String mobile, String otp, String parentRef) {
        return new AuthDtos.RegisterRequest(
                mobile, // 1 username
                mobile, // 2 mobile
                mobile + "@test.com", // 3 email
                "Test User", // 4 fullName
                "Secret@123", // 5 password
                "1234", // 6 pin
                otp, // 7 otp
                role, // 8 role
                "BIHAR", // 9 state
                "Patna", // 10 city
                "800001", // 11 pincode
                "Main Road", // 12 address
                "My Shop", // 13 businessName
                parentRef, // 14 parentUserId
                null, // 15 addedByUserRef
                null, // 16 addedByName
                null, // 17 addedByRole
                null, // 18 addedByPartyCode
                "Test", // 19 firstName
                "User", // 20 lastName
                "1990-01-01", // 21 dob
                "Father Name", // 22 fatherName
                "Male", // 23 gender
                "Retail Store", // 24 businessType
                null, // 25 gstNumber
                null, // 26 shopLandmark
                "Shop Address", // 27 shopAddress
                "BIHAR", // 28 shopState
                "Patna", // 29 shopDistrict
                "Patna", // 30 shopCity
                "800001", // 31 shopPincode
                "BIHAR", // 32 permState
                "Patna", // 33 permDistrict
                "Patna", // 34 permCity
                "800001", // 35 permPincode
                "Permanent Address", // 36 permanentAddress
                "123456789012", // 37 aadhaarNumber
                "ABCDE1234F", // 38 panNumber
                "Test User", // 39 bankAccountHolder
                "State Bank of India", // 40 bankName
                "12345678901", // 41 bankAccountNumber
                "SBIN0001234", // 42 bankIfsc
                "Patna Main", // 43 bankBranch
                "https://example.com/photo.jpg", // 44 photoUrl
                "https://example.com/aadhaar.jpg", // 45 aadhaarPhotoUrl
                "https://example.com/aadhaar_back.jpg", // 46 aadhaarBackPhotoUrl
                "https://example.com/pan.jpg", // 47 panPhotoUrl
                "https://example.com/shop.jpg", // 48 shopPhotoUrl
                "https://example.com/passbook.jpg", // 49 bankPassbookUrl
                "https://example.com/selfie.jpg", // 50 liveSelfieUrl
                null, // 51 drivingLicenceUrl
                null, // 52 voterIdUrl
                null, // 53 passportUrl
                null, // 54 gpsLat
                null, // 55 gpsLong
                null // 56 deviceInfo
        );
    }

    @Test
    @DisplayName("Valid mobile OTP allows retailer registration with PENDING ID payment status")
    void register_validOtp_createsRetailerSuccessfully() {
        AuthDtos.RegisterRequest req = createSampleRequest("RETAILER", "9876543210", "654321", null);

        when(otpService.verifyAndConsumeRegistration(eq("9876543210"), eq("654321"))).thenReturn(true);
        Role retailerRole = new Role();
        retailerRole.setName(RoleName.RETAILER);
        when(roleRepository.findByName(RoleName.RETAILER)).thenReturn(Optional.of(retailerRole));
        when(userRepository.findByMobileAndRole("9876543210", RoleName.RETAILER)).thenReturn(Optional.empty());
        when(userRepository.findByEmailAndRole("9876543210@test.com", RoleName.RETAILER)).thenReturn(Optional.empty());
        when(userRepository.findByUsername("9876543210")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(any())).thenReturn("hashedSecret");

        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User u = invocation.getArgument(0);
            u.setId(UUID.randomUUID());
            return u;
        });

        AuthDtos.UserView view = authService.register(req, "192.168.1.50");

        assertThat(view).isNotNull();
        assertThat(view.mobile()).isEqualTo("9876543210");
        assertThat(view.idPaymentStatus()).isEqualTo(IdPaymentStatus.PENDING.name());
        verify(otpService).verifyAndConsumeRegistration("9876543210", "654321");
        verify(registrationRateLimiter).checkAndIncrement("192.168.1.50", "9876543210");
        verify(userRepository).save(any(User.class));
    }

    @Test
    @DisplayName("Registration fails when OTP is invalid or not verified")
    void register_invalidOtp_throwsException() {
        AuthDtos.RegisterRequest req = createSampleRequest("RETAILER", "9876543210", "000000", null);

        when(otpService.verifyAndConsumeRegistration(eq("9876543210"), eq("000000"))).thenReturn(false);

        assertThatThrownBy(() -> authService.register(req, "192.168.1.50"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Valid mobile OTP verification is required");

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Self-registration as ADMIN is strictly blocked (Privilege Escalation Prevention)")
    void register_adminRole_blocked() {
        AuthDtos.RegisterRequest req = createSampleRequest("ADMIN", "9876543210", "654321", null);
        when(otpService.verifyAndConsumeRegistration(any(), any())).thenReturn(true);

        assertThatThrownBy(() -> authService.register(req, "192.168.1.50"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Admin accounts cannot be self-registered");

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Self-registration as SUPER_ADMIN or DEVELOPER is strictly blocked")
    void register_superAdminRole_blocked() {
        AuthDtos.RegisterRequest req = createSampleRequest("SUPER_ADMIN", "9876543210", "654321", null);
        when(otpService.verifyAndConsumeRegistration(any(), any())).thenReturn(true);

        assertThatThrownBy(() -> authService.register(req, "192.168.1.50"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Admin accounts cannot be self-registered");

        verify(userRepository, never()).save(any());
    }

    @Test
    @DisplayName("Registration fails if specified parent user does not exist")
    void register_nonExistentParent_throwsException() {
        AuthDtos.RegisterRequest req = createSampleRequest("RETAILER", "9876543210", "654321", "NON_EXISTENT_PARENT");

        when(otpService.verifyAndConsumeRegistration(any(), any())).thenReturn(true);
        Role role = new Role();
        role.setName(RoleName.RETAILER);
        when(roleRepository.findByName(RoleName.RETAILER)).thenReturn(Optional.of(role));
        when(userRepository.findByPartyCode("NON_EXISTENT_PARENT")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.register(req, "192.168.1.50"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Specified parent user does not exist");
    }

    @Test
    @DisplayName("Registration fails if specified parent is inactive or suspended")
    void register_inactiveParent_throwsException() {
        User inactiveParent = new User();
        inactiveParent.setId(UUID.randomUUID());
        inactiveParent.setMobile("8888888888");
        inactiveParent.setPartyCode("RPD88888");
        inactiveParent.setStatus(UserStatus.INACTIVE);

        AuthDtos.RegisterRequest req = createSampleRequest("RETAILER", "9876543210", "654321", "RPD88888");

        when(otpService.verifyAndConsumeRegistration(any(), any())).thenReturn(true);
        Role role = new Role();
        role.setName(RoleName.RETAILER);
        when(roleRepository.findByName(RoleName.RETAILER)).thenReturn(Optional.of(role));
        when(userRepository.findByPartyCode("RPD88888")).thenReturn(Optional.of(inactiveParent));

        assertThatThrownBy(() -> authService.register(req, "192.168.1.50"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Specified parent user is not active or approved");
    }

    @Test
    @DisplayName("Registration fails if user attempts self-parenting (circular hierarchy)")
    void register_selfParenting_throwsException() {
        User parent = new User();
        parent.setId(UUID.randomUUID());
        parent.setMobile("9876543210");
        parent.setEmail("test@test.com");
        parent.setPartyCode("RPD99999");
        parent.setStatus(UserStatus.ACTIVE);

        AuthDtos.RegisterRequest req = createSampleRequest("RETAILER", "9876543210", "654321", "RPD99999");

        when(otpService.verifyAndConsumeRegistration(any(), any())).thenReturn(true);
        Role role = new Role();
        role.setName(RoleName.RETAILER);
        when(roleRepository.findByName(RoleName.RETAILER)).thenReturn(Optional.of(role));
        when(userRepository.findByPartyCode("RPD99999")).thenReturn(Optional.of(parent));

        assertThatThrownBy(() -> authService.register(req, "192.168.1.50"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("User cannot be their own parent in the hierarchy");
    }

    @Test
    @DisplayName("Registration fails if parent role is incompatible with child role")
    void register_incompatibleParentRole_throwsException() {
        Role retailerRole = new Role();
        retailerRole.setName(RoleName.RETAILER);

        User retailerParent = new User();
        retailerParent.setId(UUID.randomUUID());
        retailerParent.setMobile("8888888888");
        retailerParent.setEmail("retailer_parent@test.com");
        retailerParent.setPartyCode("RPR88888");
        retailerParent.setStatus(UserStatus.ACTIVE);
        retailerParent.setRoles(Set.of(retailerRole));

        // Retailer cannot sponsor another Retailer
        AuthDtos.RegisterRequest req = createSampleRequest("RETAILER", "9876543210", "654321", "RPR88888");

        when(otpService.verifyAndConsumeRegistration(any(), any())).thenReturn(true);
        Role role = new Role();
        role.setName(RoleName.RETAILER);
        when(roleRepository.findByName(RoleName.RETAILER)).thenReturn(Optional.of(role));
        when(userRepository.findByPartyCode("RPR88888")).thenReturn(Optional.of(retailerParent));

        assertThatThrownBy(() -> authService.register(req, "192.168.1.50"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cannot sponsor");
    }
}
