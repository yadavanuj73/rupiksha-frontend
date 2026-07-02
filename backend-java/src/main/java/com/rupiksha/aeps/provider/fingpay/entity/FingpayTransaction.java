package com.rupiksha.aeps.provider.fingpay.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity(name = "FingpayTransaction")
@Table(name = "iaepstxn")
public class FingpayTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "uid")
    private Long uid;

    @Column(name = "type")
    private String type;

    @Column(name = "txnid")
    private String txnid;

    @Column(name = "ftxnin")
    private String ftxnin;

    @Column(name = "amount")
    private Double amount;       // balanceAmount

    @Column(name = "status")
    private String status;

    @Column(name = "message")
    private String message;

    @Column(name = "aadhar")
    private String aadhar;       // masked

    @Column(name = "rrn")
    private String rrn;

    @Column(name = "bank")
    private Long bank;

    @Column(name = "mobile")
    private String mobile;

    @Column(name = "txnamount")
    private Double txnamount;    // actual transaction amount

    @Column(name = "request", columnDefinition = "TEXT")
    private String request;

    @Column(name = "response", columnDefinition = "TEXT")
    private String response;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
}