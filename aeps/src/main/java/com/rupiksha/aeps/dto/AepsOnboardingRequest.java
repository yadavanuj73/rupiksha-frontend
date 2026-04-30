package com.rupiksha.aeps.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Data;

@Data
public class AepsOnboardingRequest {

    private String fname;

    private String middlename;

    private String lname;

    private String pan_card;

    private String aadhar_number;

    @JsonAlias({"pinCode","pin_code"})
    private String pinCode;

    private String address;

    private String aeps_mobile;

    private String state;

    private String aeps_agent_id;

    private String shop_name;

    private String city;

    private String latitude;

    private String longitude;

    private String email;

    private String ad1;

    private String ad2;

    private String ad3;

    private String ad4;

}