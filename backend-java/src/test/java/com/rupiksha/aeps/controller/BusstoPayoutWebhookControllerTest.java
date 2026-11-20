package com.rupiksha.aeps.controller;

import com.rupiksha.aeps.dto.BusstoWebhookResponse;
import com.rupiksha.aeps.service.BusstoPayoutWebhookService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class BusstoPayoutWebhookControllerTest {

    private MockMvc mockMvc;

    @Mock
    private BusstoPayoutWebhookService busstoPayoutWebhookService;

    @InjectMocks
    private BusstoPayoutWebhookController busstoPayoutWebhookController;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(busstoPayoutWebhookController).build();
    }

    @Test
    @DisplayName("POST /api/v1/webhooks/bussto/payout - Success Callback Delegated to Service")
    void testWebhookEndpoint_delegatesToService() throws Exception {
        BusstoWebhookResponse mockResponse = BusstoWebhookResponse.builder()
                .success(true)
                .status("SUCCESS")
                .message("Payout transaction updated to SUCCESS")
                .orderId("PO_20261120113355_BDHB")
                .providerTxnId("BB_TXN_123")
                .utr("UTR123456789")
                .build();

        when(busstoPayoutWebhookService.processWebhook(anyString(), any(HttpHeaders.class), anyString()))
                .thenReturn(ResponseEntity.ok(mockResponse));

        String body = "{\"external_order_id\":\"PO_20261120113355_BDHB\",\"status\":\"SUCCESS\"}";

        mockMvc.perform(post("/api/v1/webhooks/bussto/payout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Webhook-Secret", "test_secret")
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.orderId").value("PO_20261120113355_BDHB"));
    }

    @Test
    @DisplayName("POST /api/v1/webhooks/bussto/payout - Unmatched or Bad Request Returns Error")
    void testWebhookEndpoint_badRequest() throws Exception {
        BusstoWebhookResponse errorResponse = BusstoWebhookResponse.builder()
                .success(false)
                .status("ERROR")
                .message("Empty payload body")
                .build();

        when(busstoPayoutWebhookService.processWebhook(any(), any(HttpHeaders.class), anyString()))
                .thenReturn(ResponseEntity.badRequest().body(errorResponse));

        mockMvc.perform(post("/api/v1/webhooks/bussto/payout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.status").value("ERROR"));
    }
}
