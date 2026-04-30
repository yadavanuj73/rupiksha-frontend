package com.rupiksha.aeps.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "aeps_transaction")
@Data
public class AepsTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String mobile;

    private String agentId;

    private String amount;

    private String bankName;

    private String status;

    private String rrn;

    private String txnId;

    private String createdAt;
}