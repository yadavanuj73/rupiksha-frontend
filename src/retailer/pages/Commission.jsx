import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    IndianRupee, Coins, TrendingUp, Calendar, Clock,
    Search, Filter, RefreshCw, ChevronLeft, ChevronRight,
    Award, CheckCircle2, ShieldCheck, ArrowUpRight, Sparkles,
    Layers, Fingerprint, Copy, Check, FileText, Download,
    Crown, Zap, ArrowDownRight
} from 'lucide-react';
import { commissionService } from '../../services/commissionService';
import * as XLSX from 'xlsx';

const Icon3D = ({ icon: Icon, color, size = 26 }) => (
    <div className="relative group shrink-0">
        <div className="absolute inset-0 rounded-2xl blur-xl opacity-30 group-hover:opacity-60 transition-opacity" style={{ backgroundColor: color }}></div>
        <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all active:scale-95 border border-white/20 overflow-hidden" style={{ backgroundColor: color }}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/35 to-transparent"></div>
            <Icon size={size} className="text-white relative z-10" />
        </div>
    </div>
);

export default function RetailerCommission() {
    const [summary, setSummary] = useState({
        totalCommission: 0,
        todayCommission: 0,
        thisMonthCommission: 0,
        aeps1Commission: 0,
        currentPlanName: 'Free Plan',
        currentPlanCode: 'FREE'
    });

    const [activePlan, setActivePlan] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [size] = useState(10);
    const [totalElements, setTotalElements] = useState(0);
    const [search, setSearch] = useState('');
    const [serviceFilter, setServiceFilter] = useState('ALL');
    const [copiedTxnId, setCopiedTxnId] = useState('');

    // Fetch Summary & Plan
    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [sumData, planData] = await Promise.all([
                commissionService.getRetailerSummary().catch(() => null),
                commissionService.getRetailerPlan().catch(() => null)
            ]);
            if (sumData) setSummary(sumData);
            if (planData) setActivePlan(planData);
        } catch (err) {
            console.error('Failed to load commission summary:', err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch History
    const fetchHistory = async (overridePage = page) => {
        setHistoryLoading(true);
        try {
            const res = await commissionService.getRetailerHistory({
                serviceType: serviceFilter === 'ALL' ? undefined : serviceFilter,
                search: search ? search.trim() : undefined,
                page: overridePage,
                size: size
            });
            setHistory(res.content || []);
            setTotalElements(res.totalElements || 0);
        } catch (err) {
            console.error('Failed to load retailer commission history:', err);
            setHistory([]);
            setTotalElements(0);
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        fetchHistory(page);
    }, [page, serviceFilter]);

    const handleSearchSubmit = (e) => {
        if (e) e.preventDefault();
        setPage(0);
        fetchHistory(0);
    };

    const handleCopy = (text) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedTxnId(text);
        setTimeout(() => setCopiedTxnId(''), 2000);
    };

    const exportToExcel = () => {
        if (!history || history.length === 0) {
            alert("No commission records available to export.");
            return;
        }
        const dataToExport = history.map(item => ({
            "Date & Time": new Date(item.createdAt).toLocaleString('en-IN'),
            "Service": item.serviceType || 'AEPS 1',
            "Original Txn ID": item.originalTransactionId,
            "Commission Ref": item.commissionReference,
            "Transaction Amount (INR)": item.transactionAmount,
            "Slab Range": item.slabRange,
            "Commission Amount (INR)": item.commissionAmount,
            "Status": item.status
        }));
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Commissions");
        XLSX.writeFile(wb, `Rupiksha_Commission_Ledger_${Date.now()}.xlsx`);
    };

    const totalPages = Math.ceil(totalElements / size) || 1;

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 pb-28 font-['Inter',sans-serif] bg-slate-50 min-h-screen">
            {/* ── TOP SECTION: TWO-COLUMN LAYOUT (LEFT: HEADER & SLABS | RIGHT: 4 METRIC CARDS) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                
                {/* ── LEFT COLUMN: Header Info & Slabs (Span 7) ───────────────────── */}
                <div className="lg:col-span-7 flex flex-col gap-6">
                    {/* Header Banner Card */}
                    <div className="bg-white rounded-3xl p-6 md:p-7 border border-slate-200/70 shadow-sm flex flex-col justify-between gap-5 relative overflow-hidden">
                        <div className="absolute right-0 top-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                        <div className="flex items-start gap-4 relative z-10">
                            <Icon3D icon={Coins} color="#f59e0b" size={26} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                    <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/60 shadow-2xs">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                        My Earnings &bull; AEPS 1
                                    </span>
                                </div>
                                <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight">
                                    Commission & Earnings
                                </h1>
                                <p className="text-xs font-semibold text-slate-400 mt-1">
                                    Real-time fixed rupee commission credited directly to your Rupiksha wallet.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 relative z-10">
                            {/* Active Plan Pill */}
                            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 px-3.5 py-2 rounded-xl flex items-center gap-2.5 shadow-2xs">
                                <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center text-white shadow-xs">
                                    <Crown size={14} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <p className="text-[8px] font-black text-emerald-800/70 uppercase tracking-widest leading-tight">Active Plan</p>
                                    <p className="text-[11px] font-black text-emerald-700 uppercase tracking-tight">
                                        {summary.currentPlanName || 'Free Plan'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Export Excel Button */}
                                <button
                                    onClick={exportToExcel}
                                    disabled={history.length === 0}
                                    className="flex items-center gap-2 px-4 h-10 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-[1.5px] shadow-sm hover:bg-black transition-all active:scale-95 disabled:opacity-50"
                                    title="Download Statement"
                                >
                                    <Download size={13} />
                                    Excel
                                </button>

                                {/* Refresh Button */}
                                <button
                                    onClick={() => { fetchInitialData(); fetchHistory(); }}
                                    disabled={loading || historyLoading}
                                    className="w-10 h-10 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center justify-center hover:shadow-md transition-all active:rotate-180 hover:border-amber-500 disabled:opacity-50 text-slate-700"
                                    title="Refresh Data"
                                >
                                    <RefreshCw size={15} className={loading || historyLoading ? 'animate-spin text-amber-500' : ''} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Active Plan Slabs Card */}
                    <div className="bg-white rounded-3xl p-6 border border-slate-200/70 shadow-sm flex-1 flex flex-col justify-between space-y-4">
                        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
                                    <Layers size={16} />
                                </div>
                                <div>
                                    <h2 className="text-xs md:text-sm font-black text-slate-800 tracking-tight">
                                        Your Earning Slabs ({activePlan?.planName || summary.currentPlanName || 'Free Plan'})
                                    </h2>
                                    <p className="text-[10px] font-semibold text-slate-400">
                                        Exact rupee payout per cash withdrawal transaction.
                                    </p>
                                </div>
                            </div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/70 shrink-0">
                                <Zap size={10} className="text-emerald-500" />
                                Fixed Payout
                            </span>
                        </div>

                        {activePlan && activePlan.slabs && activePlan.slabs.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                                {activePlan.slabs.map((slab, i) => (
                                    <motion.div
                                        key={slab.id || i}
                                        whileHover={{ y: -2, transition: { duration: 0.15 } }}
                                        className="bg-slate-50 hover:bg-white rounded-xl p-3 border border-slate-200/80 hover:border-emerald-300 hover:shadow-xs transition-all text-center space-y-1.5 relative group"
                                    >
                                        <div className="inline-block bg-white group-hover:bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60 shadow-2xs">
                                            <p className="text-[9px] font-black text-slate-600 font-mono tracking-tight">
                                                &#8377;{Number(slab.minAmount).toLocaleString('en-IN')} &ndash; &#8377;{Number(slab.maxAmount).toLocaleString('en-IN')}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-base font-black text-emerald-600 font-mono tracking-tight">
                                                +&#8377;{Number(slab.retailerCommission).toFixed(2)}
                                            </p>
                                        </div>
                                        <div className="pt-1.5 border-t border-slate-200/40 flex items-center justify-center gap-1 text-[8px] font-black text-slate-400 uppercase tracking-wider">
                                            <CheckCircle2 size={9} className="text-emerald-500" />
                                            <span>Per Txn</span>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            /* Default Fallback Free Plan Slabs */
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                                {[
                                    { range: '₹500 - ₹999', comm: '+₹2.00' },
                                    { range: '₹1,000 - ₹1,499', comm: '+₹2.20' },
                                    { range: '₹1,500 - ₹1,999', comm: '+₹3.00' },
                                    { range: '₹2,000 - ₹2,499', comm: '+₹4.00' },
                                    { range: '₹2,500 - ₹2,999', comm: '+₹5.00' },
                                    { range: '₹3,000 - ₹7,999', comm: '+₹7.00' },
                                    { range: '₹8,000 - ₹10,000', comm: '+₹9.00' }
                                ].map((slab, i) => (
                                    <motion.div
                                        key={i}
                                        whileHover={{ y: -2, transition: { duration: 0.15 } }}
                                        className="bg-slate-50 hover:bg-white rounded-xl p-3 border border-slate-200/80 hover:border-emerald-300 hover:shadow-xs transition-all text-center space-y-1.5 relative group"
                                    >
                                        <div className="inline-block bg-white group-hover:bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60 shadow-2xs">
                                            <p className="text-[9px] font-black text-slate-600 font-mono tracking-tight">
                                                {slab.range}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-base font-black text-emerald-600 font-mono tracking-tight">
                                                {slab.comm}
                                            </p>
                                        </div>
                                        <div className="pt-1.5 border-t border-slate-200/40 flex items-center justify-center gap-1 text-[8px] font-black text-slate-400 uppercase tracking-wider">
                                            <CheckCircle2 size={9} className="text-emerald-500" />
                                            <span>Per Txn</span>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── RIGHT COLUMN: 4 Metric Cards in 2x2 Grid (Span 5) ────────────── */}
                <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
                    {/* 1. Total Commission */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/70 shadow-sm relative overflow-hidden group hover:shadow-md transition-all flex flex-col justify-between"
                    >
                        <div>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Earned</span>
                                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                                    <Award size={18} />
                                </div>
                            </div>
                            <div className="mt-4 flex items-baseline gap-1">
                                <span className="text-slate-400 text-sm font-bold">&#8377;</span>
                                <span className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight font-mono">
                                    {Number(summary.totalCommission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                        <p className="text-[10px] font-bold text-emerald-600 mt-3 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Lifetime commissions credited
                        </p>
                    </motion.div>

                    {/* 2. Today's Commission */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/70 shadow-sm relative overflow-hidden group hover:shadow-md transition-all flex flex-col justify-between"
                    >
                        <div>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Today's Earnings</span>
                                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                                    <Clock size={18} />
                                </div>
                            </div>
                            <div className="mt-4 flex items-baseline gap-1">
                                <span className="text-slate-400 text-sm font-bold">&#8377;</span>
                                <span className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight font-mono">
                                    {Number(summary.todayCommission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 mt-3 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                            Earned since 12:00 AM today
                        </p>
                    </motion.div>

                    {/* 3. This Month */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/70 shadow-sm relative overflow-hidden group hover:shadow-md transition-all flex flex-col justify-between"
                    >
                        <div>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">This Month</span>
                                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                                    <Calendar size={18} />
                                </div>
                            </div>
                            <div className="mt-4 flex items-baseline gap-1">
                                <span className="text-slate-400 text-sm font-bold">&#8377;</span>
                                <span className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight font-mono">
                                    {Number(summary.thisMonthCommission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                        <p className="text-[10px] font-bold text-blue-600 mt-3 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            Current billing month
                        </p>
                    </motion.div>

                    {/* 4. AEPS 1 Total */}
                    <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/70 shadow-sm relative overflow-hidden group hover:shadow-md transition-all flex flex-col justify-between"
                    >
                        <div>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">AEPS 1 Total</span>
                                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
                                    <Fingerprint size={18} />
                                </div>
                            </div>
                            <div className="mt-4 flex items-baseline gap-1">
                                <span className="text-slate-400 text-sm font-bold">&#8377;</span>
                                <span className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight font-mono">
                                    {Number(summary.aeps1Commission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                        <p className="text-[10px] font-bold text-amber-600 mt-3 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            Cash withdrawal commission
                        </p>
                    </motion.div>
                </div>
            </div>

            {/* ── COMMISSION HISTORY TABLE ──────────────────────────────────────── */}
            <div className="bg-white rounded-[2rem] border border-slate-200/70 shadow-sm p-6 md:p-8 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-black text-slate-800 tracking-tight">Earned Commission History</h2>
                            <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                                {totalElements} Records
                            </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-400 mt-1">
                            Trace every wallet credit back to its original customer AEPS transaction.
                        </p>
                    </div>

                    {/* Filter controls */}
                    <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
                        <div className="relative">
                            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by Txn ID / Ref..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 w-60 transition-all"
                            />
                        </div>

                        <button
                            type="submit"
                            className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95"
                        >
                            Search
                        </button>

                        <button
                            type="button"
                            onClick={() => { setSearch(''); setPage(0); fetchHistory(0); }}
                            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                            title="Reset & Refresh"
                        >
                            <RefreshCw size={14} className={historyLoading ? 'animate-spin' : ''} />
                        </button>
                    </form>
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/90 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                <th className="py-4 px-5">Date & Time</th>
                                <th className="py-4 px-5">Service</th>
                                <th className="py-4 px-5">Original Txn ID</th>
                                <th className="py-4 px-5 text-right">Customer Amount</th>
                                <th className="py-4 px-5 text-center">Matched Slab</th>
                                <th className="py-4 px-5 text-right">Commission Earned</th>
                                <th className="py-4 px-5 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                            {historyLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="py-4 px-5"><div className="h-4 bg-slate-100 rounded w-28"></div></td>
                                        <td className="py-4 px-5"><div className="h-4 bg-slate-100 rounded w-16"></div></td>
                                        <td className="py-4 px-5"><div className="h-4 bg-slate-100 rounded w-36"></div></td>
                                        <td className="py-4 px-5 text-right"><div className="h-4 bg-slate-100 rounded w-20 ml-auto"></div></td>
                                        <td className="py-4 px-5 text-center"><div className="h-4 bg-slate-100 rounded w-24 mx-auto"></div></td>
                                        <td className="py-4 px-5 text-right"><div className="h-4 bg-slate-100 rounded w-16 ml-auto"></div></td>
                                        <td className="py-4 px-5 text-center"><div className="h-6 bg-slate-100 rounded-full w-20 mx-auto"></div></td>
                                    </tr>
                                ))
                            ) : history.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center border border-amber-100 text-amber-500">
                                                <Coins size={24} />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-black text-slate-700 tracking-tight">No Commission Records Yet</h3>
                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Perform AEPS cash withdrawals to start receiving automatic commission credits.</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                history.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                                        {/* Date & Time */}
                                        <td className="py-4 px-5 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-bold text-slate-700 font-mono">
                                                    {new Date(item.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </span>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                                    {new Date(item.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Service */}
                                        <td className="py-4 px-5">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                <Fingerprint size={12} />
                                                {item.serviceType || 'AEPS 1'}
                                            </span>
                                        </td>

                                        {/* Original Txn ID */}
                                        <td className="py-4 px-5">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-mono font-bold text-slate-800 text-[11px] group-hover:text-amber-600 transition-colors">
                                                    {item.originalTransactionId}
                                                </span>
                                                <button
                                                    onClick={() => handleCopy(item.originalTransactionId)}
                                                    className="p-1 rounded hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-colors"
                                                    title="Copy Txn ID"
                                                >
                                                    {copiedTxnId === item.originalTransactionId ? (
                                                        <Check size={12} className="text-emerald-600" />
                                                    ) : (
                                                        <Copy size={12} />
                                                    )}
                                                </button>
                                            </div>
                                            {item.commissionReference && (
                                                <p className="text-[9px] font-bold text-slate-400 font-mono mt-0.5">
                                                    REF: {item.commissionReference}
                                                </p>
                                            )}
                                        </td>

                                        {/* Txn Amount */}
                                        <td className="py-4 px-5 text-right font-mono font-bold text-slate-800 text-[13px]">
                                            &#8377;{Number(item.transactionAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>

                                        {/* Slab Range */}
                                        <td className="py-4 px-5 text-center">
                                            <span className="inline-block bg-slate-100/80 px-2 py-0.5 rounded text-[10px] font-black text-slate-600 font-mono">
                                                {item.slabRange || 'Standard'}
                                            </span>
                                        </td>

                                        {/* Commission Amount */}
                                        <td className="py-4 px-5 text-right font-mono font-black text-emerald-600 text-sm">
                                            +&#8377;{Number(item.commissionAmount || 0).toFixed(2)}
                                        </td>

                                        {/* Status */}
                                        <td className="py-4 px-5 text-center">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                CREDITED
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {!historyLoading && totalElements > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Showing <span className="text-slate-800">{page * size + 1}</span> to <span className="text-slate-800">{Math.min((page + 1) * size, totalElements)}</span> of {totalElements} entries
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="h-9 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[10px] font-black uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-2xs active:scale-95"
                            >
                                Previous
                            </button>
                            <span className="text-xs font-black text-slate-700 px-2 font-mono">
                                {page + 1} / {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                disabled={page >= totalPages - 1}
                                className="h-9 px-4 rounded-xl bg-slate-900 hover:bg-black text-white text-[10px] font-black uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

