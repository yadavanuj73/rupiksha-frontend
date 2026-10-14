import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Fingerprint, Smartphone, Landmark, ArrowLeftRight, IndianRupee,
    CreditCard, Search, Calendar, Download, RefreshCw, Filter,
    CheckCircle2, Clock, AlertTriangle, Eye, Copy, X, Printer,
    FileSpreadsheet, FileText, ChevronLeft, ChevronRight, ChevronsLeft,
    ChevronsRight, ArrowUpRight, ArrowDownRight, UserCheck, Shield,
    Layers, ExternalLink
} from 'lucide-react';
import { adminTransactionService } from '../../services/apiService';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS & TAB DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export const TRANSACTION_TABS = [
    {
        id: 'Txn-Fingpay-Aeps',
        reportType: 'AEPS_FINGPAY',
        label: 'Fingpay Aeps',
        shortLabel: 'Fingpay AEPS 1',
        subtitle: 'All users\' AEPS 1 cash withdrawal, cash deposit & mini statement logs',
        icon: Fingerprint,
        color: '#2563eb',
        gradient: 'from-blue-600 to-indigo-600',
        bgLight: 'bg-blue-50/70',
        borderLight: 'border-blue-100',
    },
    {
        id: 'Txn-Levin-Aeps',
        reportType: 'AEPS_LEVIN',
        label: 'Levin Aeps',
        shortLabel: 'Levin AEPS 2',
        subtitle: 'All users\' AEPS 2 cash withdrawal, deposit & balance inquiry logs',
        icon: Fingerprint,
        color: '#4f46e5',
        gradient: 'from-indigo-600 to-purple-600',
        bgLight: 'bg-indigo-50/70',
        borderLight: 'border-indigo-100',
    },
    {
        id: 'Txn-Recharge',
        reportType: 'RECHARGE',
        label: 'Mobile & DTH Recharge',
        shortLabel: 'Recharge',
        subtitle: 'Mobile prepaid top-ups and DTH connection recharge transactions across network',
        icon: Smartphone,
        color: '#059669',
        gradient: 'from-emerald-600 to-teal-600',
        bgLight: 'bg-emerald-50/70',
        borderLight: 'border-emerald-100',
    },
    {
        id: 'Txn-MoveToBank',
        reportType: 'MOVE_TO_BANK',
        label: 'Move To Bank',
        shortLabel: 'Move To Bank',
        subtitle: 'Instant payout bank settlement & IMPS/NEFT transfers for all users',
        icon: Landmark,
        color: '#0284c7',
        gradient: 'from-sky-600 to-cyan-600',
        bgLight: 'bg-sky-50/70',
        borderLight: 'border-sky-100',
    },
    {
        id: 'Txn-WalletToWallet',
        reportType: 'WALLET_TRANSFER',
        label: 'Wallet To Wallet',
        shortLabel: 'Wallet ➔ Wallet',
        subtitle: 'Inter-wallet fund transfers and balance shifts between users',
        icon: ArrowLeftRight,
        color: '#0891b2',
        gradient: 'from-cyan-600 to-blue-600',
        bgLight: 'bg-cyan-50/70',
        borderLight: 'border-cyan-100',
    },
    {
        id: 'Txn-UpiCash',
        reportType: 'UPI_CASH_WITHDRAWAL',
        label: 'Upi Cash Withdrwal',
        shortLabel: 'UPI Cash',
        subtitle: 'Dynamic UPI QR and cardless cash withdrawal transaction records',
        icon: IndianRupee,
        color: '#d97706',
        gradient: 'from-amber-600 to-orange-600',
        bgLight: 'bg-amber-50/70',
        borderLight: 'border-amber-100',
    },
    {
        id: 'Txn-CreditCard',
        reportType: 'CREDIT_CARD_BILL',
        label: 'Credit Card Bill',
        shortLabel: 'Credit Card',
        subtitle: 'Credit card bill payments & settlements across all major bank cards',
        icon: CreditCard,
        color: '#dc2626',
        gradient: 'from-rose-600 to-red-600',
        bgLight: 'bg-rose-50/70',
        borderLight: 'border-rose-100',
    },
];

