package com.rupiksha.aeps.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
public class ServerInfoController {

    @GetMapping("/server-ip")
    public Map<String, String> getServerIp() {
        Map<String, String> result = new LinkedHashMap<>();

        // Try multiple IP lookup services
        String[] services = {
            "https://api.ipify.org",
            "https://checkip.amazonaws.com",
            "https://icanhazip.com",
            "https://ifconfig.me/ip"
        };

        for (String service : services) {
            try {
                HttpURLConnection conn = (HttpURLConnection) new URL(service).openConnection();
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                conn.setRequestProperty("User-Agent", "Mozilla/5.0");
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()))) {
                    String ip = reader.readLine();
                    if (ip != null && !ip.isBlank()) {
                        result.put("ip", ip.trim());
                        result.put("source", service);
                        result.put("status", "success");
                        return result;
                    }
                }
            } catch (Exception e) {
                result.put("error_" + service, e.getMessage());
            }
        }

        result.put("status", "failed");
        result.put("message", "Could not determine server IP from any service");
        return result;
    }
}
