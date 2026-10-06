package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.IdPaymentDtos;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.IdPaymentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/admin/id-payment")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'SUPER_DISTRIBUTOR', 'DISTRIBUTOR')")
public class AdminIdPaymentController {

    private final IdPaymentService idPaymentService;

    @GetMapping("/pending")
    public ResponseEntity<Map<String, Object>> getPendingUsers() {
        List<IdPaymentDtos.PendingPaymentUserView> users = idPaymentService.getPendingUsers();
        return ResponseEntity.ok(Map.of(
                "success", true,
                "count", users.size(),
                "users", users
        ));
    }

    @GetMapping("/success")
    public ResponseEntity<Map<String, Object>> getSuccessUsers() {
        List<IdPaymentDtos.SuccessPaymentUserView> users = idPaymentService.getSuccessUsers();
        return ResponseEntity.ok(Map.of(
                "success", true,
                "count", users.size(),
                "users", users
        ));
    }

    @PostMapping("/coupon")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<IdPaymentDtos.CouponResponse> generateCoupon(
            @Valid @RequestBody IdPaymentDtos.GenerateCouponRequest request,
            @AuthenticationPrincipal JwtPrincipal principal
    ) {
        String adminUsername = principal != null ? principal.username() : "admin";
        IdPaymentDtos.CouponResponse res = idPaymentService.generateCoupon(
                UUID.fromString(request.userId()),
                request.discountPercent(),
                adminUsername
        );
        return ResponseEntity.ok(res);
    }

    @GetMapping("/user/{identifier}")
    public ResponseEntity<IdPaymentDtos.PaymentDetailsResponse> getUserPaymentDetails(@PathVariable String identifier) {
        return ResponseEntity.ok(idPaymentService.getPaymentDetails(identifier));
    }
}
