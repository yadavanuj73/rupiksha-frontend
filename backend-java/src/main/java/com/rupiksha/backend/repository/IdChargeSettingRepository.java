package com.rupiksha.backend.repository;

import com.rupiksha.backend.domain.IdChargeSetting;
import com.rupiksha.backend.domain.RoleName;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface IdChargeSettingRepository extends JpaRepository<IdChargeSetting, RoleName> {
}
