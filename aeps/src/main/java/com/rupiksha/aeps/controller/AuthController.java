package com.rupiksha.aeps.controller;

import com.rupiksha.aeps.dto.*;
import com.rupiksha.aeps.entity.User;
import com.rupiksha.aeps.service.AuthService;
import com.rupiksha.aeps.service.OtpService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/aeps/auth")
@RequiredArgsConstructor
@CrossOrigin("*")
public class AuthController {

    private final AuthService authService;
    private final OtpService otpService;


    // signup
    @PostMapping("/signup")
    public AuthResponse signup(@RequestBody SignupRequest request){

        User user = authService.signup(request);

        if(user == null){
            return new AuthResponse("User already exists", false);
        }

        otpService.generateOtp(request.getMobile());

        return new AuthResponse("Signup success. OTP sent",true);

    }


    // send otp
    @PostMapping("/send-otp")
    public AuthResponse sendOtp(@RequestBody OtpRequest request){

        otpService.generateOtp(request.getMobile());

        return new AuthResponse("OTP sent",true);

    }


    // verify otp
    @PostMapping("/verify-otp")
    public AuthResponse verifyOtp(@RequestBody OtpVerifyRequest request){

        boolean valid =
                otpService.verifyOtp(request.getMobile(),request.getOtp());

        if(valid){
            return new AuthResponse("Login success",true);
        }

        return new AuthResponse("Invalid OTP",false);

    }


    // check user
    @PostMapping("/check-user")
    public boolean checkUser(@RequestBody OtpRequest request){

        return authService.userExists(request.getMobile());

    }

}