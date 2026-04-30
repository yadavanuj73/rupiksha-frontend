package com.rupiksha.aeps.repository;

import com.rupiksha.aeps.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByMobile(String mobile);

    boolean existsByMobile(String mobile);

}