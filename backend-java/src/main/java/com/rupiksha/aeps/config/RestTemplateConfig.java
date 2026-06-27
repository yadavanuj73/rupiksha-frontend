package com.rupiksha.aeps.config;

import com.rupiksha.aeps.client.AepsLoggingInterceptor;
import com.rupiksha.aeps.client.AepsResponseErrorHandler;
import com.rupiksha.aeps.client.AepsRetryInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.net.HttpURLConnection;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.List;

@Configuration
@RequiredArgsConstructor
public class RestTemplateConfig {

    private final AepsProperties aepsProperties;
    private final AepsLoggingInterceptor aepsLoggingInterceptor;
    private final AepsRetryInterceptor aepsRetryInterceptor;
    private final AepsResponseErrorHandler aepsResponseErrorHandler;

    @Bean
    public RestTemplate aepsRestTemplate() {
        try {
            // Trust all SSL certificates to avoid SSL handshake issues with external APIs
            TrustManager[] trustAllCerts = new TrustManager[]{
                new X509TrustManager() {
                    public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
                    public void checkClientTrusted(X509Certificate[] certs, String authType) {}
                    public void checkServerTrusted(X509Certificate[] certs, String authType) {}
                }
            };

            SSLContext sslContext = SSLContext.getInstance("TLS");
            sslContext.init(null, trustAllCerts, new java.security.SecureRandom());
            HttpsURLConnection.setDefaultSSLSocketFactory(sslContext.getSocketFactory());
            HttpsURLConnection.setDefaultHostnameVerifier((hostname, session) -> true);

            SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory() {
                @Override
                protected void prepareConnection(HttpURLConnection connection, String httpMethod) throws java.io.IOException {
                    if (connection instanceof HttpsURLConnection) {
                        ((HttpsURLConnection) connection).setSSLSocketFactory(sslContext.getSocketFactory());
                        ((HttpsURLConnection) connection).setHostnameVerifier((hostname, session) -> true);
                    }
                    super.prepareConnection(connection, httpMethod);
                }
            };

            factory.setConnectTimeout(aepsProperties.getTimeout().getConnect());
            factory.setReadTimeout(aepsProperties.getTimeout().getRead());

            RestTemplate restTemplate = new RestTemplate(
                new BufferingClientHttpRequestFactory(factory)
            );

            List<ClientHttpRequestInterceptor> interceptors = new ArrayList<>();
            interceptors.add(aepsRetryInterceptor);
            interceptors.add(aepsLoggingInterceptor);
            restTemplate.setInterceptors(interceptors);

            restTemplate.setErrorHandler(aepsResponseErrorHandler);

            return restTemplate;
        } catch (Exception e) {
            throw new RuntimeException("Failed to create RestTemplate", e);
        }
    }
}
