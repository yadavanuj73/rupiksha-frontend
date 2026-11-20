package com.rupiksha.aeps.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class BusstoPayoutWebhookDto {

    @JsonAlias({"external_order_id", "orderId", "order_id", "client_order_id", "client_ref_id", "externalOrderId"})
    private String orderId;

    @JsonAlias({"bbTransactionId", "bb_transaction_id", "transaction_id", "transactionId", "provider_txn_id", "providerTxnId", "reference_id", "referenceId"})
    private String providerTxnId;

    @JsonAlias({"bbTransactionStatus", "bb_transaction_status", "status", "txnStatus", "transaction_status", "event"})
    private String status;

    @JsonAlias({"amount", "txnAmount", "transaction_amount", "transfer_amount"})
    private BigDecimal amount;

    @JsonAlias({"bbUtrNumber", "bb_utr_number", "utr", "utrNumber", "rrn"})
    private String utr;

    @JsonAlias({"bbReason", "bb_reason", "reason", "message", "msg", "error", "bbStatusMsg", "failureReason"})
    private String reason;

    @JsonAlias({"bbStatusCode", "statusCode", "code"})
    private String statusCode;

    @JsonAlias({"currency", "curr"})
    private String currency;

    @JsonAlias({"eventId", "event_id", "callback_id", "id"})
    private String eventId;

    @JsonAlias({"timestamp", "created_at", "event_time"})
    private String timestamp;
}
