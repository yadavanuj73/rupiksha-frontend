package com.rupiksha.aeps.dto;

import lombok.Data;

@Data
public class SignupRequest {

    private String name;
    private String email;
    private String mobile;
    private String dob;

}