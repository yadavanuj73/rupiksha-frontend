package com.rupiksha.aeps.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Entity
@Data
@Table(name = "agent_profile")
public class AgentProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String mobile;

    private String agentId;

    private String merchantId;

    private String name;

    private String shopName;

    private String address;

    private String city;

    private String state;

    private String pinCode;

    private String latitude;

    private String longitude;

    private LocalDateTime createdAt = LocalDateTime.now();

}