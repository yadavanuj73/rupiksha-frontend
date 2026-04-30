package com.rupiksha.aeps.controller;
import lombok.extern.slf4j.Slf4j;
import com.rupiksha.aeps.dto.*;
import com.rupiksha.aeps.service.AepsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/aeps")
@RequiredArgsConstructor
@CrossOrigin("*")
public class AepsController {

    private final AepsService aepsService;

    @PostMapping("/onboard")
    public ResponseEntity<AepsOnboardingResponse> onboard(
            @RequestBody AepsOnboardingRequest request){

        AepsOnboardingResponse response = aepsService.onboard(request);

        return ResponseEntity.ok(response);
    }

    @PostMapping("/aeps-kyc")
    public ResponseEntity<?> aepsKyc(
            @RequestBody AepsKycRequest request){

        return ResponseEntity.ok(
                aepsService.aepsKyc(request)
        );
    }
    @PostMapping("/aeps-kyc-otp-verify")
    public ResponseEntity<?> verifyKycOtp(
            @RequestBody AepsKycOtpVerifyRequest request){

        return ResponseEntity.ok(
                aepsService.verifyKycOtp(request)
        );
    }
    @PostMapping("/aeps-twofa")
    public ResponseEntity<AepsTwoFaResponse> aepsTwoFa(
            @RequestBody AepsTwoFaRequest request){

        try {

            log.info("AEPS 2FA Request Received : {}", request);

            AepsTwoFaResponse response =
                    aepsService.aepsTwoFa(request);

            log.info("AEPS 2FA Response : {}", response);

            return ResponseEntity.ok(response);

        } catch (Exception e){

            log.error("AEPS 2FA Controller Error", e);

            AepsTwoFaResponse error =
                    new AepsTwoFaResponse();

            error.setStatusId(2);
            error.setMessage("AEPS 2FA Failed");

            return ResponseEntity.internalServerError()
                    .body(error);
        }
    }
    @PostMapping("/transaction")
    public ResponseEntity<AepsTransactionResponse> transaction(
            @RequestBody AepsTransactionRequest request){

        try {

            // Mask Aadhaar for logs
            String maskedAadhar = request.getAdharNumber() != null ?
                    request.getAdharNumber().replaceAll("\\d(?=\\d{4})", "*")
                    : null;

            log.info("=========== AEPS TRANSACTION API ===========");
            log.info("Mobile : {}", request.getMobileNumber());
            log.info("Aadhar : {}", maskedAadhar);
            log.info("Bank : {}", request.getAepsBankName());
            log.info("Method : {}", request.getAepsMethod());

            AepsTransactionResponse response =
                    aepsService.aepsTransaction(request);

            log.info("AEPS Transaction Response : {}", response);

            return ResponseEntity.ok(response);

        } catch (Exception e){

            log.error("AEPS Transaction Error", e);

            AepsTransactionResponse error =
                    new AepsTransactionResponse();

            error.setStatusId(0);
            error.setStatus("FAILED");
            error.setErrorCode("INTERNAL_ERROR");
            error.setMessage("AEPS Transaction Failed");

            return ResponseEntity.internalServerError()
                    .body(error);
        }
    }
    @PostMapping("/transaction-status")
    public ResponseEntity<AepsTransactionStatusResponse> status(
            @RequestBody AepsTransactionStatusRequest request){

        return ResponseEntity.ok(
                aepsService.transactionStatus(request)
        );
    }
}