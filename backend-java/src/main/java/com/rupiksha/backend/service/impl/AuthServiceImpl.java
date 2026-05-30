package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.AuthDtos;
import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.domain.KycStatus;
import com.rupiksha.backend.repository.RefreshTokenRepository;
import com.rupiksha.backend.repository.RoleRepository;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.security.JwtService;
import com.rupiksha.backend.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AppProperties appProperties;

    @Override
    @Transactional
    public AuthDtos.AuthResponse login(AuthDtos.LoginRequest request) {
        String identifier = request.username() == null ? "" : request.username().trim();

        // Allow login with username OR mobile OR email so retailers/distributors can
        // use whichever identifier admin shared with them.
        User user = userRepository.findByUsername(identifier)
                .or(() -> userRepository.findByMobile(identifier))
                .or(() -> userRepository.findByEmail(identifier))
                .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid credentials");
        }
        if (user.getStatus() != UserStatus.APPROVED && user.getStatus() != UserStatus.ACTIVE) {
            throw new IllegalArgumentException("User is not approved");
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
            throw new IllegalArgumentException("Mobile already exists");
        }
        if (userRepository.findByEmail(request.email()).isPresent()) {
            throw new IllegalArgumentException("Email already exists");
        }

        // Self-registration is allowed for RETAILER, DISTRIBUTOR, and SUPER_DISTRIBUTOR
        // so each applicant lands in the correct approval bucket on the admin panel.
        // ADMIN (and any unknown role) is NEVER honored — forced to RETAILER to block
        // privilege escalation. Every applicant starts in PENDING status and must be
        // approved by an existing admin via /admin/approvals before they can log in.
        RoleName roleName = resolveSelfRegistrationRole(request.role());

        Role role = roleRepository.findByName(roleName)
                .orElseThrow(() -> new IllegalArgumentException("Role seed missing: " + roleName));

        User user = new User();
        user.setUsername(request.username());
        user.setMobile(request.mobile());
        user.setEmail(request.email());
        user.setFullName(request.fullName());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setStatus(UserStatus.PENDING);
        user.getRoles().add(role);

        // Persist optional profile attributes so the admin approval screen can
        // read them back without a second round-trip. These flow straight from
        // the portal / distributor / super-distributor registration forms.
        if (isPresent(request.state())) user.setStateName(request.state().trim());
        if (isPresent(request.city())) user.setCity(request.city().trim());
        if (isPresent(request.pincode())) user.setPincode(request.pincode().trim());
        if (isPresent(request.address())) user.setAddressLine1(request.address().trim());
        if (isPresent(request.businessName())) user.setBusinessName(request.businessName().trim());
        if (isPresent(request.addedByUserRef())) user.setAddedByUserRef(request.addedByUserRef().trim());
        if (isPresent(request.addedByName())) user.setAddedByName(request.addedByName().trim());
        if (isPresent(request.addedByRole())) user.setAddedByRole(request.addedByRole().trim());
        if (isPresent(request.addedByPartyCode())) user.setAddedByPartyCode(request.addedByPartyCode().trim());

        User saved = userRepository.save(user);
        return toView(saved);
    }

    private boolean isPresent(String value) {
        return value != null && !value.isBlank();
    }

    @Override
    @Transactional
    public void logout(String refreshToken) {
        refreshTokenRepository.findByTokenHash(sha256(refreshToken)).ifPresent(token -> {
            token.setRevoked(true);
            refreshTokenRepository.save(token);
        });
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
        return new AuthDtos.UserView(
                user.getId().toString(),
                user.getUsername(),
                user.getMobile(),
                user.getEmail(),
                user.getFullName(),
                user.getStatus() == null ? null : user.getStatus().name(),
                user.getKycStatus() == null ? KycStatus.NOT_SUBMITTED.name() : user.getKycStatus().name(),
                user.getRoles().stream().map(r -> r.getName().name()).toList(),
                user.getCreatedAt()
        );
    }

    /**
     * Map a client-supplied role string to the set of roles a user is allowed to
     * request for themselves. Anything unrecognised (or ADMIN) silently becomes
     * RETAILER, so a malicious payload can never escalate privileges.
     */
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

