package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.AuthDtos;
import com.rupiksha.backend.api.dto.OtpDtos;
import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.*;
import com.rupiksha.backend.security.JwtService;
import com.rupiksha.backend.service.AuthService;
import com.rupiksha.backend.service.OtpService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final WalletRepository walletRepository;
    private final UserServiceRepository userServiceRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final OtpService otpService;
    private final AppProperties appProperties;
    private final SecureRandom secureRandom = new SecureRandom();

    @Override
    @Transactional
    public AuthDtos.AuthResponse login(AuthDtos.LoginRequest request) {
        String identifier = request.username() == null ? "" : request.username().trim();

        User user = userRepository.findByUsername(identifier)
                .or(() -> userRepository.findByMobile(identifier))
                .or(() -> userRepository.findByEmail(identifier))
                .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid credentials");
        }

        if (user.getPinHash() != null && request.pin() != null && !request.pin().isBlank()) {
            if (!passwordEncoder.matches(request.pin().trim(), user.getPinHash())) {
                throw new IllegalArgumentException("Invalid Login PIN");
            }
        }

        if (user.getStatus() != UserStatus.APPROVED && user.getStatus() != UserStatus.ACTIVE) {
            throw new IllegalArgumentException("Account is not active or approved");
        }

        return issueTokens(user);
    }

    @Override
    @Transactional
    public AuthDtos.AuthResponse refresh(AuthDtos.RefreshRequest request) {
        String hash = sha256(request.refreshToken());
        RefreshToken rt = refreshTokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> new IllegalArgumentException("Invalid refresh token"));
        if (rt.isRevoked() || rt.getExpiresAt().isBefore(Instant.now())) {
            throw new IllegalArgumentException("Refresh token expired/revoked");
        }
        rt.setRevoked(true);
        refreshTokenRepository.save(rt);
        return issueTokens(rt.getUser());
    }

    @Override
    @Transactional
    public AuthDtos.UserView register(AuthDtos.RegisterRequest request) {
        if (userRepository.findByUsername(request.username()).isPresent()) {
            throw new IllegalArgumentException("Username already exists");
        }
        if (userRepository.findByMobile(request.mobile()).isPresent()) {
            throw new IllegalArgumentException("Mobile number already registered");
        }
        if (userRepository.findByEmail(request.email()).isPresent()) {
            throw new IllegalArgumentException("Email already exists");
        }

        RoleName roleName = resolveSelfRegistrationRole(request.role());
        Role role = roleRepository.findByName(roleName)
                .orElseThrow(() -> new IllegalArgumentException("Role seed missing: " + roleName));

        User user = new User();
        user.setUsername(request.username().trim());
        user.setMobile(request.mobile().trim());
        user.setEmail(request.email().trim());
        user.setFullName(request.fullName().trim());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        if (request.pin() != null && !request.pin().isBlank()) {
            user.setPinHash(passwordEncoder.encode(request.pin().trim()));
            user.setPinLastChanged(Instant.now());
        }
        user.setPasswordLastChanged(Instant.now());
        user.setOtpVerified(true);

        // AUTO APPROVAL REQUIREMENT (Instant auto approval for registration + onboarding)
        user.setStatus(UserStatus.ACTIVE);
        user.setRegistrationStatus(RegistrationStatus.APPROVED);
        user.setKycStatus(KycStatus.APPROVED);
        user.setKycSubmittedAt(Instant.now());
        user.setKycApprovedAt(Instant.now());
        user.getRoles().add(role);

        // Auto-generate Party Code
        String partyCode = generatePartyCode(request.state(), roleName);
        user.setPartyCode(partyCode);

        // Populate Onboarding Details
        if (isPresent(request.firstName())) user.setFirstName(request.firstName().trim());
        if (isPresent(request.lastName())) user.setLastName(request.lastName().trim());
        if (isPresent(request.dob())) user.setDob(request.dob().trim());
        if (isPresent(request.fatherName())) user.setFatherName(request.fatherName().trim());
        if (isPresent(request.gender())) user.setGender(request.gender().trim());
        if (isPresent(request.state())) user.setStateName(request.state().trim());
        if (isPresent(request.city())) user.setCity(request.city().trim());
        if (isPresent(request.pincode())) user.setPincode(request.pincode().trim());
        if (isPresent(request.address())) user.setAddressLine1(request.address().trim());
        if (isPresent(request.businessName())) user.setBusinessName(request.businessName().trim());
        if (isPresent(request.businessType())) user.setBusinessType(request.businessType().trim());
        if (isPresent(request.gstNumber())) user.setGstNumber(request.gstNumber().trim());

        // Address Details
        if (isPresent(request.shopLandmark())) user.setShopLandmark(request.shopLandmark().trim());
        if (isPresent(request.shopAddress())) user.setShopAddress(request.shopAddress().trim());
        if (isPresent(request.shopState())) user.setShopState(request.shopState().trim());
        if (isPresent(request.shopDistrict())) user.setShopDistrict(request.shopDistrict().trim());
        if (isPresent(request.shopCity())) user.setShopCity(request.shopCity().trim());
        if (isPresent(request.shopPincode())) user.setShopPincode(request.shopPincode().trim());

        if (isPresent(request.permanentAddress())) user.setPermanentAddress(request.permanentAddress().trim());
        if (isPresent(request.permState())) user.setPermState(request.permState().trim());
        if (isPresent(request.permDistrict())) user.setPermDistrict(request.permDistrict().trim());
        if (isPresent(request.permCity())) user.setPermCity(request.permCity().trim());
        if (isPresent(request.permPincode())) user.setPermPincode(request.permPincode().trim());

        // Identity & Bank Details
        if (isPresent(request.aadhaarNumber())) user.setAadhaarNumber(request.aadhaarNumber().trim());
        if (isPresent(request.panNumber())) user.setPanNumber(request.panNumber().trim());
        if (isPresent(request.bankAccountHolder())) user.setBankAccountHolder(request.bankAccountHolder().trim());
        if (isPresent(request.bankName())) user.setBankName(request.bankName().trim());
        if (isPresent(request.bankAccountNumber())) user.setBankAccountNumber(request.bankAccountNumber().trim());
        if (isPresent(request.bankIfsc())) user.setBankIfsc(request.bankIfsc().trim());
        if (isPresent(request.bankBranch())) user.setBankBranch(request.bankBranch().trim());

        // Document Image URLs
        if (isPresent(request.photoUrl())) user.setPhotoUrl(request.photoUrl().trim());
        if (isPresent(request.aadhaarPhotoUrl())) user.setAadhaarPhotoUrl(request.aadhaarPhotoUrl().trim());
        if (isPresent(request.aadhaarBackPhotoUrl())) user.setAadhaarBackPhotoUrl(request.aadhaarBackPhotoUrl().trim());
        if (isPresent(request.panPhotoUrl())) user.setPanPhotoUrl(request.panPhotoUrl().trim());
        if (isPresent(request.shopPhotoUrl())) user.setShopPhotoUrl(request.shopPhotoUrl().trim());
        if (isPresent(request.bankPassbookUrl())) user.setBankPassbookUrl(request.bankPassbookUrl().trim());
        if (isPresent(request.liveSelfieUrl())) user.setLiveSelfieUrl(request.liveSelfieUrl().trim());
        if (isPresent(request.drivingLicenceUrl())) user.setDrivingLicenceUrl(request.drivingLicenceUrl().trim());
        if (isPresent(request.voterIdUrl())) user.setVoterIdUrl(request.voterIdUrl().trim());
        if (isPresent(request.passportUrl())) user.setPassportUrl(request.passportUrl().trim());

        if (isPresent(request.gpsLat())) user.setGpsLat(request.gpsLat().trim());
        if (isPresent(request.gpsLong())) user.setGpsLong(request.gpsLong().trim());
        if (isPresent(request.deviceInfo())) user.setDeviceInfo(request.deviceInfo().trim());

        // Resolve Parent Hierarchy
        resolveAndSetParent(user, request);

        User saved = userRepository.save(user);

        // Create Wallet
        if (walletRepository.findByUserId(saved.getId()).isEmpty()) {
            Wallet wallet = new Wallet();
            wallet.setUser(saved);
            wallet.setBalance(BigDecimal.ZERO);
            wallet.setLockedBalance(BigDecimal.ZERO);
            walletRepository.save(wallet);
        }

        // Initialize Default Services (Wallet, Recharge, BBPS, Reports, Profile, Settings = enabled; AEPS/Payout = disabled until KYC)
        initializeUserServices(saved);

        log.info("Welcome Notification: Account created & AUTO APPROVED for user {} ({})", saved.getUsername(), saved.getMobile());

        return toView(saved);
    }

    @Override
    @Transactional
    public OtpDtos.OtpResponse forgotPasswordSendOtp(AuthDtos.ForgotPasswordRequest request) {
        User user = userRepository.findByMobile(request.mobile().trim())
                .orElseThrow(() -> new IllegalArgumentException("Mobile number not registered"));
        return otpService.sendOtp(new OtpDtos.SendOtpRequest(user.getMobile()));
    }

    @Override
    @Transactional
    public OtpDtos.OtpResponse resetPassword(AuthDtos.ResetPasswordRequest request) {
        User user = userRepository.findByMobile(request.mobile().trim())
                .orElseThrow(() -> new IllegalArgumentException("Mobile number not registered"));

        OtpDtos.OtpResponse otpRes = otpService.verifyOtp(new OtpDtos.VerifyOtpRequest(user.getMobile(), request.otp()));
        if (!otpRes.success()) {
            return otpRes;
        }

        user.setPasswordHash(passwordEncoder.encode(request.newPassword().trim()));
        user.setPasswordLastChanged(Instant.now());
        userRepository.save(user);
        return new OtpDtos.OtpResponse(true, "Password reset successfully");
    }

    @Override
    @Transactional
    public OtpDtos.OtpResponse forgotPinSendOtp(AuthDtos.ForgotPinRequest request) {
        User user = userRepository.findByMobile(request.mobile().trim())
                .orElseThrow(() -> new IllegalArgumentException("Mobile number not registered"));
        return otpService.sendOtp(new OtpDtos.SendOtpRequest(user.getMobile()));
    }

    @Override
    @Transactional
    public OtpDtos.OtpResponse resetPin(AuthDtos.ResetPinRequest request) {
        User user = userRepository.findByMobile(request.mobile().trim())
                .orElseThrow(() -> new IllegalArgumentException("Mobile number not registered"));

        OtpDtos.OtpResponse otpRes = otpService.verifyOtp(new OtpDtos.VerifyOtpRequest(user.getMobile(), request.otp()));
        if (!otpRes.success()) {
            return otpRes;
        }

        user.setPinHash(passwordEncoder.encode(request.newPin().trim()));
        user.setPinLastChanged(Instant.now());
        userRepository.save(user);
        return new OtpDtos.OtpResponse(true, "Login PIN reset successfully");
    }

    @Override
    @Transactional
    public void logout(String refreshToken) {
        refreshTokenRepository.findByTokenHash(sha256(refreshToken)).ifPresent(token -> {
            token.setRevoked(true);
            refreshTokenRepository.save(token);
        });
    }

    private void resolveAndSetParent(User user, AuthDtos.RegisterRequest request) {
        if (isPresent(request.parentUserId())) {
            try {
                UUID parentId = UUID.fromString(request.parentUserId().trim());
                userRepository.findById(parentId).ifPresent(parent -> {
                    user.setParentUser(parent);
                    user.setAddedByUserRef(parent.getId().toString());
                    user.setAddedByName(parent.getFullName());
                    user.setAddedByPartyCode(parent.getPartyCode());
                    String pRole = parent.getRoles().stream().map(r -> r.getName().name()).findFirst().orElse("DISTRIBUTOR");
                    user.setAddedByRole(pRole);
                });
            } catch (Exception ignored) {}
        } else if (isPresent(request.addedByPartyCode())) {
            userRepository.findByPartyCode(request.addedByPartyCode().trim()).ifPresent(parent -> {
                user.setParentUser(parent);
                user.setAddedByUserRef(parent.getId().toString());
                user.setAddedByName(parent.getFullName());
                user.setAddedByPartyCode(parent.getPartyCode());
                String pRole = parent.getRoles().stream().map(r -> r.getName().name()).findFirst().orElse("DISTRIBUTOR");
                user.setAddedByRole(pRole);
            });
        }
        if (isPresent(request.addedByName()) && user.getAddedByName() == null) {
            user.setAddedByName(request.addedByName().trim());
        }
        if (isPresent(request.addedByRole()) && user.getAddedByRole() == null) {
            user.setAddedByRole(request.addedByRole().trim());
        }
    }

    private void initializeUserServices(User user) {
        for (ServiceType type : ServiceType.values()) {
            boolean defaultEnable = switch (type) {
                case AEPS, BBPS, PAYOUT, DMT -> false; // AEPS, BBPS, Payout, DMT remain disabled for new user until Admin enables
                default -> true; // Wallet, Recharge, MATM, CMS, etc.
            };
            if (userServiceRepository.findByUserIdAndServiceType(user.getId(), type).isEmpty()) {
                com.rupiksha.backend.domain.UserService s = new com.rupiksha.backend.domain.UserService();
                s.setUser(user);
                s.setServiceType(type);
                s.setIsEnabled(defaultEnable);
                s.setEnabledBy("system");
                s.setEnabledAt(Instant.now());
                userServiceRepository.save(s);
            }
        }
    }

    private String generatePartyCode(String state, RoleName roleName) {
        String rolePrefix = switch (roleName) {
            case SUPER_DISTRIBUTOR -> "RPSD";
            case DISTRIBUTOR -> "RPD";
            case ADMIN, NATIONAL_HEADER, STATE_HEADER, REGIONAL_HEADER, EMPLOYEE -> "RPADM";
            default -> "RPR";
        };
        String statePlate = resolveStatePlateCode(state);
        String prefix = rolePrefix + statePlate;

        String candidate;
        int attempts = 0;
        do {
            int random5Digit = 10000 + secureRandom.nextInt(90000);
            candidate = prefix + random5Digit;
            attempts++;
        } while (userRepository.existsByPartyCode(candidate) && attempts < 100);

        return candidate;
    }

    private String resolveStatePlateCode(String rawState) {
        if (rawState == null || rawState.isBlank()) return "BR";
        String upper = rawState.trim().toUpperCase();

        if (upper.length() == 2 && upper.matches("[A-Z]{2}")) {
            return upper;
        }

        if (upper.contains("BIHAR") || upper.contains("MUZAFFARPUR") || upper.contains("PATNA") || upper.contains("NALANDA")) return "BR";
        if (upper.contains("MAHARASHTRA") || upper.contains("MUMBAI") || upper.contains("PUNE")) return "MH";
        if (upper.contains("UTTAR PRADESH") || upper.contains("LUCKNOW") || upper.contains("KANPUR") || upper.contains("NOIDA")) return "UP";
        if (upper.contains("DELHI") || upper.contains("NEW DELHI")) return "DL";
        if (upper.contains("WEST BENGAL") || upper.contains("BENGAL") || upper.contains("KOLKATA")) return "WB";
        if (upper.contains("RAJASTHAN") || upper.contains("JAIPUR")) return "RJ";
        if (upper.contains("PUNJAB") || upper.contains("LUDHIANA")) return "PB";
        if (upper.contains("HARYANA") || upper.contains("GURGAON") || upper.contains("GURUGRAM")) return "HR";
        if (upper.contains("GUJARAT") || upper.contains("SURAT") || upper.contains("AHMEDABAD")) return "GJ";
        if (upper.contains("KARNATAKA") || upper.contains("BANGALORE") || upper.contains("BENGALURU")) return "KA";
        if (upper.contains("TAMIL NADU") || upper.contains("CHENNAI")) return "TN";
        if (upper.contains("TELANGANA") || upper.contains("HYDERABAD")) return "TS";
        if (upper.contains("ANDHRA")) return "AP";
        if (upper.contains("MADHYA PRADESH") || upper.contains("INDORE") || upper.contains("BHOPAL")) return "MP";
        if (upper.contains("ODISHA") || upper.contains("ORISSA")) return "OD";
        if (upper.contains("JHARKHAND") || upper.contains("RANCHI")) return "JH";
        if (upper.contains("CHHATTISGARH") || upper.contains("RAIPUR")) return "CG";
        if (upper.contains("ASSAM") || upper.contains("GUWAHATI")) return "AS";
        if (upper.contains("KERALA")) return "KL";
        if (upper.contains("UTTARAKHAND") || upper.contains("DEHRADUN")) return "UK";
        if (upper.contains("HIMACHAL")) return "HP";
        if (upper.contains("JAMMU") || upper.contains("KASHMIR")) return "JK";
        if (upper.contains("GOA")) return "GA";
        if (upper.contains("MANIPUR")) return "MN";
        if (upper.contains("MEGHALAYA")) return "ML";
        if (upper.contains("MIZORAM")) return "MZ";
        if (upper.contains("NAGALAND")) return "NL";
        if (upper.contains("SIKKIM")) return "SK";
        if (upper.contains("TRIPURA")) return "TR";
        if (upper.contains("ARUNACHAL")) return "AR";
        if (upper.contains("PUDUCHERRY")) return "PY";
        if (upper.contains("CHANDIGARH")) return "CH";
        if (upper.contains("LADAKH")) return "LA";

        return "BR";
    }

    private boolean isPresent(String value) {
        return value != null && !value.isBlank();
    }

    private AuthDtos.AuthResponse issueTokens(User user) {
        List<String> roles = user.getRoles().stream().map(r -> r.getName().name()).toList();
        String access = jwtService.createAccessToken(user.getId(), user.getUsername(), roles);
        String refreshRaw = UUID.randomUUID().toString() + "." + UUID.randomUUID();
        String refreshHash = sha256(refreshRaw);

        RefreshToken rt = new RefreshToken();
        rt.setUser(user);
        rt.setTokenHash(refreshHash);
        rt.setExpiresAt(Instant.now().plusSeconds(appProperties.jwt().refreshTokenDays() * 86400));
        refreshTokenRepository.save(rt);

        return new AuthDtos.AuthResponse(
                access,
                refreshRaw,
                "Bearer",
                appProperties.jwt().accessTokenMinutes() * 60,
                toView(user)
        );
    }

    private AuthDtos.UserView toView(User user) {
        String pName = user.getAddedByName();
        String pPartyCode = user.getAddedByPartyCode();
        if (user.getParentUser() != null) {
            pName = user.getParentUser().getFullName();
            pPartyCode = user.getParentUser().getPartyCode();
        }
        return new AuthDtos.UserView(
                user.getId().toString(),
                user.getUsername(),
                user.getMobile(),
                user.getEmail(),
                user.getFullName(),
                user.getPartyCode(),
                user.getStatus() == null ? null : user.getStatus().name(),
                user.getRegistrationStatus() == null ? RegistrationStatus.APPROVED.name() : user.getRegistrationStatus().name(),
                user.getKycStatus() == null ? KycStatus.NOT_SUBMITTED.name() : user.getKycStatus().name(),
                user.getPinHash() != null && !user.getPinHash().isBlank(),
                user.getRoles().stream().map(r -> r.getName().name()).toList(),
                pName,
                pPartyCode,
                user.getCreatedAt()
        );
    }

    private RoleName resolveSelfRegistrationRole(String raw) {
        if (raw == null || raw.isBlank()) return RoleName.RETAILER;
        String normalized = raw.trim().replace('-', '_').replace(' ', '_').toUpperCase();
        return switch (normalized) {
            case "DISTRIBUTOR" -> RoleName.DISTRIBUTOR;
            case "SUPER_DISTRIBUTOR", "SUPERDISTRIBUTOR" -> RoleName.SUPER_DISTRIBUTOR;
            default -> RoleName.RETAILER;
        };
    }

    private String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to hash token");
        }
    }
}
