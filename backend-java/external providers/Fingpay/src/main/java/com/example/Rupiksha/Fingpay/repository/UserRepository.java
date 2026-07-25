package com.example.Rupiksha.Fingpay.repository;

import com.example.Rupiksha.Fingpay.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {
}