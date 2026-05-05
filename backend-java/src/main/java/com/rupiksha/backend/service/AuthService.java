package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.AuthDtos;

public interface AuthService {
    AuthDtos.AuthResponse login(AuthDtos.LoginRequest request);
    AuthDtos.AuthResponse refresh(AuthDtos.RefreshRequest request);
    AuthDtos.UserView register(AuthDtos.RegisterRequest request);
    void logout(String refreshToken);
}

