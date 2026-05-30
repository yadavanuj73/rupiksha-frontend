package com.rupiksha.aeps.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.URL;

@RestController
public class ServerInfoController {

    @GetMapping("/server-ip")
    public String getServerIp() {
        try {
            URL url = new URL("https://ifconfig.me");
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(url.openStream()))) {
                String ip = reader.readLine();
                return "Server Public IP: " + ip;
            }
        } catch (Exception e) {
            return "Error fetching IP: " + e.getMessage();
        }
    }
}
