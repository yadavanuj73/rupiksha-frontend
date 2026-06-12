package com.payout.payout.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonPropertyOrder({
    "PayoutPipe", "OrderId", "Amount", "BeneficiaryName",
    "AccountNumber", "Ifsc", "BankName", "TransferMode",
    "Remarks", "MobileNumber", "AccountType"
})
public class PayoutRequest {

    @JsonProperty("PayoutPipe")
    private String payoutPipe;

    @JsonProperty("OrderId")
    private String orderId;

    @JsonProperty("Amount")
    private double amount;

    @JsonProperty("BeneficiaryName")
    private String beneficiaryName;

    @JsonProperty("AccountNumber")
    private String accountNumber;

    @JsonProperty("Ifsc")
    private String ifsc;

    @JsonProperty("BankName")
    private String bankName;

    @JsonProperty("TransferMode")
    private String transferMode;

    @JsonProperty("Remarks")
    private String remarks;

    @JsonProperty("MobileNumber")
    private String mobileNumber;

    @JsonProperty("AccountType")
    private String accountType;
}
