package com.rupiksha.aeps.validator;

import com.rupiksha.aeps.exception.ValidationException;
import org.springframework.stereotype.Component;

@Component
public class AepsValidator {

    public void validateAadhaar(String aadhaar) {
        if (aadhaar == null || !aadhaar.matches("^\\d{12}$")) {
            throw new ValidationException("Invalid Aadhaar number format. Must be exactly 12 digits.");
        }
    }

    public void validateMobile(String mobile) {
        if (mobile == null || !mobile.matches("^[6-9]\\d{9}$")) {
            throw new ValidationException("Invalid Indian mobile number. Must be 10 digits starting with 6-9.");
        }
    }

    public void validatePan(String pan) {
        if (pan == null || !pan.matches("^[A-Z]{5}[0-9]{4}[A-Z]{1}$")) {
            throw new ValidationException("Invalid PAN card format. Must match standard Indian PAN pattern.");
        }
    }
}
