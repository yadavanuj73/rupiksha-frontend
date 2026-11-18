package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.api.dto.AdminAuthDtos;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AdminDestinationService {

    public static final String DEST_ID_PHONE_1 = "ADMIN_PHONE_1";
    public static final String DEST_ID_PHONE_2 = "ADMIN_PHONE_2";

    @Value("${admin.auth.phone-1:${ADMIN_PHONE_1:7292987918}}")
    private String adminPhone1;

    @Value("${admin.auth.phone-2:${ADMIN_PHONE_2:9679729762}}")
    private String adminPhone2;

    public List<AdminAuthDtos.AdminDestinationDto> getAvailableDestinations() {
        return List.of(
                new AdminAuthDtos.AdminDestinationDto(DEST_ID_PHONE_1, maskNumber(getPhone1())),
                new AdminAuthDtos.AdminDestinationDto(DEST_ID_PHONE_2, maskNumber(getPhone2()))
        );
    }

    public String resolveDestination(String destinationIdentifier) {
        if (destinationIdentifier == null || destinationIdentifier.isBlank()) {
            throw new IllegalArgumentException("Destination identifier is required.");
        }
        String cleanId = destinationIdentifier.trim().toUpperCase();
        if (DEST_ID_PHONE_1.equals(cleanId)) {
            return getPhone1();
        } else if (DEST_ID_PHONE_2.equals(cleanId)) {
            return getPhone2();
        } else {
            throw new IllegalArgumentException("Invalid destination identifier. Unauthorized destination.");
        }
    }

    public String maskForIdentifier(String destinationIdentifier) {
        if (destinationIdentifier == null || destinationIdentifier.isBlank()) {
            return "XXXXXXX000";
        }
        String cleanId = destinationIdentifier.trim().toUpperCase();
        if (DEST_ID_PHONE_1.equals(cleanId)) {
            return maskNumber(getPhone1());
        } else if (DEST_ID_PHONE_2.equals(cleanId)) {
            return maskNumber(getPhone2());
        }
        return "XXXXXXX000";
    }

    public static String maskNumber(String rawNumber) {
        if (rawNumber == null || rawNumber.isBlank()) {
            return "XXXXXXX000";
        }
        String clean = rawNumber.replaceAll("[^0-9]", "");
        if (clean.length() < 3) {
            return "XXXXXXX000";
        }
        String last3 = clean.substring(clean.length() - 3);
        return "XXXXXXX" + last3;
    }

    private String getPhone1() {
        return (adminPhone1 != null && !adminPhone1.isBlank()) ? adminPhone1.trim() : "7292987918";
    }

    private String getPhone2() {
        return (adminPhone2 != null && !adminPhone2.isBlank()) ? adminPhone2.trim() : "9679729762";
    }
}
