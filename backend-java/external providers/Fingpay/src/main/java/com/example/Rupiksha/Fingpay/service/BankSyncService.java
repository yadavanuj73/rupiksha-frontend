package com.example.Rupiksha.Fingpay.service;

import com.example.Rupiksha.Fingpay.entity.FingBank;
import com.example.Rupiksha.Fingpay.repository.FingBankRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
@RequiredArgsConstructor
@Slf4j
public class BankSyncService {

    private final FingBankRepository bankRepo;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    private static final String BANK_LIST_URL =
            "https://fingpayap.tapits.in/fpaepsservice/api/bankdata/bank/details";

    public int syncBanks() throws Exception {
        ResponseEntity<String> resp = restTemplate.getForEntity(BANK_LIST_URL, String.class);
        JsonNode root = objectMapper.readTree(resp.getBody());
        JsonNode data = root.path("data");

        int count = 0;
        for (JsonNode node : data) {
            FingBank bank = new FingBank();
            bank.setId(node.path("id").asLong());
            bank.setBankName(node.path("bankName").asText());
            bank.setIinno(node.path("iinno").asText());
            bankRepo.save(bank);
            count++;
        }
        log.info("Banks synced: {}", count);
        return count;
    }
}