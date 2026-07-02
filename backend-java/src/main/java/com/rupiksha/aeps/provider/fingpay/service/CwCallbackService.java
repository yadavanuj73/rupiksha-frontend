package com.rupiksha.aeps.provider.fingpay.service;

import com.rupiksha.aeps.provider.fingpay.dto.CwCallbackRequest;
import com.rupiksha.aeps.provider.fingpay.entity.AepsTransaction;
import com.rupiksha.aeps.provider.fingpay.repository.AepsTransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class CwCallbackService {

    private final AepsTransactionRepository txnRepo;

    public void handle(CwCallbackRequest req) {
        log.info("CW Callback received | merchantRefNo={} status={}",
                req.getMerchantRefNo(), req.getTransactionStatus());

        String status = req.getTransactionStatus();

        if ("I".equalsIgnoreCase(status)) {
            // Initiation callback — transaction abhi bank ko nahi gayi
            // Sirf log karo, DB update ki zaroorat nahi
            log.info("CW Initiated | fpTxnId={} amount={}",
                    req.getFpTransactionId(), req.getAmount());
            return;
        }

        // S = success, F = failure — DB update karo
        Optional<AepsTransaction> txnOpt = txnRepo.findByTxnid(req.getMerchantRefNo());

        if (txnOpt.isEmpty()) {
            log.warn("CW Callback — txn not found in DB for merchantRefNo={}",
                    req.getMerchantRefNo());
            return;
        }

        AepsTransaction txn = txnOpt.get();

        if ("S".equalsIgnoreCase(status)) {
            txn.setStatus("SUCCESS");
            txn.setRrn(req.getBankRRN() != null ? req.getBankRRN().toString() : "NA");
            txn.setFtxnin(req.getFpTransactionId());
            txn.setMessage("Transaction Successful");
            log.info("CW Success callback | merchantRefNo={} bankRRN={}",
                    req.getMerchantRefNo(), req.getBankRRN());

        } else if ("F".equalsIgnoreCase(status)) {
            txn.setStatus("FAILED");
            txn.setMessage(req.getErrorMessage() != null
                    ? req.getErrorMessage() : "Transaction Failed");
            log.warn("CW Failure callback | merchantRefNo={} error={}",
                    req.getMerchantRefNo(), req.getErrorMessage());
        }

        txnRepo.save(txn);
    }
}