import {
    Users, Repeat, FileBarChart, FileText, Wallet, Percent,
    LifeBuoy, History, Monitor, MapPin, Youtube, User
} from 'lucide-react';

export const menuItems = [
    { title: "ALL SERVICES", icon: Monitor, path: "/distributor/all-services" },
    { title: "RETAILERS", icon: Users, path: "/distributor/retailers" },
    {
        title: "TRANSACTIONS", icon: Repeat, path: "/distributor/transactions",
        submenu: [
            { title: "Distributor Receipt", icon: FileText, path: "/distributor/transactions/distributor-receipt" },
            { title: "Retailer Receipt", icon: FileText, path: "/distributor/transactions/retailer-receipt" }
        ]
    },
    {
        title: "REPORTS", icon: FileBarChart, path: "/distributor/reports",
        submenu: [
            { title: "Retailer Balance", icon: FileText, path: "/distributor/reports/retailer-balance" },
            { title: "Payment Request", icon: Wallet, path: "/distributor/reports/payment-request" },
            { title: "Purchase Report", icon: FileBarChart, path: "/distributor/reports/purchase" },
            { title: "Charge Report", icon: Percent, path: "/distributor/reports/charges" },
            { title: "Commission Report", icon: FileBarChart, path: "/distributor/reports/commission" },
            { title: "AEPS Report", icon: Monitor, path: "/distributor/reports/aeps" },
            { title: "DMT Report", icon: Monitor, path: "/distributor/reports/dmt" },
            { title: "BBPS Report", icon: Monitor, path: "/distributor/reports/bbps" },
            { title: "CMS Report", icon: FileText, path: "/distributor/reports/cms" },
        ]
    },
    {
        title: "SUPPORT", icon: LifeBuoy, path: "/distributor/support",
        submenu: [
            { title: "Online New Retailers Lead", icon: MapPin, path: "/distributor/support/leads" },
            { title: "ECollect/OLP Complaints", icon: Repeat, path: "/distributor/support/complaints-ecollect" },
            { title: "Retailer Complaint", icon: User, path: "/distributor/support/retailer-complaints" },
            { title: "Training Videos", icon: Youtube, path: "/distributor/support/videos" }
        ]
    },
    { title: "OLD FY REPORTS", icon: History, path: "/distributor/old-reports" }
];
