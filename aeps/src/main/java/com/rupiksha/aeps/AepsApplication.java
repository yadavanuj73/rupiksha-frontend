package com.rupiksha.aeps;

import com.rupiksha.aeps.config.AepsProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(AepsProperties.class)
public class AepsApplication {

	public static void main(String[] args) {
		SpringApplication.run(AepsApplication.class, args);
	}

}
