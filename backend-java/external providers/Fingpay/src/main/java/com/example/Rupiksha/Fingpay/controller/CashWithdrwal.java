package com.example.Rupiksha.Fingpay.controller;

import com.example.Rupiksha.Fingpay.dto.*;
import com.example.Rupiksha.Fingpay.service.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/aeps")
@RequiredArgsConstructor
public class CashWithdrwal {


    private final CashWithdrawalService cashWithdrawalService;
    private final BankSyncService bankSyncService;
    private final CwStatusService cwStatusService;
    private final CwCallbackService cwCallbackService;
    private final BalanceInquiryService balanceInquiryService;
    private final MiniStatementService miniStatementService;
    private final AadhaarPayService aadhaarPayService;
    private final ApStatusService apStatusService;

    @PostMapping("/cash-withdrawal")
    public ResponseEntity<CashWithdrawalResponse> cashWithdrawal(
            @RequestBody CashWithdrawalRequest request) {
        return ResponseEntity.ok(cashWithdrawalService.process(request));
    }

    // Ek baar run karo — saari banks DB mein save ho jaayengi
    @GetMapping("/sync-banks")
    public ResponseEntity<String> syncBanks() throws Exception {
        int count = bankSyncService.syncBanks();
        return ResponseEntity.ok("Synced " + count + " banks");
    }

    @PostMapping("/cash-withdrawal/status")
    public ResponseEntity<CwStatusResponse> cwStatus(
            @RequestBody CwStatusRequest request) {
        return ResponseEntity.ok(cwStatusService.checkStatus(request));
    }

    @PostMapping("/cash-withdrawal/callback")
    public ResponseEntity<Void> cwCallback(
            @RequestBody CwCallbackRequest request) {
        cwCallbackService.handle(request);
        return ResponseEntity.ok().build(); // 200 return karna mandatory hai
    }

    @PostMapping("/balance-inquiry")
    public ResponseEntity<BalanceInquiryResponse> balanceInquiry(
            @RequestBody BalanceInquiryRequest request) {
        return ResponseEntity.ok(balanceInquiryService.process(request));
    }

    @PostMapping("/mini-statement")
    public ResponseEntity<MiniStatementResponse> miniStatement(
            @RequestBody MiniStatementRequest request) {
        return ResponseEntity.ok(miniStatementService.process(request));
    }

    @PostMapping("/aadhaar-pay")
    public ResponseEntity<AadhaarPayResponse> aadhaarPay(
            @RequestBody AadhaarPayRequest request) {
        return ResponseEntity.ok(aadhaarPayService.process(request));
    }

    @PostMapping("/aadhaar-pay/status")
    public ResponseEntity<ApStatusResponse> apStatus(
            @RequestBody ApStatusRequest request) {
        return ResponseEntity.ok(apStatusService.checkStatus(request));
    }
}
