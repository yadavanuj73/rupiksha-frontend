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
import com.rupiksha.backend.repository.UserServiceRepository;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/user")
@RequiredArgsConstructor
public class KycController {
    private final UserRepository userRepository;
    private final UserServiceRepository userServiceRepository;

    @GetMapping("/profile")
    public Map<String, Object> getProfile(@AuthenticationPrincipal JwtPrincipal principal) {
        if (principal == null) throw new IllegalArgumentException("Unauthorized");
        User user = userRepository.findById(UUID.fromString(principal.userId()))
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        String primaryRole = user.getRoles().stream()
                .map(r -> r.getName().name())
                .findFirst()
                .orElse("RETAILER");

        Map<String, Object> profile = new HashMap<>();
        profile.put("id", user.getId().toString());
        profile.put("username", user.getUsername());
        profile.put("fullName", user.getFullName());
        profile.put("email", user.getEmail());
        profile.put("mobile", user.getMobile());
        profile.put("role", primaryRole);
        profile.put("status", user.getStatus() != null ? user.getStatus().name() : "PENDING");
        profile.put("kycStatus", user.getKycStatus() != null ? user.getKycStatus().name() : "NOT_SUBMITTED");
        profile.put("partyCode", user.getPartyCode());
        profile.put("businessName", user.getBusinessName());
        profile.put("createdAt", user.getCreatedAt());
        return Map.of("success", true, "user", profile);
    }

    @GetMapping("/services")
    public Map<String, Boolean> getUserServices(@AuthenticationPrincipal JwtPrincipal principal) {
        if (principal == null) throw new IllegalArgumentException("Unauthorized");
        UUID userId = UUID.fromString(principal.userId());
        List<com.rupiksha.backend.domain.UserService> services = userServiceRepository.findByUserId(userId);
        Map<String, Boolean> statusMap = new HashMap<>();
        for (com.rupiksha.backend.domain.UserService s : services) {
            statusMap.put(s.getServiceType().name(), s.getIsEnabled());
        }
        for (com.rupiksha.backend.domain.ServiceType type : com.rupiksha.backend.domain.ServiceType.values()) {
            if (!statusMap.containsKey(type.name())) {
                boolean def = switch (type) {
                    case AEPS, BBPS, PAYOUT, DMT -> false;
                    default -> true;
                };
                statusMap.put(type.name(), def);
            }
        }
        return statusMap;
    }

