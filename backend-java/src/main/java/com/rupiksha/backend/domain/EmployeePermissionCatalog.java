package com.rupiksha.backend.domain;

import java.util.*;

public final class EmployeePermissionCatalog {

    public record PermissionDefinition(
            String category,
            String categoryLabel,
            String code,
            String label,
            String description,
            boolean onboardingWrite
    ) {}

    public static final String CAT_DASHBOARD = "DASHBOARD";
    public static final String CAT_USER_MANAGEMENT = "USER_MANAGEMENT";
    public static final String CAT_TRANSACTION_MANAGEMENT = "TRANSACTION_MANAGEMENT";
    public static final String CAT_EMPLOYEE_VISIBILITY = "EMPLOYEE_VISIBILITY";

    public static final String VIEW_DASHBOARD = "VIEW_DASHBOARD";
    public static final String VIEW_TRANSACTION_METRICS = "VIEW_TRANSACTION_METRICS";
    public static final String VIEW_SALES_METRICS = "VIEW_SALES_METRICS";
    public static final String VIEW_USER_STATISTICS = "VIEW_USER_STATISTICS";
    public static final String VIEW_EMPLOYEE_STATISTICS = "VIEW_EMPLOYEE_STATISTICS";

    public static final String VIEW_RETAILERS = "VIEW_RETAILERS";
    public static final String VIEW_DISTRIBUTORS = "VIEW_DISTRIBUTORS";
    public static final String VIEW_SUPER_DISTRIBUTORS = "VIEW_SUPER_DISTRIBUTORS";
    public static final String CREATE_RETAILER_ACCOUNT = "CREATE_RETAILER_ACCOUNT";
    public static final String CREATE_DISTRIBUTOR_ACCOUNT = "CREATE_DISTRIBUTOR_ACCOUNT";
    public static final String CREATE_SUPER_DISTRIBUTOR_ACCOUNT = "CREATE_SUPER_DISTRIBUTOR_ACCOUNT";
    public static final String VIEW_USER_DETAILS = "VIEW_USER_DETAILS";
    public static final String VIEW_USER_KYC_STATUS = "VIEW_USER_KYC_STATUS";

    public static final String VIEW_TRANSACTIONS = "VIEW_TRANSACTIONS";
    public static final String VIEW_TRANSACTION_DETAILS = "VIEW_TRANSACTION_DETAILS";
    public static final String VIEW_WALLET_TRANSACTIONS = "VIEW_WALLET_TRANSACTIONS";
    public static final String VIEW_AEPS_TRANSACTIONS = "VIEW_AEPS_TRANSACTIONS";
    public static final String VIEW_RECHARGE_TRANSACTIONS = "VIEW_RECHARGE_TRANSACTIONS";
    public static final String VIEW_BBPS_TRANSACTIONS = "VIEW_BBPS_TRANSACTIONS";
    public static final String VIEW_PAYOUT_TRANSACTIONS = "VIEW_PAYOUT_TRANSACTIONS";
    public static final String VIEW_TRANSACTION_REPORTS = "VIEW_TRANSACTION_REPORTS";
    public static final String DOWNLOAD_PERMITTED_REPORTS = "DOWNLOAD_PERMITTED_REPORTS";

    public static final String VIEW_EMPLOYEES_UNDER_HIERARCHY = "VIEW_EMPLOYEES_UNDER_HIERARCHY";
    public static final String VIEW_EMPLOYEE_PERFORMANCE = "VIEW_EMPLOYEE_PERFORMANCE";

