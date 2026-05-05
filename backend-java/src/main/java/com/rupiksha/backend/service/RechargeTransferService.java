package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.ProviderTxnDtos;

public interface RechargeTransferService {
    ProviderTxnDtos.TxnResponse recharge(ProviderTxnDtos.RechargeRequest request);
    ProviderTxnDtos.TxnResponse transfer(ProviderTxnDtos.TransferRequest request);
}