    @PostMapping("/submit-kyc")
    public KycDtos.KycStatusResponse submitKyc(
            @AuthenticationPrincipal JwtPrincipal principal,
            @Valid @RequestBody KycDtos.SubmitKycRequest request
    ) {
        if (principal == null) throw new IllegalArgumentException("Unauthorized");
        User user = userRepository.findById(UUID.fromString(principal.userId()))
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // Section 1: Personal Details
        if (isPresent(request.fullName())) user.setFullName(request.fullName().trim());
        if (isPresent(request.fatherName())) user.setFatherName(request.fatherName().trim());
        if (isPresent(request.email())) user.setEmail(request.email().trim());
        if (isPresent(request.dob())) user.setDob(request.dob().trim());
        if (isPresent(request.gender())) user.setGender(request.gender().trim());

        // Section 2: Business Details
        if (isPresent(request.shopName())) user.setBusinessName(request.shopName().trim());
        else if (isPresent(request.businessName())) user.setBusinessName(request.businessName().trim());
        if (isPresent(request.businessType())) user.setBusinessType(request.businessType().trim());
        if (isPresent(request.gstNumber())) user.setGstNumber(request.gstNumber().trim().toUpperCase());

        // Section 3: Shop Address
        if (isPresent(request.shopAddress())) user.setShopAddress(request.shopAddress().trim());
        if (isPresent(request.shopLandmark())) user.setShopLandmark(request.shopLandmark().trim());
        if (isPresent(request.shopState())) user.setShopState(request.shopState().trim());
        else if (isPresent(request.state())) user.setShopState(request.state().trim());
        if (isPresent(request.shopDistrict())) user.setShopDistrict(request.shopDistrict().trim());
        if (isPresent(request.shopCity())) user.setShopCity(request.shopCity().trim());
        else if (isPresent(request.city())) user.setShopCity(request.city().trim());
        if (isPresent(request.shopPincode())) user.setShopPincode(request.shopPincode().trim());
        else if (isPresent(request.pincode())) user.setShopPincode(request.pincode().trim());

        // Fallback for general address fields
        if (isPresent(request.addressLine1())) user.setAddressLine1(request.addressLine1().trim());
        else if (isPresent(request.shopAddress())) user.setAddressLine1(request.shopAddress().trim());
        if (isPresent(request.city())) user.setCity(request.city().trim());
        if (isPresent(request.state())) user.setStateName(request.state().trim());
        if (isPresent(request.pincode())) user.setPincode(request.pincode().trim());

        // Section 4: Permanent Address
        if (isPresent(request.permanentAddress())) user.setPermanentAddress(request.permanentAddress().trim());
        if (isPresent(request.permState())) user.setPermState(request.permState().trim());
        if (isPresent(request.permDistrict())) user.setPermDistrict(request.permDistrict().trim());
        if (isPresent(request.permCity())) user.setPermCity(request.permCity().trim());
        if (isPresent(request.permPincode())) user.setPermPincode(request.permPincode().trim());

        // Section 5: Identity Details
        if (isPresent(request.aadhaarNumber())) user.setAadhaarNumber(request.aadhaarNumber().trim());
        if (isPresent(request.panNumber())) user.setPanNumber(request.panNumber().trim().toUpperCase());

        // Section 6: Bank Details
        if (isPresent(request.bankAccountHolder())) user.setBankAccountHolder(request.bankAccountHolder().trim());
        if (isPresent(request.bankName())) user.setBankName(request.bankName().trim());
        if (isPresent(request.bankAccountNumber())) user.setBankAccountNumber(request.bankAccountNumber().trim());
        if (isPresent(request.bankIfsc())) user.setBankIfsc(request.bankIfsc().trim().toUpperCase());
        if (isPresent(request.bankBranch())) user.setBankBranch(request.bankBranch().trim());

        // Section 7: Documents
        if (isPresent(request.photoUrl())) user.setPhotoUrl(request.photoUrl());
        if (isPresent(request.aadhaarPhotoUrl())) user.setAadhaarPhotoUrl(request.aadhaarPhotoUrl());
        if (isPresent(request.aadhaarBackPhotoUrl())) user.setAadhaarBackPhotoUrl(request.aadhaarBackPhotoUrl());
        if (isPresent(request.panPhotoUrl())) user.setPanPhotoUrl(request.panPhotoUrl());
        if (isPresent(request.bankPassbookUrl())) user.setBankPassbookUrl(request.bankPassbookUrl());
        if (isPresent(request.shopPhotoUrl())) user.setShopPhotoUrl(request.shopPhotoUrl());
        if (isPresent(request.drivingLicenceUrl())) user.setDrivingLicenceUrl(request.drivingLicenceUrl());
        if (isPresent(request.voterIdUrl())) user.setVoterIdUrl(request.voterIdUrl());
        if (isPresent(request.passportUrl())) user.setPassportUrl(request.passportUrl());

        // Section 8: Live Verification & GPS
        if (isPresent(request.liveSelfieUrl())) user.setLiveSelfieUrl(request.liveSelfieUrl());
        if (isPresent(request.gpsLat())) user.setGpsLat(request.gpsLat().trim());
        if (isPresent(request.gpsLong())) user.setGpsLong(request.gpsLong().trim());
        if (isPresent(request.gpsTimestamp())) {
            try { user.setGpsTimestamp(Instant.parse(request.gpsTimestamp().trim())); }
            catch (Exception e) { user.setGpsTimestamp(Instant.now()); }
        } else {
            user.setGpsTimestamp(Instant.now());
        }
        if (isPresent(request.deviceInfo())) user.setDeviceInfo(request.deviceInfo().trim());

        // Update status to PENDING_ADMIN_APPROVAL
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

    private boolean isPresent(String val) {
        return val != null && !val.isBlank();
    }

    private KycDtos.KycStatusResponse toStatusResponse(User user) {
        return new KycDtos.KycStatusResponse(
                user.getId().toString(),
                user.getStatus() == null ? null : user.getStatus().name(),
                user.getKycStatus() == null ? KycStatus.NOT_SUBMITTED.name() : user.getKycStatus().name(),
                user.getKycRejectionReason(),
                user.getKycSubmittedAt(),
                user.getKycApprovedAt()
        );
    }
}
