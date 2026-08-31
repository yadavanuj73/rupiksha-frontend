import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    IndianRupee, Coins, TrendingUp, Calendar, Clock,
    Search, Filter, RefreshCw, ChevronLeft, ChevronRight,
    Award, CheckCircle2, ShieldCheck, ArrowUpRight, Sparkles, Layers
} from 'lucide-react';
import { commissionService } from '../../services/commissionService';

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
    const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
            const res = await commissionService.getRetailerHistory({
                serviceType: serviceFilter,
                search: search,
                page: page,
                size: size
            });
            setHistory(res.content || []);
            setTotalElements(res.totalElements || 0);
        } catch (err) {
            console.error('Failed to load retailer commission history:', err);
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        fetchHistory();
    }, [page, serviceFilter]);

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 pb-24 font-['Inter',sans-serif]">
            {/* ── HEADER ────────────────────────────────────────────────────────── */}
            <div className="bg-white rounded-[2.5rem] p-6 md:p-8 border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                        <Coins size={28} strokeWidth={2.5} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-100">
                                My Earnings &bull; AEPS 1
                            </span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight mt-1">
                            Commission & Earnings
                        </h1>
                        <p className="text-xs font-semibold text-slate-400 mt-0.5">
                            Real-time fixed rupee commission credited directly to your Rupiksha wallet.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="bg-emerald-50 border border-emerald-100 px-5 py-3 rounded-2xl flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/30">
                            <Sparkles size={16} />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-emerald-800 uppercase tracking-widest">Active Plan</p>
                            <p className="text-xs font-black text-emerald-600 uppercase">{summary.currentPlanName || 'Free Plan'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── METRIC CARDS ─────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Commission */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Earned</span>
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <Award size={18} />
                        </div>
                    </div>
                    <div className="mt-4 flex items-baseline gap-1">
                        <span className="text-slate-400 text-lg font-bold">&#8377;</span>
                        <span className="text-3xl font-black text-slate-800 tracking-tight font-mono">
                            {Number(summary.totalCommission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                    <p className="text-[11px] font-bold text-emerald-600 mt-2 flex items-center gap-1">
                        <TrendingUp size={12} /> Lifetime commissions credited
                    </p>
                </motion.div>

                {/* Today's Commission */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Today's Earnings</span>
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <Clock size={18} />
                        </div>
                    </div>
                    <div className="mt-4 flex items-baseline gap-1">
                        <span className="text-slate-400 text-lg font-bold">&#8377;</span>
                        <span className="text-3xl font-black text-slate-800 tracking-tight font-mono">
                            {Number(summary.todayCommission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-400 mt-2">
                        Earned since 12:00 AM today
                    </p>
                </motion.div>

                {/* This Month */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">This Month</span>
                        <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                            <Calendar size={18} />
                        </div>
                    </div>
                    <div className="mt-4 flex items-baseline gap-1">
                        <span className="text-slate-400 text-lg font-bold">&#8377;</span>
                        <span className="text-3xl font-black text-slate-800 tracking-tight font-mono">
                            {Number(summary.thisMonthCommission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                    <p className="text-[11px] font-bold text-blue-600 mt-2">
                        Current billing month
                    </p>
                </motion.div>

                {/* AEPS 1 Total */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">AEPS 1 Total</span>
                        <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                            <IndianRupee size={18} />
                        </div>
                    </div>
                    <div className="mt-4 flex items-baseline gap-1">
                        <span className="text-slate-400 text-lg font-bold">&#8377;</span>
                        <span className="text-3xl font-black text-slate-800 tracking-tight font-mono">
                            {Number(summary.aeps1Commission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                    <p className="text-[11px] font-bold text-amber-600 mt-2">
                        Cash withdrawal commission
                    </p>
                </motion.div>
            </div>

            {/* ── ACTIVE PLAN SLABS VIEW ───────────────────────────────────────── */}
            {activePlan && activePlan.slabs && activePlan.slabs.length > 0 && (
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Layers size={18} className="text-indigo-600" />
                            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                Your Earning Slabs ({activePlan.planName})
                            </h2>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Fixed Rupee Payout
                        </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                        {activePlan.slabs.map((slab, i) => (
                            <div key={slab.id || i} className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 text-center space-y-1">
                                <p className="text-[10px] font-black text-slate-400 font-mono">
                                    &#8377;{Number(slab.minAmount).toLocaleString()} &ndash; &#8377;{Number(slab.maxAmount).toLocaleString()}
                                </p>
                                <p className="text-base font-black text-emerald-600 font-mono">
                                    +&#8377;{Number(slab.retailerCommission).toFixed(2)}
                                </p>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">per txn</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── COMMISSION HISTORY TABLE ──────────────────────────────────────── */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6 md:p-8 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-black text-slate-800">Earned Commission History</h2>
                        <p className="text-xs font-semibold text-slate-400 mt-0.5">
                            Trace every wallet credit back to its original customer AEPS transaction.
                        </p>
                    </div>

                    {/* Filter controls */}
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by Txn ID / Ref..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') fetchHistory(); }}
                                className="pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-amber-500 w-56 transition-all"
                            />
                        </div>

                        <button
                            onClick={fetchHistory}
                            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                            title="Refresh"
                        >
                            <RefreshCw size={14} className={historyLoading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                <th className="py-3.5 px-4">Date & Time</th>
                                <th className="py-3.5 px-4">Service</th>
                                <th className="py-3.5 px-4">Transaction ID</th>
                                <th className="py-3.5 px-4 text-right">Txn Amount</th>
                                <th className="py-3.5 px-4 text-center">Slab Range</th>
                                <th className="py-3.5 px-4 text-right">Commission Earned</th>
                                <th className="py-3.5 px-4 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                            {historyLoading ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-slate-400">
                                        <RefreshCw className="animate-spin mx-auto mb-2 text-amber-500" size={20} />
                                        Loading your commission records...
                                    </td>
                                </tr>
                            ) : history.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">
                                        No commissions credited yet. Perform AEPS cash withdrawals to start earning!
                                    </td>
                                </tr>
                            ) : (
                                history.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                                            {new Date(item.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                AEPS 1
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                                            {item.originalTransactionId}
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800">
                                            &#8377;{Number(item.transactionAmount).toLocaleString()}
                                        </td>
                                        <td className="py-3.5 px-4 text-center font-mono text-[11px] text-slate-600">
                                            {item.slabRange}
                                        </td>
                                        <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-600 text-sm">
                                            +&#8377;{Number(item.commissionAmount).toFixed(2)}
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
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
                {totalElements > size && (
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                        <span className="text-xs text-slate-400 font-bold">
                            Showing {page * size + 1} to {Math.min((page + 1) * size, totalElements)} of {totalElements} entries
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                disabled={page === 0}
                                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="text-xs font-black text-slate-700 px-2">Page {page + 1}</span>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={(page + 1) * size >= totalElements}
                                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
