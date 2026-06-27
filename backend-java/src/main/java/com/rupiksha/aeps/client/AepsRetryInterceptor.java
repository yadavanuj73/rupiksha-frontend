package com.rupiksha.aeps.client;

import com.rupiksha.aeps.config.AepsProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpRequest;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Slf4j
@Component
@RequiredArgsConstructor
public class AepsRetryInterceptor implements ClientHttpRequestInterceptor {

    private final AepsProperties aepsProperties;

    @Override
    public ClientHttpResponse intercept(HttpRequest request, byte[] body, ClientHttpRequestExecution execution) throws IOException {
        int maxAttempts = aepsProperties.getRetry().getMaxAttempts();
        long backoffMs = aepsProperties.getRetry().getBackoffMs();

        int attempt = 1;
        IOException lastException = null;

        while (attempt <= maxAttempts) {
            try {
                if (attempt > 1) {
                    log.warn("Retrying AEPS outbound request. Attempt [{}/{}] for URI: [{}]",
                            attempt, maxAttempts, request.getURI());
                }
                return execution.execute(request, body);
            } catch (IOException e) {
                lastException = e;
                log.warn("AEPS HTTP Call failed on attempt [{}/{}]. Reason: {}",
                        attempt, maxAttempts, e.getMessage());

                if (attempt >= maxAttempts) {
                    break;
                }

                try {
                    Thread.sleep(backoffMs);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new IOException("Retry sleep interrupted", ie);
                }
                attempt++;
            }
        }
        throw new IOException("AEPS API call failed after " + maxAttempts + " attempts", lastException);
    }
}
