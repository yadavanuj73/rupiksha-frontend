import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { 
    FileText, Search, Download, Calendar, IndianRupee, 
    ArrowRight, Filter, RefreshCw, CheckCircle, Clock, 
    AlertCircle, Smartphone, Fingerprint, ChevronRight,
    ArrowUpRight, ArrowDownRight, Printer, Share2, Coins,
    Landmark, CreditCard, Copy, Eye, X, HelpCircle, Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { transactionService } from '../../services/apiService';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const getReportEnum = (type) => {
    const mapping = {
        aeps_1: 'AEPS_FINGPAY',
        aeps_2: 'AEPS_LEVIN',
        payout_hub: 'PAYOUT',
        money_transfer: 'MONEY_TRANSFER',
        move_to_bank: 'MOVE_TO_BANK',
        airtel_cms: 'CMS_AIRTEL',
        fingpay_cms: 'CMS_FINGPAY',
        bbps_bill_pay: 'BBPS',
        wallet: 'WALLET',
        wallet_to_wallet: 'WALLET_TRANSFER',
        mobile_dth_recharge: 'RECHARGE',
        aeps_cash_deposit: 'AEPS_CASH_DEPOSIT',
        micro_atm_transactions: 'MICRO_ATM',
        aadhaar_pay: 'AADHAAR_PAY',
        payment_gateway: 'PAYMENT_GATEWAY',
        credit_card_bill: 'CREDIT_CARD_BILL',
        upi_cash_withdrawal: 'UPI_CASH_WITHDRAWAL',
        my_earnings_report: 'EARNINGS'
    };
    return mapping[type] || 'AEPS_FINGPAY';
};

const FINGPAY_CMS_MOCK_DATA = [
    {
        transactionId: "RXCMS9281041",
        providerReference: "FP-CMS-892101",
        bankReference: "410294829101",
        createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 24).toISOString(),
        serviceType: "CMS Collection",
        provider: "Fingpay",
        amount: 8500.00,
        commission: 25.50,
        openingBalance: 42150.00,
        closingBalance: 50675.50,
        status: "SUCCESS",
        remarks: "L&T Finance - Loan EMI Collection (ID: LT98234190)"
    },
    {
        transactionId: "RXCMS9281042",
        providerReference: "FP-CMS-892102",
        bankReference: "410294829102",
        createdAt: new Date(Date.now() - 1000 * 60 * 85).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 84).toISOString(),
        serviceType: "CMS Collection",
        provider: "Fingpay",
        amount: 14200.00,
        commission: 42.60,
        openingBalance: 27950.00,
        closingBalance: 42192.60,
        status: "SUCCESS",
        remarks: "Bajaj Finance - Two Wheeler EMI (ID: BJ8829103)"
    },
    {
        transactionId: "RXCMS9281043",
        providerReference: "FP-CMS-892103",
        bankReference: "410294829103",
        createdAt: new Date(Date.now() - 1000 * 60 * 210).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 209).toISOString(),
        serviceType: "CMS Collection",
        provider: "Fingpay",
        amount: 5400.00,
        commission: 16.20,
        openingBalance: 22550.00,
        closingBalance: 27966.20,
        status: "SUCCESS",
        remarks: "Hero Fincorp - Personal Loan EMI (ID: HF4491022)"
    },
    {
        transactionId: "RXCMS9281044",
        providerReference: "FP-CMS-892104",
        bankReference: "410294829104",
        createdAt: new Date(Date.now() - 1000 * 60 * 480).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 479).toISOString(),
        serviceType: "CMS Collection",
        provider: "Fingpay",
        amount: 12000.00,
        commission: 36.00,
        openingBalance: 10550.00,
        closingBalance: 22586.00,
        status: "SUCCESS",
        remarks: "Muthoot Finance - Gold Loan EMI (ID: MF7738192)"
    },
    {
        transactionId: "RXCMS9281045",
        providerReference: "FP-CMS-892105",
        bankReference: "410294829105",
        createdAt: new Date(Date.now() - 1000 * 60 * 1440).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 1438).toISOString(),
        serviceType: "CMS Collection",
        provider: "Fingpay",
        amount: 6750.00,
        commission: 20.25,
        openingBalance: 3800.00,
        closingBalance: 10570.25,
        status: "SUCCESS",
        remarks: "Mahindra Finance - Tractor Loan EMI (ID: MM1192039)"
    },
    {
        transactionId: "RXCMS9281046",
        providerReference: "FP-CMS-892106",
        bankReference: "",
        createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        serviceType: "CMS Collection",
        provider: "Fingpay",
        amount: 3200.00,
        commission: 9.60,
        openingBalance: 50675.50,
        closingBalance: 50675.50,
        status: "PENDING",
        remarks: "Cholamandalam Finance - Auto Loan (ID: CH5529103)"
    }
];

const Icon3D = ({ icon: Icon, color, size = 24 }) => (
    <div className="relative group">
        <div className="absolute inset-0 rounded-2xl blur-xl opacity-25 group-hover:opacity-50 transition-opacity" style={{ backgroundColor: color }}></div>
        <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all active:scale-95 border border-white/20 overflow-hidden" style={{ backgroundColor: color }}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent"></div>
            <Icon size={size} className="text-white relative z-10" />
        </div>
    </div>
);

