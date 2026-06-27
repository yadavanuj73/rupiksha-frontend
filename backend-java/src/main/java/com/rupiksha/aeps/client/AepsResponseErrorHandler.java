package com.rupiksha.aeps.client;

import com.rupiksha.aeps.exception.ApiTimeoutException;
import com.rupiksha.aeps.exception.AuthenticationException;
import com.rupiksha.aeps.exception.ProviderException;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResponseErrorHandler;

import java.io.IOException;

@Component
public class AepsResponseErrorHandler implements ResponseErrorHandler {

    @Override
    public boolean hasError(ClientHttpResponse response) throws IOException {
        return response.getStatusCode().isError();
    }

    @Override
    public void handleError(ClientHttpResponse response) throws IOException {
        HttpStatus status = HttpStatus.valueOf(response.getStatusCode().value());
        String statusText = response.getStatusText();
        String message = "Upstream AEPS Provider returned HTTP status " + status.value() + " (" + statusText + ")";

        if (status == HttpStatus.UNAUTHORIZED || status == HttpStatus.FORBIDDEN) {
            throw new AuthenticationException("Authentication with AEPS Provider failed: " + message);
        } else if (status == HttpStatus.REQUEST_TIMEOUT || status == HttpStatus.GATEWAY_TIMEOUT) {
            throw new ApiTimeoutException("Connection timed out with AEPS Provider: " + message);
        } else {
            throw new ProviderException(message);
        }
    }
}
