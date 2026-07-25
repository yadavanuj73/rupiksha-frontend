package com.example.Rupiksha.Fingpay.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "iaepstxn")
public class AepsTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long uid;
    private String type;
    private String txnid;
    private String ftxnin;
    private Double amount;       // balanceAmount
    private String status;
    private String message;
    private String aadhar;       // masked
    private String rrn;
    private Long bank;
    private String mobile;
    private Double txnamount;    // actual transaction amount

    @Column(columnDefinition = "TEXT")
    private String request;

    @Column(columnDefinition = "TEXT")
    private String response;

    private LocalDateTime createdAt = LocalDateTime.now();
}