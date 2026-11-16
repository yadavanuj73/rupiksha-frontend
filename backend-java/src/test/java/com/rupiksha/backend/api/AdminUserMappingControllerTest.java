package com.rupiksha.backend.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.rupiksha.backend.api.dto.UserMappingDtos.*;
import com.rupiksha.backend.security.JwtPrincipal;
import com.rupiksha.backend.service.TestUserCleanupService;
import com.rupiksha.backend.service.UserMappingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableHandlerMethodArgumentResolver;
import org.springframework.http.MediaType;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AdminUserMappingControllerTest {

    private MockMvc mockMvc;

    @Mock
    private UserMappingService userMappingService;

    @Mock
    private TestUserCleanupService testUserCleanupService;

    @InjectMocks
    private AdminUserMappingController controller;

    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        objectMapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setMessageConverters(new MappingJackson2HttpMessageConverter(objectMapper))
                .setCustomArgumentResolvers(new PageableHandlerMethodArgumentResolver())
                .build();
    }

    @Test
    @DisplayName("GET /search-retailers - should return page of matching retailers")
    void testSearchRetailersEndpoint() throws Exception {
        UUID id = UUID.randomUUID();
        UserMappingSearchDto dto = UserMappingSearchDto.builder()
                .id(id)
                .fullName("Ramesh Retailer")
                .mobile("9876543210")
                .partyCode("RPRBR10001")
                .role("RETAILER")
                .status("ACTIVE")
                .build();

        PageRequest pageRequest = PageRequest.of(0, 10);
        when(userMappingService.searchRetailers(eq("9876543210"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(dto), pageRequest, 1));

        mockMvc.perform(get("/api/v1/admin/user-mapping/search-retailers")
                        .param("query", "9876543210"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].fullName").value("Ramesh Retailer"))
                .andExpect(jsonPath("$.content[0].mobile").value("9876543210"))
                .andExpect(jsonPath("$.content[0].partyCode").value("RPRBR10001"));
    }

    @Test
    @DisplayName("POST /map - should map user and return response DTO")
    void testMapUserEndpoint() throws Exception {
        UUID retailerId = UUID.randomUUID();
        UUID distId = UUID.randomUUID();
        UUID mappingId = UUID.randomUUID();

        UserMappingRequest req = UserMappingRequest.builder()
                .retailerId(retailerId)
                .targetRole("DISTRIBUTOR")
                .targetParentId(distId)
                .reason("Assigning to regional distributor")
                .build();

        UserMappingResponseDto res = UserMappingResponseDto.builder()
                .mappingId(mappingId)
                .retailerId(retailerId)
                .retailerName("Ramesh Retailer")
                .parentRole("DISTRIBUTOR")
                .parentId(distId)
                .parentName("Dinesh Distributor")
                .message("Retailer mapped successfully under DISTRIBUTOR")
                .mappedAt(Instant.now())
                .build();

        when(userMappingService.mapUser(any(UserMappingRequest.class), any()))
                .thenReturn(res);

        mockMvc.perform(post("/api/v1/admin/user-mapping/map")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.parentRole").value("DISTRIBUTOR"))
                .andExpect(jsonPath("$.parentName").value("Dinesh Distributor"))
                .andExpect(jsonPath("$.retailerName").value("Ramesh Retailer"));
    }

    @Test
    @DisplayName("GET /list - should return paginated current mappings")
    void testGetCurrentMappingsListEndpoint() throws Exception {
        UUID id = UUID.randomUUID();
        UserMappingTableItemDto item = UserMappingTableItemDto.builder()
                .id(id)
                .retailerId(id)
                .retailerName("Ramesh Retailer")
                .partyCode("RPRBR10001")
                .mobile("9876543210")
                .mappedUnder("DISTRIBUTOR")
                .parentName("Dinesh Distributor")
                .status("ACTIVE")
                .active(true)
                .build();

        PageRequest pageRequest = PageRequest.of(0, 10);
        when(userMappingService.getCurrentMappingsList(any(), any(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(item), pageRequest, 1));

        mockMvc.perform(get("/api/v1/admin/user-mapping/list")
                        .param("page", "0")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].retailerName").value("Ramesh Retailer"))
                .andExpect(jsonPath("$.content[0].mappedUnder").value("DISTRIBUTOR"));
    }

    @Test
    @DisplayName("GET /history - should return paginated audit logs")
    void testGetMappingHistoryEndpoint() throws Exception {
        UUID mappingId = UUID.randomUUID();
        UserMappingHistoryDto history = UserMappingHistoryDto.builder()
                .mappingId(mappingId)
                .retailerName("Ramesh Retailer")
                .newParentRole("DISTRIBUTOR")
                .newParentName("Dinesh Distributor")
                .actionType("REMAPPING")
                .mappedByAdminUsername("admin")
                .status("ACTIVE")
                .build();

        PageRequest pageRequest = PageRequest.of(0, 10);
        when(userMappingService.getMappingHistory(any(), any(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(history), pageRequest, 1));

        mockMvc.perform(get("/api/v1/admin/user-mapping/history")
                        .param("page", "0")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].actionType").value("REMAPPING"))
                .andExpect(jsonPath("$.content[0].newParentRole").value("DISTRIBUTOR"));
    }

    @Test
    @DisplayName("POST /cleanup-test-users - should trigger cleanup and return result")
    void testCleanupTestUsersEndpoint() throws Exception {
        when(testUserCleanupService.cleanupTestUsers())
                .thenReturn(Map.of("success", true, "foundCount", 27, "deletedCount", 27, "message", "Successfully cleaned up 27 QA test accounts."));

        mockMvc.perform(post("/api/v1/admin/user-mapping/cleanup-test-users"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.deletedCount").value(27))
                .andExpect(jsonPath("$.message").value("Successfully cleaned up 27 QA test accounts."));
    }
}
