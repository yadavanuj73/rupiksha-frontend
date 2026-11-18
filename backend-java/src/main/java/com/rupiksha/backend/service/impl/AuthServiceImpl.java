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
    private final RegistrationRateLimiter registrationRateLimiter;
    private final SecureRandom secureRandom = new SecureRandom();

    public AuthServiceImpl(
            UserRepository userRepository,
            RoleRepository roleRepository,
            RefreshTokenRepository refreshTokenRepository,
            WalletRepository walletRepository,
            UserServiceRepository userServiceRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            OtpService otpService,
            AppProperties appProperties
    ) {
        this(userRepository, roleRepository, refreshTokenRepository, walletRepository,
                userServiceRepository, passwordEncoder, jwtService, otpService, appProperties,
                new RegistrationRateLimiter(null));
    }

    @org.springframework.beans.factory.annotation.Autowired
    public AuthServiceImpl(
            UserRepository userRepository,
            RoleRepository roleRepository,
            RefreshTokenRepository refreshTokenRepository,
            WalletRepository walletRepository,
            UserServiceRepository userServiceRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            OtpService otpService,
            AppProperties appProperties,
            @org.springframework.beans.factory.annotation.Autowired(required = false) RegistrationRateLimiter registrationRateLimiter
    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.walletRepository = walletRepository;
        this.userServiceRepository = userServiceRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.otpService = otpService;
        this.appProperties = appProperties;
        this.registrationRateLimiter = registrationRateLimiter != null ? registrationRateLimiter : new RegistrationRateLimiter(null);
    }

    @Override
    @Transactional
    public AuthDtos.AuthResponse login(AuthDtos.LoginRequest request) {
        String identifier = request.username() == null ? "" : request.username().trim();

        User user;
        if (request.role() != null && !request.role().isBlank()) {
            RoleName roleName = resolveRoleForLogin(request.role());
            user = userRepository.findByUsernameAndRole(identifier, roleName)
                    .or(() -> userRepository.findByMobileAndRole(identifier, roleName))
                    .or(() -> userRepository.findByEmailAndRole(identifier, roleName))
                    .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));
        } else {
            user = userRepository.findByUsername(identifier)
                    .or(() -> userRepository.findByMobile(identifier))
                    .or(() -> userRepository.findByEmail(identifier))
                    .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));
        }

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

        // ID Payment Gate Check for Retailers, Distributors, Super Distributors
        boolean isPartnerRole = user.getRoles().stream()
                .anyMatch(r -> r.getName() == RoleName.RETAILER || r.getName() == RoleName.DISTRIBUTOR || r.getName() == RoleName.SUPER_DISTRIBUTOR);

        if (isPartnerRole && user.getIdPaymentStatus() != IdPaymentStatus.SUCCESS) {
            String roleStr = user.getRoles().stream()
                    .map(r -> r.getName().name())
                    .findFirst()
                    .orElse("RETAILER");
            log.warn("Login blocked for user {} ({}): ID Charge payment is {}", user.getUsername(), user.getMobile(), user.getIdPaymentStatus());
            throw new com.rupiksha.backend.service.IdPaymentRequiredException(
                    "ID charge payment is required before portal access.",
                    user.getId().toString(),
                    user.getUsername(),
                    user.getMobile(),
                    user.getFullName(),
                    roleStr,
                    user.getIdPaymentStatus() != null ? user.getIdPaymentStatus().name() : "PENDING"
            );
        }

        boolean isAdmin = user.getRoles().stream()
                .anyMatch(r -> r.getName() == RoleName.ADMIN);
        if (isAdmin) {
            log.warn("Blocked direct login attempt for ADMIN user: {}", user.getUsername());
            throw new IllegalArgumentException("Admin accounts require multi-factor OTP authentication via the admin portal.");
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
        return register(request, "unknown");
    }

    @Override
    @Transactional
    public AuthDtos.UserView register(AuthDtos.RegisterRequest request, String clientIp) {
        if (registrationRateLimiter != null) {
            registrationRateLimiter.checkAndIncrement(clientIp, request.mobile());
        }

        if (!otpService.verifyAndConsumeRegistration(request.mobile(), request.otp())) {
            throw new IllegalArgumentException("Valid mobile OTP verification is required to complete registration. Please verify your mobile number.");
        }

        RoleName roleName = resolveSelfRegistrationRole(request.role());
        Role role = roleRepository.findByName(roleName)
                .orElseThrow(() -> new IllegalArgumentException("Role seed missing: " + roleName));

        if (userRepository.findByMobileAndRole(request.mobile().trim(), roleName).isPresent()) {
            throw new IllegalArgumentException("Mobile number already registered for " + roleName.name().toLowerCase() + " role");
        }
        if (userRepository.findByEmailAndRole(request.email().trim(), roleName).isPresent()) {
            throw new IllegalArgumentException("Email already registered for " + roleName.name().toLowerCase() + " role");
        }

        String targetUsername = request.username().trim();
        if (userRepository.findByUsername(targetUsername).isPresent()) {
            targetUsername = targetUsername + "_" + roleName.name();
            if (userRepository.findByUsername(targetUsername).isPresent()) {
                throw new IllegalArgumentException("Username already exists");
            }
        }

        User user = new User();
        user.setUsername(targetUsername);
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

        // ID Charge Payment Requirement for partner self-registrations
        if (roleName == RoleName.RETAILER || roleName == RoleName.DISTRIBUTOR || roleName == RoleName.SUPER_DISTRIBUTOR) {
            user.setIdPaymentStatus(IdPaymentStatus.PENDING);
        } else {
            user.setIdPaymentStatus(IdPaymentStatus.SUCCESS);
        }

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
        resolveAndSetParent(user, request, roleName);

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

    private User resolveUserForRecovery(String rawMobile, String roleStr) {
        String cleanMobile = rawMobile != null ? rawMobile.trim() : "";
        if (cleanMobile.isBlank()) {
            return null;
        }
        if (roleStr != null && !roleStr.isBlank()) {
            RoleName roleName = resolveRoleForLogin(roleStr);
            List<User> matches = userRepository.findAllByMobileAndRole(cleanMobile, roleName);
            if (matches.size() == 1) {
                return matches.get(0);
            }
            if (matches.size() > 1) {
                log.warn("Multiple accounts found for mobile {} and role {}. Ambiguity detected during recovery.", cleanMobile, roleName);
                return null;
            }
            return null;
        }
        return userRepository.findByMobile(cleanMobile).orElse(null);
    }

    @Override
    @Transactional
    public OtpDtos.OtpResponse forgotPasswordSendOtp(AuthDtos.ForgotPasswordRequest request) {
        User user = resolveUserForRecovery(request.mobile(), request.role());
        if (user == null) {
            // Anti-enumeration: do not reveal whether account exists
            return new OtpDtos.OtpResponse(true, "If an eligible Rupiksha account exists for this mobile number, an OTP will be sent.");
        }
        return otpService.sendOtp(new OtpDtos.SendOtpRequest(user.getMobile()));
    }

    @Override
    @Transactional
    public OtpDtos.OtpResponse resetPassword(AuthDtos.ResetPasswordRequest request) {
        User user = resolveUserForRecovery(request.mobile(), request.role());
        if (user == null) {
            return new OtpDtos.OtpResponse(false, "Invalid request or mobile number");
        }

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
        User user = resolveUserForRecovery(request.mobile(), request.role());
        if (user == null) {
            // Anti-enumeration: do not reveal whether account exists
            return new OtpDtos.OtpResponse(true, "If an eligible Rupiksha account exists for this mobile number, an OTP will be sent.");
        }
        return otpService.sendOtp(new OtpDtos.SendOtpRequest(user.getMobile()));
    }

    @Override
    @Transactional
    public OtpDtos.OtpResponse resetPin(AuthDtos.ResetPinRequest request) {
        User user = resolveUserForRecovery(request.mobile(), request.role());
        if (user == null) {
            return new OtpDtos.OtpResponse(false, "Invalid request or mobile number");
        }

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

    private void resolveAndSetParent(User user, AuthDtos.RegisterRequest request, RoleName childRole) {
        String parentRef = null;
        if (isPresent(request.parentUserId())) {
            parentRef = request.parentUserId().trim();
        } else if (isPresent(request.addedByUserRef())) {
            parentRef = request.addedByUserRef().trim();
        } else if (isPresent(request.addedByPartyCode())) {
            parentRef = request.addedByPartyCode().trim();
        }

        if (parentRef != null) {
            User parent = findParentByRef(parentRef);
            if (parent == null) {
                throw new IllegalArgumentException("Specified parent user does not exist.");
            }

            if ((user.getMobile() != null && user.getMobile().equals(parent.getMobile()))
                    || (user.getEmail() != null && user.getEmail().equalsIgnoreCase(parent.getEmail()))) {
                throw new IllegalArgumentException("User cannot be their own parent in the hierarchy.");
            }

            // Ensure parent is active or approved
            if (parent.getStatus() != UserStatus.ACTIVE && parent.getStatus() != UserStatus.APPROVED) {
                throw new IllegalArgumentException("Specified parent user is not active or approved.");
            }

            // Validate role compatibility
            RoleName parentRole = parent.getRoles().stream()
                    .map(Role::getName)
                    .findFirst()
                    .orElse(RoleName.RETAILER);

            validateHierarchyCompatibility(childRole, parentRole);

            user.setParentUser(parent);
            user.setAddedByUserRef(parent.getId().toString());
            user.setAddedByName(parent.getFullName());
            user.setAddedByPartyCode(parent.getPartyCode());
            user.setAddedByRole(parentRole.name());
        }

        if (isPresent(request.addedByName()) && user.getAddedByName() == null) {
            user.setAddedByName(request.addedByName().trim());
        }
        if (isPresent(request.addedByPartyCode()) && user.getAddedByPartyCode() == null) {
            user.setAddedByPartyCode(request.addedByPartyCode().trim());
        }
        if (isPresent(request.addedByRole()) && user.getAddedByRole() == null) {
            user.setAddedByRole(request.addedByRole().trim());
        }
    }

    private User findParentByRef(String ref) {
        try {
            UUID id = UUID.fromString(ref);
            java.util.Optional<User> byId = userRepository.findById(id);
            if (byId.isPresent()) return byId.get();
        } catch (Exception ignored) {
            // Not a UUID, try lookup by partyCode, mobile, or username
        }
        return userRepository.findByPartyCode(ref)
                .or(() -> userRepository.findByMobile(ref))
                .or(() -> userRepository.findByUsername(ref))
                .orElse(null);
    }

    private void validateHierarchyCompatibility(RoleName childRole, RoleName parentRole) {
        boolean valid = switch (childRole) {
            case RETAILER -> parentRole == RoleName.DISTRIBUTOR
                    || parentRole == RoleName.SUPER_DISTRIBUTOR
                    || parentRole == RoleName.ADMIN;
            case DISTRIBUTOR -> parentRole == RoleName.SUPER_DISTRIBUTOR
                    || parentRole == RoleName.ADMIN;
            case SUPER_DISTRIBUTOR -> parentRole == RoleName.ADMIN;
            default -> false;
        };

        if (!valid) {
            throw new IllegalArgumentException("Parent with role " + parentRole + " cannot sponsor a " + childRole + " account.");
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
            case ADMIN -> "RPADM";
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

        // 28 States & 8 UTs mapping
        if (upper.contains("BIHAR") || upper.contains("MUZAFFARPUR") || upper.contains("PATNA") || upper.contains("NALANDA") || upper.contains("GAYA") || upper.contains("BHAGALPUR") || upper.contains("DARBHANGA") || upper.contains("PURNEA")) return "BR";
        if (upper.contains("MAHARASHTRA") || upper.contains("MUMBAI") || upper.contains("PUNE") || upper.contains("NAGPUR") || upper.contains("THANE") || upper.contains("NASHIK")) return "MH";
        if (upper.contains("UTTAR PRADESH") || upper.contains("LUCKNOW") || upper.contains("KANPUR") || upper.contains("NOIDA") || upper.contains("VARANASI") || upper.contains("AGRA") || upper.contains("PRAYAGRAJ") || upper.contains("GHAZIABAD")) return "UP";
        if (upper.contains("DELHI") || upper.contains("NEW DELHI") || upper.contains("NCT")) return "DL";
        if (upper.contains("WEST BENGAL") || upper.contains("BENGAL") || upper.contains("KOLKATA") || upper.contains("HOWRAH") || upper.contains("SILIGURI")) return "WB";
        if (upper.contains("RAJASTHAN") || upper.contains("JAIPUR") || upper.contains("JODHPUR") || upper.contains("UDAIPUR") || upper.contains("KOTA")) return "RJ";
        if (upper.contains("PUNJAB") || upper.contains("LUDHIANA") || upper.contains("AMRITSAR") || upper.contains("JALANDHAR")) return "PB";
        if (upper.contains("HARYANA") || upper.contains("GURGAON") || upper.contains("GURUGRAM") || upper.contains("FARIDABAD") || upper.contains("PANIPAT")) return "HR";
        if (upper.contains("GUJARAT") || upper.contains("SURAT") || upper.contains("AHMEDABAD") || upper.contains("VADODARA") || upper.contains("RAJKOT")) return "GJ";
        if (upper.contains("KARNATAKA") || upper.contains("BANGALORE") || upper.contains("BENGALURU") || upper.contains("MYSORE") || upper.contains("MYSURU")) return "KA";
        if (upper.contains("TAMIL NADU") || upper.contains("CHENNAI") || upper.contains("COIMBATORE") || upper.contains("MADURAI")) return "TN";
        if (upper.contains("TELANGANA") || upper.contains("HYDERABAD") || upper.contains("WARANGAL")) return "TS";
        if (upper.contains("ANDHRA") || upper.contains("VISAKHAPATNAM") || upper.contains("VIJAYAWADA")) return "AP";
        if (upper.contains("MADHYA PRADESH") || upper.contains("INDORE") || upper.contains("BHOPAL") || upper.contains("GWALIOR") || upper.contains("JABALPUR")) return "MP";
        if (upper.contains("ODISHA") || upper.contains("ORISSA") || upper.contains("BHUBANESWAR") || upper.contains("CUTTACK")) return "OD";
        if (upper.contains("JHARKHAND") || upper.contains("RANCHI") || upper.contains("JAMSHEDPUR") || upper.contains("DHANBAD")) return "JH";
        if (upper.contains("CHHATTISGARH") || upper.contains("RAIPUR") || upper.contains("BILASPUR")) return "CG";
        if (upper.contains("ASSAM") || upper.contains("GUWAHATI") || upper.contains("DISPUR")) return "AS";
        if (upper.contains("KERALA") || upper.contains("KOCHI") || upper.contains("THIRUVANANTHAPURAM") || upper.contains("TRIVANDRUM")) return "KL";
        if (upper.contains("UTTARAKHAND") || upper.contains("UTTARANCHAL") || upper.contains("DEHRADUN") || upper.contains("HARIDWAR")) return "UK";
        if (upper.contains("HIMACHAL") || upper.contains("SHIMLA")) return "HP";
        if (upper.contains("JAMMU") || upper.contains("KASHMIR") || upper.contains("SRINAGAR")) return "JK";
        if (upper.contains("GOA") || upper.contains("PANAJI")) return "GA";
        if (upper.contains("MANIPUR") || upper.contains("IMPHAL")) return "MN";
        if (upper.contains("MEGHALAYA") || upper.contains("SHILLONG")) return "ML";
        if (upper.contains("MIZORAM") || upper.contains("AIZAWL")) return "MZ";
        if (upper.contains("NAGALAND") || upper.contains("KOHIMA")) return "NL";
        if (upper.contains("SIKKIM") || upper.contains("GANGTOK")) return "SK";
        if (upper.contains("TRIPURA") || upper.contains("AGARTALA")) return "TR";
        if (upper.contains("ARUNACHAL") || upper.contains("ITANAGAR")) return "AR";
        if (upper.contains("PUDUCHERRY") || upper.contains("PONDICHERRY")) return "PY";
        if (upper.contains("CHANDIGARH")) return "CH";
        if (upper.contains("LADAKH") || upper.contains("LEH")) return "LA";
        if (upper.contains("ANDAMAN") || upper.contains("NICOBAR") || upper.contains("PORT BLAIR")) return "AN";
        if (upper.contains("DADRA") || upper.contains("DAMAN") || upper.contains("DIU")) return "DN";
        if (upper.contains("LAKSHADWEEP") || upper.contains("KAVARATTI")) return "LD";

        return "BR";
    }

    private boolean isPresent(String value) {
        return value != null && !value.isBlank();
    }

    private AuthDtos.AuthResponse issueTokens(User user) {
        List<String> roles = user.getRoles().stream().map(r -> r.getName().name()).toList();
        boolean isAdmin = user.getRoles().stream().anyMatch(r -> r.getName() == RoleName.ADMIN);
        String access;
        if (isAdmin) {
            access = jwtService.createAccessToken(user.getId(), user.getUsername(), roles, user.getAdminSessionVersion());
        } else {
            access = jwtService.createAccessToken(user.getId(), user.getUsername(), roles);
        }
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
                user.getIdPaymentStatus() == null ? IdPaymentStatus.SUCCESS.name() : user.getIdPaymentStatus().name(),
                user.getPinHash() != null && !user.getPinHash().isBlank(),
                user.getRoles().stream().map(r -> r.getName().name()).toList(),
                pName,
                pPartyCode,
                user.getCreatedAt(),
                user.getPhotoUrl()
        );
    }

    private RoleName resolveSelfRegistrationRole(String raw) {
        if (raw == null || raw.isBlank()) return RoleName.RETAILER;
        String normalized = raw.trim().replace('-', '_').replace(' ', '_').toUpperCase(java.util.Locale.ROOT);
        if ("ADMIN".equals(normalized) || "SUPER_ADMIN".equals(normalized) || "SYSTEM_ADMIN".equals(normalized) || "DEVELOPER".equals(normalized)) {
            log.warn("Security Alert: Blocked attempt to self-register privileged role: {}", normalized);
            throw new IllegalArgumentException("Admin accounts cannot be self-registered.");
        }
        return switch (normalized) {
            case "DISTRIBUTOR" -> RoleName.DISTRIBUTOR;
            case "SUPER_DISTRIBUTOR", "SUPERDISTRIBUTOR" -> RoleName.SUPER_DISTRIBUTOR;
            case "RETAILER" -> RoleName.RETAILER;
            default -> throw new IllegalArgumentException("Invalid registration role: " + raw);
        };
    }

    private RoleName resolveRoleForLogin(String raw) {
        if (raw == null || raw.isBlank()) return RoleName.RETAILER;
        String normalized = raw.trim().replace('-', '_').replace(' ', '_').toUpperCase(java.util.Locale.ROOT);
        return switch (normalized) {
            case "ADMIN" -> RoleName.ADMIN;
            case "DISTRIBUTOR" -> RoleName.DISTRIBUTOR;
            case "SUPER_DISTRIBUTOR", "SUPERDISTRIBUTOR" -> RoleName.SUPER_DISTRIBUTOR;
            case "RETAILER" -> RoleName.RETAILER;
            default -> RoleName.RETAILER;
        };
    }

    @Override
    @Transactional
    public AuthDtos.AuthResponse issueTokensForUser(User user) {
        return issueTokens(user);
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
