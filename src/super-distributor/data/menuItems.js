import {
    Users, Repeat, FileBarChart, FileText, Wallet, Percent,
    LifeBuoy, History, Monitor, MapPin, Youtube, User, Smartphone
} from 'lucide-react';

export const menuItems = [
    { title: "All Services", icon: Smartphone, path: "/super-distributor/all-services" },
    { title: "Retailers", icon: Users, path: "/super-distributor/retailers" },
    { title: "Distributors", icon: Users, path: "/super-distributor/distributors" },
    {
        title: "Transactions", icon: Repeat, path: "/super-distributor/transactions",
        submenu: [
            { title: "Super Distributor Receipt", icon: FileText, path: "/super-distributor/transactions/super-distributor-receipt" },
            { title: "Retailer Receipt", icon: FileText, path: "/super-distributor/transactions/retailer-receipt" }
        ]
    },
    {
        title: "Reports", icon: FileBarChart, path: "/super-distributor/reports",
        submenu: [
            { title: "Retailer Balance", icon: FileText, path: "/super-distributor/reports/retailer-balance" },
            { title: "Payment Request", icon: Wallet, path: "/super-distributor/reports/payment-request" },
            { title: "Purchase Report", icon: FileBarChart, path: "/super-distributor/reports/purchase" },
            { title: "Charge Report", icon: Percent, path: "/super-distributor/reports/charges" },
            { title: "Commission Report", icon: FileBarChart, path: "/super-distributor/reports/commission" },
            { title: "AEPS Report", icon: Monitor, path: "/super-distributor/reports/aeps" },
            { title: "DMT Report", icon: Monitor, path: "/super-distributor/reports/dmt" },
            { title: "BBPS Report", icon: Monitor, path: "/super-distributor/reports/bbps" },
            { title: "CMS Report", icon: FileText, path: "/super-distributor/reports/cms" },
        ]
    },
    {
        title: "Support", icon: LifeBuoy, path: "/super-distributor/support",
        submenu: [
            { title: "Online New Retailers Lead", icon: MapPin, path: "/super-distributor/support/leads" },
            { title: "ECollect/OLP Complaints", icon: Repeat, path: "/super-distributor/support/complaints-ecollect" },
            { title: "Retailer Complaint", icon: User, path: "/super-distributor/support/retailer-complaints" },
            { title: "Training Videos", icon: Youtube, path: "/super-distributor/support/videos" }
        ]
    },
    { title: "Old FY Reports", icon: History, path: "/super-distributor/old-reports" }
];
