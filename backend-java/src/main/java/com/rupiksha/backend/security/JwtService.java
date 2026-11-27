package com.rupiksha.backend.security;

import com.rupiksha.backend.config.AppProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class JwtService {
    private final AppProperties appProperties;
    private final SecretKey secretKey;

    public JwtService(AppProperties appProperties) {
        this.appProperties = appProperties;
        this.secretKey = Keys.hmacShaKeyFor(appProperties.jwt().secret().getBytes(StandardCharsets.UTF_8));
    }

    public String createAccessToken(UUID userId, String username, List<String> roles) {
        return createAccessToken(userId, username, roles, null);
    }

    public String createAccessToken(UUID userId, String username, List<String> roles, Integer adminSessionVersion) {
        Instant now = Instant.now();
        Instant exp = now.plusSeconds(appProperties.jwt().accessTokenMinutes() * 60);
        var builder = Jwts.builder()
                .issuer(appProperties.jwt().issuer())
                .subject(userId.toString())
                .claim("username", username)
                .claim("roles", roles)
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp));
        if (adminSessionVersion != null) {
            builder.claim("admin_session_version", adminSessionVersion);
        }
        return builder.signWith(secretKey).compact();
    }

    public String createEmployeeAccessToken(UUID employeeId, String username, String employeeRole, Integer sessionVersion) {
        Instant now = Instant.now();
        Instant exp = now.plusSeconds(appProperties.jwt().accessTokenMinutes() * 60);
        List<String> roles = List.of("EMPLOYEE", employeeRole);
        var builder = Jwts.builder()
                .issuer(appProperties.jwt().issuer())
                .subject(employeeId.toString())
                .claim("username", username)
                .claim("roles", roles)
                .claim("principal_type", "EMPLOYEE")
                .claim("employee_role", employeeRole)
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp));
        if (sessionVersion != null) {
            builder.claim("employee_session_version", sessionVersion);
        }
        return builder.signWith(secretKey).compact();
    }

    public Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public Map<String, Object> parseSafe(String token) {
        Claims claims = parse(token);
        return claims;
    }
}

