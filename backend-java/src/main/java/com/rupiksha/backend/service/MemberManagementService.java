package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.*;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.*;
import com.rupiksha.backend.security.JwtPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class MemberManagementService {

    private final UserRepository userRepository;
    private final UserServiceRepository userServiceRepository;
    private final WalletRepository walletRepository;
    private final TxnRepository txnRepository;

    public Page<MemberDetailResponse> getAllMembers(Pageable pageable, String search) {
        Page<User> users;
        if (search != null && !search.isEmpty()) {
            users = userRepository.findBySearch(search, pageable);
        } else {
            users = userRepository.findAll(pageable);
        }

        // Batch-load wallets for all users on this page in ONE query (eliminates N+1).
        List<UUID> userIds = users.stream().map(User::getId).collect(Collectors.toList());
        Map<UUID, BigDecimal> walletBalanceMap = walletRepository.findByUserIdIn(userIds)
                .stream()
                .collect(Collectors.toMap(
                        w -> w.getUser().getId(),
                        Wallet::getBalance,
                        (a, b) -> a  // keep first on duplicate
                ));

        return users.map(user -> mapToMemberDetail(user, walletBalanceMap, false));
    }

    public MemberDetailResponse getMemberDetail(UUID userId, boolean includePassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return mapToMemberDetail(user, Collections.emptyMap(), includePassword);
    }

    @Transactional
    public UserServiceDTO toggleUserService(UUID userId, ServiceToggleRequest request, JwtPrincipal admin) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Optional<UserService> existingService = userServiceRepository
                .findByUserIdAndServiceType(userId, request.getServiceType());

        UserService userService;
        if (existingService.isPresent()) {
            userService = existingService.get();
            userService.setIsEnabled(request.getEnable());
            if (request.getEnable()) {
                userService.setEnabledBy(admin.username());
                userService.setEnabledAt(Instant.now());
                userService.setDisabledBy(null);
                userService.setDisabledAt(null);
            } else {
                userService.setDisabledBy(admin.username());
                userService.setDisabledAt(Instant.now());
            }
        } else {
            userService = new UserService();
            userService.setUser(user);
            userService.setServiceType(request.getServiceType());
            userService.setIsEnabled(request.getEnable());
            userService.setEnabledBy(admin.username());
            userService.setEnabledAt(Instant.now());
        }
        
        userService.setRemarks(request.getRemarks());
        UserService saved = userServiceRepository.save(userService);
        
        return mapToUserServiceDTO(saved);
    }

    public List<UserServiceDTO> getUserServices(UUID userId) {
        List<UserService> services = userServiceRepository.findByUserId(userId);
        if (services.isEmpty()) {
            // Initialize default services for user
            return initializeDefaultServices(userId);
        }
        return services.stream()
                .map(this::mapToUserServiceDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public List<UserServiceDTO> initializeDefaultServices(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        
        List<UserService> services = new ArrayList<>();
        for (ServiceType type : ServiceType.values()) {
            UserService service = new UserService();
            service.setUser(user);
            service.setServiceType(type);
            service.setIsEnabled(true);
            service.setEnabledBy("system");
            service.setEnabledAt(Instant.now());
            services.add(userServiceRepository.save(service));
        }
        
        return services.stream()
                .map(this::mapToUserServiceDTO)
                .collect(Collectors.toList());
    }

    private MemberDetailResponse mapToMemberDetail(User user) {
        return mapToMemberDetail(user, Collections.emptyMap(), false);
    }

    /**
     * Maps a User to MemberDetailResponse using a pre-fetched wallet balance map.
     * When the map is empty (e.g. single-user getMemberDetail), falls back to a direct
     * wallet lookup — one query is acceptable for a single-user detail view.
     */
    private MemberDetailResponse mapToMemberDetail(User user, Map<UUID, BigDecimal> walletBalanceMap, boolean includePassword) {
        BigDecimal balance;
        if (walletBalanceMap.containsKey(user.getId())) {
            balance = walletBalanceMap.get(user.getId());
        } else {
            // Fallback for single-user detail view (getMemberDetail)
            balance = walletRepository.findByUserId(user.getId())
                    .map(Wallet::getBalance)
                    .orElse(BigDecimal.ZERO);
        }
        
        // Get last AEPS transaction
        Optional<Txn> lastAepsTxn = txnRepository.findTopByUserIdAndServiceTypeOrderByCreatedAtDesc(
                user.getId(), "AEPS");
            
            // Get total AEPS transaction count
            Integer aepsCount = txnRepository.countByUserIdAndServiceType(user.getId(), "AEPS");
        
        List<UserServiceDTO> services = getUserServices(user.getId());

        MemberDetailResponse.MemberDetailResponseBuilder builder = MemberDetailResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .mobile(user.getMobile())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .status(user.getStatus())
                .kycStatus(user.getKycStatus())
                .aadhaarNumber(user.getAadhaarNumber())
                .panNumber(user.getPanNumber())
                .photoUrl(user.getPhotoUrl())
                .aadhaarPhotoUrl(user.getAadhaarPhotoUrl())
                .panPhotoUrl(user.getPanPhotoUrl())
                .addressLine1(user.getAddressLine1())
                .city(user.getCity())
                .stateName(user.getStateName())
                .pincode(user.getPincode())
                .businessName(user.getBusinessName())
                .partyCode(user.getPartyCode())
                .addedByUserRef(user.getAddedByUserRef())
                .addedByName(user.getAddedByName())
                .addedByRole(user.getAddedByRole())
                .addedByPartyCode(user.getAddedByPartyCode())
                .kycRejectionReason(user.getKycRejectionReason())
                .kycSubmittedAt(user.getKycSubmittedAt())
                .kycApprovedAt(user.getKycApprovedAt())
                .roles(user.getRoles().stream().map(Role::getName).collect(Collectors.toSet()))
                .walletBalance(balance)
                .services(services)
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .totalAepsTxnCount(aepsCount);

        if (lastAepsTxn.isPresent()) {
            builder.lastAepsTxnDate(lastAepsTxn.get().getCreatedAt().toString());
        }

        if (includePassword) {
            builder.password(user.getPasswordHash()); // Note: This should be handled securely
        }

        return builder.build();
    }

    private UserServiceDTO mapToUserServiceDTO(UserService service) {
        return UserServiceDTO.builder()
                .id(service.getId())
                .serviceType(service.getServiceType())
                .isEnabled(service.getIsEnabled())
                .enabledBy(service.getEnabledBy())
                .enabledAt(service.getEnabledAt())
                .disabledBy(service.getDisabledBy())
                .disabledAt(service.getDisabledAt())
                .remarks(service.getRemarks())
                .build();
    }
}
