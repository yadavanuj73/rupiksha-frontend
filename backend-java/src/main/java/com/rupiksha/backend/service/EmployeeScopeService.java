package com.rupiksha.backend.service;

import com.rupiksha.backend.api.dto.EmployeeDtos;
import com.rupiksha.backend.domain.*;
import com.rupiksha.backend.repository.EmployeeRepository;
import com.rupiksha.backend.repository.EmployeeScopeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class EmployeeScopeService {

    private static final Map<String, List<String>> ZONE_TO_STATES = new LinkedHashMap<>();
    private static final Map<String, String> STATE_TO_ZONE = new HashMap<>();
    private static final Map<String, String> STATE_ALIASES = new HashMap<>();

    static {
        ZONE_TO_STATES.put("North Zone", List.of(
                "Chandigarh", "Delhi", "Haryana", "Himachal Pradesh",
                "Jammu and Kashmir", "Ladakh", "Punjab", "Rajasthan", "Uttarakhand"
        ));
        ZONE_TO_STATES.put("South Zone", List.of(
                "Andaman and Nicobar Islands", "Andhra Pradesh", "Karnataka",
                "Kerala", "Lakshadweep", "Puducherry", "Tamil Nadu", "Telangana"
        ));
        ZONE_TO_STATES.put("East Zone", List.of(
                "Bihar", "Jharkhand", "Odisha", "West Bengal"
        ));
        ZONE_TO_STATES.put("West Zone", List.of(
                "Dadra and Nagar Haveli and Daman and Diu", "Goa", "Gujarat", "Maharashtra"
        ));
        ZONE_TO_STATES.put("Central Zone", List.of(
                "Chhattisgarh", "Madhya Pradesh", "Uttar Pradesh"
        ));
        ZONE_TO_STATES.put("North-East Zone", List.of(
                "Arunachal Pradesh", "Assam", "Manipur", "Meghalaya",
                "Mizoram", "Nagaland", "Sikkim", "Tripura"
        ));

        for (Map.Entry<String, List<String>> entry : ZONE_TO_STATES.entrySet()) {
            String zone = entry.getKey();
            for (String state : entry.getValue()) {
                String normState = normalizeToken(state);
                STATE_TO_ZONE.put(normState, zone);
                STATE_ALIASES.put(normState, state);
            }
        }

        STATE_ALIASES.put("nct of delhi", "Delhi");
        STATE_ALIASES.put("new delhi", "Delhi");
        STATE_ALIASES.put("orissa", "Odisha");
        STATE_ALIASES.put("pondicherry", "Puducherry");
        STATE_ALIASES.put("uttaranchal", "Uttarakhand");
        STATE_ALIASES.put("jammu & kashmir", "Jammu and Kashmir");
        STATE_ALIASES.put("j&k", "Jammu and Kashmir");
        STATE_ALIASES.put("dadra and nagar haveli", "Dadra and Nagar Haveli and Daman and Diu");
        STATE_ALIASES.put("daman and diu", "Dadra and Nagar Haveli and Daman and Diu");
        STATE_ALIASES.put("andaman & nicobar islands", "Andaman and Nicobar Islands");
    }

    private final EmployeeRepository employeeRepository;
    private final EmployeeScopeRepository employeeScopeRepository;

    public EmployeeDtos.ZoneCatalogResponse getZoneCatalog() {
        List<String> allStates = ZONE_TO_STATES.values().stream()
                .flatMap(List::stream)
                .sorted()
                .toList();
        return new EmployeeDtos.ZoneCatalogResponse(ZONE_TO_STATES, allStates);
    }

    public String canonicalZoneName(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String clean = normalizeToken(raw);
        for (String canonical : ZONE_TO_STATES.keySet()) {
            if (normalizeToken(canonical).equals(clean)
                    || normalizeToken(canonical.replace(" zone", "").replace("-", "")).equals(clean.replace("zone", "").replace("-", ""))) {
                return canonical;
            }
        }
        return raw.trim();
    }

    public String canonicalStateName(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String norm = normalizeToken(raw);
        return STATE_ALIASES.getOrDefault(norm, raw.trim());
    }

    public String inferZoneForState(String rawState) {
        if (rawState == null || rawState.isBlank()) return null;
        String canonical = canonicalStateName(rawState);
        if (canonical == null) return null;
        return STATE_TO_ZONE.get(normalizeToken(canonical));
    }

    public List<EmployeeScope> buildValidatedScopes(
            Employee employee,
            EmployeeRole role,
            List<EmployeeDtos.ScopeItem> requestedScopes,
            String territoryFallback,
            Employee reportingManager
    ) {
        List<EmployeeScope> result = new ArrayList<>();

        if (role == EmployeeRole.NATIONAL_HEADER) {
            EmployeeScope scope = new EmployeeScope();
            scope.setEmployee(employee);
            scope.setScopeType(EmployeeScopeType.NATIONAL);
            scope.setZoneName("All India");
            result.add(scope);
            return result;
        }

        List<EmployeeDtos.ScopeItem> items = requestedScopes == null ? List.of() : requestedScopes;

        if (role == EmployeeRole.STATE_HEADER) {
            Set<String> seenStates = new LinkedHashSet<>();
            for (EmployeeDtos.ScopeItem item : items) {
                if (item == null || !hasText(item.stateName())) continue;
                String canonical = canonicalStateName(item.stateName());
                if (seenStates.add(normalizeToken(canonical))) {
                    EmployeeScope s = new EmployeeScope();
                    s.setEmployee(employee);
                    s.setScopeType(EmployeeScopeType.STATE);
                    s.setStateName(canonical);
                    s.setZoneName(inferZoneForState(canonical));
                    result.add(s);
                }
            }
            if (result.isEmpty() && hasText(territoryFallback)) {
                for (String part : territoryFallback.split(",")) {
                    if (hasText(part)) {
                        String canonical = canonicalStateName(part);
                        if (seenStates.add(normalizeToken(canonical))) {
                            EmployeeScope s = new EmployeeScope();
                            s.setEmployee(employee);
                            s.setScopeType(EmployeeScopeType.STATE);
                            s.setStateName(canonical);
                            s.setZoneName(inferZoneForState(canonical));
                            result.add(s);
                        }
                    }
                }
            }
            if (result.isEmpty()) {
                throw new IllegalArgumentException("State Head must be assigned at least one state.");
            }
            validateScopeContainment(result, reportingManager);
            return result;
        }

        // REGIONAL_HEADER (Zonal Head)
        Set<String> seenKeys = new LinkedHashSet<>();
        for (EmployeeDtos.ScopeItem item : items) {
            if (item == null) continue;
            String zone = hasText(item.zoneName()) ? canonicalZoneName(item.zoneName()) : null;
            String state = hasText(item.stateName()) ? canonicalStateName(item.stateName()) : null;
            String city = hasText(item.cityOrDistrict()) ? item.cityOrDistrict().trim() : null;
            if (zone == null && state == null && city == null) continue;
            String key = (zone == null ? "" : normalizeToken(zone)) + "|"
                    + (state == null ? "" : normalizeToken(state)) + "|"
                    + (city == null ? "" : normalizeToken(city));
            if (seenKeys.add(key)) {
                EmployeeScope s = new EmployeeScope();
                s.setEmployee(employee);
                s.setScopeType(EmployeeScopeType.ZONE);
                s.setZoneName(zone != null ? zone : (state != null ? inferZoneForState(state) : null));
                s.setStateName(state);
                s.setCityOrDistrict(city);
                result.add(s);
            }
        }
        if (result.isEmpty() && hasText(territoryFallback)) {
            for (String part : territoryFallback.split(",")) {
                if (hasText(part)) {
                    String trimmed = part.trim();
                    String zCanonical = canonicalZoneName(trimmed);
                    EmployeeScope s = new EmployeeScope();
                    s.setEmployee(employee);
                    s.setScopeType(EmployeeScopeType.ZONE);
                    if (ZONE_TO_STATES.containsKey(zCanonical)) {
                        s.setZoneName(zCanonical);
                    } else if (STATE_TO_ZONE.containsKey(normalizeToken(canonicalStateName(trimmed)))) {
                        String st = canonicalStateName(trimmed);
                        s.setStateName(st);
                        s.setZoneName(inferZoneForState(st));
                    } else {
                        s.setCityOrDistrict(trimmed);
                    }
                    result.add(s);
                }
            }
        }
        if (result.isEmpty()) {
            throw new IllegalArgumentException("Zonal Head must be assigned at least one zone, state, or district/city scope.");
        }
        validateScopeContainment(result, reportingManager);
        return result;
    }

    public String buildTerritorySummary(EmployeeRole role, List<EmployeeScope> scopes) {
        if (role == EmployeeRole.NATIONAL_HEADER) {
            return "All India (National)";
        }
        if (scopes == null || scopes.isEmpty()) {
            return "Unassigned";
        }
        List<String> parts = new ArrayList<>();
        for (EmployeeScope s : scopes) {
            if (hasText(s.getCityOrDistrict()) && hasText(s.getStateName())) {
                parts.add(s.getCityOrDistrict() + ", " + s.getStateName());
            } else if (hasText(s.getCityOrDistrict())) {
                parts.add(s.getCityOrDistrict());
            } else if (hasText(s.getStateName())) {
                parts.add(s.getStateName());
            } else if (hasText(s.getZoneName())) {
                parts.add(s.getZoneName());
            }
        }
        String joined = String.join(", ", parts.stream().distinct().toList());
        return joined.length() > 250 ? joined.substring(0, 247) + "..." : joined;
    }

    private void validateScopeContainment(List<EmployeeScope> childScopes, Employee manager) {
        if (manager == null || manager.getEmployeeRole() == EmployeeRole.NATIONAL_HEADER) {
            return;
        }
        if (manager.getEmployeeRole() == EmployeeRole.STATE_HEADER) {
            List<EmployeeScope> managerScopes = employeeScopeRepository.findByEmployeeId(manager.getId());
            Set<String> managerStates = new HashSet<>();
            for (EmployeeScope ms : managerScopes) {
                if (hasText(ms.getStateName())) {
                    managerStates.add(normalizeToken(canonicalStateName(ms.getStateName())));
                }
            }
            for (EmployeeScope cs : childScopes) {
                if (hasText(cs.getStateName())) {
                    String st = normalizeToken(canonicalStateName(cs.getStateName()));
                    if (!managerStates.contains(st)) {
                        throw new IllegalArgumentException(
                                "Assigned state '" + cs.getStateName() + "' is outside reporting State Head's permitted states."
                        );
                    }
                } else if (hasText(cs.getZoneName())) {
                    List<String> zoneStates = ZONE_TO_STATES.get(canonicalZoneName(cs.getZoneName()));
                    if (zoneStates != null) {
                        boolean anyOverlap = zoneStates.stream()
                                .map(EmployeeScopeService::normalizeToken)
                                .anyMatch(managerStates::contains);
                        if (!anyOverlap) {
                            throw new IllegalArgumentException(
                                    "Assigned zone '" + cs.getZoneName() + "' has no overlap with reporting State Head's states."
                            );
                        }
                    }
                }
            }
        }
    }

    public Set<UUID> resolveSubordinateEmployeeIds(UUID rootEmployeeId) {
        List<Employee> all = employeeRepository.findAll();
        return resolveSubordinateEmployeeIds(rootEmployeeId, all);
    }

    public Set<UUID> resolveSubordinateEmployeeIds(UUID rootEmployeeId, List<Employee> allEmployees) {
        Map<UUID, List<UUID>> childrenMap = new HashMap<>();
        for (Employee emp : allEmployees) {
            if (emp.getReportingManagerId() != null) {
                childrenMap.computeIfAbsent(emp.getReportingManagerId(), k -> new ArrayList<>()).add(emp.getId());
            }
        }
        Set<UUID> descendants = new LinkedHashSet<>();
        Deque<UUID> queue = new ArrayDeque<>();
        queue.add(rootEmployeeId);
        while (!queue.isEmpty()) {
            UUID current = queue.poll();
            List<UUID> children = childrenMap.getOrDefault(current, List.of());
            for (UUID childId : children) {
                if (!childId.equals(rootEmployeeId) && descendants.add(childId)) {
                    queue.add(childId);
                }
            }
        }
        return descendants;
    }

    public boolean isMemberUser(User user) {
        if (user == null || user.getRoles() == null) return false;
        boolean isAdmin = user.getRoles().stream().anyMatch(r -> r.getName() == RoleName.ADMIN);
        if (isAdmin) return false;
        return user.getRoles().stream().anyMatch(r ->
                r.getName() == RoleName.RETAILER
                        || r.getName() == RoleName.DISTRIBUTOR
                        || r.getName() == RoleName.SUPER_DISTRIBUTOR
        );
    }

    public boolean isUserInHierarchyAndScope(
            User user,
            Employee employee,
            List<EmployeeScope> scopes,
            Set<UUID> subordinateEmployeeIds
    ) {
        if (!isMemberUser(user) || employee == null) {
            return false;
        }
        UUID onboardedBy = user.getOnboardedByEmployeeId();
        boolean inEmployeeHierarchy = onboardedBy != null
                && (employee.getId().equals(onboardedBy)
                || (subordinateEmployeeIds != null && subordinateEmployeeIds.contains(onboardedBy)));
        return inEmployeeHierarchy && isUserInEmployeeScope(user, employee, scopes);
    }

    public boolean isUserInEmployeeScope(User user, Employee employee, List<EmployeeScope> scopes) {
        if (!isMemberUser(user) || employee == null) {
            return false;
        }
        if (employee.getEmployeeRole() == EmployeeRole.NATIONAL_HEADER) {
            return true;
        }
        if (scopes == null || scopes.isEmpty()) {
            return false;
        }
        for (EmployeeScope scope : scopes) {
            if (matchesSingleScope(user, scope)) {
                return true;
            }
        }
        return false;
    }

    public void validateLocationWithinEmployeeScope(
            Employee employee,
            List<EmployeeScope> scopes,
            String stateName,
            String cityOrDistrict,
            String zoneName
    ) {
        if (employee.getEmployeeRole() == EmployeeRole.NATIONAL_HEADER) {
            return;
        }
        if (scopes == null || scopes.isEmpty()) {
            throw new IllegalArgumentException("You do not have an assigned geographical scope for onboarding.");
        }
        String normState = hasText(stateName) ? normalizeToken(canonicalStateName(stateName)) : "";
        String normCity = hasText(cityOrDistrict) ? normalizeToken(cityOrDistrict) : "";
        String normZone = hasText(zoneName) ? normalizeToken(canonicalZoneName(zoneName)) : "";
        if (normZone.isEmpty() && !normState.isEmpty()) {
            String inferred = inferZoneForState(canonicalStateName(stateName));
            if (inferred != null) {
                normZone = normalizeToken(inferred);
            }
        }

        if (employee.getEmployeeRole() == EmployeeRole.STATE_HEADER) {
            if (normState.isEmpty()) {
                throw new IllegalArgumentException("State is required to onboard a user under your State Head scope.");
            }
            for (EmployeeScope s : scopes) {
                if (hasText(s.getStateName()) && normalizeToken(canonicalStateName(s.getStateName())).equals(normState)) {
                    return;
                }
            }
            throw new IllegalArgumentException("State '" + stateName + "' is outside your assigned state scope.");
        }

        // REGIONAL_HEADER (Zonal Head)
        for (EmployeeScope s : scopes) {
            boolean stateMatch = !hasText(s.getStateName()) ||
                    (!normState.isEmpty() && normalizeToken(canonicalStateName(s.getStateName())).equals(normState));
            boolean cityMatch = !hasText(s.getCityOrDistrict()) ||
                    (!normCity.isEmpty() && normalizeToken(s.getCityOrDistrict()).equals(normCity));
            boolean zoneMatch = true;
            if (hasText(s.getZoneName())) {
                String scopeZoneNorm = normalizeToken(s.getZoneName());
                boolean directZoneMatch = !normZone.isEmpty() && scopeZoneNorm.equals(normZone);
                boolean inferredZoneMatch = !normState.isEmpty() && stateBelongsToZone(normState, s.getZoneName());
                zoneMatch = directZoneMatch || inferredZoneMatch;
            }
            if (stateMatch && cityMatch && zoneMatch) {
                return;
            }
        }
        throw new IllegalArgumentException("Selected state/zone/city is outside your assigned Zonal Head scope.");
    }

    private boolean matchesSingleScope(User user, EmployeeScope scope) {
        String userState = firstNonBlank(user.getStateName(), user.getShopState(), user.getPermState());
        String userCity = firstNonBlank(user.getCity(), user.getShopCity(), user.getShopDistrict(), user.getPermCity(), user.getPermDistrict());
        String userZone = user.getZoneName();

        String normUserState = hasText(userState) ? normalizeToken(canonicalStateName(userState)) : "";
        String normUserCity = hasText(userCity) ? normalizeToken(userCity) : "";
        String normUserDistrict = hasText(user.getShopDistrict()) ? normalizeToken(user.getShopDistrict()) : "";
        String normUserZone = hasText(userZone) ? normalizeToken(canonicalZoneName(userZone)) : "";

        if (scope.getScopeType() == EmployeeScopeType.NATIONAL) {
            return true;
        }
        if (scope.getScopeType() == EmployeeScopeType.STATE) {
            return hasText(scope.getStateName())
                    && !normUserState.isEmpty()
                    && normalizeToken(canonicalStateName(scope.getStateName())).equals(normUserState);
        }

        // ZONE
        boolean hasAnyConstraint = false;
        if (hasText(scope.getCityOrDistrict())) {
            hasAnyConstraint = true;
            String targetCity = normalizeToken(scope.getCityOrDistrict());
            boolean cityMatched = targetCity.equals(normUserCity) || targetCity.equals(normUserDistrict);
            if (!cityMatched) {
                return false;
            }
        }
        if (hasText(scope.getStateName())) {
            hasAnyConstraint = true;
            if (normUserState.isEmpty() || !normalizeToken(canonicalStateName(scope.getStateName())).equals(normUserState)) {
                return false;
            }
        }
        if (hasText(scope.getZoneName()) && !hasText(scope.getStateName()) && !hasText(scope.getCityOrDistrict())) {
            hasAnyConstraint = true;
            String targetZone = normalizeToken(canonicalZoneName(scope.getZoneName()));
            boolean directZone = !normUserZone.isEmpty() && targetZone.equals(normUserZone);
            boolean stateInZone = !normUserState.isEmpty() && stateBelongsToZone(normUserState, scope.getZoneName());
            return directZone || stateInZone;
        }
        return hasAnyConstraint;
    }

    private boolean stateBelongsToZone(String normalizedState, String zoneName) {
        String canonicalZone = canonicalZoneName(zoneName);
        List<String> states = ZONE_TO_STATES.get(canonicalZone);
        if (states == null) {
            return false;
        }
        return states.stream().map(EmployeeScopeService::normalizeToken).anyMatch(s -> s.equals(normalizedState));
    }

    private String firstNonBlank(String... values) {
        for (String v : values) {
            if (hasText(v)) return v;
        }
        return null;
    }

    private boolean hasText(String s) {
        return s != null && !s.isBlank();
    }

    private static String normalizeToken(String s) {
        return s == null ? "" : s.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }
}
