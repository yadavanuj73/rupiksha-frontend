package com.rupiksha.backend.api.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;

@Data
@Builder
public class CertificateDto {
    private String certificateNumber;
    private String partyCode;
    private String certificateRole;
    private String roleDisplayName;
    private String certificateTitle;
    private String certificateType;
    private String idLabel;
    private String recipientName;
    private String issuedOn;
    private String validTill;
    private String location;
    private String certificationStatement;
    private String authorizationClause;
    private String bottomRole;
    private String disclaimerNote;
    private String status;
    private String verificationUrl;
}
