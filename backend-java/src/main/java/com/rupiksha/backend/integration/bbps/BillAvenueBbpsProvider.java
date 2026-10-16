package com.rupiksha.backend.integration.bbps;

import com.rupiksha.backend.integration.bbps.dto.BillAvenueDtos;
import com.rupiksha.backend.integration.bbps.util.BillAvenueCryptoUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Slf4j
@Component("billavenue")
@RequiredArgsConstructor
public class BillAvenueBbpsProvider implements BbpsProvider {

    private final BillAvenueClient client;

    @Override
    public String providerName() {
        return "billavenue";
    }

    @Override
    public ProviderFetchResponse fetch(String userId, String biller, String opcode, String consumerNo, String category) {
        log.info("Bill fetch called for biller: {}, consumerNo: {}", biller, consumerNo);
        // Mobile prepaid does not support fetch per BillAvenue doc (Fetch = NOT_SUPPORTED)
        return new ProviderFetchResponse(false, "Bill fetch is not supported for Mobile Prepaid category", Map.of());
    }

    @Override
    public ProviderPayResponse pay(String userId, String biller, String opcode, String consumerNo, String category, BigDecimal amount) {
        String requestId = BillAvenueCryptoUtil.generateRequestId();
        long paise = amount.multiply(BigDecimal.valueOf(100)).longValue();

        BillAvenueDtos.BillPayRequest req = BillAvenueDtos.BillPayRequest.builder()
                .billerAdhoc("true")
                .agentId(client.getAgentId())
                .billerId(biller)
                .agentDeviceInfo(BillAvenueDtos.AgentDeviceInfo.builder()
                        .initChannel("AGT")
                        .ip("127.0.0.1")
                        .mac("01-23-45-67-89-ab")
                        .build())
                .customerInfo(BillAvenueDtos.CustomerInfo.builder()
                        .customerMobile(consumerNo)
                        .build())
                .inputParams(BillAvenueDtos.InputParams.builder()
                        .input(List.of(
                                BillAvenueDtos.InputParam.builder().paramName("Mobile Number").paramValue(consumerNo).build(),
                                BillAvenueDtos.InputParam.builder().paramName("Location").paramValue("All India").build()
                        ))
                        .build())
                .amountInfo(BillAvenueDtos.AmountInfo.builder()
                        .amount(String.valueOf(paise))
                        .currency("356")
                        .custConvFee("0")
                        .build())
                .paymentMethod(BillAvenueDtos.PaymentMethod.builder()
                        .paymentMode("Wallet")
                        .quickPay("Y")
                        .splitPay("N")
                        .build())
                .paymentInfo(BillAvenueDtos.PaymentInfo.builder()
                        .info(List.of(
                                BillAvenueDtos.InfoItem.builder().infoName("Payment Account Info").infoValue("Rupiksha|" + consumerNo).build(),
                                BillAvenueDtos.InfoItem.builder().infoName("PaymentRefId").infoValue(requestId).build()
                        ))
                        .build())
                .build();

        BillAvenueDtos.BillPayResponse response = client.payBill(req, requestId);
        return new ProviderPayResponse(
                response.isSuccess(),
                response.getTxnRefId(),
                response.getErrorMessage(),
                Map.of("raw", response)
        );
    }
}
