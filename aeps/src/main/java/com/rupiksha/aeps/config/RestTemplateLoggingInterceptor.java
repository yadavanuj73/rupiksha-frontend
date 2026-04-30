package com.rupiksha.aeps.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpRequest;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.*;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

public class RestTemplateLoggingInterceptor
        implements ClientHttpRequestInterceptor {

    private static final Logger log =
            LoggerFactory.getLogger(
                    RestTemplateLoggingInterceptor.class);

    @Override
    public ClientHttpResponse intercept(
            HttpRequest request,
            byte[] body,
            ClientHttpRequestExecution execution
    ) throws IOException {

        log.info("Request URI: {}", request.getURI());
        log.info("Request Method: {}", request.getMethod());
        log.info("Request Body: {}",
                new String(body, StandardCharsets.UTF_8));

        ClientHttpResponse response =
                execution.execute(request, body);

        byte[] responseBody =
                response.getBody().readAllBytes();

        log.info("Response Status: {}",
                response.getStatusCode());

        log.info("Response Body: {}",
                new String(responseBody,
                        StandardCharsets.UTF_8));

        return new BufferingClientHttpResponseWrapper(
                response,
                responseBody
        );
    }

    private static class BufferingClientHttpResponseWrapper
            implements ClientHttpResponse {

        private final ClientHttpResponse response;
        private final byte[] body;

        public BufferingClientHttpResponseWrapper(
                ClientHttpResponse response,
                byte[] body
        ) {
            this.response = response;
            this.body = body;
        }

        @Override
        public HttpStatusCode getStatusCode()
                throws IOException {
            return response.getStatusCode();
        }
        @Override
        public String getStatusText()
                throws IOException {
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