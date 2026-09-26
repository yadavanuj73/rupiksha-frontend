package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.CertificateDto;
import com.rupiksha.backend.domain.Certificate;
import com.rupiksha.backend.domain.RoleName;
import com.rupiksha.backend.domain.User;
import com.rupiksha.backend.domain.UserStatus;
import com.rupiksha.backend.repository.CertificateRepository;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.service.CertificateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class CertificateServiceImpl implements CertificateService {

    private final UserRepository userRepository;
    private final CertificateRepository certificateRepository;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd-MM-yyyy");
    private static final DateTimeFormatter DISPLAY_DATE_FORMATTER = DateTimeFormatter.ofPattern("dd-MMM-yyyy");
    private static final ZoneId IST_ZONE = ZoneId.of("Asia/Kolkata");
    private static final String BASE_VERIFICATION_URL = "https://rupiksha.in/certificate/verify/";

    @Override
    @Transactional
    public CertificateDto getCertificateForUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found with ID: " + userId));
        return getCertificateForUser(user);
    }

    @Override
    @Transactional
    public CertificateDto getCertificateForUser(User user) {
        RoleName primaryRole = resolveCertificateRole(user);
        if (primaryRole == null) {
            throw new IllegalArgumentException("User with role ADMIN is not eligible for a partner certificate");
        }

        String partyCode = user.getPartyCode();
        if (partyCode == null || partyCode.isBlank()) {
            char roleCode = primaryRole == RoleName.SUPER_DISTRIBUTOR ? 'S' : (primaryRole == RoleName.DISTRIBUTOR ? 'D' : 'R');
            partyCode = "RP" + roleCode + user.getUsername().toUpperCase();
        } else {
            partyCode = partyCode.trim().toUpperCase();
        }

        LocalDate issuedOn = user.getCreatedAt() != null
                ? user.getCreatedAt().atZone(IST_ZONE).toLocalDate()
                : LocalDate.now();

        LocalDate validTill = issuedOn.plusYears(1);

        String certPrefix = (primaryRole == RoleName.SUPER_DISTRIBUTOR) ? "RUP-SD-" :
                            (primaryRole == RoleName.DISTRIBUTOR ? "RUP-D-" : "RUP-R-");
        String certificateNumber = certPrefix + partyCode;

        String status = calculateStatus(user, validTill);

        // Persist/Update Certificate Record in DB
        Optional<Certificate> existing = certificateRepository.findByCertificateNumber(certificateNumber);
        Certificate cert = existing.orElseGet(Certificate::new);
        cert.setUser(user);
        cert.setCertificateNumber(certificateNumber);
        cert.setPartyCode(partyCode);
        cert.setCertificateType(primaryRole.name());
        cert.setRole(primaryRole.name());
        cert.setIssuedOn(issuedOn);
        cert.setValidTill(validTill);
        cert.setStatus(status);
        certificateRepository.save(cert);

        return buildDto(user, primaryRole, partyCode, certificateNumber, issuedOn, validTill, status);
    }

    @Override
    @Transactional(readOnly = true)
    public CertificateDto getCertificateByPartyCode(String partyCode) {
        if (partyCode == null || partyCode.isBlank()) {
            throw new IllegalArgumentException("Party code must not be empty");
        }
        String normalized = partyCode.trim().toUpperCase();
        User user = userRepository.findByPartyCode(normalized)
                .orElseThrow(() -> new IllegalArgumentException("No user found with Party Code: " + normalized));
        return getCertificateForUser(user);
    }

    @Override
    @Transactional(readOnly = true)
    public CertificateDto getCertificateByCertificateNumber(String certificateNumber) {
        if (certificateNumber == null || certificateNumber.isBlank()) {
            throw new IllegalArgumentException("Certificate number must not be empty");
        }
        String normalized = certificateNumber.trim().toUpperCase();
        Certificate cert = certificateRepository.findByCertificateNumber(normalized)
                .orElseThrow(() -> new IllegalArgumentException("Certificate not found: " + normalized));
        return getCertificateForUser(cert.getUser());
    }

    @Override
    @Transactional(readOnly = true)
    public CertificateDto verifyCertificate(String certificateNumber) {
        if (certificateNumber == null || certificateNumber.isBlank()) {
            throw new IllegalArgumentException("Certificate number is required for verification");
        }
        String normalized = certificateNumber.trim().toUpperCase();
        Optional<Certificate> certOpt = certificateRepository.findByCertificateNumber(normalized);
        if (certOpt.isPresent()) {
            return getCertificateForUser(certOpt.get().getUser());
        }

        // If not yet saved in certificates table, parse partyCode and lookup user
        String partyCode = normalized.replaceFirst("^RUP-(SD|D|R)-", "");
        Optional<User> userOpt = userRepository.findByPartyCode(partyCode);
        if (userOpt.isPresent()) {
            return getCertificateForUser(userOpt.get());
        }

        throw new IllegalArgumentException("Invalid Certificate: No verified record found for " + normalized);
    }

    private RoleName resolveCertificateRole(User user) {
        if (user == null || user.getRoles() == null) return null;
        if (user.getRoles().stream().anyMatch(r -> r.getName() == RoleName.SUPER_DISTRIBUTOR)) {
            return RoleName.SUPER_DISTRIBUTOR;
        }
        if (user.getRoles().stream().anyMatch(r -> r.getName() == RoleName.DISTRIBUTOR)) {
            return RoleName.DISTRIBUTOR;
        }
        if (user.getRoles().stream().anyMatch(r -> r.getName() == RoleName.RETAILER)) {
            return RoleName.RETAILER;
        }
        return null;
    }

    private String calculateStatus(User user, LocalDate validTill) {
        if (user.getStatus() == UserStatus.INACTIVE || user.getStatus() == UserStatus.REJECTED) {
            return "REVOKED";
        }
        LocalDate today = LocalDate.now(IST_ZONE);
        if (today.isAfter(validTill)) {
            return "EXPIRED";
        }
        return "VALID";
    }

    private CertificateDto buildDto(
            User user,
            RoleName roleName,
            String partyCode,
            String certificateNumber,
            LocalDate issuedOn,
            LocalDate validTill,
            String status
    ) {
        boolean isSuper = (roleName == RoleName.SUPER_DISTRIBUTOR);
        boolean isRetailer = (roleName == RoleName.RETAILER);

        String title = isSuper ? "AUTHORISED SUPER DISTRIBUTOR" : (isRetailer ? "RETAILER CERTIFICATE" : "AUTHORISED DISTRIBUTOR");
        String certType = isSuper ? "SUPER DISTRIBUTOR CERTIFICATE" : (isRetailer ? "RETAILER CERTIFICATE" : "DISTRIBUTOR CERTIFICATE");
        String idLabel = isSuper ? "SUPER DISTRIBUTOR ID" : (isRetailer ? "RETAILER ID" : "DISTRIBUTOR ID");
        String roleDisplay = isSuper ? "Super Distributor" : (isRetailer ? "Retailer" : "Distributor");
        String bottomRole = isSuper ? "SUPER DISTRIBUTOR" : (isRetailer ? "RETAILER" : "DISTRIBUTOR");

        String name = resolveName(user);
        String location = resolveLocation(user);
        String fullAddress = resolveFullAddress(user);
        String downloadDate = LocalDate.now(IST_ZONE).format(DISPLAY_DATE_FORMATTER);

        String statement = isRetailer
                ? "has been onboarded as a Retailer of Rupiksha Services Private Limited"
                : "is an Authorised " + roleDisplay + " for delivering Rupiksha Services Pvt. Ltd. digital financial services.";

        String authClause = isRetailer
                ? "w.e.f. the Retailer ID creation date. The retailer is authorized to provide and distribute the banking and financial technology services offered by Rupiksha Services Private Limited through its Web Portal and Mobile Application, subject to the terms & conditions accepted by the retailer and the applicable company policies."
                : "This " + roleDisplay + " is hereby authorised for providing the services offered by Rupiksha Services Pvt. Ltd. and shall not act as our representative in any capacity for any other purpose whatsoever.";

        String disclaimer = "NOTE: If you will not perform up to the mark, then your " + roleDisplay + " location will be allocated to some other person.";

        return CertificateDto.builder()
                .certificateNumber(certificateNumber)
                .partyCode(partyCode)
                .certificateRole(roleName.name())
                .roleDisplayName(roleDisplay)
                .certificateTitle(title)
                .certificateType(certType)
                .idLabel(idLabel)
                .recipientName(name.toUpperCase())
                .issuedOn(isRetailer ? issuedOn.format(DISPLAY_DATE_FORMATTER) : issuedOn.format(DATE_FORMATTER))
                .validTill(isRetailer ? validTill.format(DISPLAY_DATE_FORMATTER) : validTill.format(DATE_FORMATTER))
                .location(location.toUpperCase())
                .fullAddress(fullAddress)
                .downloadDate(downloadDate)
                .certificationStatement(statement)
                .authorizationClause(authClause)
                .bottomRole(bottomRole)
                .disclaimerNote(disclaimer)
                .status(status)
                .verificationUrl(BASE_VERIFICATION_URL + certificateNumber)
                .build();
    }

    private String resolveName(User user) {
        if (user.getFullName() != null && !user.getFullName().isBlank()) {
            return user.getFullName().trim();
        }
        String first = user.getFirstName() != null ? user.getFirstName().trim() : "";
        String last = user.getLastName() != null ? user.getLastName().trim() : "";
        String combined = (first + " " + last).trim();
        if (!combined.isEmpty()) return combined;
        return user.getUsername() != null ? user.getUsername() : "Rupiksha Partner";
    }

    private String resolveLocation(User user) {
        if (user.getShopCity() != null && !user.getShopCity().isBlank()) {
            return user.getShopCity().trim();
        }
        if (user.getCity() != null && !user.getCity().isBlank()) {
            return user.getCity().trim();
        }
        if (user.getShopDistrict() != null && !user.getShopDistrict().isBlank()) {
            return user.getShopDistrict().trim();
        }
        if (user.getStateName() != null && !user.getStateName().isBlank()) {
            return user.getStateName().trim();
        }
        return "INDIA";
    }

    private String resolveFullAddress(User user) {
        StringBuilder sb = new StringBuilder();
        if (user.getPermanentAddress() != null && !user.getPermanentAddress().isBlank()) {
            sb.append(user.getPermanentAddress().trim());
        } else if (user.getShopAddress() != null && !user.getShopAddress().isBlank()) {
            sb.append(user.getShopAddress().trim());
        } else if (user.getAddressLine1() != null && !user.getAddressLine1().isBlank()) {
            sb.append(user.getAddressLine1().trim());
        }

        String city = user.getPermCity() != null && !user.getPermCity().isBlank() ? user.getPermCity().trim() :
                      (user.getShopCity() != null && !user.getShopCity().isBlank() ? user.getShopCity().trim() :
                      (user.getCity() != null && !user.getCity().isBlank() ? user.getCity().trim() : ""));
        if (!city.isEmpty() && !sb.toString().toLowerCase().contains(city.toLowerCase())) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(city);
        }

        String state = user.getPermState() != null && !user.getPermState().isBlank() ? user.getPermState().trim() :
                       (user.getShopState() != null && !user.getShopState().isBlank() ? user.getShopState().trim() :
                       (user.getStateName() != null && !user.getStateName().isBlank() ? user.getStateName().trim() : ""));
        if (!state.isEmpty() && !sb.toString().toLowerCase().contains(state.toLowerCase())) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(state);
        }

        String pin = user.getPermPincode() != null && !user.getPermPincode().isBlank() ? user.getPermPincode().trim() :
                     (user.getShopPincode() != null && !user.getShopPincode().isBlank() ? user.getShopPincode().trim() :
                     (user.getPincode() != null && !user.getPincode().isBlank() ? user.getPincode().trim() : ""));
        if (!pin.isEmpty() && !sb.toString().contains(pin)) {
            if (sb.length() > 0) sb.append(" - ");
            sb.append(pin);
        }

        return sb.length() > 0 ? sb.toString() : "Ward No. 12, Main Road, Nalanda, Bihar - 803101";
    }
}
