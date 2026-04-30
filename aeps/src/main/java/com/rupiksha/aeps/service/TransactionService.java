package com.rupiksha.aeps.service;

import com.rupiksha.aeps.entity.AepsTransaction;
import com.rupiksha.aeps.repository.AepsTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TransactionService {

private final AepsTransactionRepository repo;

public void save(AepsTransaction txn){
repo.save(txn);
}

public List<AepsTransaction> get(String mobile){
return repo.findByMobile(mobile);
}

}