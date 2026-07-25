package com.example.Rupiksha.Fingpay.entity;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "fingbank")
public class FingBank {

    @Id
    private Long id; // Fingpay ka id use karo, auto-generate nahi

    private String bankName;
    private String iinno;
}