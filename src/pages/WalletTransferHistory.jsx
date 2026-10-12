import React, { useState, useEffect, useCallback } from 'react';
import {
    Search, RefreshCw, ArrowUpRight, ArrowDownLeft, 
    Copy, Check, FileText, Printer, ChevronLeft, ChevronRight,
    Coins, Calendar, Clock, X, ArrowLeft, Download, FileSpreadsheet, RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { walletService, walletTransferService, transactionService } from '../services/apiService';
import { useAuth } from '../context/AuthContext';
import { printWalletTransferReceipt } from '../utils/walletTransferReceiptPrint';

export default function WalletTransferHistory() {
    const { user: currentUser } = useAuth();
    const navigate = useNavigate();

    // Wallet Balance State
    const [availableBalance, setAvailableBalance] = useState(0);
    const [balanceLoading, setBalanceLoading] = useState(false);

    // Transfer History State
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [directionFilter, setDirectionFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [totalElements, setTotalElements] = useState(0);

    // Export State
    const [exportingExcel, setExportingExcel] = useState(false);
    const [exportingCsv, setExportingCsv] = useState(false);

    // Receipt Modal State
    const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
    const [copiedRef, setCopiedRef] = useState(false);

    // Load Balance
    const fetchBalance = useCallback(async () => {
        if (!currentUser?.id) return;
        setBalanceLoading(true);
        try {
            const data = await walletService.getBalance(currentUser.id);
            if (data) {
                const bal = Number(data.balance || 0);
                const locked = Number(data.lockedAmount || data.lockedBalance || 0);
                setAvailableBalance(Number(data.availableBalance ?? (bal - locked)));
            }
        } catch (err) {
            console.error('Failed to load wallet balance:', err);
        } finally {
            setBalanceLoading(false);
        }
    }, [currentUser?.id]);

    useEffect(() => {
        fetchBalance();
    }, [fetchBalance]);

    // Fallback parser in case transfer records need to be retrieved from general ledger transactions
    const tryFetchFallbackTransfers = useCallback(async (targetPage = 0, pageSize = 10) => {
        try {
            const txRes = await transactionService.getHistory({
                reportType: 'WALLET_TRANSFER',
                page: targetPage,
                size: pageSize,
                search: searchTerm.trim() || undefined,
                status: statusFilter !== 'ALL' ? statusFilter : undefined,
                fromDate: startDate || undefined,
                toDate: endDate || undefined
            });

            if (txRes && txRes.success && Array.isArray(txRes.data) && txRes.data.length > 0) {
                const myId = currentUser?.id ? String(currentUser.id) : '';
                const myName = currentUser?.fullName || currentUser?.name || currentUser?.username || 'You';
                const myPartyCode = currentUser?.partyCode || currentUser?.userId || 'N/A';
                const myMobile = currentUser?.mobile || '';

                const mapped = txRes.data.map((txn, idx) => {
                    const narration = txn.remarks || txn.narration || '';
                    const isDebit = String(txn.serviceType || '').toUpperCase().includes('DEBIT') ||
                                    narration.toLowerCase().includes('to ') ||
                                    Number(txn.amount) < 0;
                    const direction = isDebit ? 'SENT' : 'RECEIVED';

                    let parsedOtherName = 'Partner';
                    let parsedOtherPartyCode = 'N/A';
                    let parsedOtherMobile = '';

                    if (narration.toLowerCase().includes('to ')) {
                        const afterTo = narration.split(/to\s+/i)[1] || '';
                        parsedOtherName = afterTo.split('(')[0].trim() || 'Recipient';
                        const codeMatch = afterTo.match(/\((RP[A-Za-z0-9_-]+)\)/i);
                        if (codeMatch) parsedOtherPartyCode = codeMatch[1];
                    } else if (narration.toLowerCase().includes('from ')) {
                        const afterFrom = narration.split(/from\s+/i)[1] || '';
                        parsedOtherName = afterFrom.split('(')[0].trim() || 'Sender';
                        const codeMatch = afterFrom.match(/\((RP[A-Za-z0-9_-]+)\)/i);
                        if (codeMatch) parsedOtherPartyCode = codeMatch[1];
                    }

                    return {
                        id: txn.providerTransactionId || txn.transactionId || `tx-${idx}`,
                        transferReference: txn.transactionId || txn.providerReference || `W2W-${idx}`,
                        direction,
                        senderId: isDebit ? myId : 'other',
                        senderName: isDebit ? myName : parsedOtherName,
                        senderPartyCode: isDebit ? myPartyCode : parsedOtherPartyCode,
                        senderMobile: isDebit ? myMobile : parsedOtherMobile,
                        recipientId: isDebit ? 'other' : myId,
                        recipientName: isDebit ? parsedOtherName : myName,
                        recipientPartyCode: isDebit ? parsedOtherPartyCode : myPartyCode,
                        recipientMobile: isDebit ? parsedOtherMobile : myMobile,
                        recipientRole: 'RETAILER',
                        amount: Math.abs(Number(txn.amount || 0)),
                        fee: 0,
                        totalDebit: Math.abs(Number(txn.amount || 0)),
                        recipientCredit: Math.abs(Number(txn.amount || 0)),
                        status: txn.status || 'SUCCESS',
                        remarks: narration || 'Wallet Transfer',
                        createdAt: txn.createdAt || new Date().toISOString()
                    };
                });

                if (directionFilter !== 'ALL') {
                    return mapped.filter(m => m.direction === directionFilter);
                }
                return mapped;
            }
        } catch (err) {
            console.warn('[WalletTransferHistory] Fallback ledger retrieval error:', err);
        }
        return null;
    }, [currentUser, directionFilter, statusFilter, searchTerm, startDate, endDate]);

    // Load Transfer History
    const fetchHistory = useCallback(async (targetPage = page) => {
        setHistoryLoading(true);
        try {
            const res = await walletTransferService.getHistory({
                direction: directionFilter !== 'ALL' ? directionFilter : undefined,
                status: statusFilter !== 'ALL' ? statusFilter : undefined,
                search: searchTerm.trim() || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                page: targetPage,
                size: 10,
                sortBy: 'createdAt',
                sortDirection: 'desc'
            });

            if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
                setHistory(res.data);
                setTotalPages(res.totalPages || 1);
                setTotalElements(res.totalElements || res.data.length);
                setPage(res.page ?? targetPage);
                return;
            }

            // Fallback check if wallet_transfers table returned 0 items
            const fallback = await tryFetchFallbackTransfers(targetPage, 10);
            if (fallback && fallback.length > 0) {
                setHistory(fallback);
                setTotalPages(1);
                setTotalElements(fallback.length);
                setPage(0);
                return;
            }

            setHistory([]);
            setTotalPages(1);
            setTotalElements(0);
            setPage(0);
        } catch (err) {
            console.error('Failed to load transfer history, trying fallback:', err);
            const fallback = await tryFetchFallbackTransfers(targetPage, 10);
            if (fallback && fallback.length > 0) {
                setHistory(fallback);
                setTotalPages(1);
                setTotalElements(fallback.length);
                setPage(0);
            } else {
                setHistory([]);
                setTotalPages(1);
                setTotalElements(0);
                setPage(0);
            }
        } finally {
            setHistoryLoading(false);
        }
    }, [directionFilter, statusFilter, searchTerm, startDate, endDate, page, tryFetchFallbackTransfers]);

    useEffect(() => {
        fetchHistory(0);
    }, [directionFilter, statusFilter, startDate, endDate]);

    const handleResetFilters = () => {
        setSearchTerm('');
        setStatusFilter('ALL');
        setDirectionFilter('ALL');
        setStartDate('');
        setEndDate('');
        setPage(0);
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopiedRef(true);
        setTimeout(() => setCopiedRef(false), 2000);
    };

    const handlePrintReceipt = () => {
        if (selectedHistoryItem) {
            printWalletTransferReceipt(selectedHistoryItem);
        } else {
            window.print();
        }
    };

    // Determine Transfer Page Route based on role
    const getTransferPageRoute = () => {
        const roles = (Array.isArray(currentUser?.roles) && currentUser.roles.length ? currentUser.roles : [currentUser?.role])
            .map(r => String(typeof r === 'string' ? r : r?.name || '').trim().toUpperCase());
        if (roles.includes('SUPER_DISTRIBUTOR')) return '/super-distributor/wallet-to-wallet';
        if (roles.includes('DISTRIBUTOR')) return '/distributor/wallet-to-wallet';
        return '/wallet-to-wallet';
    };

    // Helper to fetch complete records matching active filters for export
    const fetchExportData = async () => {
        try {
            const res = await walletTransferService.getHistory({
                direction: directionFilter !== 'ALL' ? directionFilter : undefined,
                status: statusFilter !== 'ALL' ? statusFilter : undefined,
                search: searchTerm.trim() || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                page: 0,
                size: 2000,
                sortBy: 'createdAt',
                sortDirection: 'desc'
            });
            if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
                return res.data;
            }
            const fallback = await tryFetchFallbackTransfers(0, 2000);
            if (fallback && fallback.length > 0) return fallback;
            return [];
        } catch (err) {
            console.error('Failed to fetch data for export:', err);
            const fallback = await tryFetchFallbackTransfers(0, 2000);
            return fallback || [];
        }
    };

    // Export to Excel
    const handleExportExcel = async () => {
        if (exportingExcel) return;
        setExportingExcel(true);
        try {
            const items = await fetchExportData();
            if (!items || items.length === 0) {
                alert('No records found to export.');
                return;
            }

            const rows = items.map(item => {
                const isSender = item.direction === 'SENT';
                const counterpartyName = isSender ? item.recipientName : item.senderName;
                const counterpartyCode = isSender ? item.recipientPartyCode : item.senderPartyCode;
                const counterpartyMobile = isSender ? item.recipientMobile : item.senderMobile;

                return {
                    "Reference ID": item.transferReference || '',
                    "Date & Time": item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN') : '',
                    "Direction": item.direction || '',
                    "Sender (From)": item.senderName || '',
                    "Sender Code": item.senderPartyCode || '',
                    "Sender Mobile": item.senderMobile || '',
                    "Receiver (To)": item.recipientName || '',
                    "Receiver Code": item.recipientPartyCode || '',
                    "Receiver Mobile": item.recipientMobile || '',
                    "Counterparty": counterpartyName || '',
                    "Counterparty Code": counterpartyCode || '',
                    "Amount (₹)": Number(item.amount || 0).toFixed(2),
                    "Fee (₹)": Number(item.fee || 0).toFixed(2),
                    "Total Debit (₹)": Number(item.totalDebit || 0).toFixed(2),
                    "Credit (₹)": Number(item.recipientCredit || 0).toFixed(2),
                    "Status": item.status || '',
                    "Remarks": item.remarks || ''
                };
            });

            const ws = XLSX.utils.json_to_sheet(rows);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Wallet Transfers");
            const dateStr = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `Rupiksha_Wallet_Transfers_${dateStr}.xlsx`);
        } catch (err) {
            console.error('Excel export error:', err);
            alert('Failed to export Excel.');
        } finally {
            setExportingExcel(false);
        }
    };

    // Export to CSV
    const handleExportCsv = async () => {
        if (exportingCsv) return;
        setExportingCsv(true);
        try {
            const items = await fetchExportData();
            if (!items || items.length === 0) {
                alert('No records found to export.');
                return;
            }

            const headers = [
                "Reference ID",
                "Date & Time",
                "Direction",
                "Sender (From)",
                "Sender Code",
                "Sender Mobile",
                "Receiver (To)",
                "Receiver Code",
                "Receiver Mobile",
                "Counterparty",
                "Counterparty Code",
                "Amount (INR)",
                "Fee (INR)",
                "Total Debit (INR)",
                "Credit (INR)",
                "Status",
                "Remarks"
            ];

            const csvRows = [headers.join(",")];
            items.forEach(item => {
                const isSender = item.direction === 'SENT';
                const counterpartyName = isSender ? item.recipientName : item.senderName;
                const counterpartyCode = isSender ? item.recipientPartyCode : item.senderPartyCode;

                const values = [
                    `"${item.transferReference || ''}"`,
                    `"${item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN') : ''}"`,
                    `"${item.direction || ''}"`,
                    `"${(item.senderName || '').replace(/"/g, '""')}"`,
                    `"${item.senderPartyCode || ''}"`,
                    `"${item.senderMobile || ''}"`,
                    `"${(item.recipientName || '').replace(/"/g, '""')}"`,
                    `"${item.recipientPartyCode || ''}"`,
                    `"${item.recipientMobile || ''}"`,
                    `"${(counterpartyName || '').replace(/"/g, '""')}"`,
                    `"${counterpartyCode || ''}"`,
                    Number(item.amount || 0).toFixed(2),
                    Number(item.fee || 0).toFixed(2),
                    Number(item.totalDebit || 0).toFixed(2),
                    Number(item.recipientCredit || 0).toFixed(2),
                    `"${item.status || ''}"`,
                    `"${(item.remarks || '').replace(/"/g, '""')}"`
                ];
                csvRows.push(values.join(","));
            });

            const csvContent = "\uFEFF" + csvRows.join("\n");
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            const dateStr = new Date().toISOString().slice(0, 10);
            link.setAttribute("download", `Rupiksha_Wallet_Transfers_${dateStr}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('CSV export error:', err);
            alert('Failed to export CSV.');
        } finally {
            setExportingCsv(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto font-['Inter',sans-serif] space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="p-2.5 bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white rounded-xl shadow-md">
                            <Coins size={24} className="stroke-[2.2]" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Wallet to Wallet History</h1>
                            <p className="text-xs sm:text-sm text-slate-500 font-medium">Inter-wallet fund transfer and received transaction logs.</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(getTransferPageRoute())}
                        className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                        <ArrowLeft size={14} />
                        <span>Transfer Funds</span>
                    </button>

                    <div className="flex items-center gap-3 bg-white p-2.5 px-4 rounded-2xl border border-slate-200/80 shadow-xs">
                        <div className="flex flex-col">
                            <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Available Balance</span>
                            <span className="text-lg font-black text-slate-900">
                                ₹{balanceLoading ? '...' : availableBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <button
                            onClick={fetchBalance}
                            disabled={balanceLoading}
                            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                            title="Refresh Balance"
                        >
                            <RefreshCw size={16} className={balanceLoading ? 'animate-spin text-blue-600' : ''} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Transfer History Table Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                        <h2 className="text-lg font-black text-slate-900">All Transactions</h2>
                        <p className="text-xs text-slate-500 font-medium">Complete record of sent and received transfers.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Direction Tabs */}
                        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-black">
                            {['ALL', 'SENT', 'RECEIVED'].map((dir) => (
                                <button
                                    key={dir}
                                    onClick={() => setDirectionFilter(dir)}
                                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                                        directionFilter === dir
                                            ? 'bg-white text-slate-900 shadow-xs'
                                            : 'text-slate-500 hover:text-slate-900'
                                    }`}
                                >
                                    {dir === 'ALL' ? 'All' : dir === 'SENT' ? 'Sent' : 'Received'}
                                </button>
                            ))}
                        </div>

                        {/* Export to Excel */}
                        <button
                            onClick={handleExportExcel}
                            disabled={exportingExcel}
                            className="px-3.5 py-2 bg-[#0d1527] hover:bg-[#1a253c] text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                            title="Export to Excel"
                        >
                            {exportingExcel ? (
                                <RefreshCw size={13} className="animate-spin text-emerald-400" />
                            ) : (
                                <Download size={13} className="text-emerald-400" />
                            )}
                            <span>EXCEL</span>
                        </button>

                        {/* Export to CSV */}
                        <button
                            onClick={handleExportCsv}
                            disabled={exportingCsv}
                            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-black rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                            title="Export to CSV"
                        >
                            {exportingCsv ? (
                                <RefreshCw size={13} className="animate-spin text-blue-500" />
                            ) : (
                                <Download size={13} className="text-blue-500" />
                            )}
                            <span>CSV</span>
                        </button>
                    </div>
                </div>

                {/* Filters Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && fetchHistory(0)}
                            placeholder="Search reference, party code, name..."
                            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-500"
                        />
                    </div>

                    <div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-500"
                        >
                            <option value="ALL">All Status</option>
                            <option value="SUCCESS">Success</option>
                            <option value="FAILED">Failed</option>
                        </select>
                    </div>

                    <div>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-500"
                        />
                    </div>

                    <div>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-500"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => fetchHistory(0)}
                            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                        >
                            <Search size={13} />
                            <span>Apply</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleResetFilters}
                            className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center"
                            title="Reset Filters"
                        >
                            <RotateCcw size={13} />
                        </button>
                    </div>
                </div>

                {/* Transactions Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3">Reference / Date</th>
                                <th className="px-4 py-3">Type</th>
                                <th className="px-4 py-3">Sender (From)</th>
                                <th className="px-4 py-3">Receiver (To)</th>
                                <th className="px-4 py-3">Amount</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-right">Receipt</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                            {historyLoading ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-bold">
                                        <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-blue-600" />
                                        Loading transfers...
                                    </td>
                                </tr>
                            ) : history.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-bold">
                                        No wallet transfers found matching the criteria.
                                    </td>
                                </tr>
                            ) : (
                                history.map((item) => {
                                    const isSent = item.direction === 'SENT';
                                    const currentUserId = currentUser?.id ? String(currentUser.id) : '';
                                    const currentUserCode = currentUser?.partyCode || currentUser?.userId || '';
                                    const isSenderMe = isSent || (currentUserId && (String(item.senderId) === currentUserId || item.senderPartyCode === currentUserCode));
                                    const isRecipientMe = !isSent || (currentUserId && (String(item.recipientId) === currentUserId || item.recipientPartyCode === currentUserCode));

                                    return (
                                        <tr key={item.id || item.transferReference} className="hover:bg-slate-50/80 transition">
                                            {/* Reference & Date */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono font-black text-slate-900">{item.transferReference}</span>
                                                    <button
                                                        onClick={() => copyToClipboard(item.transferReference)}
                                                        className="text-slate-400 hover:text-blue-600 transition cursor-pointer"
                                                        title="Copy Reference"
                                                    >
                                                        {copiedRef ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                                                    </button>
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                                                    {item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN') : 'N/A'}
                                                </div>
                                            </td>

                                            {/* Type / Direction */}
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                                    isSent 
                                                        ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                                                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                }`}>
                                                    {isSent ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                                                    {isSent ? 'Sent' : 'Received'}
                                                </span>
                                            </td>

                                            {/* Sender (From) Details */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-black text-slate-900">{item.senderName || 'Sender'}</span>
                                                    {isSenderMe && (
                                                        <span className="text-[9px] font-black bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded">
                                                            YOU
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10.5px] font-mono text-slate-500 mt-0.5">
                                                    {item.senderPartyCode && item.senderPartyCode !== 'N/A' && (
                                                        <span className="font-bold text-slate-700">{item.senderPartyCode}</span>
                                                    )}
                                                    {item.senderMobile && item.senderMobile !== 'N/A' && (
                                                        <span className="text-slate-400 ml-1.5">({item.senderMobile})</span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Receiver (To) Details */}
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-black text-slate-900">{item.recipientName || 'Receiver'}</span>
                                                    {isRecipientMe && !isSenderMe && (
                                                        <span className="text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded">
                                                            YOU
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10.5px] font-mono text-slate-500 mt-0.5">
                                                    {item.recipientPartyCode && item.recipientPartyCode !== 'N/A' && (
                                                        <span className="font-bold text-slate-700">{item.recipientPartyCode}</span>
                                                    )}
                                                    {item.recipientMobile && item.recipientMobile !== 'N/A' && (
                                                        <span className="text-slate-400 ml-1.5">({item.recipientMobile})</span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Amount */}
                                            <td className="px-4 py-3">
                                                <span className={`font-black font-mono text-xs ${isSent ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                    {isSent ? '-' : '+'}₹{Number(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </td>

                                            {/* Status */}
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 text-[10px] font-black rounded-full uppercase border ${
                                                    String(item.status).toUpperCase() === 'SUCCESS'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : String(item.status).toUpperCase() === 'FAILED'
                                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                                }`}>
                                                    {item.status || 'SUCCESS'}
                                                </span>
                                            </td>

                                            {/* Action */}
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => setSelectedHistoryItem(item)}
                                                    className="px-2.5 py-1 text-[11px] font-black text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                                >
                                                    View
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
                {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-2">
                        <span className="text-xs text-slate-500 font-bold">
                            Showing page {page + 1} of {totalPages} ({totalElements} total records)
                        </span>
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => fetchHistory(page - 1)}
                                disabled={page === 0 || historyLoading}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button
                                onClick={() => fetchHistory(page + 1)}
                                disabled={page >= totalPages - 1 || historyLoading}
                                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Receipt Modal */}
            <AnimatePresence>
                {selectedHistoryItem && (
                    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            className="relative bg-white rounded-2xl border-2 border-slate-300 shadow-2xl max-w-lg w-full p-4 sm:p-5 my-auto max-h-[94vh] overflow-y-auto font-['Inter',sans-serif] space-y-3 text-black"
                        >
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                                        <Coins size={18} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm sm:text-base font-black text-black leading-tight">Transfer Receipt</h3>
                                        <p className="text-[10.5px] text-slate-700 font-bold">Inter-wallet fund transfer confirmation</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedHistoryItem(null)}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-black hover:bg-slate-100 transition cursor-pointer"
                                    title="Close"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Amount & Status banner */}
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-center space-y-1">
                                <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-700">
                                    {selectedHistoryItem.direction === 'SENT' ? 'Transferred Amount' : 'Received Amount'}
                                </span>
                                <div className="text-2xl sm:text-3xl font-black font-mono text-black">
                                    ₹{Number(selectedHistoryItem.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div>
                                    <span className="inline-block px-2.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-black rounded-full uppercase">
                                        ✓ {selectedHistoryItem.status || 'SUCCESS'}
                                    </span>
                                </div>
                            </div>

                            {/* Sender and Receiver Comparison Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {/* Sender Block */}
                                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider">Sender (Debited)</span>
                                        <span className="text-[9px] font-black text-blue-600 bg-blue-100 px-1.5 py-0.2 rounded">FROM</span>
                                    </div>
                                    <div className="font-black text-black text-sm truncate">
                                        {selectedHistoryItem.senderName || 'Sender'}
                                    </div>
                                    <div className="text-[11px] text-black font-mono space-y-0.5">
                                        {selectedHistoryItem.senderPartyCode && selectedHistoryItem.senderPartyCode !== 'N/A' && !selectedHistoryItem.senderPartyCode.toLowerCase().includes('wallet transfer') && (
                                            <div>Code: <span className="font-bold text-black">{selectedHistoryItem.senderPartyCode}</span></div>
                                        )}
                                        {selectedHistoryItem.senderMobile && (
                                            <div>Mob: <span className="font-bold text-black">{selectedHistoryItem.senderMobile}</span></div>
                                        )}
                                    </div>
                                </div>

                                {/* Receiver Block */}
                                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">Receiver (Credited)</span>
                                        <span className="text-[9px] font-black text-emerald-600 bg-emerald-100 px-1.5 py-0.2 rounded">TO</span>
                                    </div>
                                    <div className="font-black text-black text-sm truncate">
                                        {selectedHistoryItem.recipientName || 'Recipient'}
                                    </div>
                                    <div className="text-[11px] text-black font-mono space-y-0.5">
                                        {selectedHistoryItem.recipientPartyCode && selectedHistoryItem.recipientPartyCode !== 'N/A' && !selectedHistoryItem.recipientPartyCode.toLowerCase().includes('wallet transfer') && (
                                            <div>Code: <span className="font-bold text-black">{selectedHistoryItem.recipientPartyCode}</span></div>
                                        )}
                                        {selectedHistoryItem.recipientMobile && (
                                            <div>Mob: <span className="font-bold text-black">{selectedHistoryItem.recipientMobile}</span></div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Metadata */}
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs text-black">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-700 font-bold text-[11px]">Reference ID:</span>
                                    <div className="flex items-center gap-1 font-mono font-black text-black">
                                        <span>{selectedHistoryItem.transferReference}</span>
                                        <button
                                            onClick={() => copyToClipboard(selectedHistoryItem.transferReference)}
                                            className="text-slate-500 hover:text-black cursor-pointer p-0.5"
                                            title="Copy Reference"
                                        >
                                            {copiedRef ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-700 font-bold text-[11px]">Transfer Type:</span>
                                    <span className="font-black text-black">
                                        {selectedHistoryItem.direction === 'SENT' ? 'Outgoing Fund Transfer' : 'Incoming Fund Transfer'}
                                    </span>
                                </div>
                                {selectedHistoryItem.remarks && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-700 font-bold text-[11px]">Remarks:</span>
                                        <span className="font-bold text-black text-right max-w-[240px] truncate">{selectedHistoryItem.remarks}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-700 font-bold text-[11px]">Date & Time:</span>
                                    <span className="font-bold text-black">
                                        {selectedHistoryItem.createdAt ? new Date(selectedHistoryItem.createdAt).toLocaleString('en-IN') : 'N/A'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-2.5 pt-1">
                                <button
                                    type="button"
                                    onClick={handlePrintReceipt}
                                    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
                                >
                                    <Printer size={14} />
                                    <span>Print Receipt</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedHistoryItem(null)}
                                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition cursor-pointer active:scale-98"
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
