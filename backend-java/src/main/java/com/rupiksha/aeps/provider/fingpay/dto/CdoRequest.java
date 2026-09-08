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
public class CdoRequest {
    private String mobileNumber;
    private String iin;
    private String bankName;
    private String accountNumber;
    private BigDecimal amount;
    private String requestRemarks;
    private String latitude;
    private String longitude;
    private String deviceId;
    private String merchantTranId;
    
    // 2nd and 3rd leg parameters
    private String fingpayTransactionId;
    private String otp;
    private Integer cdPkId;
}
