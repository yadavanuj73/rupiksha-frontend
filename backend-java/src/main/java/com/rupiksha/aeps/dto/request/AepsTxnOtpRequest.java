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
public class AepsTxnOtpRequest {

    @NotNull(message = "Transaction amount is required")
    private BigDecimal amount;

    @NotBlank(message = "Service type is required (e.g. CASH_WITHDRAWAL, AADHAAR_PAY, CW, AP)")
    private String serviceType;

    @NotBlank(message = "Bank IIN or Name is required")
    private String bankName;

    @NotBlank(message = "Customer Aadhaar or VID is required")
    private String adhaarNumber;

    private String customerMobile;

    private String mobileNumber;

    private String latitude;

    private String longitude;

    private String requestRemarks;

    private String deviceId;

    private String provider;
}
