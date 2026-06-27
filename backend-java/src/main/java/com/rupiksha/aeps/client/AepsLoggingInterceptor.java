package com.rupiksha.aeps.client;

import com.rupiksha.aeps.util.AepsUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpRequest;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Slf4j
@Component
public class AepsLoggingInterceptor implements ClientHttpRequestInterceptor {

    @Override
    public ClientHttpResponse intercept(HttpRequest request, byte[] body, ClientHttpRequestExecution execution) throws IOException {
        long startTime = System.currentTimeMillis();
        String requestBody = new String(body, StandardCharsets.UTF_8);
        String maskedRequestBody = AepsUtil.maskSensitiveData(requestBody);

        log.info("Outbound AEPS Request URI: [{}], Method: [{}], Body: [{}]",
                request.getURI(), request.getMethod(), maskedRequestBody);

        ClientHttpResponse response = execution.execute(request, body);
        long duration = System.currentTimeMillis() - startTime;

        byte[] responseBodyBytes = response.getBody().readAllBytes();
        String responseBodyStr = new String(responseBodyBytes, StandardCharsets.UTF_8);
        String maskedResponseBody = AepsUtil.maskSensitiveData(responseBodyStr);

        log.info("Inbound AEPS Response Status: [{}], Duration: [{}ms], Body: [{}]",
                response.getStatusCode(), duration, maskedResponseBody);

        return new BufferingClientHttpResponseWrapper(response, responseBodyBytes);
    }

    private static class BufferingClientHttpResponseWrapper implements ClientHttpResponse {
        private final ClientHttpResponse response;
        private final byte[] body;

        public BufferingClientHttpResponseWrapper(ClientHttpResponse response, byte[] body) {
            this.response = response;
            this.body = body;
        }

        @Override
        public org.springframework.http.HttpStatusCode getStatusCode() throws IOException {
            return response.getStatusCode();
        }

        @Override
        public String getStatusText() throws IOException {
            return response.getStatusText();
        }

        @Override
        public void close() {
            response.close();
        }

        @Override
        public org.springframework.http.HttpHeaders getHeaders() {
            return response.getHeaders();
        }

        @Override
        public java.io.InputStream getBody() {
            return new ByteArrayInputStream(body);
        }
    }
}
