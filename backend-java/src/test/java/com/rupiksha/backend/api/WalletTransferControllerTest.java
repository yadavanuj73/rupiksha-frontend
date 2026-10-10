package com.rupiksha.backend.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rupiksha.backend.api.dto.WalletTransferDtos;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.WalletTransferService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
public class WalletTransferControllerTest {

    private MockMvc mockMvc;

    @Mock
    private WalletTransferService walletTransferService;

    @InjectMocks
    private WalletTransferController walletTransferController;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private UUID currentUserId;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(walletTransferController).build();

        currentUserId = UUID.randomUUID();
        JwtPrincipal principal = new JwtPrincipal(
                currentUserId.toString(),
                "sender_user",
                List.of("ROLE_RETAILER")
        );

        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                principal,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_RETAILER"))
        );

        SecurityContext securityContext = SecurityContextHolder.createEmptyContext();
        securityContext.setAuthentication(auth);
        SecurityContextHolder.setContext(securityContext);
    }

    @Test
    void searchRecipient_returnsRecipientDetails() throws Exception {
        WalletTransferDtos.RecipientLookupResponse lookup = new WalletTransferDtos.RecipientLookupResponse(
                UUID.randomUUID().toString(),
                "Recipient Name",
                "Recipient Shop",
                "9876543211",
                "RX1005",
                "DISTRIBUTOR",
                "Mumbai",
                "Maharashtra",
                "Andheri East",
                "ACTIVE",
                true,
                "User verified"
        );

        when(walletTransferService.searchRecipient(eq("9876543211"), eq(currentUserId))).thenReturn(lookup);

        mockMvc.perform(get("/api/v1/wallet-transfer/recipients")
                        .param("mobile", "9876543211")
                        .principal(SecurityContextHolder.getContext().getAuthentication()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.fullName").value("Recipient Name"))
                .andExpect(jsonPath("$.data.mobile").value("9876543211"))
                .andExpect(jsonPath("$.data.partyCode").value("RX1005"));
    }

    @Test
    void transferFunds_executesAndReturnsCommittedResult() throws Exception {
        WalletTransferDtos.WalletTransferRequest req = new WalletTransferDtos.WalletTransferRequest(
                "9876543211",
                null,
                new BigDecimal("500.00"),
                "Settlement",
                "idem_test_key"
        );

        WalletTransferDtos.WalletTransferResponse response = new WalletTransferDtos.WalletTransferResponse(
                "W2W-20261009-TEST01",
                currentUserId.toString(),
                "Sender Retailer",
                "RX1001",
                UUID.randomUUID().toString(),
                "Recipient Name",
                "Recipient Shop",
                "RX1005",
                "9876543211",
                "DISTRIBUTOR",
                new BigDecimal("500.00"),
                BigDecimal.ZERO,
                new BigDecimal("500.00"),
                new BigDecimal("500.00"),
                "SUCCESS",
                "Settlement",
                Instant.now(),
                new BigDecimal("1500.00")
        );

        when(walletTransferService.transferFunds(any(), eq(currentUserId), any(), any())).thenReturn(response);

        mockMvc.perform(post("/api/v1/wallet-transfer")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req))
                        .principal(SecurityContextHolder.getContext().getAuthentication()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.transferReference").value("W2W-20261009-TEST01"))
                .andExpect(jsonPath("$.data.amount").value(500.00));
    }
}