    private static final List<PermissionDefinition> ALL_DEFINITIONS = List.of(
            // DASHBOARD
            new PermissionDefinition(CAT_DASHBOARD, "Dashboard", VIEW_DASHBOARD, "View Dashboard", "Access the employee overview dashboard", false),
            new PermissionDefinition(CAT_DASHBOARD, "Dashboard", VIEW_TRANSACTION_METRICS, "View Transaction Metrics", "View transaction counts and status breakdown", false),
            new PermissionDefinition(CAT_DASHBOARD, "Dashboard", VIEW_SALES_METRICS, "View Sales Metrics", "View volume and date-wise business trends", false),
            new PermissionDefinition(CAT_DASHBOARD, "Dashboard", VIEW_USER_STATISTICS, "View User Statistics", "View scoped retailer, distributor & super distributor counts", false),
            new PermissionDefinition(CAT_DASHBOARD, "Dashboard", VIEW_EMPLOYEE_STATISTICS, "View Employee Statistics", "View subordinate employee headcount metrics", false),

            // USER MANAGEMENT (Read-only + strictly limited 3 onboarding creation permissions)
            new PermissionDefinition(CAT_USER_MANAGEMENT, "User Management", VIEW_RETAILERS, "View Retailers", "View retailers within assigned scope (read-only)", false),
            new PermissionDefinition(CAT_USER_MANAGEMENT, "User Management", VIEW_DISTRIBUTORS, "View Distributors", "View distributors within assigned scope (read-only)", false),
            new PermissionDefinition(CAT_USER_MANAGEMENT, "User Management", VIEW_SUPER_DISTRIBUTORS, "View Super Distributors", "View super distributors within assigned scope (read-only)", false),
            new PermissionDefinition(CAT_USER_MANAGEMENT, "User Management", CREATE_RETAILER_ACCOUNT, "Create Retailer Account", "Onboard new Retailer accounts within permitted scope", true),
            new PermissionDefinition(CAT_USER_MANAGEMENT, "User Management", CREATE_DISTRIBUTOR_ACCOUNT, "Create Distributor Account", "Onboard new Distributor accounts within permitted scope", true),
            new PermissionDefinition(CAT_USER_MANAGEMENT, "User Management", CREATE_SUPER_DISTRIBUTOR_ACCOUNT, "Create Super Distributor Account", "Onboard new Super Distributor accounts within permitted scope", true),
            new PermissionDefinition(CAT_USER_MANAGEMENT, "User Management", VIEW_USER_DETAILS, "View User Details", "Inspect scoped member profile details (read-only)", false),
            new PermissionDefinition(CAT_USER_MANAGEMENT, "User Management", VIEW_USER_KYC_STATUS, "View User KYC Status", "View KYC status of scoped members (read-only)", false),

            // TRANSACTION MANAGEMENT
            new PermissionDefinition(CAT_TRANSACTION_MANAGEMENT, "Transaction Management", VIEW_TRANSACTIONS, "View Transactions", "View transaction ledger across permitted hierarchy", false),
            new PermissionDefinition(CAT_TRANSACTION_MANAGEMENT, "Transaction Management", VIEW_TRANSACTION_DETAILS, "View Transaction Details", "View detailed transaction receipt & status metadata", false),
            new PermissionDefinition(CAT_TRANSACTION_MANAGEMENT, "Transaction Management", VIEW_WALLET_TRANSACTIONS, "View Wallet Transactions", "View wallet transfer & ledger entries in scope", false),
            new PermissionDefinition(CAT_TRANSACTION_MANAGEMENT, "Transaction Management", VIEW_AEPS_TRANSACTIONS, "View AEPS Transactions", "View AEPS transactions in scope", false),
            new PermissionDefinition(CAT_TRANSACTION_MANAGEMENT, "Transaction Management", VIEW_RECHARGE_TRANSACTIONS, "View Recharge Transactions", "View recharge transactions in scope", false),
            new PermissionDefinition(CAT_TRANSACTION_MANAGEMENT, "Transaction Management", VIEW_BBPS_TRANSACTIONS, "View BBPS Transactions", "View BBPS utility payment transactions in scope", false),
            new PermissionDefinition(CAT_TRANSACTION_MANAGEMENT, "Transaction Management", VIEW_PAYOUT_TRANSACTIONS, "View Payout Transactions", "View payout/DMT transactions in scope", false),
            new PermissionDefinition(CAT_TRANSACTION_MANAGEMENT, "Transaction Management", VIEW_TRANSACTION_REPORTS, "View Transaction Reports", "View service-wise & date-wise transaction reports", false),
            new PermissionDefinition(CAT_TRANSACTION_MANAGEMENT, "Transaction Management", DOWNLOAD_PERMITTED_REPORTS, "Download Permitted Reports", "Export permitted CSV/JSON report data", false),

            // EMPLOYEE VISIBILITY
            new PermissionDefinition(CAT_EMPLOYEE_VISIBILITY, "Employee Visibility", VIEW_EMPLOYEES_UNDER_HIERARCHY, "View Employees Under Assigned Hierarchy", "View subordinate employees beneath your branch", false),
            new PermissionDefinition(CAT_EMPLOYEE_VISIBILITY, "Employee Visibility", VIEW_EMPLOYEE_PERFORMANCE, "View Employee Performance", "View onboarding and transaction performance of subordinates", false)
    );

    private static final Map<String, PermissionDefinition> BY_CODE = new LinkedHashMap<>();
    private static final Map<String, PermissionDefinition> SAFE_ALIASES = new HashMap<>();

    static {
        for (PermissionDefinition def : ALL_DEFINITIONS) {
            BY_CODE.put(def.code(), def);
            SAFE_ALIASES.put(normalizeKey(def.code()), def);
            SAFE_ALIASES.put(normalizeKey(def.label()), def);
        }
        // Safe read-only legacy mappings from earlier UI drafts
        SAFE_ALIASES.put(normalizeKey("View Live Dashboard"), BY_CODE.get(VIEW_DASHBOARD));
        SAFE_ALIASES.put(normalizeKey("View Revenue Metrics"), BY_CODE.get(VIEW_SALES_METRICS));
        SAFE_ALIASES.put(normalizeKey("View Header Employees"), BY_CODE.get(VIEW_EMPLOYEES_UNDER_HIERARCHY));
    }

    private EmployeePermissionCatalog() {}

    public static List<PermissionDefinition> allDefinitions() {
        return ALL_DEFINITIONS;
    }

    public static PermissionDefinition resolveStrict(String rawCodeOrLabel) {
        if (rawCodeOrLabel == null || rawCodeOrLabel.isBlank()) {
            throw new IllegalArgumentException("Permission code cannot be blank");
        }
        String key = normalizeKey(rawCodeOrLabel);
        PermissionDefinition found = SAFE_ALIASES.get(key);
        if (found == null) {
            throw new IllegalArgumentException(
                    "Permission '" + rawCodeOrLabel + "' is either unknown or restricted from employees"
            );
        }
        return found;
    }

    public static boolean isValidPermissionCode(String code) {
        return code != null && BY_CODE.containsKey(code.trim().toUpperCase(Locale.ROOT));
    }

    private static String normalizeKey(String value) {
        return value.trim().toUpperCase(Locale.ROOT)
                .replaceAll("[^A-Z0-9]+", "_")
                .replaceAll("^_+|_+$", "");
    }
}
