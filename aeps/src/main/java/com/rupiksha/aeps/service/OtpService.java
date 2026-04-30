package com.rupiksha.aeps.service;

import com.rupiksha.aeps.entity.OtpLog;
import com.rupiksha.aeps.repository.OtpRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Random;

@Service
@RequiredArgsConstructor
public class OtpService {

    private final OtpRepository otpRepository;

    public String generateOtp(String mobile){

        String otp = String.valueOf(new Random().nextInt(900000)+100000);

        OtpLog log = new OtpLog();
        log.setMobile(mobile);
        log.setOtp(otp);
        log.setExpiry(LocalDateTime.now().plusMinutes(5));

        otpRepository.save(log);

        System.out.println("OTP : " + otp);

        return otp;
    }

    public boolean verifyOtp(String mobile,String otp){

        var log = otpRepository.findTopByMobileOrderByIdDesc(mobile);

        if(log.isPresent()){

            OtpLog otpLog = log.get();

            if(otpLog.getOtp().equals(otp)
                    && otpLog.getExpiry().isAfter(LocalDateTime.now())){

                otpLog.setVerified(true);
                otpRepository.save(otpLog);

                return true;
            }

        }

        return false;
    }
}