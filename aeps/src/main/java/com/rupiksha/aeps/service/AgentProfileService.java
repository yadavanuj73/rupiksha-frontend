package com.rupiksha.aeps.service;

import com.rupiksha.aeps.entity.AgentProfile;
import com.rupiksha.aeps.repository.AgentProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AgentProfileService {

    private final AgentProfileRepository repository;


    // Save or Update profile
    public AgentProfile save(AgentProfile profile){

        return repository.findByMobile(profile.getMobile())
                .map(existing -> {

                    if(profile.getAgentId()!=null)
                        existing.setAgentId(profile.getAgentId());

                    if(profile.getMerchantId()!=null)
                        existing.setMerchantId(profile.getMerchantId());

                    if(profile.getName()!=null)
                        existing.setName(profile.getName());

                    if(profile.getShopName()!=null)
                        existing.setShopName(profile.getShopName());

                    if(profile.getAddress()!=null)
                        existing.setAddress(profile.getAddress());

                    if(profile.getCity()!=null)
                        existing.setCity(profile.getCity());

                    if(profile.getState()!=null)
                        existing.setState(profile.getState());

                    if(profile.getPinCode()!=null)
                        existing.setPinCode(profile.getPinCode());

                    if(profile.getLatitude()!=null)
                        existing.setLatitude(profile.getLatitude());

                    if(profile.getLongitude()!=null)
                        existing.setLongitude(profile.getLongitude());

                    return repository.save(existing);

                })
                .orElseGet(() -> repository.save(profile));

    }


    // Get profile
    public AgentProfile getByMobile(String mobile){

        return repository.findByMobile(mobile)
                .orElse(null);

    }

}