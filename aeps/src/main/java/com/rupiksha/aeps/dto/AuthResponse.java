package com.rupiksha.aeps.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class AuthResponse {

    private String message;
    private boolean success;

}