const StatusBadge = ({ status }) => {
    const sStr = status?.toUpperCase() || 'PENDING';
    const config = {
        SUCCESS: { bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600', dot: 'bg-emerald-500', label: 'SUCCESSFUL' },
        APPROVED: { bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600', dot: 'bg-emerald-500', label: 'SUCCESSFUL' },
        PENDING: { bg: 'bg-amber-500/10 border-amber-500/20 text-amber-600', dot: 'bg-amber-500', label: 'PENDING' },
        INITIATED: { bg: 'bg-blue-500/10 border-blue-500/20 text-blue-600', dot: 'bg-blue-500', label: 'INITIATED' },
        FAILED: { bg: 'bg-rose-500/10 border-rose-500/20 text-rose-600', dot: 'bg-rose-500', label: 'FAILED' },
        FAILURE: { bg: 'bg-rose-500/10 border-rose-500/20 text-rose-600', dot: 'bg-rose-500', label: 'FAILED' },
        DECLINED: { bg: 'bg-rose-500/10 border-rose-500/20 text-rose-600', dot: 'bg-rose-500', label: 'DECLINED' },
        REVERSED: { bg: 'bg-purple-500/10 border-purple-500/20 text-purple-600', dot: 'bg-purple-500', label: 'REVERSED' }
    };
    const s = config[sStr] || config.PENDING;
    return (
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border ${s.bg} text-[10px] font-black tracking-wider uppercase shadow-sm`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot} animate-pulse`}></span>
            {s.label}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN REPORTS COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const Reports = () => {
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const reportType = queryParams.get('report') || 'aeps_1';

    if (reportType === 'wallet_to_wallet') {
        return <Navigate to="/transactions/wallet-to-wallet" replace />;
    }

    if (reportType === 'bbps' || reportType === 'bbps_bill_pay') {
        return <Navigate to="/bbps-history" replace />;
    }

    const initialSummary = {
        totalTransactions: 0,
        successCount: 0,
        failedCount: 0,
        pendingCount: 0,
        totalVolume: 0,
        cashWithdrawalVolume: 0,
        cashDepositVolume: 0,
        commissionEarned: 0
    };

    // State Variables
    const [transactions, setTransactions] = useState([]);
    const [summary, setSummary] = useState(initialSummary);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [providerFilter, setProviderFilter] = useState('');
    
    // Dates
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    
    // Applied filters (single source of truth for active query)
    const [appliedFilters, setAppliedFilters] = useState({
        search: '',
        status: '',
        provider: '',
        fromDate: '',
        toDate: ''
    });

    // Sorting & Pagination
    const [sortBy, setSortBy] = useState('createdAt');
    const [sortDirection, setSortDirection] = useState('desc');
    const [currentPage, setCurrentPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);

    // Detail Modal State
    const [selectedTxn, setSelectedTxn] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [modalLoading, setModalLoading] = useState(false);
    const [copySuccess, setCopySuccess] = useState('');

    const reportConfigs = {
        aeps_1: { title: "AEPS 1 History", subtitle: "Aadhaar Enabled Payment System 1 transaction logs", color: "#2563eb", icon: Fingerprint },
        aeps_2: { title: "AEPS 2 History", subtitle: "Aadhaar Enabled Payment System 2 transaction logs", color: "#4f46e5", icon: Fingerprint },
        payout_hub: { title: "Payout Hub History", subtitle: "Instant bank transfer transaction logs and statuses", color: "#6366f1", icon: Landmark },
        money_transfer: { title: "Money Transfer History", subtitle: "Domestic money remittance transactions", color: "#0d9488", icon: IndianRupee },
        move_to_bank: { title: "Move To Bank Logs", subtitle: "Settlements to registered bank accounts", color: "#0284c7", icon: Landmark },
        airtel_cms: { title: "Airtel CMS History", subtitle: "Airtel Cash Management Services transaction logs", color: "#dc2626", icon: FileText },
        fingpay_cms: { title: "Fingpay CMS History", subtitle: "Cash Management Services & EMI transaction logs", color: "#7c3aed", icon: Building2 },
        bbps_bill_pay: { title: "BBPS Bill Payments", subtitle: "Bharat Bill Payment System transaction logs", color: "#2563eb", icon: RefreshCw },
        wallet: { title: "Wallet Ledger", subtitle: "Wallet deposits, top-ups, and debit logs", color: "#4f46e5", icon: Coins },
        wallet_to_wallet: { title: "Wallet To Wallet", subtitle: "Inter-wallet fund transfer transaction logs", color: "#0891b2", icon: Coins },
        mobile_dth_recharge: { title: "Mobile & DTH Recharge", subtitle: "Mobile top-ups and DTH connection recharge history", color: "#059669", icon: Smartphone },
        aeps_cash_deposit: { title: "AEPS Cash Deposits", subtitle: "Aadhaar cash deposit transaction history", color: "#0891b2", icon: Fingerprint },
        micro_atm_transactions: { title: "Micro ATM Transactions", subtitle: "Micro ATM card withdrawal logs", color: "#1e293b", icon: FileText },
        aadhaar_pay: { title: "Aadhaar Pay Transactions", subtitle: "Aadhaar Pay merchant payment logs", color: "#4f46e5", icon: Fingerprint },
        payment_gateway: { title: "Payment Gateway Logs", subtitle: "Online payment gateway deposit transactions", color: "#0ea5e9", icon: Coins },
        credit_card_bill: { title: "Credit Card Bill Payments", subtitle: "Credit card bill payment transaction logs", color: "#059669", icon: CreditCard },
        upi_cash_withdrawal: { title: "UPI Cash Withdrawal", subtitle: "UPI QR and cardless cash withdrawal logs", color: "#0d9488", icon: IndianRupee },
        my_earnings_report: { title: "My Earnings Report", subtitle: "Commission earned across all banking and utility services", color: "#059669", icon: ArrowUpRight }
    };

    const currentConfig = reportConfigs[reportType] || reportConfigs.aeps_1;

    // Reset filters and page when reportType changes
    useEffect(() => {
        setCurrentPage(0);
        setSearchTerm('');
        setStatusFilter('');
        setProviderFilter('');
        setFromDate('');
        setToDate('');
        setAppliedFilters({
            search: '',
            status: '',
            provider: '',
            fromDate: '',
            toDate: ''
        });
        setTransactions([]);
        setSummary(initialSummary);
        setTotalPages(0);
        setTotalElements(0);
    }, [reportType]);

    // Fetch dynamic transaction data
    const fetchHistoryData = useCallback(async (overridePage = currentPage, filtersToUse = appliedFilters) => {
        setLoading(true);
        try {
            const params = {
                reportType: getReportEnum(reportType),
                page: overridePage,
                size: pageSize,
                search: filtersToUse.search,
                status: filtersToUse.status,
                provider: filtersToUse.provider,
                fromDate: filtersToUse.fromDate,
                toDate: filtersToUse.toDate,
                sortBy,
                sortDirection
            };

            const response = await transactionService.getHistory(params);
            if (response && response.success && response.data && response.data.length > 0) {
                setTransactions(response.data);
                setTotalPages(response.pagination?.totalPages || 1);
                setTotalElements(response.pagination?.totalElements || response.data.length);
                if (response.summary) {
                    setSummary(response.summary);
                } else {
                    setSummary(initialSummary);
                }
            } else if (reportType === 'fingpay_cms') {
                let filtered = [...FINGPAY_CMS_MOCK_DATA];
                if (filtersToUse.search) {
                    const q = filtersToUse.search.toLowerCase();
                    filtered = filtered.filter(item => 
                        (item.transactionId && item.transactionId.toLowerCase().includes(q)) ||
                        (item.providerReference && item.providerReference.toLowerCase().includes(q)) ||
                        (item.bankReference && item.bankReference.toLowerCase().includes(q)) ||
                        (item.remarks && item.remarks.toLowerCase().includes(q))
                    );
                }
                if (filtersToUse.status) {
                    filtered = filtered.filter(item => item.status?.toUpperCase() === filtersToUse.status.toUpperCase());
                }
                if (filtersToUse.fromDate) {
                    filtered = filtered.filter(item => item.createdAt >= filtersToUse.fromDate);
                }
                if (filtersToUse.toDate) {
                    const toEnd = filtersToUse.toDate + 'T23:59:59';
                    filtered = filtered.filter(item => item.createdAt <= toEnd);
                }

                setTransactions(filtered);
                setTotalElements(filtered.length);
                setTotalPages(Math.max(1, Math.ceil(filtered.length / pageSize)));

                const totalVol = filtered.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
                const commEarned = filtered.reduce((acc, curr) => acc + (Number(curr.commission) || 0), 0);
                const success = filtered.filter(t => t.status === 'SUCCESS').length;
                const failed = filtered.filter(t => t.status === 'FAILED').length;
                const pending = filtered.length - success - failed;

                setSummary({
                    totalTransactions: filtered.length,
                    successCount: success,
                    failedCount: failed,
                    pendingCount: pending,
                    totalVolume: totalVol,
                    cashWithdrawalVolume: 0,
                    cashDepositVolume: 0,
                    commissionEarned: commEarned
                });
            } else {
                setTransactions(response?.data || []);
                setSummary(response?.summary || initialSummary);
                setTotalPages(response?.pagination?.totalPages || 0);
                setTotalElements(response?.pagination?.totalElements || 0);
            }
        } catch (error) {
            console.error("Failed to load history data:", error);
            if (reportType === 'fingpay_cms') {
                let filtered = [...FINGPAY_CMS_MOCK_DATA];
                setTransactions(filtered);
                setTotalElements(filtered.length);
                setTotalPages(1);
                const totalVol = filtered.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
                const commEarned = filtered.reduce((acc, curr) => acc + (Number(curr.commission) || 0), 0);
                setSummary({
                    totalTransactions: filtered.length,
                    successCount: filtered.filter(t => t.status === 'SUCCESS').length,
                    failedCount: 0,
                    pendingCount: filtered.filter(t => t.status === 'PENDING').length,
                    totalVolume: totalVol,
                    commissionEarned: commEarned
                });
            } else {
                setTransactions([]);
                setSummary(initialSummary);
                setTotalPages(0);
                setTotalElements(0);
            }
        } finally {
            setLoading(false);
        }
    }, [reportType, pageSize, sortBy, sortDirection, appliedFilters]);

    // Single unified fetch trigger
    useEffect(() => {
        fetchHistoryData(currentPage);
    }, [fetchHistoryData, currentPage]);

    const handleSearchSubmit = (e) => {
        if (e) e.preventDefault();
        setCurrentPage(0);
        setAppliedFilters({
            search: searchTerm,
            status: statusFilter,
            provider: providerFilter,
            fromDate,
            toDate
        });
    };

    const handleStatusChange = (e) => {
        const val = e.target.value;
        setStatusFilter(val);
        setCurrentPage(0);
        setAppliedFilters(prev => ({
            ...prev,
            status: val
        }));
    };

    // Quick Filters
    const applyQuickDateFilter = (filterType) => {
        const today = new Date();
        let from = '';
        let to = today.toISOString().split('T')[0];

        if (filterType === 'today') {
            from = today.toISOString().split('T')[0];
        } else if (filterType === 'yesterday') {
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            from = yesterday.toISOString().split('T')[0];
            to = yesterday.toISOString().split('T')[0];
        } else if (filterType === 'week') {
            const weekAgo = new Date(today);
            weekAgo.setDate(today.getDate() - 7);
            from = weekAgo.toISOString().split('T')[0];
        } else if (filterType === 'month') {
            const monthAgo = new Date(today);
            monthAgo.setMonth(today.getMonth() - 1);
            from = monthAgo.toISOString().split('T')[0];
        }

        setFromDate(from);
        setToDate(to);
        setCurrentPage(0);
        setAppliedFilters(prev => ({
            ...prev,
            fromDate: from,
            toDate: to
        }));
    };

    const handleResetFilters = () => {
        setFromDate('');
        setToDate('');
        setSearchTerm('');
        setStatusFilter('');
        setProviderFilter('');
        setCurrentPage(0);
        setAppliedFilters({
            search: '',
            status: '',
            provider: '',
            fromDate: '',
            toDate: ''
        });
    };

    // Row Details Handler
    const handleRowClick = async (txnId) => {
        try {
            setModalLoading(true);
            setShowModal(true);
            const response = await transactionService.getHistoryDetail(txnId);
            if (response && response.success && response.data) {
                setSelectedTxn(response.data);
            } else {
                const found = transactions.find(t => t.transactionId === txnId);
                setSelectedTxn(found || null);
            }
        } catch (error) {
            console.error("Failed to fetch transaction detail:", error);
            const found = transactions.find(t => t.transactionId === txnId);
            setSelectedTxn(found || null);
        } finally {
            setModalLoading(false);
        }
    };

    // Clipboard Copy Helper
    const copyToClipboard = (text, label) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopySuccess(label);
        setTimeout(() => setCopySuccess(''), 2000);
    };

    // SheetJS Export handler
    const exportToExcel = async () => {
        try {
            setLoading(true);
            const params = {
                reportType: getReportEnum(reportType),
                search: appliedFilters.search,
                status: appliedFilters.status,
                provider: appliedFilters.provider,
                fromDate: appliedFilters.fromDate,
                toDate: appliedFilters.toDate,
                sortBy,
                sortDirection
            };

            let dataToExport = await transactionService.getHistoryExport(params);
            if (!dataToExport || dataToExport.length === 0) {
                dataToExport = transactions;
            }

            if (!dataToExport || dataToExport.length === 0) {
                alert("No records found to export.");
                return;
            }

            const ws = XLSX.utils.json_to_sheet(dataToExport.map(row => ({
                "Transaction ID": row.transactionId,
                "Provider Reference": row.providerReference,
                "UTR / Bank Reference": row.bankReference,
                "Date": new Date(row.createdAt).toLocaleString(),
                "Service": row.serviceType,
                "Provider": row.provider,
                "Amount (INR)": row.amount,
                "Commission (INR)": row.commission,
                "Opening Balance (INR)": row.openingBalance,
                "Closing Balance (INR)": row.closingBalance,
                "Status": row.status,
                "Remarks": row.remarks
            })));

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Transactions");
            XLSX.writeFile(wb, `Rupiksha_Report_${reportType}_${Date.now()}.xlsx`);
        } catch (error) {
            console.error("Failed to export to Excel:", error);
            alert("Export failed.");
        } finally {
            setLoading(false);
        }
    };

    // CSV Export Handler
    const exportToCSV = async () => {
        try {
            setLoading(true);
            const params = {
                reportType: getReportEnum(reportType),
                search: appliedFilters.search,
                status: appliedFilters.status,
                provider: appliedFilters.provider,
                fromDate: appliedFilters.fromDate,
                toDate: appliedFilters.toDate,
                sortBy,
                sortDirection
            };

            let dataToExport = await transactionService.getHistoryExport(params);
            if (!dataToExport || dataToExport.length === 0) {
                dataToExport = transactions;
            }

            if (!dataToExport || dataToExport.length === 0) {
                alert("No records found to export.");
                return;
            }

            const headers = ["Transaction ID", "Provider Reference", "UTR", "Date", "Service", "Provider", "Amount", "Commission", "Opening Balance", "Closing Balance", "Status", "Remarks"];
            const csvRows = [headers.join(",")];

            dataToExport.forEach(row => {
                const values = [
                    `"${row.transactionId || ''}"`,
                    `"${row.providerReference || ''}"`,
                    `"${row.bankReference || ''}"`,
                    `"${new Date(row.createdAt).toLocaleString()}"`,
                    `"${row.serviceType || ''}"`,
                    `"${row.provider || ''}"`,
                    row.amount || 0,
                    row.commission || 0,
                    row.openingBalance || 0,
                    row.closingBalance || 0,
                    `"${row.status || ''}"`,
                    `"${(row.remarks || '').replace(/"/g, '""')}"`
                ];
                csvRows.push(values.join(","));
            });

            const csvContent = "\uFEFF" + csvRows.join("\n");
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `Rupiksha_Report_${reportType}_${Date.now()}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Failed to export to CSV:", error);
            alert("Export failed.");
        } finally {
            setLoading(false);
        }
    };

    // PDF Export Handler
    const exportToPDF = async () => {
        try {
            setLoading(true);
            const params = {
                reportType: getReportEnum(reportType),
                search: appliedFilters.search,
                status: appliedFilters.status,
                provider: appliedFilters.provider,
                fromDate: appliedFilters.fromDate,
                toDate: appliedFilters.toDate,
                sortBy,
                sortDirection
            };

            let dataToExport = await transactionService.getHistoryExport(params);
            if (!dataToExport || dataToExport.length === 0) {
                dataToExport = transactions;
            }

            if (!dataToExport || dataToExport.length === 0) {
                alert("No records found to export.");
                return;
            }

            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();

            // Brand Header Banner (Dark Navy)
            doc.setFillColor(15, 23, 42);
            doc.rect(0, 0, pageWidth, 24, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text('RUPIKSHA SERVICES', 14, 11);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(203, 213, 225);
            doc.text(`${(currentConfig.title || 'TRANSACTION REPORT').toUpperCase()} | OPERATIONS AUDIT LOG`, 14, 17);
            doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pageWidth - 14, 14, { align: 'right' });

            // Filter Meta bar
            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.3);
            doc.rect(14, 28, pageWidth - 28, 12, 'FD');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(51, 65, 85);
            const dateRangeStr = appliedFilters.fromDate && appliedFilters.toDate 
                ? `${appliedFilters.fromDate} to ${appliedFilters.toDate}` 
                : appliedFilters.fromDate ? `From ${appliedFilters.fromDate}` : 'All Recorded Dates';
            doc.text(`Date Range: ${dateRangeStr}   |   Status: ${appliedFilters.status || 'ALL'}   |   Total Records: ${dataToExport.length}`, 18, 35.5);

            // Table Header setup
            const tableX = 14;
            const tableWidth = pageWidth - 28;
            let currentY = 44;
            const headerHeight = 8;
            const rowHeight = 7.5;

            const colWidths = [44, 36, 62, 32, 28, 27, 40];
            const colHeaders = ['TRANSACTION ID', 'DATE & TIME', 'PARTICULARS / REMARKS', 'AMOUNT (INR)', 'COMMISSION', 'STATUS', 'BANK UTR / REF'];

            const drawTableHeader = (y) => {
                doc.setFillColor(30, 41, 59);
                doc.rect(tableX, y, tableWidth, headerHeight, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7.5);
                let xOffset = tableX;
                colHeaders.forEach((h, idx) => {
                    const align = (idx === 3 || idx === 4) ? 'right' : 'left';
                    const textX = align === 'right' ? xOffset + colWidths[idx] - 3 : xOffset + 3;
                    doc.text(h, textX, y + 5.5, { align });
                    xOffset += colWidths[idx];
                });
            };

            drawTableHeader(currentY);
            currentY += headerHeight;

            dataToExport.forEach((row, index) => {
                if (currentY + rowHeight > pageHeight - 15) {
                    doc.addPage();
                    currentY = 15;
                    drawTableHeader(currentY);
                    currentY += headerHeight;
                }

                if (index % 2 === 1) {
                    doc.setFillColor(248, 250, 252);
                    doc.rect(tableX, currentY, tableWidth, rowHeight, 'F');
                }

                doc.setDrawColor(241, 245, 249);
                doc.line(tableX, currentY + rowHeight, tableX + tableWidth, currentY + rowHeight);

                let xOffset = tableX;

                // 1. Txn ID
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7);
                doc.setTextColor(30, 41, 59);
                doc.text(String(row.transactionId || '—'), xOffset + 3, currentY + 5);
                xOffset += colWidths[0];

                // 2. Date
                doc.setFont('helvetica', 'normal');
                const dtStr = row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) + ' ' + new Date(row.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
                doc.text(dtStr, xOffset + 3, currentY + 5);
                xOffset += colWidths[1];

                // 3. Particulars / Remarks
                const partStr = row.remarks || row.serviceType || 'CMS Collection';
                doc.text(partStr.length > 38 ? partStr.substring(0, 36) + '...' : partStr, xOffset + 3, currentY + 5);
                xOffset += colWidths[2];

                // 4. Amount
                doc.setFont('helvetica', 'bold');
                const amtStr = 'Rs. ' + Number(row.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
                doc.text(amtStr, xOffset + colWidths[3] - 3, currentY + 5, { align: 'right' });
                xOffset += colWidths[3];

                // 5. Commission
                doc.setTextColor(16, 185, 129);
                const commStr = row.commission > 0 ? '+Rs. ' + Number(row.commission).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : 'Rs. 0.00';
                doc.text(commStr, xOffset + colWidths[4] - 3, currentY + 5, { align: 'right' });
                xOffset += colWidths[4];

                // 6. Status
                const st = (row.status || 'PENDING').toUpperCase();
                if (st === 'SUCCESS' || st === 'APPROVED') doc.setTextColor(16, 185, 129);
                else if (st === 'FAILED' || st === 'FAILURE') doc.setTextColor(225, 29, 72);
                else doc.setTextColor(217, 119, 6);
                doc.text(st, xOffset + 3, currentY + 5);
                xOffset += colWidths[5];

                // 7. Bank UTR / Ref
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(71, 85, 105);
                const refStr = row.bankReference || row.providerReference || '—';
                doc.text(refStr.length > 22 ? refStr.substring(0, 20) + '...' : refStr, xOffset + 3, currentY + 5);

                currentY += rowHeight;
            });

            // Footer
            const totalPagesCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= totalPagesCount; i++) {
                doc.setPage(i);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(148, 163, 184);
                doc.text(`Page ${i} of ${totalPagesCount}  |  Rupiksha Retailer Portal  |  Confidential`, 14, pageHeight - 6);
            }

            doc.save(`Rupiksha_${reportType}_Report_${Date.now()}.pdf`);
        } catch (error) {
            console.error("Failed to export to PDF:", error);
            alert("PDF export failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 pb-20 font-['Inter',sans-serif] bg-slate-50 min-h-screen">
            {/* ── Header ── */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 md:p-8 rounded-[2rem] border border-slate-200/60 shadow-sm relative overflow-hidden">
                <div className="absolute right-0 top-0 w-64 h-64 bg-[#4a148c]/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
                <div className="flex items-center gap-6 relative z-10">
                    <Icon3D icon={currentConfig.icon || FileText} color={currentConfig.color || '#4a148c'} size={28} />
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[5px] mb-1.5 opacity-60" style={{ color: currentConfig.color || '#4a148c' }}>Operations Intelligence</p>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">{currentConfig.title}</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{currentConfig.subtitle}</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 relative z-10">
                    <button 
                        onClick={exportToPDF}
                        disabled={loading}
                        className="flex items-center gap-2.5 px-6 h-12 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-[2px] shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                        title="Download PDF Document"
                    >
                        <FileText size={14} />
                        PDF
                    </button>
                    <button 
                        onClick={exportToExcel}
                        disabled={loading}
                        className="flex items-center gap-2.5 px-6 h-12 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-[2px] shadow-lg hover:bg-black transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                        <Download size={14} />
                        Excel
                    </button>
                    <button 
                        onClick={exportToCSV}
                        disabled={loading}
                        className="flex items-center gap-2.5 px-6 h-12 bg-white border border-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-[2px] shadow-sm hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                        <Download size={14} />
                        CSV
                    </button>
                    <button 
                        onClick={() => fetchHistoryData(currentPage)}
                        disabled={loading}
                        className="w-12 h-12 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center justify-center hover:shadow-md transition-all active:rotate-180 hover:border-[#4a148c] disabled:opacity-50 cursor-pointer"
                    >
                        <RefreshCw size={18} className="text-[#4a148c]" />
                    </button>
                </div>
            </div>

            {/* ── Summary Cards ── */}
            {(() => {
                const isAeps = reportType === 'aeps_1' || reportType === 'aeps_2';
                const isPayoutReport = reportType === 'payout_hub' || reportType === 'payout';
                const isCms = reportType === 'fingpay_cms' || reportType === 'airtel_cms';
                const commCardLabel = isPayoutReport ? 'Payout Charges' : 'Commission Earned';

                const cards = isAeps ? [
                    { label: 'Total Transactions', val: summary.totalTransactions || 0, icon: FileText, col: '#0ea5e9' },
                    { label: 'Cash Withdrawal', val: `₹${Number(summary.cashWithdrawalVolume ?? (summary.totalVolume || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: IndianRupee, col: '#2563eb' },
                    { label: 'Cash Deposit', val: `₹${Number(summary.cashDepositVolume || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: Landmark, col: '#0891b2' },
                    { label: 'Commission Earned', val: `₹${Number(summary.commissionEarned || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: Coins, col: '#10b981' },
                    { label: 'Success / Fail / Pending', val: `${summary.successCount || 0} / ${summary.failedCount || 0} / ${summary.pendingCount || 0}`, icon: Clock, col: '#ea580c' },
                ] : isCms ? [
                    { label: 'Total EMI Collection', val: `₹${Number(summary.totalVolume || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: IndianRupee, col: currentConfig.color || '#7c3aed' },
                    { label: 'Commission Earned', val: `₹${Number(summary.commissionEarned || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: Coins, col: '#10b981' },
                    { label: 'Total Transactions', val: summary.totalTransactions || 0, icon: Building2, col: '#0ea5e9' },
                    { label: 'Success / Fail / Pending', val: `${summary.successCount || 0} / ${summary.failedCount || 0} / ${summary.pendingCount || 0}`, icon: Clock, col: '#ea580c' },
                ] : [
                    { label: 'Total Volume', val: `₹${Number(summary.totalVolume || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: IndianRupee, col: currentConfig.color || '#4a148c' },
                    { label: commCardLabel, val: `₹${Number(summary.commissionEarned || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: Coins, col: '#10b981' },
                    { label: 'Total Transactions', val: summary.totalTransactions || 0, icon: FileText, col: '#0ea5e9' },
                    { label: 'Success / Fail / Pending', val: `${summary.successCount || 0} / ${summary.failedCount || 0} / ${summary.pendingCount || 0}`, icon: Clock, col: '#ea580c' },
                ];

                return (
                    <div className={isAeps ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"}>
                        {cards.map((s, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                                className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all group relative overflow-hidden"
                            >
                                <div className="absolute right-0 top-0 w-20 h-20 rounded-full blur-3xl opacity-5" style={{ backgroundColor: s.col }}></div>
                                <div className="flex items-center justify-between mb-3 relative z-10">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${s.col}10` }}>
                                        <s.icon size={18} style={{ color: s.col }} />
                                    </div>
                                    <ArrowUpRight className="text-slate-200 group-hover:text-slate-400 transition-colors" size={16} />
                                </div>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{s.label}</p>
                                <p className="text-lg font-black text-slate-800 mt-1 tracking-tight">{s.val}</p>
                            </motion.div>
                        ))}
                    </div>
                );
            })()}

            {/* ── Filters & Search Control ── */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6">
                <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    {/* Search Field */}
                    <div className="md:col-span-4 space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block ml-1">Search ID / UTR / Customer</label>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="Lookup transactions..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-[#4a148c20] focus:ring-4 focus:ring-[#4a148c]/5 outline-none transition-all placeholder:text-slate-300"
                            />
                        </div>
                    </div>

                    {/* From Date */}
                    <div className="md:col-span-2.5 space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block ml-1">From Date</label>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-[#4a148c20] focus:ring-4 focus:ring-[#4a148c]/5 outline-none transition-all text-slate-700"
                        />
                    </div>

                    {/* To Date */}
                    <div className="md:col-span-2.5 space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block ml-1">To Date</label>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-[#4a148c20] focus:ring-4 focus:ring-[#4a148c]/5 outline-none transition-all text-slate-700"
                        />
                    </div>

                    {/* Status Filter */}
                    <div className="md:col-span-2 space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block ml-1">Status</label>
                        <select
                            value={statusFilter}
                            onChange={handleStatusChange}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:border-[#4a148c20] focus:ring-4 focus:ring-[#4a148c]/5 outline-none transition-all text-slate-700"
                        >
                            <option value="">All Status</option>
                            <option value="SUCCESS">SUCCESSFUL</option>
                            <option value="PENDING">PENDING</option>
                            <option value="FAILED">FAILED</option>
                            <option value="REVERSED">REVERSED</option>
                        </select>
                    </div>

                    {/* Filter Button */}
                    <div className="md:col-span-1">
                        <button
                            type="submit"
                            className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
                        >
                            <Filter size={14} />
                            Apply
                        </button>
                    </div>
                </form>

                {/* Quick Filters row */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mr-2">Quick Dates:</span>
                    {['today', 'yesterday', 'week', 'month'].map((filter) => (
                        <button
                            key={filter}
                            onClick={() => applyQuickDateFilter(filter)}
                            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                        >
                            {filter}
                        </button>
                    ))}
                    <button
                        onClick={handleResetFilters}
                        className="px-3.5 py-1.5 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ml-auto"
                    >
                        Reset Filters
                    </button>
                </div>
            </div>

            {/* ── Enterprise Grid Data Table ── */}
            <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                <div className="overflow-x-auto relative">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                {[
                                    { id: 'transactionId', label: 'Transaction ID' },
                                    { id: 'createdAt', label: 'Timestamp' },
                                    { id: 'serviceType', label: 'Particulars / Domain' },
                                    { id: 'amount', label: 'Amount' },
                                    { id: 'commission', label: (reportType === 'payout_hub' || reportType === 'payout') ? 'Payout Charges' : 'Commission' },
                                    { id: 'status', label: 'Status' },
                                    { id: 'actions', label: 'Receipt' }
                                ].map((h) => (
                                    <th 
                                        key={h.id} 
                                        onClick={() => {
                                            if (h.id === 'actions') return;
                                            const direction = sortBy === h.id && sortDirection === 'desc' ? 'asc' : 'desc';
                                            setSortBy(h.id);
                                            setSortDirection(direction);
                                        }}
                                        className={`px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors ${h.id === 'actions' ? 'text-center' : ''}`}
                                    >
                                        <div className="flex items-center gap-1.5 justify-start">
                                            {h.label}
                                            {sortBy === h.id && (
                                                <span className="text-[8px] text-cyan-600">{sortDirection === 'desc' ? '▼' : '▲'}</span>
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                // Skeleton Loader rows
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-6 py-5"><div className="h-4 bg-slate-100 rounded w-28"></div></td>
                                        <td className="px-6 py-5"><div className="h-4 bg-slate-100 rounded w-20"></div></td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded bg-slate-100"></div>
                                                <div className="h-4 bg-slate-100 rounded w-24"></div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5"><div className="h-4 bg-slate-100 rounded w-16"></div></td>
                                        <td className="px-6 py-5"><div className="h-4 bg-slate-100 rounded w-12"></div></td>
                                        <td className="px-6 py-5"><div className="h-6 bg-slate-100 rounded-full w-20"></div></td>
                                        <td className="px-6 py-5 text-center"><div className="h-8 bg-slate-100 rounded w-8 mx-auto"></div></td>
                                    </tr>
                                ))
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-8 py-24 text-center">
                                        <div className="flex flex-col items-center gap-4 py-8">
                                            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                                                <FileText className="text-slate-300" size={24} />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-slate-700 tracking-tight">No Transactions Logged</h3>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Check back later or adjust filter parameters</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((t) => (
                                    <tr 
                                        key={t.transactionId}
                                        onClick={() => handleRowClick(t.transactionId)}
                                        className="hover:bg-slate-50/60 transition-colors group cursor-pointer"
                                    >
                                        <td className="px-6 py-4.5">
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider group-hover:text-[#4a148c] transition-colors">{t.transactionId}</span>
                                                {t.providerReference && (
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">REF: {t.providerReference}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4.5 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-bold text-slate-600 tracking-tight">{new Date(t.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{new Date(t.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4.5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200/50">
                                                    {t.serviceType?.toLowerCase().includes('recharge') ? <Smartphone size={14} className="text-blue-500" /> :
                                                        t.serviceType?.toLowerCase().includes('bill') ? <RefreshCw size={14} className="text-orange-500" /> :
                                                            t.serviceType?.toLowerCase().includes('aeps') ? <Fingerprint size={14} className="text-emerald-500" /> :
                                                                t.serviceType?.toLowerCase().includes('cms') ? <Building2 size={14} className="text-purple-600" /> :
                                                                    <Coins size={14} className="text-purple-500" />}
                                                </div>
                                                <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">{t.serviceType || 'Utility'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4.5 font-black text-[13px] text-slate-800 tracking-tighter">
                                            ₹{(t.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-4.5 font-black text-[13px] text-emerald-600 tracking-tighter">
                                            {t.commission > 0 ? `+ ₹${(t.commission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹0.00'}
                                        </td>
                                        <td className="px-6 py-4.5">
                                            <StatusBadge status={t.status} />
                                        </td>
                                        <td className="px-6 py-4.5 text-center">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRowClick(t.transactionId);
                                                }}
                                                className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200/60 text-[#4a148c] flex items-center justify-center hover:bg-white hover:border-[#4a148c] transition-all"
                                            >
                                                <Printer size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {!loading && totalElements > 0 && (
                    <div className="py-5 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between px-6 gap-4 bg-slate-50/50">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Showing <span className="text-slate-800">{(currentPage * pageSize) + 1}</span> to <span className="text-slate-800">{Math.min((currentPage + 1) * pageSize, totalElements)}</span> of {totalElements} entries
                        </p>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                                disabled={currentPage === 0}
                                className="h-9 px-4 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm hover:bg-slate-50 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                Previous
                            </button>
                            <button 
                                onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                                disabled={currentPage === totalPages - 1}
                                className="h-9 px-4 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-md hover:bg-black active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Transaction Details Modal Popup ── */}
            <AnimatePresence>
                {showModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        {/* Overlay backdrop */}
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }}
                            onClick={() => setShowModal(false)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        ></motion.div>

                        {/* Modal Body */}
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="bg-white w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl relative border border-slate-200"
                        >
                            {/* Close Trigger */}
                            <button 
                                onClick={() => setShowModal(false)}
                                className="absolute right-5 top-5 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 text-slate-500 transition-colors z-20"
                            >
                                <X size={16} />
                            </button>

                            {modalLoading ? (
                                <div className="p-16 flex flex-col items-center justify-center gap-4">
                                    <div className="w-12 h-12 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin"></div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Querying Cloud Audit Logs...</p>
                                </div>
                            ) : selectedTxn ? (
                                <div className="p-6 md:p-8 space-y-6">
                                    {/* Header Status Card */}
                                    <div className="flex justify-between items-start pb-4 border-b border-slate-100">
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Transaction Audit Ledger</p>
                                            <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2 mt-1">
                                                {selectedTxn.transactionId}
                                                <button 
                                                    onClick={() => copyToClipboard(selectedTxn.transactionId, 'txnId')}
                                                    className="p-1 bg-slate-50 text-slate-400 rounded hover:text-slate-800 transition-colors"
                                                >
                                                    <Copy size={12} />
                                                </button>
                                                {copySuccess === 'txnId' && <span className="text-[8px] text-emerald-600 font-bold uppercase">Copied!</span>}
                                            </h3>
                                        </div>
                                        <StatusBadge status={selectedTxn.status} />
                                    </div>

                                    {/* Parameter list */}
                                    <div className="grid grid-cols-2 gap-4 text-xs font-bold text-slate-600">
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Transaction Amount</p>
                                            <p className="text-lg font-black text-slate-800 mt-1 tracking-tight">₹{(selectedTxn.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Commission Distributed</p>
                                            <p className="text-lg font-black text-emerald-600 mt-1 tracking-tight">+ ₹{(selectedTxn.commission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                        <div className="border-t border-slate-50 pt-3">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Opening Wallet Balance</p>
                                            <p className="text-slate-700 font-black mt-1">₹{(selectedTxn.openingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                        <div className="border-t border-slate-50 pt-3">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Closing Wallet Balance</p>
                                            <p className="text-slate-700 font-black mt-1">₹{(selectedTxn.closingBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                        <div className="border-t border-slate-50 pt-3 col-span-2">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">UTR / Bank RRN</p>
                                            <p className="text-slate-700 font-black mt-1 flex items-center gap-1.5">
                                                {selectedTxn.bankReference || 'N/A'}
                                                {selectedTxn.bankReference && (
                                                    <button 
                                                        onClick={() => copyToClipboard(selectedTxn.bankReference, 'utr')}
                                                        className="p-1 bg-slate-50 text-slate-400 rounded hover:text-slate-800 transition-colors"
                                                    >
                                                        <Copy size={10} />
                                                    </button>
                                                )}
                                                {copySuccess === 'utr' && <span className="text-[8px] text-emerald-600 font-bold uppercase">Copied!</span>}
                                            </p>
                                        </div>
                                        <div className="border-t border-slate-50 pt-3">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Operator / Partner</p>
                                            <p className="text-slate-700 font-black mt-1">{selectedTxn.provider || 'INTERNAL'}</p>
                                        </div>
                                        <div className="border-t border-slate-50 pt-3">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Service Domain</p>
                                            <p className="text-slate-700 font-black mt-1">{selectedTxn.serviceType || 'Utility'}</p>
                                        </div>
                                        {selectedTxn.remarks && (
                                            <div className="border-t border-slate-50 pt-3 col-span-2">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Remarks</p>
                                                <p className="text-slate-700 mt-1 font-bold italic">{selectedTxn.remarks}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Timeline Flow */}
                                    <div className="border-t border-slate-100 pt-5 space-y-4">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Transaction Timeline Progression</p>
                                        
                                        <div className="relative pl-6 space-y-4">
                                            {/* Vertical line connecting nodes */}
                                            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-slate-100"></div>

                                            {/* Node 1 */}
                                            <div className="relative flex gap-3 text-xs">
                                                <span className="absolute -left-[23px] top-1.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm"></span>
                                                <div>
                                                    <p className="font-black text-slate-800">TRANSACTION CREATED</p>
                                                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">Retailer session initiated log in database</p>
                                                </div>
                                                <span className="ml-auto text-[9px] text-slate-400 font-bold">{new Date(selectedTxn.createdAt).toLocaleTimeString()}</span>
                                            </div>

                                            {/* Node 2 */}
                                            <div className="relative flex gap-3 text-xs">
                                                <span className="absolute -left-[23px] top-1.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm"></span>
                                                <div>
                                                    <p className="font-black text-slate-800">PARTNER DISPATCHED</p>
                                                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">Payload sent to external banking interface</p>
                                                </div>
                                                <span className="ml-auto text-[9px] text-slate-400 font-bold">{new Date(new Date(selectedTxn.createdAt).getTime() + 1000).toLocaleTimeString()}</span>
                                            </div>

                                            {/* Node 3 */}
                                            <div className="relative flex gap-3 text-xs">
                                                <span className={`absolute -left-[23px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${
                                                    selectedTxn.status === 'SUCCESS' || selectedTxn.status === 'APPROVED' ? 'bg-emerald-500' : 
                                                    selectedTxn.status === 'FAILED' || selectedTxn.status === 'FAILURE' ? 'bg-rose-500' : 'bg-amber-500 animate-pulse'
                                                }`}></span>
                                                <div>
                                                    <p className="font-black text-slate-800">FINAL RESPONSE RECEIVED</p>
                                                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                                                        {selectedTxn.status === 'SUCCESS' || selectedTxn.status === 'APPROVED' ? 'Bank cleared transaction successfully' :
                                                         selectedTxn.status === 'FAILED' || selectedTxn.status === 'FAILURE' ? 'Transaction declined by issuer bank' : 'Waiting for gateway response confirmation'}
                                                    </p>
                                                </div>
                                                <span className="ml-auto text-[9px] text-slate-400 font-bold">
                                                    {selectedTxn.updatedAt ? new Date(selectedTxn.updatedAt).toLocaleTimeString() : new Date(selectedTxn.createdAt).toLocaleTimeString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex gap-4 border-t border-slate-100 pt-6">
                                        <button 
                                            onClick={() => window.print()}
                                            className="flex-1 bg-slate-900 text-white py-3.5 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-black transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                                        >
                                            <Printer size={14} />
                                            Print Receipt
                                        </button>
                                        <button 
                                            onClick={() => setShowModal(false)}
                                            className="flex-1 bg-slate-50 border border-slate-200 text-slate-700 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-100 transition-all active:scale-[0.98]"
                                        >
                                            Close View
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-16 text-center text-rose-500 text-xs font-bold">
                                    <AlertCircle size={32} className="mx-auto mb-4" />
                                    Failed to retrieve ledger detail information.
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Reports;
