package com.rupiksha.backend.domain;

public enum EmployeeRole {
    NATIONAL_HEADER("National Head", 3),
    STATE_HEADER("State Head", 2),
    REGIONAL_HEADER("Zonal Head", 1);

    private final String displayName;
    private final int level;

    EmployeeRole(String displayName, int level) {
        this.displayName = displayName;
        this.level = level;
    }

    public String getDisplayName() {
        return displayName;
    }

    public int getLevel() {
        return level;
    }

    public boolean canManage(EmployeeRole subordinateRole) {
        if (subordinateRole == null) {
            return false;
        }
        return this.level > subordinateRole.level;
    }

    public static EmployeeRole fromString(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("Employee role is required");
        }
        String normalized = raw.trim().toUpperCase().replace('-', '_').replace(' ', '_');
        if ("NATIONAL_HEAD".equals(normalized) || "NATIONAL_HEADER".equals(normalized) || "NATIONAL".equals(normalized)) {
            return NATIONAL_HEADER;
        }
        if ("STATE_HEAD".equals(normalized) || "STATE_HEADER".equals(normalized) || "STATE".equals(normalized)) {
            return STATE_HEADER;
        }
        if ("ZONAL_HEAD".equals(normalized) || "ZONAL_HEADER".equals(normalized)
                || "REGIONAL_HEAD".equals(normalized) || "REGIONAL_HEADER".equals(normalized)
                || "ZONAL".equals(normalized) || "REGIONAL".equals(normalized)) {
            return REGIONAL_HEADER;
        }
        throw new IllegalArgumentException("Unsupported employee role: " + raw);
    }
}
