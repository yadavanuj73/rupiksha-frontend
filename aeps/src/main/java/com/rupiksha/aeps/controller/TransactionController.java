package com.rupiksha.aeps.controller;

import com.rupiksha.aeps.entity.AepsTransaction;
import com.rupiksha.aeps.service.TransactionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/aeps/transaction")
@RequiredArgsConstructor
@CrossOrigin("*")   // ✅ CORS enabled
public class TransactionController {

    private final TransactionService service;

    @GetMapping("/{mobile}")
    public List<AepsTransaction> get(
            @PathVariable String mobile
    ){
        return service.get(mobile);
    }

}