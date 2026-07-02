package com.rupiksha.aeps.provider.fingpay.entity;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "aepskyc")
public class AepsKyc {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long uid;
    private String outlet;
    private String mpin;
}