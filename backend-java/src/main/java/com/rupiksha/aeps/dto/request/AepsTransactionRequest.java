package com.rupiksha.aeps.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AepsTransactionRequest {

    @NotNull(message = "Transaction amount is required")
    private BigDecimal amount;

    @NotBlank(message = "Service type is required")
    private String serviceType; // e.g. CASH_WITHDRAWAL, BALANCE_INQUIRY, MINI_STATEMENT, AADHAAR_PAY

    @NotBlank(message = "Bank IIN or Name is required")
    private String bankName; // or iin

    @NotBlank(message = "Aadhaar number is required")
    private String adhaarNumber;

    @NotBlank(message = "PID XML is required")
    private String pidXml;

    @Builder.Default
    private String biometricType = "FMR";

    private String latitude;

    private String longitude;

    private String mobileNumber;

    private String customerMobile;

    private String requestRemarks;

    private String deviceId;

    private String ipAddress;

    private String transactionId; // Optional: Client-provided reference

    private String provider;
}

