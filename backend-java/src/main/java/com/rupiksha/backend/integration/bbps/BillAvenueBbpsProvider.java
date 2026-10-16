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

        List<BillAvenueDtos.InputParam> inputs = new java.util.ArrayList<>();
        inputs.add(BillAvenueDtos.InputParam.builder().paramName("Mobile Number").paramValue(consumerNo).build());
        if ("BILAVAIRTEL001".equalsIgnoreCase(biller)) {
            inputs.add(BillAvenueDtos.InputParam.builder().paramName("Location").paramValue("All India").build());
        }

        BillAvenueDtos.BillPayXmlRequest req = BillAvenueDtos.BillPayXmlRequest.builder()
                .fetchRequestId(requestId)
                .billerId(biller)
                .customerMobile(consumerNo)
                .amountPaise(paise)
                .billAmountPaise(paise)
                .customerName("Retailer Customer")
                .inputParams(inputs)
                .clientTxnId(requestId)
                .paymentMode("Cash")
                .remitterName("Rupiksha Retailer")
                .remarks("Received")
                .paymentAccountInfo("Cash Payment")
                .clientIp("103.108.7.127")
                .build();

        BillAvenueDtos.BillPayResponse response = client.payBillXml(req);
        return new ProviderPayResponse(
                response.isSuccess(),
                response.getTxnRefId(),
                response.getErrorMessage(),
                Map.of("raw", response)
        );
    }
}
