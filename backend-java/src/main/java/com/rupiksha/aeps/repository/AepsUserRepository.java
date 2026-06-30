package com.rupiksha.aeps.repository;

import com.rupiksha.aeps.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository("aepsUserRepository")
public interface AepsUserRepository extends JpaRepository<User, Long> {
    Optional<User> findByMobile(String mobile);
    Optional<User> findByUsername(String username);
}
