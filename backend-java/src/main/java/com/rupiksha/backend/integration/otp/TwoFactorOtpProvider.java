package com.rupiksha.backend.integration.otp;

import com.rupiksha.backend.config.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class TwoFactorOtpProvider implements OtpProvider {
    private final AppProperties appProperties;
    private final RestTemplateBuilder restTemplateBuilder;

    @Override
    public String providerName() {
        return "2factor";
    }

    @Override
    public String sendOtp(String mobile) {
        String apiKey = appProperties.providers().otp().apiKey();
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalArgumentException("2Factor API key not configured");
        }
        RestTemplate rt = restTemplateBuilder.build();
        String url = "https://2factor.in/API/V1/" + apiKey + "/SMS/" + mobile + "/AUTOGEN";
        ResponseEntity<Map> response = rt.getForEntity(url, Map.class);
        Map body = response.getBody();
        if (body == null || !"Success".equalsIgnoreCase(String.valueOf(body.get("Status")))) {
            throw new IllegalArgumentException("2Factor OTP send failed");
        }
        String details = String.valueOf(body.get("Details"));
        log.info("2Factor OTP session created for {}", mobile);
        return details;
    }

    @Override
    public boolean verifyOtp(String mobile, String otp, String reference) {
        String apiKey = appProperties.providers().otp().apiKey();
        if (apiKey == null || apiKey.isBlank()) {
            throw new IllegalArgumentException("2Factor API key not configured");
        }
        if (reference == null || reference.isBlank()) return false;
        RestTemplate rt = restTemplateBuilder.build();
        String url = "https://2factor.in/API/V1/" + apiKey + "/SMS/VERIFY3/" + reference + "/" + otp;
        ResponseEntity<Map> response = rt.getForEntity(url, Map.class);
        Map body = response.getBody();
        return body != null && "Success".equalsIgnoreCase(String.valueOf(body.get("Status")));
    }
}

