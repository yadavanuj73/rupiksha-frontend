package com.rupiksha.aeps.provider.fingpay.entity;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "fingbank")
public class FingBank {

    @Id
    @Column(name = "id")
    private Long id; // Fingpay bank ID (non-generated)

    @Column(name = "bank_name")
    private String bankName;

    @Column(name = "iinno")
    private String iinno;
}