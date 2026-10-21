import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    History, Search, Filter, Calendar, RefreshCw, AlertCircle,
    CheckCircle2, Clock, XCircle, Printer, Eye, ChevronLeft,
    ChevronRight, ArrowUpRight, ShieldCheck, Download, Smartphone, Zap
} from 'lucide-react';
import { bbpsService } from '../../services/apiService';
import BbpsReceiptCard from '../components/bbps/BbpsReceiptCard';

const STATUS_CONFIG = {
    SUCCESS: { label: 'SUCCESS', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
    PENDING: { label: 'PENDING', bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
    INITIATED: { label: 'INITIATED', bg: 'bg-blue-50 text-blue-700 border-blue-200', icon: Clock },
    FAILED: { label: 'FAILED', bg: 'bg-rose-50 text-rose-700 border-rose-200', icon: XCircle },
    REFUNDED: { label: 'REFUNDED', bg: 'bg-purple-50 text-purple-700 border-purple-200', icon: RefreshCw }
};

const CATEGORY_TABS = [
    { id: 'ALL', label: 'All Services' },
    { id: 'Electricity', label: 'Electricity', icon: Zap },
    { id: 'Mobile Prepaid', label: 'Mobile Prepaid', icon: Smartphone }
];

// Helper to reliably identify electricity transactions across categories and billers
const isElectricityTxn = (txn) => {
    if (!txn) return false;
    const cat = String(txn.category || '').toLowerCase();
    const ref = String(txn.merchantRefNo || txn.id || '').toUpperCase();
    const bName = String(txn.billerName || '').toLowerCase();
    return (
        cat.includes('electr') ||
        cat.includes('meter') ||
        ref.startsWith('BBPSEL') ||
        bName.includes('power') ||
        bName.includes('electric') ||
        bName.includes('discom')
    );
};

const BbpsHistory = () => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(0);
    const [size] = useState(15);
    const [totalPages, setTotalPages] = useState(1);
    const [totalElements, setTotalElements] = useState(0);
    const [summary, setSummary] = useState(null);

    // Modal
    const [selectedTxn, setSelectedTxn] = useState(null);
    const [reconcilingId, setReconcilingId] = useState(null);

    // Debounce search
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPage(0);
        }, 400);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    // Fetch transactions
    const fetchHistory = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            if (categoryFilter === 'Electricity') {
                // Fetch Electricity records directly from server
                const resElec = await bbpsService.getHistory({
                    page,
                    size,
                    category: 'Electricity',
                    status: statusFilter !== 'ALL' ? statusFilter : undefined,
                    search: debouncedSearch || undefined
                });

                // If Electricity records found, use them directly (prevents double-counting stats)
                if (resElec && ((resElec.totalElements && resElec.totalElements > 0) || (resElec.content && resElec.content.length > 0))) {
                    setTransactions(resElec.content || []);
                    setTotalPages(resElec.totalPages || 1);
                    setTotalElements(resElec.totalElements || 0);
                    if (resElec.summary) setSummary(resElec.summary);
                } else {
                    // Fallback query if server has records saved under 'Prepaid Meter'
                    const resPrepaid = await bbpsService.getHistory({
                        page,
                        size,
                        category: 'Prepaid Meter',
                        status: statusFilter !== 'ALL' ? statusFilter : undefined,
                        search: debouncedSearch || undefined
                    });
                    if (resPrepaid) {
                        setTransactions(resPrepaid.content || []);
                        setTotalPages(resPrepaid.totalPages || 1);
                        setTotalElements(resPrepaid.totalElements || 0);
                        if (resPrepaid.summary) setSummary(resPrepaid.summary);
                    } else {
                        setTransactions([]);
                        setTotalPages(1);
                        setTotalElements(0);
                    }
                }
            } else {
                const params = {
                    page,
                    size,
                    category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
                    status: statusFilter !== 'ALL' ? statusFilter : undefined,
                    search: debouncedSearch || undefined
                };
                const res = await bbpsService.getHistory(params);
                if (res) {
                    setTransactions(res.content || []);
                    setTotalPages(res.totalPages || 1);
                    setTotalElements(res.totalElements || 0);
                    if (res.summary) setSummary(res.summary);
                }
            }
        } catch (err) {
            console.error('Failed to load BBPS history:', err);
            setError(err.message || 'Failed to load transaction history');
        } finally {
            setLoading(false);
        }
    }, [page, size, categoryFilter, statusFilter, debouncedSearch]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    // Status reconcile trigger
    const handleReconcile = async (txnId) => {
        setReconcilingId(txnId);
        try {
            const updated = await bbpsService.reconcileStatus(txnId);
            fetchHistory();
            if (selectedTxn && selectedTxn.id === txnId) {
                setSelectedTxn(prev => ({ ...prev, status: updated.status, providerTxnId: updated.providerTxnId }));
            }
        } catch (err) {
            alert('Reconciliation error: ' + (err.message || 'Could not verify status'));
        } finally {
            setReconcilingId(null);
        }
    };

    return (
        <div className="min-h-screen bg-[#f7f9fc] p-3 md:p-6 lg:px-8 pb-20 font-['Inter',sans-serif] space-y-6">
            <div className="max-w-[1440px] mx-auto space-y-6">

                {/* Top Header Card */}
                <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 md:p-6 shadow-xs">
                    <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-500/5 blur-2xl" />
                    <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md shrink-0">
                                <History className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-xl md:text-2xl font-black text-black tracking-tight">
                                        BBPS Transaction History
                                    </h1>
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                        Bharat Connect
                                    </span>
                                </div>
                                <p className="text-xs font-bold text-slate-600 mt-0.5">
                                    Real-time server records, provider reference IDs, and reconciliation
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={fetchHistory}
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-black text-slate-800 transition-colors cursor-pointer"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>

                {/* KPI Summary Cards */}
                {summary && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Total Volume</span>
                            <div className="text-lg md:text-xl font-black text-black mt-1">
                                ₹{(summary.totalVolume || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Transactions</span>
                            <div className="text-lg md:text-xl font-black text-black mt-1">
                                {summary.totalTransactions || 0}
                            </div>
                        </div>
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-2xs">
                            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800">Successful</span>
                            <div className="text-lg md:text-xl font-black text-emerald-700 mt-1">
                                {summary.successCount || 0}
                            </div>
                        </div>
                        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-2xs">
                            <span className="text-[11px] font-black uppercase tracking-wider text-amber-800">Pending</span>
                            <div className="text-lg md:text-xl font-black text-amber-700 mt-1">
                                {summary.pendingCount || 0}
                            </div>
                        </div>
                        <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 shadow-2xs">
                            <span className="text-[11px] font-black uppercase tracking-wider text-rose-800">Failed / Refunded</span>
                            <div className="text-lg md:text-xl font-black text-rose-700 mt-1">
                                {(summary.failedCount || 0) + (summary.refundedCount || 0)}
                            </div>
                        </div>
                    </div>
                )}

                {/* Filter and Search Bar */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
                    {/* Top Row: Category Tabs */}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 mr-1">Category:</span>
                            {CATEGORY_TABS.map(cat => {
                                const Icon = cat.icon;
                                const isSelected = categoryFilter === cat.id;
                                return (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => {
                                            setCategoryFilter(cat.id);
                                            setPage(0);
                                        }}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer ${
                                            isSelected
                                                ? 'bg-black text-white shadow-xs'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-black'
                                        }`}
                                    >
                                        {Icon && <Icon className="w-3.5 h-3.5" />}
                                        <span>{cat.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Search Input */}
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search consumer, ref, board, mobile..."
                                className="w-full pl-9 pr-3.5 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-black placeholder-slate-400"
                            />
                        </div>
                    </div>

                    {/* Bottom Row: Status Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 mr-1">Status:</span>
                        {['ALL', 'SUCCESS', 'PENDING', 'FAILED', 'REFUNDED'].map(st => (
                            <button
                                key={st}
                                type="button"
                                onClick={() => {
                                    setStatusFilter(st);
                                    setPage(0);
                                }}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer ${
                                    statusFilter === st
                                        ? 'bg-blue-600 text-white shadow-2xs'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-black'
                                }`}
                            >
                                {st}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Transactions Table Card */}
                <div className="rounded-3xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                    {loading ? (
                        <div className="py-20 text-center space-y-2">
                            <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                            <p className="text-xs font-bold text-slate-600">Loading BBPS transactions...</p>
                        </div>
                    ) : error ? (
                        <div className="py-16 text-center space-y-3">
                            <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
                            <p className="text-xs font-bold text-rose-700">{error}</p>
                            <button
                                type="button"
                                onClick={fetchHistory}
                                className="px-4 py-1.5 rounded-xl bg-blue-600 text-white font-black text-xs"
                            >
                                Retry
                            </button>
                        </div>
                    ) : transactions.length > 0 ? (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-600">
                                            <th className="py-3.5 px-4">Date & Time</th>
                                            <th className="py-3.5 px-4">Service</th>
                                            <th className="py-3.5 px-4">Transaction Ref</th>
                                            <th className="py-3.5 px-4">Biller / Consumer</th>
                                            <th className="py-3.5 px-4">State / Circle</th>
                                            <th className="py-3.5 px-4 text-right">Amount</th>
                                            <th className="py-3.5 px-4">Status</th>
                                            <th className="py-3.5 px-4">Provider Ref</th>
                                            <th className="py-3.5 px-4 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                                        {transactions.map(item => {
                                            const statusObj = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;
                                            const StatusIcon = statusObj.icon;
                                            const isPending = item.status === 'PENDING' || item.status === 'INITIATED';
                                            const isElectricity = isElectricityTxn(item);

                                            return (
                                                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                                                        {item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN', {
                                                            day: '2-digit', month: 'short', year: 'numeric',
                                                            hour: '2-digit', minute: '2-digit'
                                                        }) : 'N/A'}
                                                    </td>
                                                    <td className="py-3 px-4 whitespace-nowrap">
                                                        {isElectricity ? (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200">
                                                                <Zap className="w-3 h-3 text-amber-600" />
                                                                Electricity
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                                                                <Smartphone className="w-3 h-3 text-blue-600" />
                                                                Mobile Prepaid
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 font-mono text-black font-black whitespace-nowrap">
                                                        {item.merchantRefNo || item.id.substring(0, 8)}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="font-black text-black">{item.billerName}</div>
                                                        {isElectricity ? (
                                                            <div className="text-[11px] text-slate-600 font-mono">
                                                                ID: {item.consumerNumber || item.maskedMobileNumber || '—'}
                                                                {item.customerName ? ` (${item.customerName})` : ''}
                                                            </div>
                                                        ) : (
                                                            <div className="text-[11px] text-slate-500 font-mono">
                                                                {item.maskedMobileNumber || item.mobileNumber}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                                                        {item.circle || 'All India'}
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-black text-black text-sm whitespace-nowrap">
                                                        ₹{Number(item.amount).toFixed(2)}
                                                    </td>
                                                    <td className="py-3 px-4 whitespace-nowrap">
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${statusObj.bg}`}>
                                                            <StatusIcon className="w-3 h-3" />
                                                            {statusObj.label}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                                                        {item.providerTxnId || '—'}
                                                    </td>
                                                    <td className="py-3 px-4 text-center whitespace-nowrap">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedTxn(item)}
                                                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 hover:text-black transition-colors cursor-pointer"
                                                                title="View receipt"
                                                            >
                                                                <Eye className="w-3.5 h-3.5" />
                                                            </button>
                                                            {isPending && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleReconcile(item.id)}
                                                                    disabled={reconcilingId === item.id}
                                                                    className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black transition-colors cursor-pointer"
                                                                    title="Reconcile with BillAvenue"
                                                                >
                                                                    {reconcilingId === item.id ? 'Checking...' : 'Check Status'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div className="flex items-center justify-between p-4 border-t border-slate-200 text-xs font-bold text-slate-600">
                                <div>
                                    Showing <span className="font-black text-black">{transactions.length}</span> of{' '}
                                    <span className="font-black text-black">{totalElements}</span> entries
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPage(p => Math.max(0, p - 1))}
                                        disabled={page === 0}
                                        className="p-1.5 rounded-lg border border-slate-300 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="text-xs font-black">
                                        Page {page + 1} of {Math.max(1, totalPages)}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                        disabled={page >= totalPages - 1}
                                        className="p-1.5 rounded-lg border border-slate-300 bg-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 cursor-pointer"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="py-20 text-center space-y-2">
                            <History className="w-8 h-8 text-slate-400 mx-auto" />
                            <h3 className="text-sm font-black text-black">No transactions found</h3>
                            <p className="text-xs text-slate-500">
                                {statusFilter !== 'ALL' || categoryFilter !== 'ALL' || debouncedSearch
                                    ? 'Try adjusting your filters or search keywords.'
                                    : 'When you perform a BBPS transaction, records will appear here.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Receipt Modal */}
            <AnimatePresence>
                {selectedTxn && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="w-full max-w-xl my-auto"
                        >
                            {(() => {
                                const isElec = isElectricityTxn(selectedTxn);
                                const isPrepaidMeter = selectedTxn.category === 'Prepaid Meter' || selectedTxn.meterType === 'PREPAID' || selectedTxn.billerName?.toLowerCase().includes('prepaid');
                                return (
                                    <BbpsReceiptCard
                                        txnOutcome={{
                                            ...selectedTxn,
                                            status: selectedTxn.status,
                                            merchantRefNo: selectedTxn.merchantRefNo || selectedTxn.id,
                                            providerTxnId: selectedTxn.providerTxnId,
                                            approvalRefNo: selectedTxn.approvalRefNo,
                                            amount: selectedTxn.amount,
                                            billerName: selectedTxn.billerName,
                                            consumerNumber: selectedTxn.consumerNumber || selectedTxn.mobileNumber,
                                            customerName: selectedTxn.customerName || (isElec ? (isPrepaidMeter ? 'Prepaid Meter Consumer' : 'Electricity Consumer') : 'Mobile Subscriber'),
                                            meterType: isPrepaidMeter ? 'PREPAID' : (selectedTxn.meterType || 'POSTPAID'),
                                            createdAt: selectedTxn.createdAt
                                        }}
                                        category={isElec ? 'electricity' : 'mobile-prepaid'}
                                        isPrepaid={isElec && isPrepaidMeter}
                                        billerName={selectedTxn.billerName}
                                        consumerNumber={selectedTxn.consumerNumber || selectedTxn.mobileNumber}
                                        customerName={selectedTxn.customerName}
                                        onReset={() => setSelectedTxn(null)}
                                        resetButtonText="Close Receipt"
                                    />
                                );
                            })()}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default BbpsHistory;
