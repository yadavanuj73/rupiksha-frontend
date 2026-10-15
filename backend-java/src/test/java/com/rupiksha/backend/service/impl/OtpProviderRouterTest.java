package com.rupiksha.backend.service.impl;

import com.rupiksha.backend.config.AppProperties;
import com.rupiksha.backend.integration.otp.DoveSoftOtpProvider;
import com.rupiksha.backend.integration.otp.MockOtpProvider;
import com.rupiksha.backend.integration.otp.OtpProvider;
import com.rupiksha.backend.integration.otp.TwoFactorOtpProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.core.env.Environment;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OtpProviderRouterTest {

    @Mock
    private AppProperties appProperties;

    @Mock
    private AppProperties.Providers providers;

    @Mock
    private AppProperties.OtpProvider otpProviderConfig;

    @Mock
    private Environment environment;

    @Mock
    private DoveSoftOtpProvider doveSoftOtpProvider;

    @Mock
    private TwoFactorOtpProvider twoFactorOtpProvider;

    @Mock
    private MockOtpProvider mockOtpProvider;

    private void setupMocks(String configuredName) {
        lenient().when(appProperties.providers()).thenReturn(providers);
        lenient().when(providers.otp()).thenReturn(otpProviderConfig);
        lenient().when(otpProviderConfig.name()).thenReturn(configuredName);
        lenient().when(environment.getActiveProfiles()).thenReturn(new String[]{"dev"});

        lenient().when(doveSoftOtpProvider.providerName()).thenReturn("dovesoft");
        lenient().when(twoFactorOtpProvider.providerName()).thenReturn("2factor");
        lenient().when(mockOtpProvider.providerName()).thenReturn("mock");
    }

    @Test
    void shouldRouteToDoveSoft_WhenConfiguredAsDovesoft() {
        setupMocks("dovesoft");
        List<OtpProvider> providerList = List.of(mockOtpProvider, twoFactorOtpProvider, doveSoftOtpProvider);

        OtpProviderRouter router = new OtpProviderRouter(providerList, appProperties, environment);
        assertEquals("dovesoft", router.current().providerName());
    }

    @Test
    void shouldRouteToDoveSoft_WhenConfiguredAsDove() {
        setupMocks("dove");
        List<OtpProvider> providerList = List.of(mockOtpProvider, twoFactorOtpProvider, doveSoftOtpProvider);

        OtpProviderRouter router = new OtpProviderRouter(providerList, appProperties, environment);
        assertEquals("dovesoft", router.current().providerName());
    }

    @Test
    void shouldRouteToTwoFactor_WhenConfiguredAs2fa() {
        setupMocks("2fa");
        List<OtpProvider> providerList = List.of(mockOtpProvider, twoFactorOtpProvider, doveSoftOtpProvider);

        OtpProviderRouter router = new OtpProviderRouter(providerList, appProperties, environment);
        assertEquals("2factor", router.current().providerName());
    }

    @Test
    void shouldRouteToMock_WhenConfiguredAsMock() {
        setupMocks("mock");
        List<OtpProvider> providerList = List.of(mockOtpProvider, twoFactorOtpProvider, doveSoftOtpProvider);

        OtpProviderRouter router = new OtpProviderRouter(providerList, appProperties, environment);
        assertEquals("mock", router.current().providerName());
    }
}
