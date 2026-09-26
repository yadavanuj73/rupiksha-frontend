package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.CertificateDto;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.CertificateRepository;
import com.rupiksha.backend.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CertificateServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private CertificateRepository certificateRepository;

    @InjectMocks
    private CertificateServiceImpl certificateService;

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("dd-MM-yyyy");
    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private Role superDistributorRole;
    private Role distributorRole;
    private Role retailerRole;

    @BeforeEach
    void setUp() {
        superDistributorRole = new Role();
        superDistributorRole.setName(RoleName.SUPER_DISTRIBUTOR);

        distributorRole = new Role();
        distributorRole.setName(RoleName.DISTRIBUTOR);

        retailerRole = new Role();
        retailerRole.setName(RoleName.RETAILER);

        lenient().when(certificateRepository.save(any(Certificate.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    @DisplayName("1. Super Distributor certificate generates correct titles, labels, Party Code and 1-year validity")
    void testSuperDistributorCertificate() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setFullName("MANISH KUMAR");
        user.setUsername("manish_sd");
        user.setPartyCode("RD0002");
        user.setShopCity("NALANDA");
        user.setStatus(UserStatus.ACTIVE);
        user.setRoles(Set.of(superDistributorRole));

        // Account created on 15-05-2026
        LocalDate createdLocalDate = LocalDate.of(2026, 5, 15);
        Instant createdAt = createdLocalDate.atStartOfDay(IST).toInstant();
        user.setCreatedAt(createdAt);

        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

        CertificateDto dto = certificateService.getCertificateForUser(user.getId());

        assertNotNull(dto);
        assertEquals("MANISH KUMAR", dto.getRecipientName());
        assertEquals("RD0002", dto.getPartyCode());
        assertEquals("SUPER_DISTRIBUTOR", dto.getCertificateRole());
        assertEquals("AUTHORISED SUPER DISTRIBUTOR", dto.getCertificateTitle());
        assertEquals("SUPER DISTRIBUTOR CERTIFICATE", dto.getCertificateType());
        assertEquals("SUPER DISTRIBUTOR ID", dto.getIdLabel());
        assertEquals("Super Distributor", dto.getRoleDisplayName());
        assertEquals("SUPER DISTRIBUTOR", dto.getBottomRole());
        assertEquals("RUP-SD-RD0002", dto.getCertificateNumber());
        assertEquals("15-05-2026", dto.getIssuedOn());
        assertEquals("15-05-2027", dto.getValidTill()); // Exactly 1 year
        assertEquals("NALANDA", dto.getLocation());
        assertEquals("VALID", dto.getStatus());
        assertTrue(dto.getCertificationStatement().contains("Authorised Super Distributor"));
        assertTrue(dto.getAuthorizationClause().contains("This Super Distributor is hereby authorised"));
        assertEquals("https://rupiksha.in/certificate/verify/RUP-SD-RD0002", dto.getVerificationUrl());
    }

    @Test
    @DisplayName("2. Distributor certificate generates correct titles, labels, Party Code and 1-year validity without Super wording")
    void testDistributorCertificate() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setFullName("RAHUL SHARMA");
        user.setUsername("rahul_dist");
        user.setPartyCode("RD0003");
        user.setShopCity("PATNA");
        user.setStatus(UserStatus.ACTIVE);
        user.setRoles(Set.of(distributorRole));

        // Account created on 20-05-2026
        LocalDate createdLocalDate = LocalDate.of(2026, 5, 20);
        Instant createdAt = createdLocalDate.atStartOfDay(IST).toInstant();
        user.setCreatedAt(createdAt);

        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

        CertificateDto dto = certificateService.getCertificateForUser(user.getId());

        assertNotNull(dto);
        assertEquals("RAHUL SHARMA", dto.getRecipientName());
        assertEquals("RD0003", dto.getPartyCode());
        assertEquals("DISTRIBUTOR", dto.getCertificateRole());
        assertEquals("AUTHORISED DISTRIBUTOR", dto.getCertificateTitle());
        assertEquals("DISTRIBUTOR CERTIFICATE", dto.getCertificateType());
        assertEquals("DISTRIBUTOR ID", dto.getIdLabel());
        assertEquals("Distributor", dto.getRoleDisplayName());
        assertEquals("DISTRIBUTOR", dto.getBottomRole());
        assertEquals("RUP-D-RD0003", dto.getCertificateNumber());
        assertEquals("20-05-2026", dto.getIssuedOn());
        assertEquals("20-05-2027", dto.getValidTill()); // Exactly 1 year
        assertEquals("PATNA", dto.getLocation());
        assertEquals("VALID", dto.getStatus());
        assertFalse(dto.getCertificateTitle().contains("SUPER"));
        assertFalse(dto.getIdLabel().contains("SUPER"));
        assertFalse(dto.getAuthorizationClause().contains("Super Distributor"));
        assertTrue(dto.getCertificationStatement().contains("Authorised Distributor"));
    }

    @Test
    @DisplayName("3. Leap-year test: 29-Feb account creation date validates to 28-Feb next year via plusYears(1)")
    void testLeapYearValidityCalculation() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setFullName("LEAP YEAR USER");
        user.setPartyCode("RD0099");
        user.setStatus(UserStatus.ACTIVE);
        user.setRoles(Set.of(distributorRole));

        // Leap Year: 2028-02-29
        LocalDate leapDate = LocalDate.of(2028, 2, 29);
        user.setCreatedAt(leapDate.atStartOfDay(IST).toInstant());

        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

        CertificateDto dto = certificateService.getCertificateForUser(user.getId());

        assertEquals("29-02-2028", dto.getIssuedOn());
        assertEquals("28-02-2029", dto.getValidTill()); // Correct LocalDate.plusYears(1) handling
    }

    @Test
    @DisplayName("4. Month-end & Year-end date tests")
    void testMonthAndYearEndDates() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setFullName("YEAR END USER");
        user.setPartyCode("RD0100");
        user.setStatus(UserStatus.ACTIVE);
        user.setRoles(Set.of(distributorRole));

        // Year end: 31-12-2026
        LocalDate yearEnd = LocalDate.of(2026, 12, 31);
        user.setCreatedAt(yearEnd.atStartOfDay(IST).toInstant());

        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

        CertificateDto dto = certificateService.getCertificateForUser(user.getId());

        assertEquals("31-12-2026", dto.getIssuedOn());
        assertEquals("31-12-2027", dto.getValidTill());
    }

    @Test
    @DisplayName("5. Ineligible roles (e.g. Retailer only) are rejected with clear exception")
    void testIneligibleRetailerRole() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setFullName("RETAILER ONLY");
        user.setRoles(Set.of(retailerRole));

        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                certificateService.getCertificateForUser(user.getId())
        );
        assertTrue(ex.getMessage().contains("not eligible"));
    }

    @Test
    @DisplayName("6. Inactive or Rejected users have REVOKED status on certificate")
    void testRevokedStatusForInactiveUser() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setFullName("INACTIVE USER");
        user.setPartyCode("RD0005");
        user.setStatus(UserStatus.INACTIVE);
        user.setRoles(Set.of(distributorRole));
        user.setCreatedAt(LocalDate.of(2026, 1, 1).atStartOfDay(IST).toInstant());

        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

        CertificateDto dto = certificateService.getCertificateForUser(user.getId());
        assertEquals("REVOKED", dto.getStatus());
    }
}
