package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.CertificateDto;
import com.rupiksha.backend.domain.User;

import java.util.UUID;

public interface CertificateService {
    CertificateDto getCertificateForUser(UUID userId);
    CertificateDto getCertificateForUser(User user);
    CertificateDto getCertificateByPartyCode(String partyCode);
    CertificateDto getCertificateByCertificateNumber(String certificateNumber);
    CertificateDto verifyCertificate(String certificateNumber);
}
