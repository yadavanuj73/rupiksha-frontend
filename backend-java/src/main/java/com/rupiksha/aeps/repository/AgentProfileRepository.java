package com.rupiksha.aeps.repository;

import com.rupiksha.aeps.entity.AgentProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface AgentProfileRepository extends JpaRepository<AgentProfile, Long> {
    Optional<AgentProfile> findByAgentId(String agentId);
    Optional<AgentProfile> findByMobile(String mobile);
}
