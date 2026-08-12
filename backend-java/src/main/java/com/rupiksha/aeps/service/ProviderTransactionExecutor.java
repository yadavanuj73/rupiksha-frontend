package com.rupiksha.aeps.service;

import com.rupiksha.aeps.config.AepsProperties;
import com.rupiksha.aeps.dto.TransactionContext;
import com.rupiksha.aeps.dto.TransactionResult;
import com.rupiksha.aeps.exception.AepsException;
import com.rupiksha.aeps.provider.AepsProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class ProviderTransactionExecutor {

    private final List<AepsProvider> providers;
    private final AepsProperties aepsProperties;

    /**
     * Resolves the active AEPS provider and executes the transaction.
     */
    public TransactionResult execute(TransactionContext context) {
        AepsProvider provider = getActiveProvider(context.getProvider());
        log.info("Resolved active provider: [{}] for transaction", provider.getProviderName());
        context.setProvider(provider.getProviderName());
        return provider.executeTransaction(context);
    }

    private AepsProvider getActiveProvider(String requestedProvider) {
        String activeName = (requestedProvider != null && !requestedProvider.isBlank())
                ? requestedProvider
                : aepsProperties.getActiveProvider();
        return providers.stream()
                .filter(p -> p.getProviderName().equalsIgnoreCase(activeName))
                .findFirst()
                .orElseThrow(() -> new AepsException("Active AEPS provider strategy not registered: " + activeName));
    }
}
