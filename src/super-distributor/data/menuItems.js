import {
    Users, Repeat, FileBarChart, Map, FileText, Wallet, Percent,
    LifeBuoy, History, Monitor, MapPin, Youtube, User, Plus, Share2,
    CheckCircle2, Settings as SettingsIcon, Landmark,
    AlertCircle, Clock, X
} from 'lucide-react';

export const menuItems = [
    { title: "ALL SERVICES", icon: Monitor, path: "/super-distributor/all-services" },
    { title: "APPROVALS", icon: CheckCircle2, path: "/super-distributor/approvals" },
    { title: "LOAN APPROVALS", icon: Landmark, path: "/super-distributor/loans" },
    {
        title: "ALL MEMBERS", icon: Users, path: "/super-distributor/members",
        submenu: [
            { title: "Manage Members", icon: Users, path: "/super-distributor/members" },
            { title: "Super Distributor", icon: Users, path: "/super-distributor/super-distributors" },
            { title: "Distributors", icon: Users, path: "/super-distributor/distributors" },
            { title: "Retailer Details", icon: Monitor, path: "/super-distributor/retailers/details" },
            { title: "Share Rupiksha APP", icon: Share2, path: "/super-distributor/retailers/share" },
            { title: "Service Workflow", icon: Monitor, path: "/super-distributor/retailers/workflow" }
        ]
    },
    {
        title: "WALLET CONTROL", icon: Wallet, path: "/super-distributor/wallet",
        submenu: [
            { title: "Credit Fund", icon: Plus, path: "/super-distributor/wallet/credit" },
            { title: "Debit Fund", icon: X, path: "/super-distributor/wallet/debit" },
            { title: "Fund Requests", icon: Clock, path: "/super-distributor/wallet/requests" },
            { title: "Lock Amount", icon: AlertCircle, path: "/super-distributor/wallet/lock" },
            { title: "Release Lock", icon: CheckCircle2, path: "/super-distributor/wallet/release" }
        ]
    },
    {
        title: "TRANSACTIONS", icon: Repeat, path: "/super-distributor/transactions",
        submenu: [
            { title: "SUPER_DISTRIBUTOR Receipt", icon: FileText, path: "/super-distributor/transactions/super-distributor-receipt" },
            { title: "Retailer Receipt", icon: FileText, path: "/super-distributor/transactions/retailer-receipt" },
            { title: "Add Money", icon: Wallet, path: "/super-distributor/transactions/add-money" },
            { title: "Axis CDM Card", icon: Monitor, path: "/super-distributor/transactions/axis-cdm" },
            { title: "Axis Card Mapping", icon: Percent, path: "/super-distributor/transactions/axis-mapping" }
        ]
    },
    {
        title: "REPORTS", icon: FileBarChart, path: "/super-distributor/reports",
        submenu: [
            { title: "Sale Report", icon: FileText, path: "/super-distributor/reports/sale-report" },
            { title: "Consolidated-ledger", icon: FileText, path: "/super-distributor/reports/consolidated-ledger" },
            { title: "Daily ledger", icon: FileText, path: "/super-distributor/reports/daily-ledger" },
            { title: "GST E-Invoice", icon: FileText, path: "/super-distributor/reports/gst-einvoice" },
            { title: "GST E-Invoice Report", icon: FileText, path: "/super-distributor/reports/gst-einvoice-report" },
            { title: "GSTIN Invoice", icon: FileText, path: "/super-distributor/reports/gstin-invoice" },
            { title: "Consolidated GSTIN Invoice", icon: FileText, path: "/super-distributor/reports/consolidated-gstin-invoice" },
            { title: "Consolidated Commission Receipt", icon: FileText, path: "/super-distributor/reports/consolidated-commission" },
            { title: "TDS", icon: FileText, path: "/super-distributor/reports/tds" },
            { title: "Payment Request History", icon: Wallet, path: "/super-distributor/reports/payment-request" },
            { title: "EMI Reports", icon: FileText, path: "/super-distributor/reports/emi-reports" },
            { title: "QR Transactions Report", icon: FileText, path: "/super-distributor/reports/qr-transactions" },
        ]
    },
    { title: "PLAN & RATES", icon: Map, path: "/super-distributor/plans" },
    { title: "INVOICE", icon: FileText, path: "/super-distributor/invoice" },
    {
        title: "ACCOUNTS", icon: Wallet, path: "/super-distributor/accounts",
        submenu: [
            { title: "My Ledger", icon: FileText, path: "/super-distributor/accounts/my-ledger" },
            { title: "Retailer Ledger", icon: Monitor, path: "/super-distributor/accounts/retailer-ledger" },
            { title: "Commission Reports", icon: FileBarChart, path: "/super-distributor/accounts/commission" }
        ]
    },
    {
        title: "PROMOTIONS", icon: Percent, path: "/super-distributor/promotions",
        submenu: [
            { title: "Promotions", icon: Plus, path: "/super-distributor/promotions/list" },
            { title: "Video / Pdf", icon: Monitor, path: "/super-distributor/promotions/assets" }
        ]
    },
    {
        title: "SUPPORT", icon: LifeBuoy, path: "/super-distributor/support",
        submenu: [
            { title: "Online New Retailers Lead", icon: MapPin, path: "/super-distributor/support/leads" },
            { title: "ECollect/OLP Complaints", icon: Repeat, path: "/super-distributor/support/complaints-ecollect" },
            { title: "Retailer Complaint", icon: User, path: "/super-distributor/support/retailer-complaints" },
            { title: "Training Videos", icon: Youtube, path: "/super-distributor/support/videos" }
        ]
    },
    { title: "OLD FY REPORTS", icon: History, path: "/super-distributor/old-reports" },
    { title: "SETTINGS", icon: SettingsIcon, path: "/super-distributor/settings" }
];
