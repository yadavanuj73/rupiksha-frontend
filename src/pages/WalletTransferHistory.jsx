import React, { useState, useEffect, useCallback } from 'react';
import {
    Search, RefreshCw, ArrowUpRight, ArrowDownLeft, 
    Copy, Check, FileText, Printer, ChevronLeft, ChevronRight,
    Coins, Calendar, Clock, X, ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { walletService, walletTransferService } from '../services/apiService';
import { useAuth } from '../context/AuthContext';

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

            if (res && res.success) {
                setHistory(res.data || []);
                setTotalPages(res.totalPages || 1);
                setTotalElements(res.totalElements || 0);
                setPage(res.page || 0);
            } else {
                setHistory([]);
            }
        } catch (err) {
            console.error('Failed to load transfer history:', err);
            setHistory([]);
        } finally {
            setHistoryLoading(false);
        }
    }, [directionFilter, statusFilter, searchTerm, startDate, endDate, page]);

    useEffect(() => {
        fetchHistory(0);
    }, [directionFilter, statusFilter, startDate, endDate]);

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopiedRef(true);
        setTimeout(() => setCopiedRef(false), 2000);
    };

    const handlePrintReceipt = () => {
        window.print();
    };

    // Determine Transfer Page Route based on role
    const getTransferPageRoute = () => {
        const roles = (Array.isArray(currentUser?.roles) && currentUser.roles.length ? currentUser.roles : [currentUser?.role])
            .map(r => String(typeof r === 'string' ? r : r?.name || '').trim().toUpperCase());
        if (roles.includes('SUPER_DISTRIBUTOR')) return '/super-distributor/wallet-to-wallet';
        if (roles.includes('DISTRIBUTOR')) return '/distributor/wallet-to-wallet';
        return '/wallet-to-wallet';
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                        <h2 className="text-lg font-black text-slate-900">All Transactions</h2>
                        <p className="text-xs text-slate-500 font-medium">Complete record of sent and received transfers.</p>
                    </div>

                    {/* Direction Tabs */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-black">
                        {['ALL', 'SENT', 'RECEIVED'].map((dir) => (
                            <button
                                key={dir}
                                onClick={() => setDirectionFilter(dir)}
                                className={`px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
                                    directionFilter === dir
                                        ? 'bg-white text-slate-900 shadow-xs'
                                        : 'text-slate-500 hover:text-slate-900'
                                }`}
                            >
                                {dir === 'ALL' ? 'All' : dir === 'SENT' ? 'Sent' : 'Received'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Filters Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
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
                </div>

                {/* Transactions Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-wider border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3">Reference / Date</th>
                                <th className="px-4 py-3">Direction</th>
                                <th className="px-4 py-3">Counterparty</th>
                                <th className="px-4 py-3">Party Code</th>
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
                                    return (
                                        <tr key={item.id || item.transferReference} className="hover:bg-slate-50/80 transition">
                                            <td className="px-4 py-3">
                                                <div className="font-mono font-black text-slate-900">{item.transferReference}</div>
                                                <div className="text-[10px] text-slate-400 font-bold">{new Date(item.createdAt).toLocaleString()}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                                    isSent ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                }`}>
                                                    {isSent ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
                                                    {isSent ? 'Sent' : 'Received'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-black text-slate-900">{isSent ? item.recipientName : item.senderName}</div>
                                                <div className="text-[10px] font-mono text-slate-500">{isSent ? item.recipientMobile : item.senderMobile}</div>
                                            </td>
                                            <td className="px-4 py-3 font-mono font-bold text-slate-700">
                                                {isSent ? item.recipientPartyCode : item.senderPartyCode}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`font-black font-mono ${isSent ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                    {isSent ? '-' : '+'}₹{Number(item.amount || 0).toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black rounded-full uppercase">
                                                    {item.status}
                                                </span>
                                            </td>
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
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4"
                        >
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <h3 className="text-base font-black text-slate-900">Transfer Receipt</h3>
                                <button
                                    onClick={() => setSelectedHistoryItem(null)}
                                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-bold">Reference ID:</span>
                                    <span className="font-mono font-black text-slate-900">{selectedHistoryItem.transferReference}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-bold">Direction:</span>
                                    <span className="font-black">{selectedHistoryItem.direction}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-bold">Sender:</span>
                                    <span className="font-black text-slate-900">{selectedHistoryItem.senderName} ({selectedHistoryItem.senderPartyCode})</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-bold">Recipient:</span>
                                    <span className="font-black text-slate-900">{selectedHistoryItem.recipientName} ({selectedHistoryItem.recipientPartyCode})</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-bold">Amount:</span>
                                    <span className="font-mono font-black text-slate-900">₹{Number(selectedHistoryItem.amount).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-bold">Status:</span>
                                    <span className="font-black text-emerald-600">{selectedHistoryItem.status}</span>
                                </div>
                                {selectedHistoryItem.remarks && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-500 font-bold">Remarks:</span>
                                        <span className="font-medium text-slate-700">{selectedHistoryItem.remarks}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-slate-500 font-bold">Date:</span>
                                    <span className="font-bold text-slate-700">{new Date(selectedHistoryItem.createdAt).toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handlePrintReceipt}
                                    className="flex-1 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                    <Printer size={14} />
                                    <span>Print</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedHistoryItem(null)}
                                    className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition cursor-pointer"
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
