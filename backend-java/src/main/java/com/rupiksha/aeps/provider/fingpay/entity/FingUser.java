package com.rupiksha.aeps.provider.fingpay.entity;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity(name = "FingUser")
@Table(name = "fingpay_users")
public class FingUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String pin;
}