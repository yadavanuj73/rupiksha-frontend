package com.payout.payout.Controll;

import com.payout.payout.dto.PayoutRequest;
import com.payout.payout.dto.PayoutResponse;
import com.payout.payout.service.PayoutService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/payout")
@RequiredArgsConstructor
public class PayoutController {

    private final PayoutService payoutService;

    @PostMapping("/initiate")
    public ResponseEntity<PayoutResponse> initiatePayout(@RequestBody PayoutRequest request) {
        log.info("Payout request received for OrderId: {}", request.getOrderId());
        PayoutResponse response = payoutService.initiatePayout(request);
        return ResponseEntity.ok(response);
    }
}
