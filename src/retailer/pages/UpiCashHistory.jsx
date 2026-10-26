import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    History, Search, Filter, Calendar, RefreshCw, AlertCircle,
    CheckCircle2, Clock, XCircle, Printer, Eye, ChevronLeft,
    ChevronRight, ArrowUpRight, ShieldCheck, Download, HandCoins,
    IndianRupee, X, FileSpreadsheet, FileText, Share2, Copy
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { upiCashPointService } from '../../services/apiService';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

const STATUS_BADGES = {
    SUCCESS: { label: 'SUCCESS', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    PENDING: { label: 'PENDING', bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
    INITIATED: { label: 'INITIATED', bg: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
    QR_GENERATED: { label: 'QR ACTIVE', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
    FAILED: { label: 'FAILED', bg: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
    EXPIRED: { label: 'EXPIRED', bg: 'bg-slate-100 text-slate-700 border-slate-300', dot: 'bg-slate-500' }
};

// Escape potential formula injection in CSV cells
const sanitizeCsvCell = (val) => {
    if (val === null || val === undefined) return '';
    let str = String(val).replace(/"/g, '""');
    if (/^[=+@-]/.test(str)) {
        str = `'${str}`;
    }
    return `"${str}"`;
};

const UpiCashHistory = () => {
    const navigate = useNavigate();

    // Data states
    const [transactions, setTransactions] = useState([]);
    const [summary, setSummary] = useState({
        totalTransactions: 0,
        totalVolume: 0,
        successCount: 0,
        failedCount: 0,
        pendingCount: 0
    });
    const [loading, setLoading] = useState(true);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [error, setError] = useState(null);

    // Filters & Pagination
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [page, setPage] = useState(0);
    const [size, setSize] = useState(15);
    const [totalPages, setTotalPages] = useState(1);
    const [totalElements, setTotalElements] = useState(0);

    // Modal state
    const [selectedTxn, setSelectedTxn] = useState(null);
    const [reconcilingId, setReconcilingId] = useState(null);
    const [exportLoading, setExportLoading] = useState(false);
    const [copiedField, setCopiedField] = useState(null);

    // Debounce search input
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPage(0);
        }, 400);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    // Fetch summary metrics
    const fetchSummary = useCallback(async () => {
        setSummaryLoading(true);
        try {
            const data = await upiCashPointService.getSummary();
            if (data) {
                setSummary({
                    totalTransactions: data.totalTransactions || 0,
                    totalVolume: data.totalVolume || 0,
                    successCount: data.successCount || 0,
                    failedCount: data.failedCount || 0,
                    pendingCount: data.pendingCount || 0
                });
            }
        } catch (err) {
            console.warn('Could not fetch summary stats:', err);
        } finally {
            setSummaryLoading(false);
        }
    }, []);

    // Fetch transactions list
    const fetchHistory = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {
                page,
                size,
                status: statusFilter !== 'ALL' ? statusFilter : undefined,
                search: debouncedSearch.trim() || undefined,
                fromDate: fromDate || undefined,
                toDate: toDate || undefined
            };

            const res = await upiCashPointService.getHistory(params);
            if (res) {
                setTransactions(res.content || []);
                setTotalPages(res.totalPages || 1);
                setTotalElements(res.totalElements || 0);

                if (res.summary) {
                    setSummary(prev => ({ ...prev, ...res.summary }));
                }
            }
        } catch (err) {
            console.error('Fetch history error:', err);
            setError(err.response?.data?.message || err.message || 'Failed to load transaction history');
        } finally {
            setLoading(false);
        }
    }, [page, size, statusFilter, debouncedSearch, fromDate, toDate]);

    // Initial load and filter change trigger
    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    useEffect(() => {
        fetchSummary();
    }, [fetchSummary]);

    // Quick Date Filters
    const applyQuickFilter = (type) => {
        const today = new Date();
        let from = '';
        let to = today.toISOString().split('T')[0];

        if (type === 'today') {
            from = to;
        } else if (type === 'yesterday') {
            const yest = new Date(today);
            yest.setDate(today.getDate() - 1);
            from = yest.toISOString().split('T')[0];
            to = from;
        } else if (type === 'week') {
            const week = new Date(today);
            week.setDate(today.getDate() - 7);
            from = week.toISOString().split('T')[0];
        } else if (type === 'month') {
            const month = new Date(today);
            month.setMonth(today.getMonth() - 1);
            from = month.toISOString().split('T')[0];
        }

        setFromDate(from);
        setToDate(to);
        setPage(0);
    };

    const handleClearFilters = () => {
        setSearchQuery('');
        setStatusFilter('ALL');
        setFromDate('');
        setToDate('');
        setPage(0);
    };

    // Reconcile pending transaction
    const handleReconcile = async (txn) => {
        if (!txn || !txn.id) return;
        setReconcilingId(txn.id);
        try {
            const res = await upiCashPointService.reconcile(txn.id);
            if (res && res.success) {
                // Update item in list
                setTransactions(prev => prev.map(t => (t.id === txn.id ? { ...t, ...res } : t)));
                if (selectedTxn && selectedTxn.id === txn.id) {
                    setSelectedTxn(prev => ({ ...prev, ...res }));
                }
                fetchSummary();
            }
        } catch (err) {
            console.error('Reconciliation error:', err);
            alert(err.response?.data?.message || 'Reconciliation check failed');
        } finally {
            setReconcilingId(null);
        }
    };

    // Copy helper
    const handleCopy = (text, field) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    // Export to Excel
    const handleExportExcel = async () => {
        try {
            setExportLoading(true);
            const params = {
                status: statusFilter !== 'ALL' ? statusFilter : undefined,
                search: debouncedSearch.trim() || undefined,
                fromDate: fromDate || undefined,
                toDate: toDate || undefined
            };

            let data = await upiCashPointService.getExport(params);
            if (!data || data.length === 0) data = transactions;

            if (!data || data.length === 0) {
                alert('No records available to export.');
                return;
            }

            const rows = data.map(t => ({
                'Transaction Date': t.createdAt ? new Date(t.createdAt).toLocaleString('en-IN') : (t.transactionDate || ''),
                'Partner Request ID': t.partnerRequestId || '',
                'Fingpay Txn ID': t.fpTxnId || '',
                'Bank RRN': t.bankRrn || '',
                'Amount (INR)': parseFloat(t.amount || 0),
                'Status': t.status || '',
                'Response Message': t.responseMessage || '',
                'Payer Name': t.payerName || '',
                'Payer VPA': t.payerVpa || '',
                'Retailer BC ID': t.merchantLoginId || '',
                'Reconciliation Status': t.reconStatus || 'N/A'
            }));

            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'UPI_Cash_Point');
            XLSX.writeFile(wb, `Rupiksha_UPICW_History_${Date.now()}.xlsx`);
        } catch (err) {
            console.error('Excel export error:', err);
            alert('Failed to export Excel report.');
        } finally {
            setExportLoading(false);
        }
    };

    // Export to CSV
    const handleExportCsv = async () => {
        try {
            setExportLoading(true);
            const params = {
                status: statusFilter !== 'ALL' ? statusFilter : undefined,
                search: debouncedSearch.trim() || undefined,
                fromDate: fromDate || undefined,
                toDate: toDate || undefined
            };

            let data = await upiCashPointService.getExport(params);
            if (!data || data.length === 0) data = transactions;

            if (!data || data.length === 0) {
                alert('No records available to export.');
                return;
            }

            const headers = [
                'Date & Time', 'Partner Request ID', 'Fingpay Txn ID',
                'Bank RRN', 'Amount (INR)', 'Status', 'Response Message',
                'Payer Name', 'Payer VPA', 'Retailer BC ID'
            ];

            const rows = data.map(t => [
                sanitizeCsvCell(t.createdAt ? new Date(t.createdAt).toLocaleString('en-IN') : t.transactionDate),
                sanitizeCsvCell(t.partnerRequestId),
                sanitizeCsvCell(t.fpTxnId),
                sanitizeCsvCell(t.bankRrn),
                sanitizeCsvCell(t.amount),
                sanitizeCsvCell(t.status),
                sanitizeCsvCell(t.responseMessage),
                sanitizeCsvCell(t.payerName),
                sanitizeCsvCell(t.payerVpa),
                sanitizeCsvCell(t.merchantLoginId)
            ].join(','));

            const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', `Rupiksha_UPICW_History_${Date.now()}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('CSV export error:', err);
            alert('Failed to export CSV.');
        } finally {
            setExportLoading(false);
        }
    };

    // Export to PDF
    const handleExportPdf = async () => {
        try {
            setExportLoading(true);
            const params = {
                status: statusFilter !== 'ALL' ? statusFilter : undefined,
                search: debouncedSearch.trim() || undefined,
                fromDate: fromDate || undefined,
                toDate: toDate || undefined
            };

            let data = await upiCashPointService.getExport(params);
            if (!data || data.length === 0) data = transactions;

            if (!data || data.length === 0) {
                alert('No records available to export.');
                return;
            }

            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const w = doc.internal.pageSize.getWidth();

            // Header Banner
            doc.setFillColor(15, 23, 42); // dark navy
            doc.rect(0, 0, w, 22, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text('RUPIKSHA SERVICES — UPI CASH POINT TRANSACTION STATEMENT', 14, 11);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(203, 213, 225);
            doc.text(`Generated on ${new Date().toLocaleString('en-IN')} | Records: ${data.length}`, 14, 17);

            // Table Header
            let y = 30;
            doc.setFillColor(241, 245, 249);
            doc.rect(14, y, w - 28, 8, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(51, 65, 85);

            doc.text('Date & Time', 16, y + 5.5);
            doc.text('Partner Request ID', 46, y + 5.5);
            doc.text('Fingpay Txn ID', 82, y + 5.5);
            doc.text('Bank RRN', 125, y + 5.5);
            doc.text('Amount (INR)', 160, y + 5.5);
            doc.text('Status', 188, y + 5.5);
            doc.text('Payer Details', 214, y + 5.5);
            doc.text('Message', 252, y + 5.5);

            y += 10;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);

            data.slice(0, 50).forEach((row, i) => {
                if (y > 185) {
                    doc.addPage();
                    y = 20;
                }

                if (i % 2 === 1) {
                    doc.setFillColor(248, 250, 252);
                    doc.rect(14, y - 4, w - 28, 7, 'F');
                }

                doc.setTextColor(30, 41, 59);
                doc.text(row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-IN') : (row.transactionDate || ''), 16, y);
                doc.text(String(row.partnerRequestId || '').slice(0, 18), 46, y);
                doc.text(String(row.fpTxnId || '').slice(0, 20), 82, y);
                doc.text(String(row.bankRrn || 'N/A').slice(0, 16), 125, y);
                doc.text(`INR ${parseFloat(row.amount || 0).toFixed(2)}`, 160, y);

                // Status text color
                if (row.status === 'SUCCESS') doc.setTextColor(16, 185, 129);
                else if (row.status === 'PENDING') doc.setTextColor(245, 158, 11);
                else doc.setTextColor(239, 68, 68);
                doc.text(String(row.status || ''), 188, y);

                doc.setTextColor(71, 85, 105);
                doc.text(`${String(row.payerName || '').slice(0, 12)} (${String(row.payerVpa || '').slice(0, 12)})`, 214, y);
                doc.text(String(row.responseMessage || '').slice(0, 22), 252, y);

                y += 6.5;
            });

            doc.save(`Rupiksha_UPICW_Report_${Date.now()}.pdf`);
        } catch (err) {
            console.error('PDF export error:', err);
            alert('Failed to export PDF.');
        } finally {
            setExportLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] p-3 md:p-6 lg:p-8 font-['Inter',sans-serif] space-y-6">
            {/* Header section */}
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 md:p-6 rounded-3xl border border-slate-200/80 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25">
                        <History size={28} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
                                UPI Cash Point History
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                                Official Ledger
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Real-time transaction history, reconciliations, and regulatory statements.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                        type="button"
                        onClick={() => navigate('/upi-cash-point')}
                        className="px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/25 transition-all flex items-center gap-2"
                    >
                        <HandCoins size={15} />
                        <span>New Withdrawal</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            fetchHistory();
                            fetchSummary();
                        }}
                        className="p-2.5 rounded-2xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={16} className={loading || summaryLoading ? 'animate-spin' : ''} />
                    </button>

                    {/* Export Dropdown / Buttons */}
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            disabled={exportLoading}
                            onClick={handleExportExcel}
                            className="px-3 py-2 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-all flex items-center gap-1.5"
                            title="Export Excel"
                        >
                            <FileSpreadsheet size={14} />
                            <span className="hidden sm:inline">Excel</span>
                        </button>
                        <button
                            type="button"
                            disabled={exportLoading}
                            onClick={handleExportCsv}
                            className="px-3 py-2 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition-all flex items-center gap-1.5"
                            title="Export CSV"
                        >
                            <FileText size={14} />
                            <span className="hidden sm:inline">CSV</span>
                        </button>
                        <button
                            type="button"
                            disabled={exportLoading}
                            onClick={handleExportPdf}
                            className="px-3 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition-all flex items-center gap-1.5"
                            title="Export PDF"
                        >
                            <Download size={14} />
                            <span className="hidden sm:inline">PDF</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* 5 Server-Derived Metric Cards */}
            <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
                {/* Total Volume */}
                <div className="bg-white p-4 md:p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Successful Volume</span>
                    <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
                            ₹{Number(summary.totalVolume || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                    </div>
                    <span className="text-[10px] text-emerald-600 font-bold mt-1">Dispensed to customers</span>
                </div>

                {/* Total Txns */}
                <div className="bg-white p-4 md:p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Transactions</span>
                    <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
                            {summary.totalTransactions}
                        </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium mt-1">All recorded attempts</span>
                </div>

                {/* Success Count */}
                <div className="bg-white p-4 md:p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Successful</span>
                    <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-xl md:text-2xl font-black text-emerald-700 tracking-tight">
                            {summary.successCount}
                        </span>
                    </div>
                    <span className="text-[10px] text-emerald-600 font-medium mt-1">Wallet credited</span>
                </div>

                {/* Pending Count */}
                <div className="bg-white p-4 md:p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">Pending / Active</span>
                    <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-xl md:text-2xl font-black text-amber-700 tracking-tight">
                            {summary.pendingCount}
                        </span>
                    </div>
                    <span className="text-[10px] text-amber-600 font-medium mt-1">Awaiting confirmation</span>
                </div>

                {/* Failed Count */}
                <div className="bg-white p-4 md:p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-600">Failed / Expired</span>
                    <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-xl md:text-2xl font-black text-rose-700 tracking-tight">
                            {summary.failedCount}
                        </span>
                    </div>
                    <span className="text-[10px] text-rose-500 font-medium mt-1">No wallet deduction</span>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="max-w-7xl mx-auto bg-white p-4 md:p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    {/* Search */}
                    <div className="md:col-span-4 relative">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by Request ID, Fingpay ID, or RRN..."
                            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                        />
                    </div>

                    {/* Status Filter Tabs */}
                    <div className="md:col-span-4 flex items-center gap-1 p-1 bg-slate-50 rounded-2xl border border-slate-200/70 overflow-x-auto">
                        {['ALL', 'SUCCESS', 'PENDING', 'FAILED'].map(st => (
                            <button
                                key={st}
                                type="button"
                                onClick={() => {
                                    setStatusFilter(st);
                                    setPage(0);
                                }}
                                className={`flex-1 py-1.5 px-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                                    statusFilter === st
                                        ? 'bg-white text-indigo-700 shadow-sm border border-slate-200'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {st}
                            </button>
                        ))}
                    </div>

                    {/* Date Pickers */}
                    <div className="md:col-span-4 flex items-center gap-2">
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => {
                                setFromDate(e.target.value);
                                setPage(0);
                            }}
                            className="w-1/2 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <span className="text-slate-400 text-xs font-bold">to</span>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => {
                                setToDate(e.target.value);
                                setPage(0);
                            }}
                            className="w-1/2 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                    </div>
                </div>

                {/* Quick Date Chips & Reset */}
                <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">Quick:</span>
                        {['today', 'yesterday', 'week', 'month'].map(q => (
                            <button
                                key={q}
                                type="button"
                                onClick={() => applyQuickFilter(q)}
                                className="px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-wider transition-colors"
                            >
                                {q === 'week' ? 'Last 7 Days' : q === 'month' ? 'This Month' : q}
                            </button>
                        ))}
                    </div>

                    {(searchQuery || statusFilter !== 'ALL' || fromDate || toDate) && (
                        <button
                            type="button"
                            onClick={handleClearFilters}
                            className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1"
                        >
                            <X size={13} />
                            <span>Clear Filters</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Transactions Table Card */}
            <div className="max-w-7xl mx-auto bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[10px] font-black uppercase tracking-wider text-slate-400">
                                <th className="p-4 pl-6">Date & Time</th>
                                <th className="p-4">Partner Request ID</th>
                                <th className="p-4">Fingpay Txn ID</th>
                                <th className="p-4">Bank RRN</th>
                                <th className="p-4">Amount</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Payer Details</th>
                                <th className="p-4 pr-6 text-right">Actions</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan="8" className="py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <RefreshCw size={24} className="animate-spin text-indigo-600" />
                                            <span className="font-bold text-xs uppercase tracking-wider">Loading statement records...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <AlertCircle size={28} className="opacity-30" />
                                            <span className="font-bold text-xs uppercase tracking-wider">No UPI Cash Withdrawal records found</span>
                                            <p className="text-[11px] text-slate-400">Try adjusting your filters or initiate a new transaction.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                transactions.map((txn) => {
                                    const badge = STATUS_BADGES[txn.status] || STATUS_BADGES.PENDING;
                                    return (
                                        <tr key={txn.id} className="hover:bg-slate-50/70 transition-colors">
                                            {/* Date */}
                                            <td className="p-4 pl-6 whitespace-nowrap">
                                                <span className="font-semibold text-slate-800 block">
                                                    {txn.createdAt ? new Date(txn.createdAt).toLocaleDateString('en-IN') : (txn.transactionDate || 'N/A')}
                                                </span>
                                                <span className="text-[10px] text-slate-400">
                                                    {txn.createdAt ? new Date(txn.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                                                </span>
                                            </td>

                                            {/* Partner Request ID */}
                                            <td className="p-4 whitespace-nowrap font-mono text-slate-700 font-medium">
                                                <div className="flex items-center gap-1.5">
                                                    <span>{txn.partnerRequestId}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopy(txn.partnerRequestId, `pr_${txn.id}`)}
                                                        className="text-slate-400 hover:text-slate-600"
                                                        title="Copy"
                                                    >
                                                        <Copy size={12} />
                                                    </button>
                                                </div>
                                            </td>

                                            {/* Fingpay Txn ID */}
                                            <td className="p-4 whitespace-nowrap font-mono text-slate-600 text-[11px]">
                                                {txn.fpTxnId || 'Pending'}
                                            </td>

                                            {/* Bank RRN */}
                                            <td className="p-4 whitespace-nowrap font-mono font-bold text-slate-800">
                                                {txn.bankRrn || '—'}
                                            </td>

                                            {/* Amount */}
                                            <td className="p-4 whitespace-nowrap">
                                                <span className="font-black text-slate-900 text-sm">
                                                    ₹{parseFloat(txn.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </span>
                                            </td>

                                            {/* Status Badge */}
                                            <td className="p-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-wider ${badge.bg}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                                                    {badge.label}
                                                </span>
                                            </td>

                                            {/* Payer Details */}
                                            <td className="p-4 whitespace-nowrap">
                                                <span className="font-semibold text-slate-800 block">
                                                    {txn.payerName || 'UPI Customer'}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-mono">
                                                    {txn.payerVpa || '—'}
                                                </span>
                                            </td>

                                            {/* Actions */}
                                            <td className="p-4 pr-6 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {txn.status === 'PENDING' && (
                                                        <button
                                                            type="button"
                                                            disabled={reconcilingId === txn.id}
                                                            onClick={() => handleReconcile(txn)}
                                                            className="p-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold flex items-center gap-1 transition-colors"
                                                            title="Reconcile with Fingpay"
                                                        >
                                                            <RefreshCw size={12} className={reconcilingId === txn.id ? 'animate-spin' : ''} />
                                                            <span>Recon</span>
                                                        </button>
                                                    )}

                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedTxn(txn)}
                                                        className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Eye size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                    <span className="text-slate-500 font-medium">
                        Showing {transactions.length > 0 ? page * size + 1 : 0} to {Math.min((page + 1) * size, totalElements)} of {totalElements} transactions
                    </span>

                    <div className="flex items-center gap-2">
                        <select
                            value={size}
                            onChange={(e) => {
                                setSize(Number(e.target.value));
                                setPage(0);
                            }}
                            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
                        >
                            <option value={10}>10 per page</option>
                            <option value={15}>15 per page</option>
                            <option value={25}>25 per page</option>
                            <option value={50}>50 per page</option>
                        </select>

                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                disabled={page === 0}
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                className="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="px-2.5 font-bold text-slate-700">
                                {page + 1} / {totalPages}
                            </span>
                            <button
                                type="button"
                                disabled={page >= totalPages - 1}
                                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                className="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* DETAILS / RECEIPT MODAL */}
            <AnimatePresence>
                {selectedTxn && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200"
                        >
                            {/* Modal Header */}
                            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-black tracking-wider uppercase">UPI Cash Point Transaction</h3>
                                    <p className="text-[10px] text-slate-400 font-semibold font-mono mt-0.5">
                                        {selectedTxn.partnerRequestId}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedTxn(null)}
                                    className="text-slate-400 hover:text-white text-lg font-bold"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="p-6 space-y-4 text-xs">
                                <div className="text-center py-2 border-b border-dashed border-slate-200">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${
                                        STATUS_BADGES[selectedTxn.status]?.bg || 'bg-slate-100 text-slate-700 border-slate-200'
                                    }`}>
                                        {selectedTxn.status}
                                    </span>
                                    <p className="text-3xl font-black text-slate-900 mt-2">
                                        ₹{parseFloat(selectedTxn.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-medium">UPI Cash Withdrawal Amount</p>
                                </div>

                                <div className="space-y-2 text-slate-600">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Date & Time:</span>
                                        <span className="font-semibold text-slate-800">
                                            {selectedTxn.createdAt ? new Date(selectedTxn.createdAt).toLocaleString('en-IN') : selectedTxn.transactionDate}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Fingpay Txn ID:</span>
                                        <span className="font-mono font-bold text-slate-800">{selectedTxn.fpTxnId || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Bank RRN (UTR):</span>
                                        <span className="font-mono font-bold text-slate-800">{selectedTxn.bankRrn || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Response Code:</span>
                                        <span className="font-mono text-slate-700">{selectedTxn.responseCode || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Provider Message:</span>
                                        <span className="font-semibold text-slate-800">{selectedTxn.responseMessage || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Payer Name:</span>
                                        <span className="font-semibold text-slate-800">{selectedTxn.payerName || 'UPI Customer'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Payer VPA:</span>
                                        <span className="font-mono text-slate-700">{selectedTxn.payerVpa || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Merchant BC Login:</span>
                                        <span className="font-semibold text-slate-800">{selectedTxn.merchantLoginId || 'N/A'}</span>
                                    </div>
                                    {selectedTxn.reconStatus && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Three-Way Recon:</span>
                                            <span className="font-semibold text-indigo-700">{selectedTxn.reconStatus}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                                {selectedTxn.status === 'PENDING' && (
                                    <button
                                        type="button"
                                        disabled={reconcilingId === selectedTxn.id}
                                        onClick={() => handleReconcile(selectedTxn)}
                                        className="px-4 py-2.5 rounded-xl bg-amber-600 text-white font-bold text-xs uppercase tracking-wider hover:bg-amber-700 transition-colors flex items-center gap-1.5"
                                    >
                                        <RefreshCw size={13} className={reconcilingId === selectedTxn.id ? 'animate-spin' : ''} />
                                        <span>Check Latest Status</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setSelectedTxn(null)}
                                    className="px-4 py-2.5 rounded-xl bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider hover:bg-slate-300 transition-colors"
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
};

export default UpiCashHistory;
