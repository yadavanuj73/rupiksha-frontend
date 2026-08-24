package com.rupiksha.aeps.provider.fingpay.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FingpayTxnOtpRequestDTO {
    private Long uid;
    private String transactionType; // "CO" for CW OTP, "MO" for AP OTP
    private String serviceType;     // "CW" for CW OTP, "AP" for AP OTP
    private String mobileNumber;    // Customer mobile number
    private Double latitude;
    private Double longitude;
    private String requestRemarks;
    private String paymentType;     // "AEPS"
    private String merchantTransactionId;
    private Integer superMerchantId;
    private String merchantUserName;
    private String merchantPin;
    private Double transactionAmount;
    private String bankId;          // FingBank ID or IIN
    private String adhaarNumber;
    private String virtualId;
    private String deviceId;
}