// Helper to format currency
const fmtINR = (val) => {
    const num = parseFloat(String(val || 0).replace(/,/g, '')) || 0;
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
};

// Helper to format dates
const fmtDateTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return String(dateStr);
        return d.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    } catch (_) {
        return String(dateStr);
    }
};

// Status Badge Component
const StatusBadge = ({ status }) => {
    const s = String(status || 'PENDING').toUpperCase();
    if (s === 'SUCCESS' || s === 'APPROVED' || s === 'COMPLETED' || s === 'PROCESSED') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                SUCCESS
            </span>
        );
    }
    if (s === 'PENDING' || s === 'INITIATED' || s === 'PROCESSING' || s === 'STARTED') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                PENDING
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            FAILED
        </span>
    );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function AdminTransactions({ activeSection, onNavigate }) {
    // Current active tab
    const currentTab = useMemo(() => {
        return TRANSACTION_TABS.find(t => t.id === activeSection) || TRANSACTION_TABS[0];
    }, [activeSection]);

    // Data States
    const [transactions, setTransactions] = useState([]);
    const [summary, setSummary] = useState({
        totalTransactions: 0,
        successCount: 0,
        failedCount: 0,
        pendingCount: 0,
        totalVolume: 0,
        cashWithdrawalVolume: 0,
        cashDepositVolume: 0,
    });
    const [loading, setLoading] = useState(true);
    const [exportLoading, setExportLoading] = useState(false);

    // Filters State
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [quickRange, setQuickRange] = useState('ALL');

    // Pagination State
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(10);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);

    // Modal Details State
    const [selectedTxn, setSelectedTxn] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [copyToast, setCopyToast] = useState('');

    // Fetch data from backend
    const fetchData = useCallback(async (pageOverride = page) => {
        setLoading(true);
        try {
            const filters = {
                reportType: currentTab.reportType,
                page: pageOverride,
                size: pageSize,
                search: searchQuery.trim(),
                status: statusFilter,
                fromDate,
                toDate,
                sortBy: 'createdAt',
                sortDirection: 'desc'
            };

            const res = await adminTransactionService.getHistory(filters);
            if (res && res.success) {
                setTransactions(res.data || []);
                setTotalPages(res.pagination?.totalPages || 0);
                setTotalElements(res.pagination?.totalElements || 0);
                if (res.summary) {
                    setSummary(res.summary);
                }
            } else {
                setTransactions([]);
                setTotalPages(0);
                setTotalElements(0);
            }
        } catch (err) {
            console.error('Failed to load admin transactions:', err);
            setTransactions([]);
        } finally {
            setLoading(false);
        }
    }, [currentTab.reportType, page, pageSize, searchQuery, statusFilter, fromDate, toDate]);

    // Re-fetch on tab change
    useEffect(() => {
        setPage(0);
        setSearchQuery('');
        setStatusFilter('');
        setFromDate('');
        setToDate('');
        setQuickRange('ALL');
    }, [currentTab.id]);

    // Re-fetch when page, tab, pageSize, or immediate filters change
    useEffect(() => {
        fetchData(page);
    }, [currentTab.id, page, pageSize, statusFilter, fromDate, toDate]);

    // Handle Search Submit
    const handleSearchSubmit = (e) => {
        if (e) e.preventDefault();
        setPage(0);
        fetchData(0);
    };

    // Quick Date Range Handler
    const handleQuickRange = (range) => {
        setQuickRange(range);
        const today = new Date();
        const yyyyMmDd = (d) => d.toISOString().split('T')[0];

        if (range === 'TODAY') {
            const nowStr = yyyyMmDd(today);
            setFromDate(nowStr);
            setToDate(nowStr);
        } else if (range === 'YESTERDAY') {
            const yest = new Date(today);
            yest.setDate(today.getDate() - 1);
            const yestStr = yyyyMmDd(yest);
            setFromDate(yestStr);
            setToDate(yestStr);
        } else if (range === '7DAYS') {
            const past = new Date(today);
            past.setDate(today.getDate() - 7);
            setFromDate(yyyyMmDd(past));
            setToDate(yyyyMmDd(today));
        } else if (range === '30DAYS') {
            const past = new Date(today);
            past.setDate(today.getDate() - 30);
            setFromDate(yyyyMmDd(past));
            setToDate(yyyyMmDd(today));
        } else {
            setFromDate('');
            setToDate('');
        }
        setPage(0);
    };

    // Reset Filters
    const handleResetFilters = () => {
        setSearchQuery('');
        setStatusFilter('');
        setFromDate('');
        setToDate('');
        setQuickRange('ALL');
        setPage(0);
    };

    // Copy to clipboard helper
    const handleCopy = (text, label) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopyToast(label);
        setTimeout(() => setCopyToast(''), 2000);
    };

    // Export to Excel handler
    const handleExportExcel = async () => {
        try {
            setExportLoading(true);
            const exportData = await adminTransactionService.getHistoryExport({
                reportType: currentTab.reportType,
                search: searchQuery.trim(),
                status: statusFilter,
                fromDate,
                toDate
            });

            if (!exportData || exportData.length === 0) {
                alert('No transaction records found matching the current filters.');
                return;
            }

            const formatted = exportData.map(row => ({
                'Party Code': row.partyCode || 'N/A',
                'User Name': row.userName || 'N/A',
                'User Mobile': row.userMobile || 'N/A',
                'User Role': row.userRole || 'RETAILER',
                'Transaction ID': row.transactionId || 'N/A',
                'Provider Ref / UTR': row.providerReference || 'N/A',
                'Bank Ref / Mobile': row.bankReference || 'N/A',
                'Service Type': row.serviceType || 'N/A',
                'Provider': row.provider || 'N/A',
                'Amount (₹)': parseFloat(row.amount || 0).toFixed(2),
                'Commission / Fee (₹)': parseFloat(row.commission || 0).toFixed(2),
                'Status': (row.status || '').toUpperCase(),
                'Date & Time': fmtDateTime(row.createdAt),
                'Remarks': row.remarks || ''
            }));

            const ws = XLSX.utils.json_to_sheet(formatted);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, currentTab.shortLabel);
            const filename = `Rupiksha_${currentTab.reportType}_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, filename);
        } catch (err) {
            console.error('Failed to export Excel:', err);
            alert('Failed to export Excel file. Please try again.');
        } finally {
            setExportLoading(false);
        }
    };

    // Export to PDF handler
    const handleExportPDF = async () => {
        try {
            setExportLoading(true);
            const exportData = await adminTransactionService.getHistoryExport({
                reportType: currentTab.reportType,
                search: searchQuery.trim(),
                status: statusFilter,
                fromDate,
                toDate
            });

            if (!exportData || exportData.length === 0) {
                alert('No transaction records found matching the current filters.');
                return;
            }

            const doc = new jsPDF('landscape', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();

            // Brand Header
            doc.setFillColor(30, 41, 59);
            doc.rect(0, 0, pageWidth, 24, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('RUPIKSHA ADMIN REPORT - ' + currentTab.label.toUpperCase(), 14, 12);

            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(`Generated: ${new Date().toLocaleString('en-IN')} | Total Records: ${exportData.length}`, 14, 18);

            // Filter context
            doc.setTextColor(51, 65, 85);
            doc.setFontSize(8.5);
            let filterNote = `Report: ${currentTab.label} | Status: ${statusFilter || 'ALL'}`;
            if (fromDate || toDate) filterNote += ` | Date Range: ${fromDate || 'Start'} to ${toDate || 'End'}`;
            if (searchQuery) filterNote += ` | Query: "${searchQuery}"`;
            doc.text(filterNote, 14, 30);

            // Table Header
            const headers = ['Party Code', 'User Name', 'Mobile', 'Txn ID', 'UTR / Ref', 'Service', 'Amount', 'Status', 'Date'];
            const startY = 34;
            const rowHeight = 7;
            const colWidths = [24, 38, 25, 42, 40, 30, 25, 20, 30];

            doc.setFillColor(241, 245, 249);
            doc.rect(14, startY, pageWidth - 28, 8, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(15, 23, 42);

            let curX = 16;
            headers.forEach((h, i) => {
                doc.text(h, curX, startY + 5.5);
                curX += colWidths[i];
            });

            let y = startY + 8;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);

            // Render up to 500 records on PDF to keep file fast and responsive
            const maxPdfRows = Math.min(exportData.length, 500);
            for (let i = 0; i < maxPdfRows; i++) {
                const row = exportData[i];
                if (y > 185) {
                    doc.addPage();
                    y = 20;
                    // re-print header on new page
                    doc.setFillColor(241, 245, 249);
                    doc.rect(14, y - 6, pageWidth - 28, 8, 'F');
                    doc.setFont('helvetica', 'bold');
                    let newX = 16;
                    headers.forEach((h, idx) => {
                        doc.text(h, newX, y - 1);
                        newX += colWidths[idx];
                    });
                    doc.setFont('helvetica', 'normal');
                    y += 4;
                }

                // Alternating row background
                if (i % 2 === 1) {
                    doc.setFillColor(248, 250, 252);
                    doc.rect(14, y - 4.5, pageWidth - 28, rowHeight, 'F');
                }

                curX = 16;
                const vals = [
                    row.partyCode || 'N/A',
                    (row.userName || 'N/A').substring(0, 20),
                    row.userMobile || 'N/A',
                    (row.transactionId || 'N/A').substring(0, 22),
                    (row.providerReference || 'N/A').substring(0, 20),
                    (row.serviceType || 'N/A').substring(0, 16),
                    `INR ${parseFloat(row.amount || 0).toFixed(2)}`,
                    (row.status || 'PENDING').toUpperCase(),
                    fmtDateTime(row.createdAt).substring(0, 18)
                ];

                vals.forEach((v, idx) => {
                    if (idx === 7) {
                        const st = (row.status || '').toUpperCase();
                        if (st === 'SUCCESS' || st === 'APPROVED') doc.setTextColor(16, 185, 129);
                        else if (st === 'PENDING') doc.setTextColor(217, 119, 6);
                        else doc.setTextColor(225, 29, 72);
                    } else {
                        doc.setTextColor(30, 41, 59);
                    }
                    doc.text(String(v), curX, y);
                    curX += colWidths[idx];
                });

                y += rowHeight;
            }

            doc.save(`Rupiksha_Admin_${currentTab.reportType}_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (err) {
            console.error('Failed to export PDF:', err);
            alert('Failed to generate PDF. Please try again.');
        } finally {
            setExportLoading(false);
        }
    };

    // Print receipt
    const handlePrintModal = () => {
        window.print();
    };

    return (
        <div className="space-y-6 pb-12 animate-in fade-in duration-200">
            {/* Top Heading & Tab Bar */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs relative overflow-hidden">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div
                            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-md relative overflow-hidden shrink-0"
                            style={{ backgroundColor: currentTab.color }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent" />
                            <currentTab.icon size={28} className="relative z-10" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                                    All Users History
                                </span>
                                <span className="text-xs text-slate-400 font-mono">
                                    {totalElements.toLocaleString('en-IN')} total logs
                                </span>
                            </div>
                            <h2 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight mt-0.5">
                                {currentTab.label}
                            </h2>
                            <p className="text-xs text-slate-500 font-medium">
                                {currentTab.subtitle}
                            </p>
                        </div>
                    </div>

                    {/* Action buttons: Refresh, Excel, PDF */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={() => fetchData(page)}
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                            title="Refresh data"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin text-indigo-600' : 'text-slate-500'} />
                            <span>Refresh</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleExportExcel}
                            disabled={exportLoading || totalElements === 0}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-black uppercase tracking-wider transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                        >
                            <FileSpreadsheet size={15} className="text-emerald-600" />
                            <span>{exportLoading ? 'Exporting...' : 'Export Excel'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleExportPDF}
                            disabled={exportLoading || totalElements === 0}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 text-xs font-black uppercase tracking-wider transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                        >
                            <FileText size={15} className="text-rose-600" />
                            <span>Export PDF</span>
                        </button>
                    </div>
                </div>

                {/* Horizontal Navigation Tabs */}
                <div className="mt-6 pt-5 border-t border-slate-100 flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
                    {TRANSACTION_TABS.map((tab) => {
                        const isActive = currentTab.id === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => {
                                    if (onNavigate) {
                                        onNavigate(tab.id);
                                    }
                                }}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold tracking-tight whitespace-nowrap transition-all cursor-pointer ${
                                    isActive
                                        ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10 scale-[1.02]'
                                        : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border border-slate-200/60'
                                }`}
                            >
                                <tab.icon size={14} className={isActive ? 'text-indigo-300' : 'text-slate-400'} />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Metrics Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Transactions</span>
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <Layers size={16} />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-slate-800 mt-2">
                        {summary.totalTransactions?.toLocaleString('en-IN') || '0'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Across all registered users</p>
                </div>

                <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Volume</span>
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                            <IndianRupee size={16} />
                        </div>
                    </div>
                    <p className="text-2xl font-black text-emerald-600 mt-2 truncate">
                        {fmtINR(summary.totalVolume)}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Successful settlements</p>
                </div>

                <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Success Rate</span>
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                            <CheckCircle2 size={16} />
                        </div>
                    </div>
                    <div className="flex items-baseline gap-2 mt-2">
                        <p className="text-2xl font-black text-slate-800">
                            {summary.successCount?.toLocaleString('en-IN') || '0'}
                        </p>
                        <span className="text-xs text-emerald-600 font-bold">
                            {summary.totalTransactions > 0
                                ? `${((summary.successCount / summary.totalTransactions) * 100).toFixed(1)}%`
                                : '0%'}
                        </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">Approved transfers</p>
                </div>

                <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Pending / Failed</span>
                        <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                            <AlertTriangle size={16} />
                        </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                        <span className="text-xl font-black text-amber-600">
                            {summary.pendingCount?.toLocaleString('en-IN') || '0'} <span className="text-[10px] font-bold text-slate-400">pend</span>
                        </span>
                        <span className="text-slate-300">|</span>
                        <span className="text-xl font-black text-rose-600">
                            {summary.failedCount?.toLocaleString('en-IN') || '0'} <span className="text-[10px] font-bold text-slate-400">fail</span>
                        </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">Exceptions / In flight</p>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200/80 shadow-xs space-y-4">
                <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    {/* Search by Number or Party Code or Txn ID */}
                    <div className="md:col-span-5 relative">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by Mobile, Party Code, Txn ID, UTR, User Name..."
                            className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-medium"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => { setSearchQuery(''); handleResetFilters(); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* From Date */}
                    <div className="md:col-span-2">
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => { setFromDate(e.target.value); setQuickRange('CUSTOM'); setPage(0); }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:border-indigo-500 font-medium"
                            title="From Date"
                        />
                    </div>

                    {/* To Date */}
                    <div className="md:col-span-2">
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => { setToDate(e.target.value); setQuickRange('CUSTOM'); setPage(0); }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:border-indigo-500 font-medium"
                            title="To Date"
                        />
                    </div>

                    {/* Status Dropdown */}
                    <div className="md:col-span-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none focus:border-indigo-500 font-medium"
                        >
                            <option value="">All Statuses</option>
                            <option value="SUCCESS">Success / Approved</option>
                            <option value="PENDING">Pending / Processing</option>
                            <option value="FAILED">Failed / Declined</option>
                        </select>
                    </div>

                    {/* Search & Reset Buttons */}
                    <div className="md:col-span-1 flex items-center gap-1.5 justify-end">
                        <button
                            type="submit"
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2 px-3 text-xs font-bold transition-all shadow-xs flex items-center justify-center cursor-pointer"
                            title="Search"
                        >
                            <Search size={14} />
                        </button>
                    </div>
                </form>

                {/* Quick Date Range Pills */}
                <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-black uppercase text-slate-400 mr-1">Quick Filter:</span>
                        {[
                            { key: 'ALL', label: 'All Time' },
                            { key: 'TODAY', label: 'Today' },
                            { key: 'YESTERDAY', label: 'Yesterday' },
                            { key: '7DAYS', label: 'Last 7 Days' },
                            { key: '30DAYS', label: 'Last 30 Days' },
                        ].map((q) => (
                            <button
                                key={q.key}
                                type="button"
                                onClick={() => handleQuickRange(q.key)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                    quickRange === q.key
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {q.label}
                            </button>
                        ))}
                    </div>

                    {(searchQuery || statusFilter || fromDate || toDate) && (
                        <button
                            type="button"
                            onClick={handleResetFilters}
                            className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer"
                        >
                            <X size={13} />
                            <span>Reset Filters</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Transactions Data Table */}
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="overflow-x-auto scrollbar-thin">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <th className="px-5 py-3.5">User / Party</th>
                                <th className="px-5 py-3.5">Transaction ID & Ref</th>
                                <th className="px-5 py-3.5">Service / Provider</th>
                                <th className="px-5 py-3.5 text-right">Amount</th>
                                <th className="px-5 py-3.5 text-right">Fee / Comm.</th>
                                <th className="px-5 py-3.5 text-center">Status</th>
                                <th className="px-5 py-3.5">Date & Time</th>
                                <th className="px-5 py-3.5 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                // Skeleton loading state
                                Array.from({ length: pageSize }).map((_, idx) => (
                                    <tr key={idx} className="animate-pulse">
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-xl bg-slate-200" />
                                                <div className="space-y-1.5">
                                                    <div className="w-24 h-3 bg-slate-200 rounded" />
                                                    <div className="w-16 h-2 bg-slate-100 rounded" />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="space-y-1.5">
                                                <div className="w-28 h-3 bg-slate-200 rounded" />
                                                <div className="w-20 h-2 bg-slate-100 rounded" />
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="w-20 h-4 bg-slate-200 rounded" />
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <div className="w-16 h-4 bg-slate-200 rounded ml-auto" />
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <div className="w-12 h-3 bg-slate-100 rounded ml-auto" />
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <div className="w-16 h-5 bg-slate-200 rounded-full mx-auto" />
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="w-24 h-3 bg-slate-200 rounded" />
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <div className="w-7 h-7 bg-slate-200 rounded-lg mx-auto" />
                                        </td>
                                    </tr>
                                ))
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-16 text-center">
                                        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
                                            <Search size={24} />
                                        </div>
                                        <h4 className="text-sm font-black text-slate-700">No Transactions Found</h4>
                                        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                            No {currentTab.label} records found matching your filters. Try clearing your search query or selecting a broader date range.
                                        </p>
                                        {(searchQuery || statusFilter || fromDate || toDate) && (
                                            <button
                                                type="button"
                                                onClick={handleResetFilters}
                                                className="mt-4 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-xs font-bold transition-all cursor-pointer"
                                            >
                                                Clear All Filters
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((txn, i) => {
                                    return (
                                        <tr
                                            key={txn.transactionId || i}
                                            className="hover:bg-indigo-50/20 transition-colors group"
                                        >
                                            {/* User / Party Code */}
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-700 font-black text-[11px] shrink-0">
                                                        {(txn.userName || txn.partyCode || 'U').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                                {txn.partyCode || txn.retailerId || 'N/A'}
                                                            </span>
                                                            <p className="text-xs font-bold text-slate-800 truncate max-w-[120px]">
                                                                {txn.userName || 'N/A'}
                                                            </p>
                                                        </div>
                                                        <p className="text-[11px] text-slate-400 font-medium">
                                                            {txn.userMobile || 'N/A'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Transaction ID & References */}
                                            <td className="px-5 py-3.5 font-mono">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-bold text-slate-700 truncate max-w-[140px]" title={txn.transactionId}>
                                                        {txn.transactionId}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopy(txn.transactionId, 'Txn ID')}
                                                        className="text-slate-400 hover:text-indigo-600 p-0.5 rounded cursor-pointer"
                                                        title="Copy ID"
                                                    >
                                                        <Copy size={11} />
                                                    </button>
                                                </div>
                                                <p className="text-[10px] text-slate-400 truncate max-w-[150px]" title={txn.providerReference || txn.bankReference}>
                                                    Ref: {txn.providerReference || txn.bankReference || 'N/A'}
                                                </p>
                                            </td>

                                            {/* Service & Provider */}
                                            <td className="px-5 py-3.5">
                                                <span className="font-bold text-slate-700 block truncate max-w-[130px]">
                                                    {txn.serviceType || currentTab.label}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                    {txn.provider || 'INTERNAL'}
                                                </span>
                                            </td>

                                            {/* Amount */}
                                            <td className="px-5 py-3.5 text-right font-black text-slate-800">
                                                {fmtINR(txn.amount)}
                                            </td>

                                            {/* Fee / Commission */}
                                            <td className="px-5 py-3.5 text-right font-bold text-slate-500">
                                                {parseFloat(txn.commission || 0) > 0 ? (
                                                    <span className="text-emerald-600">+{fmtINR(txn.commission)}</span>
                                                ) : (
                                                    '₹0.00'
                                                )}
                                            </td>

                                            {/* Status */}
                                            <td className="px-5 py-3.5 text-center">
                                                <StatusBadge status={txn.status} />
                                            </td>

                                            {/* Date & Time */}
                                            <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                                                {fmtDateTime(txn.createdAt)}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-5 py-3.5 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => { setSelectedTxn(txn); setModalOpen(true); }}
                                                    className="w-7 h-7 rounded-lg bg-slate-50 hover:bg-indigo-50 border border-slate-200 text-slate-600 hover:text-indigo-600 flex items-center justify-center transition-all mx-auto cursor-pointer"
                                                    title="View Full Details"
                                                >
                                                    <Eye size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-3 text-slate-500 font-medium">
                        <span>
                            Showing{' '}
                            <strong className="text-slate-800">
                                {totalElements === 0 ? 0 : page * pageSize + 1}
                            </strong>{' '}
                            to{' '}
                            <strong className="text-slate-800">
                                {Math.min((page + 1) * pageSize, totalElements)}
                            </strong>{' '}
                            of <strong className="text-slate-800">{totalElements.toLocaleString('en-IN')}</strong> entries
                        </span>

                        <div className="flex items-center gap-1.5 ml-2">
                            <span className="text-[10px] text-slate-400 font-black uppercase">Per Page:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    setPageSize(Number(e.target.value));
                                    setPage(0);
                                }}
                                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-500 font-bold"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                    </div>

                    {/* Page Navigation Buttons */}
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => setPage(0)}
                            disabled={page === 0 || loading}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            title="First Page"
                        >
                            <ChevronsLeft size={15} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0 || loading}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            title="Previous Page"
                        >
                            <ChevronLeft size={15} />
                        </button>

                        <div className="px-3 py-1 font-mono font-bold text-slate-700 text-xs">
                            Page {page + 1} of {Math.max(1, totalPages)}
                        </div>

                        <button
                            type="button"
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1 || loading}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            title="Next Page"
                        >
                            <ChevronRight size={15} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setPage(totalPages - 1)}
                            disabled={page >= totalPages - 1 || loading}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            title="Last Page"
                        >
                            <ChevronsRight size={15} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Copy Toast Alert */}
            <AnimatePresence>
                {copyToast && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 border border-slate-800"
                    >
                        <CheckCircle2 size={15} className="text-emerald-400" />
                        <span>Copied {copyToast} to clipboard!</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Transaction Detail Modal */}
            <AnimatePresence>
                {modalOpen && selectedTxn && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]"
                        >
                            {/* Modal Header */}
                            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                                        style={{ backgroundColor: currentTab.color }}
                                    >
                                        <currentTab.icon size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                                            Transaction Details
                                        </h3>
                                        <p className="text-[10px] text-slate-400 font-mono">
                                            {selectedTxn.transactionId}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 overflow-y-auto space-y-4 text-xs">
                                {/* Amount & Status Card */}
                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-between">
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-slate-400">Total Amount</span>
                                        <p className="text-2xl font-black text-slate-800">
                                            {fmtINR(selectedTxn.amount)}
                                        </p>
                                    </div>
                                    <div>
                                        <StatusBadge status={selectedTxn.status} />
                                    </div>
                                </div>

                                {/* User Details Box */}
                                <div className="p-4 rounded-2xl border border-slate-100 bg-white space-y-2">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">User / Network Details</span>
                                    <div className="grid grid-cols-2 gap-2 pt-1">
                                        <div>
                                            <span className="text-[10px] text-slate-400">Party Code:</span>
                                            <p className="font-mono font-bold text-slate-800">{selectedTxn.partyCode || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-400">User Name:</span>
                                            <p className="font-bold text-slate-800 truncate">{selectedTxn.userName || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-400">Mobile Number:</span>
                                            <p className="font-medium text-slate-800">{selectedTxn.userMobile || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-400">Role:</span>
                                            <p className="font-bold text-indigo-600 uppercase text-[11px]">{selectedTxn.userRole || 'RETAILER'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Transaction Meta List */}
                                <div className="space-y-2 divide-y divide-slate-100">
                                    <div className="flex items-center justify-between py-1.5">
                                        <span className="text-slate-400">Transaction ID</span>
                                        <span className="font-mono font-bold text-slate-800 select-all">{selectedTxn.transactionId}</span>
                                    </div>
                                    {selectedTxn.providerReference && (
                                        <div className="flex items-center justify-between py-1.5">
                                            <span className="text-slate-400">Provider Ref / UTR</span>
                                            <span className="font-mono font-bold text-slate-800 select-all">{selectedTxn.providerReference}</span>
                                        </div>
                                    )}
                                    {selectedTxn.bankReference && (
                                        <div className="flex items-center justify-between py-1.5">
                                            <span className="text-slate-400">Bank Ref / Account</span>
                                            <span className="font-bold text-slate-800">{selectedTxn.bankReference}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between py-1.5">
                                        <span className="text-slate-400">Service Category</span>
                                        <span className="font-bold text-slate-800">{selectedTxn.serviceType || currentTab.label}</span>
                                    </div>
                                    <div className="flex items-center justify-between py-1.5">
                                        <span className="text-slate-400">Operator / Provider</span>
                                        <span className="font-bold text-slate-800">{selectedTxn.provider || 'INTERNAL'}</span>
                                    </div>
                                    {parseFloat(selectedTxn.commission || 0) > 0 && (
                                        <div className="flex items-center justify-between py-1.5">
                                            <span className="text-slate-400">Commission / Fee</span>
                                            <span className="font-bold text-emerald-600">{fmtINR(selectedTxn.commission)}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between py-1.5">
                                        <span className="text-slate-400">Created At</span>
                                        <span className="font-medium text-slate-700">{fmtDateTime(selectedTxn.createdAt)}</span>
                                    </div>
                                    {selectedTxn.remarks && (
                                        <div className="py-1.5">
                                            <span className="text-slate-400 block mb-0.5">Remarks / Message</span>
                                            <p className="bg-slate-50 p-2 rounded-xl text-slate-700 text-[11px] border border-slate-100">
                                                {selectedTxn.remarks}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={handlePrintModal}
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
                                >
                                    <Printer size={14} />
                                    <span>Print Receipt</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-all cursor-pointer"
                                >
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
