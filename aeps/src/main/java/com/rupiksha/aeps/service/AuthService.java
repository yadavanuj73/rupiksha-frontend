package com.rupiksha.aeps.service;

import com.rupiksha.aeps.dto.SignupRequest;
import com.rupiksha.aeps.entity.User;
import com.rupiksha.aeps.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;

    // signup
    public User signup(SignupRequest request){

        // Check if user already exists
        if(userRepository.existsByMobile(request.getMobile())){
            return null;
        }

        User user = new User();

        user.setName(request.getName());
        user.setEmail(request.getEmail());
        user.setMobile(request.getMobile());
        user.setDob(request.getDob());

        return userRepository.save(user);
    }

    // check user exists
    public boolean userExists(String mobile){

        return userRepository.existsByMobile(mobile);

    }

}