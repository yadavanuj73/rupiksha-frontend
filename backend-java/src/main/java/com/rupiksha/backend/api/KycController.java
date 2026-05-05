package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.KycDtos;
import com.rupiksha.backend.domain.KycStatus;
import com.rupiksha.backend.domain.User;
import com.rupiksha.backend.repository.UserRepository;
import com.rupiksha.backend.security.JwtPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/user")
@RequiredArgsConstructor
public class KycController {
    private final UserRepository userRepository;

    @PostMapping("/submit-kyc")
    public KycDtos.KycStatusResponse submitKyc(
            @AuthenticationPrincipal JwtPrincipal principal,
            @Valid @RequestBody KycDtos.SubmitKycRequest request
    ) {
        if (principal == null) throw new IllegalArgumentException("Unauthorized");
        User user = userRepository.findById(UUID.fromString(principal.userId()))
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        user.setAadhaarNumber(request.aadhaarNumber());
        user.setPanNumber(request.panNumber().toUpperCase());
        user.setPhotoUrl(request.photoUrl());
        user.setAadhaarPhotoUrl(request.aadhaarPhotoUrl());
        user.setPanPhotoUrl(request.panPhotoUrl());
        user.setAddressLine1(request.addressLine1());
        user.setCity(request.city());
        user.setStateName(request.state());
        user.setPincode(request.pincode());
        user.setKycStatus(KycStatus.PENDING);
        user.setKycRejectionReason(null);
        user.setKycSubmittedAt(Instant.now());
        user.setKycApprovedAt(null);
        return toStatusResponse(userRepository.save(user));
    }

    @GetMapping("/kyc-status")
    public KycDtos.KycStatusResponse kycStatus(@AuthenticationPrincipal JwtPrincipal principal) {
        if (principal == null) throw new IllegalArgumentException("Unauthorized");
        User user = userRepository.findById(UUID.fromString(principal.userId()))
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return toStatusResponse(user);
    }

    private KycDtos.KycStatusResponse toStatusResponse(User user) {
        return new KycDtos.KycStatusResponse(
                user.getId().toString(),
                user.getStatus().name(),
                user.getKycStatus().name(),
                user.getKycRejectionReason(),
                user.getKycSubmittedAt(),
                user.getKycApprovedAt()
        );
    }
}

