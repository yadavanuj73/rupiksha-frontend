package com.rupiksha.aeps.controller;

import com.rupiksha.aeps.entity.AgentProfile;
import com.rupiksha.aeps.service.AgentProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/aeps/agent")
@RequiredArgsConstructor
@CrossOrigin("*")
public class AgentProfileController {

    private final AgentProfileService service;


    // save
    @PostMapping("/save")
    public AgentProfile save(
            @RequestBody AgentProfile profile
    ){

        return service.save(profile);

    }


    // get
    @GetMapping("/{mobile}")
    public AgentProfile get(
            @PathVariable String mobile
    ){

        return service.getByMobile(mobile);

    }

}