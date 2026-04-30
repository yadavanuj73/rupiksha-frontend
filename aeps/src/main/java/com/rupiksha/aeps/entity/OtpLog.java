package com.rupiksha.aeps.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Data
public class OtpLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String mobile;

    private String otp;

    private LocalDateTime expiry;

    private boolean verified = false;
}