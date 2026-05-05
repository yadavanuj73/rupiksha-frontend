package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.domain.KycStatus;
import com.rupiksha.backend.domain.User;
import com.rupiksha.backend.domain.UserStatus;
import com.rupiksha.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
@RequiredArgsConstructor
public class KycAccessGuard {
    private final UserRepository userRepository;

    public User requireServiceEnabledUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (user.getStatus() != UserStatus.APPROVED && user.getStatus() != UserStatus.ACTIVE) {
            throw new IllegalArgumentException("User registration is not approved");
        }
        if (user.getKycStatus() != KycStatus.APPROVED) {
            throw new IllegalArgumentException("KYC approval required before using services");
        }
        return user;
    }
}

