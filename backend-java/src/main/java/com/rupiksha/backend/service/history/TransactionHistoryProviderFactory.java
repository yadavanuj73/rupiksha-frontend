package com.rupiksha.backend.service.history;

import com.rupiksha.backend.domain.TransactionReportType;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class TransactionHistoryProviderFactory {

    private final List<TransactionHistoryProvider> providers;

    public TransactionHistoryProviderFactory(List<TransactionHistoryProvider> providers) {
        this.providers = providers;
    }

    public TransactionHistoryProvider getProvider(TransactionReportType reportType) {
        return providers.stream()
                .filter(provider -> provider.supports(reportType))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("No history provider found for report type: " + reportType));
    }
}
