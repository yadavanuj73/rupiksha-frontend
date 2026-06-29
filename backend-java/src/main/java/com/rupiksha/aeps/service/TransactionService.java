package com.rupiksha.aeps.service;

import com.rupiksha.aeps.dto.request.AepsTransactionRequest;
import com.rupiksha.aeps.dto.TransactionResult;

/**
 * Service interface for orchestrating AEPS transactions.
 */
public interface TransactionService {

    /**
     * Secures, validates, persists, and executes an AEPS transaction request.
     */
    TransactionResult executeTransaction(AepsTransactionRequest request, String mobile);
}
