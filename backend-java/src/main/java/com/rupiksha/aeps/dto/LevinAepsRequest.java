package com.rupiksha.aeps.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

/**
 * Request DTO for Levin AEPS v9 Onboarding API
 * URL: https://api.levinfintech.com/api/levin/v9/aeps-onboarding
 *
 * Sends both snake_case (per doc) and camelCase variants
 * because Levin v9 API validation errors show camelCase field names
 * (e.g. "shopLongitude", "permanentCity") which differ from the doc.
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LevinAepsRequest {

    // ── Auth ──────────────────────────────────────────────
    @JsonProperty("api_token")
    private String apiToken;

    @JsonProperty("user_id")
    private String userId;

    // ── Name (as per Aadhaar) ─────────────────────────────
    private String fname;
    private String middlename;
    private String lname;

    // ── Identity ──────────────────────────────────────────
    @JsonProperty("pan_card")
    private String pan_card;

    @JsonProperty("aadhar_number")
    private String aadhar_number;

    // ── Contact ───────────────────────────────────────────
    @JsonProperty("aeps_mobile")
    private String aeps_mobile;

    private String email;

    // ── Agent ID ──────────────────────────────────────────
    @JsonProperty("aeps_agent_id")
    private String aeps_agent_id;

    // ── Shop ──────────────────────────────────────────────
    @JsonProperty("shop_name")
    private String shop_name;

    // ── Address (snake_case per doc) ──────────────────────
    @JsonProperty("pin_code")
    private String pin_code;

    private String address;
    private String city;
    private String state;

    // ── Location (snake_case per doc) ─────────────────────
    private String latitude;
    private String longitude;

    // ── Address (camelCase - Levin v9 validation uses these) ──
    @JsonProperty("shopName")
    private String shopName;

    @JsonProperty("shopAddress")
    private String shopAddress;

    @JsonProperty("shopCity")
    private String shopCity;

    @JsonProperty("permanentCity")
    private String permanentCity;

    @JsonProperty("shopState")
    private String shopState;

    @JsonProperty("shopPinCode")
    private String shopPinCode;

    @JsonProperty("shopLatitude")
    private String shopLatitude;

    @JsonProperty("shopLongitude")
    private String shopLongitude;

    // ── Additional parameters ─────────────────────────────
    private String ad1;
    private String ad2;
    private String ad3;
    private String ad4;
}
