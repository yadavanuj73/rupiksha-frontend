package com.rupiksha.backend.api.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

public class RetailerServiceDtos {
    public record AepsTxnRequest(
            @NotBlank String userId,
            @NotBlank String tab,
            @NotBlank String mobile,
            @NotBlank String operator,
            String bankName,
            @NotNull @DecimalMin("0.00") BigDecimal amount
    ) {}

    public record BbpsFetchRequest(
            @NotBlank String userId,
            @NotBlank String biller,
            @NotBlank String opcode,
            @NotBlank String consumerNo,
            String category
    ) {}

    public record BbpsPayRequest(
            @NotBlank String userId,
            @NotBlank String biller,
            @NotBlank String opcode,
            @NotBlank String consumerNo,
            @NotNull @DecimalMin("1.00") BigDecimal amount,
            String category
    ) {}

    public record TicketCreateRequest(
            @NotBlank String userId,
            @NotBlank String subject,
            @NotBlank String description,
            String priority
    ) {}

    public record TicketResponse(
            String id,
            String userId,
            String subject,
            String description,
            String status,
            String priority,
            Instant createdAt
    ) {}

    public record TxnLogRequest(
            @NotBlank String userId,
            @NotBlank String service,
            @NotNull @DecimalMin("0.00") BigDecimal amount,
            String operator,
            String number,
            String status
    ) {}

    public record GenericTxnResponse(boolean success, String txid, String message, BigDecimal balance, Map<String, Object> raw) {}
    public record BillFetchResponse(boolean success, String message, Map<String, Object> bill) {}
    public record TicketListResponse(boolean success, List<TicketResponse> tickets) {}
}
