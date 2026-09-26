package com.rupiksha.backend.api;

import com.rupiksha.backend.api.dto.CertificateDto;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.CertificateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@Slf4j
@RestController
@RequestMapping("/api/v1/certificates")
@RequiredArgsConstructor
public class CertificateController {

    private final CertificateService certificateService;

    /**
     * Get certificate for the currently authenticated user (Distributor or Super Distributor)
     */
    @GetMapping("/me")
    public ResponseEntity<?> getMyCertificate(@AuthenticationPrincipal JwtPrincipal principal) {
        if (principal == null || principal.userId() == null) {
            return ResponseEntity.status(401).body(Map.of("success", false, "message", "Unauthorized"));
        }
        try {
            UUID userId = UUID.fromString(principal.userId());
            CertificateDto dto = certificateService.getCertificateForUser(userId);
            return ResponseEntity.ok(Map.of("success", true, "certificate", dto));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to get certificate for user {}: ", principal.userId(), e);
            return ResponseEntity.internalServerError().body(Map.of("success", false, "message", "Internal server error"));
        }
    }

    /**
     * Public verification endpoint (accessible without login)
     */
    @GetMapping("/verify/{certificateNumber}")
    public ResponseEntity<?> verifyCertificate(@PathVariable String certificateNumber) {
        try {
            CertificateDto dto = certificateService.verifyCertificate(certificateNumber);
            return ResponseEntity.ok(Map.of("success", true, "verified", true, "certificate", dto));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("success", false, "verified", false, "message", e.getMessage()));
        } catch (Exception e) {
            log.error("Verification failed for cert {}: ", certificateNumber, e);
            return ResponseEntity.internalServerError().body(Map.of("success", false, "message", "Verification service error"));
        }
    }

    /**
     * Lookup certificate by Party Code (Admin or authorized)
     */
    @GetMapping("/{partyCode}")
    public ResponseEntity<?> getCertificateByPartyCode(
            @AuthenticationPrincipal JwtPrincipal principal,
            @PathVariable String partyCode
    ) {
        try {
            CertificateDto dto = certificateService.getCertificateByPartyCode(partyCode);
            // Cross-user access check: If not ADMIN, only allow lookup for self partyCode
            if (principal != null && !principal.roles().contains("ADMIN")) {
                if (!dto.getPartyCode().equalsIgnoreCase(partyCode)) {
                    return ResponseEntity.status(403).body(Map.of("success", false, "message", "Access denied"));
                }
            }
            return ResponseEntity.ok(Map.of("success", true, "certificate", dto));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("success", false, "message", e.getMessage()));
        }
    }
}
