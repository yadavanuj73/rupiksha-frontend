import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    IndianRupee, Coins, TrendingUp, Calendar, Clock,
    Search, Filter, RefreshCw, ChevronLeft, ChevronRight,
    Award, CheckCircle2, ShieldCheck, ArrowUpRight, Sparkles,
    Layers, Fingerprint, Copy, Check, FileText, Download,
    Crown, Zap, ArrowDownRight, X, Wallet, AlertCircle,
    Lock, Timer
} from 'lucide-react';
import { commissionService } from '../../services/commissionService';
import { useWallet } from '../../context/WalletContext';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

export default function RetailerCommission() {
    const navigate = useNavigate();
    const { balance, availableBalance, refreshWallet } = useWallet();

    const [summary, setSummary] = useState({
        totalCommission: 0,
        todayCommission: 0,
        thisMonthCommission: 0,
        aeps1Commission: 0,
        currentPlanName: 'Free Plan',
        currentPlanCode: 'FREE'
    });

    const [activePlan, setActivePlan] = useState(null);
    const [availablePlans, setAvailablePlans] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [size] = useState(10);
    const [totalElements, setTotalElements] = useState(0);
    const [search, setSearch] = useState('');
    const [serviceFilter, setServiceFilter] = useState('ALL');
    const [copiedTxnId, setCopiedTxnId] = useState('');

    // Upgrade Plan Modal states
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [upgradingPlanId, setUpgradingPlanId] = useState(null);
    const [upgradeNotification, setUpgradeNotification] = useState(null);

    // Live countdown timer state & helper
    const [timeRemaining, setTimeRemaining] = useState({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: false,
        formatted: ''
    });

    const activeExpiresAt = activePlan?.planExpiresAt || summary?.planExpiresAt;
    const isPaidActivePlan = Boolean(
        (activePlan && activePlan.price > 0 && !activePlan.isExpired) ||
        (!activePlan && summary?.currentPlanPrice > 0 && !summary?.isExpired)
    );

    const formatExpiryDate = (isoString) => {
        if (!isoString) return '';
        try {
            return new Date(isoString).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        } catch {
            return '';
        }
    };

    useEffect(() => {
        if (!activeExpiresAt) {
            setTimeRemaining({
                days: 0,
                hours: 0,
                minutes: 0,
                seconds: 0,
                isExpired: false,
                formatted: ''
            });
            return;
        }

        const updateCountdown = () => {
            const expiryTime = new Date(activeExpiresAt).getTime();
            const now = new Date().getTime();
            const difference = expiryTime - now;

            if (difference <= 0) {
                setTimeRemaining({
                    days: 0,
                    hours: 0,
                    minutes: 0,
                    seconds: 0,
                    isExpired: true,
                    formatted: 'Plan Expired'
                });
                return;
            }

            const days = Math.floor(difference / (1000 * 60 * 60 * 24));
            const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((difference % (1000 * 60)) / 1000);

            let formatted = '';
            if (days > 0) {
                formatted = `${days}d ${hours}h left`;
            } else if (hours > 0) {
                formatted = `${hours}h ${minutes}m left`;
            } else {
                formatted = `${minutes}m ${seconds}s left`;
            }

            setTimeRemaining({
                days,
                hours,
                minutes,
                seconds,
                isExpired: false,
                formatted
            });
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 1000);
        return () => clearInterval(interval);
    }, [activeExpiresAt]);

    // Plan Name and Badge mapping helpers
    const getPlanDisplayName = (plan) => {
        if (!plan) return 'Free Plan';
        const code = String(plan.planCode || '').toUpperCase();
        const name = String(plan.planName || '');
        if (code === 'PLAN_2999' || name.includes('2999') || name.toLowerCase().includes('anand')) return 'Rupiksha Anand Plan';
        if (code === 'PLAN_4999' || name.includes('4999') || name.toLowerCase().includes('nidhi')) return 'Rupiksha Nidhi Plan';
        if (code === 'PLAN_7999' || name.includes('7999') || name.toLowerCase().includes('dhanbarsha')) return 'Rupiksha Dhanbarsha Plan';
        if (code === 'FREE' || name.toLowerCase().includes('free')) return 'Free Plan';
        return name || 'Commission Plan';
    };

    const getPlanBadge = (plan, isCurrent) => {
        if (isCurrent) return 'ACTIVE PLAN';
        const code = String(plan?.planCode || '').toUpperCase();
        const name = String(plan?.planName || '');
        if (code === 'PLAN_2999' || name.includes('2999') || name.toLowerCase().includes('anand')) return 'ANAND PLAN';
        if (code === 'PLAN_4999' || name.includes('4999') || name.toLowerCase().includes('nidhi')) return 'NIDHI PLAN';
        if (code === 'PLAN_7999' || name.includes('7999') || name.toLowerCase().includes('dhanbarsha')) return 'DHANBARSHA PLAN';
        return code || 'PLAN';
    };

    // Baseline fallback plans (updated dynamically from server)
    const defaultPlans = [
        {
            id: 'plan_free',
            planName: 'Free Plan',
            planCode: 'FREE',
            price: 0,
            maxComm: '9.00',
            slabs: [
                { minAmount: 500, maxAmount: 999, retailerCommission: 2.00 },
                { minAmount: 1000, maxAmount: 1499, retailerCommission: 2.20 },
                { minAmount: 1500, maxAmount: 1999, retailerCommission: 3.00 },
                { minAmount: 2000, maxAmount: 2499, retailerCommission: 4.00 },
                { minAmount: 2500, maxAmount: 2999, retailerCommission: 5.00 },
                { minAmount: 3000, maxAmount: 7999, retailerCommission: 7.00 },
                { minAmount: 8000, maxAmount: 10000, retailerCommission: 9.00 }
            ]
        },
        {
            id: 'plan_2999',
            planName: 'Rupiksha Anand Plan',
            planCode: 'PLAN_2999',
            price: 2999,
            maxComm: '11.00',
            slabs: [
                { minAmount: 500, maxAmount: 999, retailerCommission: 2.00 },
                { minAmount: 1000, maxAmount: 1499, retailerCommission: 2.20 },
                { minAmount: 1500, maxAmount: 1999, retailerCommission: 3.00 },
                { minAmount: 2000, maxAmount: 2499, retailerCommission: 4.00 },
                { minAmount: 2500, maxAmount: 2999, retailerCommission: 5.00 },
                { minAmount: 3000, maxAmount: 7999, retailerCommission: 9.00 },
                { minAmount: 8000, maxAmount: 10000, retailerCommission: 11.00 }
            ]
        },
        {
            id: 'plan_4999',
            planName: 'Rupiksha Nidhi Plan',
            planCode: 'PLAN_4999',
            price: 4999,
            maxComm: '13.00',
            slabs: [
                { minAmount: 500, maxAmount: 999, retailerCommission: 2.00 },
                { minAmount: 1000, maxAmount: 1499, retailerCommission: 3.00 },
                { minAmount: 1500, maxAmount: 1999, retailerCommission: 4.00 },
                { minAmount: 2000, maxAmount: 2499, retailerCommission: 6.00 },
                { minAmount: 2500, maxAmount: 2999, retailerCommission: 7.00 },
                { minAmount: 3000, maxAmount: 7999, retailerCommission: 10.00 },
                { minAmount: 8000, maxAmount: 10000, retailerCommission: 13.00 }
            ]
        },
        {
            id: 'plan_7999',
            planName: 'Rupksha Dhanbarsha Plan',
            planCode: 'PLAN_7999',
            price: 7999,
            maxComm: '16.00',
            slabs: [
                { minAmount: 500, maxAmount: 999, retailerCommission: 2.00 },
                { minAmount: 1000, maxAmount: 1499, retailerCommission: 3.00 },
                { minAmount: 1500, maxAmount: 1999, retailerCommission: 5.00 },
                { minAmount: 2000, maxAmount: 2499, retailerCommission: 7.00 },
                { minAmount: 2500, maxAmount: 2999, retailerCommission: 9.00 },
                { minAmount: 3000, maxAmount: 7999, retailerCommission: 12.00 },
                { minAmount: 8000, maxAmount: 10000, retailerCommission: 16.00 }
            ]
        }
    ];

    // Fetch Summary & Plan
    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [sumData, planData, allPlansData] = await Promise.all([
                commissionService.getRetailerSummary().catch(() => null),
                commissionService.getRetailerPlan().catch(() => null),
                commissionService.getRetailerAvailablePlans().catch(() => null)
            ]);
            if (sumData) setSummary(sumData);
            if (planData) setActivePlan(planData);
            if (allPlansData && Array.isArray(allPlansData) && allPlansData.length > 0) {
                setAvailablePlans(allPlansData);
            }
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

    // Plan Upgrade Handler
    const handleUpgradePlan = async (targetPlan) => {
        const walletBal = parseFloat(String(balance || availableBalance || 0));
        const currentActivePrice = (activePlan && activePlan.price > 0 && !activePlan.isExpired)
            ? parseFloat(String(activePlan.price || 0))
            : (summary?.currentPlanPrice > 0 && !summary?.isExpired ? parseFloat(String(summary.currentPlanPrice || 0)) : 0);

        const targetPlanPrice = parseFloat(String(targetPlan.price || 0));
        const isUpgradeDiff = currentActivePrice > 0 && targetPlanPrice > currentActivePrice;
        const priceToPay = isUpgradeDiff ? (targetPlanPrice - currentActivePrice) : targetPlanPrice;

        if (priceToPay > 0 && walletBal < priceToPay) {
            setUpgradeNotification({
                type: 'error',
                message: `Insufficient wallet balance (₹${walletBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}). You need ₹${priceToPay.toLocaleString('en-IN', { minimumFractionDigits: 2 })} to upgrade to ${getPlanDisplayName(targetPlan)}.`
            });
            return;
        }

        setUpgradingPlanId(targetPlan.id || targetPlan.planCode);
        setUpgradeNotification(null);

        try {
            const upgraded = await commissionService.upgradeRetailerPlan(targetPlan.id);
            if (upgraded) {
                setActivePlan(upgraded);
            }
            if (refreshWallet) await refreshWallet();
            await fetchInitialData();
            await fetchHistory();
            setUpgradeNotification({
                type: 'success',
                message: `🎉 Successfully upgraded to ${getPlanDisplayName(targetPlan)}! Your new slabs are now active.`
            });
            setTimeout(() => {
                setShowUpgradeModal(false);
                setUpgradeNotification(null);
            }, 2500);
        } catch (err) {
            console.error("Upgrade plan error:", err);
            setUpgradeNotification({
                type: 'error',
                message: err.message || 'Failed to upgrade plan. Please verify your balance and try again.'
            });
        } finally {
            setUpgradingPlanId(null);
        }
    };

    const currentPlanName = getPlanDisplayName(activePlan) || summary.currentPlanName || 'Free Plan';
    const currentPlanCode = activePlan?.planCode || summary.currentPlanCode || 'FREE';
    const plansToDisplay = availablePlans.length > 0 ? availablePlans : defaultPlans;
    const walletBalanceNum = parseFloat(String(balance || availableBalance || 0));
    const totalPages = Math.ceil(totalElements / size) || 1;

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 pb-28 font-['Inter',sans-serif] bg-slate-50 min-h-screen">

            {/* ── TOP SECTION: TWO-COLUMN COMPACT LAYOUT ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

                {/* ── LEFT COLUMN: Earning Slabs with Active Plan Badge & Upgrade Button (Span 7) ── */}
                <div className="lg:col-span-7 flex flex-col">
                    <div className="bg-white rounded-3xl p-5 sm:p-6 md:p-7 border border-slate-200/70 shadow-sm flex-1 flex flex-col justify-between space-y-4 sm:space-y-5 overflow-hidden">

                        {/* Header: Active Plan Badge on Left + Title + Upgrade Plan on Right */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">

                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                {/* Active Plan Badge */}
                                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/90 px-3.5 py-2 rounded-2xl flex items-center gap-2.5 shadow-2xs shrink-0 max-w-[280px] sm:max-w-none">
                                    <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-xs shrink-0">
                                        <Crown size={16} strokeWidth={2.5} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[8.5px] font-black text-emerald-800 uppercase tracking-widest leading-none">Active Plan</p>
                                        <p className="text-[12px] sm:text-xs font-black text-emerald-700 uppercase tracking-tight mt-0.5 truncate">
                                            {currentPlanName}
                                        </p>
                                        {isPaidActivePlan && activeExpiresAt && (
                                            <p className="text-[9px] font-semibold text-emerald-600/80 mt-0.5">
                                                Valid till {formatExpiryDate(activeExpiresAt)}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="min-w-0 flex-1">
                                    <h2 className="text-sm md:text-base font-black text-black tracking-tight truncate">
                                        Your Earning Slabs
                                    </h2>
                                    <p className="text-[10.5px] sm:text-[11px] font-black text-black truncate hidden sm:block">
                                        Exact rupee payout per cash withdrawal transaction.
                                    </p>
                                    {isPaidActivePlan && activeExpiresAt && (
                                        <p className="text-[11px] sm:text-xs font-black text-black flex items-center gap-1.5 mt-0.5 font-mono">
                                            <Timer size={13} className="text-black shrink-0" strokeWidth={2.5} />
                                            <span>
                                                Expires in <span className="font-black text-black">{timeRemaining.formatted || `${activePlan?.daysRemaining || 0}d left`}</span>
                                                <span className="font-black text-black ml-1 font-sans text-[10.5px] hidden sm:inline">(Valid till {formatExpiryDate(activeExpiresAt)})</span>
                                            </span>
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Upgrade Plan Button */}
                            <button
                                onClick={() => setShowUpgradeModal(true)}
                                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md shadow-indigo-500/20 transition-all active:scale-95 cursor-pointer shrink-0 self-start sm:self-auto"
                            >
                                <Sparkles size={13} className="text-amber-300 animate-pulse" />
                                <span>Upgrade Plan</span>
                            </button>
                        </div>

                        {/* Slabs Grid */}
                        {activePlan && activePlan.slabs && activePlan.slabs.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-2.5">
                                {activePlan.slabs.map((slab, i) => (
                                    <motion.div
                                        key={slab.id || i}
                                        whileHover={{ y: -2, transition: { duration: 0.15 } }}
                                        className="bg-slate-50 hover:bg-white rounded-xl p-2.5 sm:p-3 border border-slate-200/80 hover:border-emerald-300 hover:shadow-xs transition-all text-center space-y-1.5 relative group flex flex-col justify-between h-full"
                                    >
                                        <div className="inline-block bg-white group-hover:bg-slate-100 px-1.5 sm:px-2 py-0.5 rounded-md border border-slate-200/60 shadow-2xs max-w-full truncate">
                                            <p className="text-[10px] sm:text-[10.5px] font-bold text-black font-mono tracking-tight whitespace-nowrap">
                                                &#8377;{Number(slab.minAmount).toLocaleString('en-IN')} &ndash; &#8377;{Number(slab.maxAmount).toLocaleString('en-IN')}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-base sm:text-lg font-black text-emerald-700 font-mono tracking-tight">
                                                +&#8377;{Number(slab.retailerCommission).toFixed(2)}
                                            </p>
                                        </div>
                                        <div className="pt-1.5 border-t border-slate-200/40 flex items-center justify-center gap-1 text-[8.5px] font-black text-slate-500 uppercase tracking-wider">
                                            <CheckCircle2 size={10} className="text-emerald-600" />
                                            <span>Per Txn</span>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        ) : (
                            /* Default Fallback Free Plan Slabs */
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-2.5">
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
                                        className="bg-slate-50 hover:bg-white rounded-xl p-2.5 sm:p-3 border border-slate-200/80 hover:border-emerald-300 hover:shadow-xs transition-all text-center space-y-1.5 relative group flex flex-col justify-between h-full"
                                    >
                                        <div className="inline-block bg-white group-hover:bg-slate-100 px-1.5 sm:px-2 py-0.5 rounded-md border border-slate-200/60 shadow-2xs max-w-full truncate">
                                            <p className="text-[10px] sm:text-[10.5px] font-bold text-black font-mono tracking-tight whitespace-nowrap">
                                                {slab.range}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-base sm:text-lg font-black text-emerald-700 font-mono tracking-tight">
                                                {slab.comm}
                                            </p>
                                        </div>
                                        <div className="pt-1.5 border-t border-slate-200/40 flex items-center justify-center gap-1 text-[8.5px] font-black text-slate-500 uppercase tracking-wider">
                                            <CheckCircle2 size={10} className="text-emerald-600" />
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

                    {/* Filter & Export controls */}
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
                            className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer"
                        >
                            Search
                        </button>

                        {/* Export Excel Button placed right near the search bar */}
                        <button
                            type="button"
                            onClick={exportToExcel}
                            disabled={history.length === 0}
                            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
                            title="Export to Excel"
                        >
                            <Download size={13} />
                            <span>Excel</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => { setSearch(''); setPage(0); fetchHistory(0); }}
                            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
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

            {/* ── UPGRADE COMMISSION PLAN MODAL ─────────────────────────────────── */}
            <AnimatePresence>
                {showUpgradeModal && (
                    <div className="fixed inset-0 z-[100] bg-slate-900/65 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 md:p-6 overflow-y-auto">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 10 }}
                            className="bg-white rounded-3xl md:rounded-[2.2rem] border border-slate-200/90 shadow-2xl max-w-7xl w-full flex flex-col p-5 sm:p-6 md:p-7 space-y-4 md:space-y-5 my-auto"
                        >
                            {/* Modal Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 shrink-0">
                                <div className="flex items-center gap-3.5">
                                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 shrink-0">
                                        <Sparkles size={22} className="text-amber-300 animate-pulse" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg sm:text-xl md:text-2xl font-black text-slate-800 tracking-tight">
                                            Upgrade Commission Plan
                                        </h2>
                                        <p className="text-xs font-semibold text-slate-400 mt-0.5">
                                            Unlock higher rupee margins credited directly to your wallet per cash withdrawal.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    {/* Live Wallet Balance Pill */}
                                    <div className="bg-slate-50 border border-slate-200/80 px-3.5 py-2 rounded-2xl flex items-center gap-2.5 shadow-2xs">
                                        <div className="w-7 h-7 rounded-xl bg-emerald-500 flex items-center justify-center text-white shrink-0">
                                            <Wallet size={14} />
                                        </div>
                                        <div>
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Wallet Balance</p>
                                            <p className="text-xs font-black text-slate-800 font-mono tracking-tight mt-0.5">
                                                &#8377;{walletBalanceNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Close Button */}
                                    <button
                                        onClick={() => { setShowUpgradeModal(false); setUpgradeNotification(null); }}
                                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                                        title="Close"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Notification banner */}
                            {upgradeNotification && (
                                <motion.div
                                    initial={{ opacity: 0, y: -5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-3 ${upgradeNotification.type === 'success'
                                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                                        }`}
                                >
                                    {upgradeNotification.type === 'success' ? (
                                        <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                                    ) : (
                                        <AlertCircle size={18} className="text-rose-600 shrink-0" />
                                    )}
                                    <span className="flex-1">{upgradeNotification.message}</span>
                                    {upgradeNotification.type === 'error' && (
                                        <button
                                            onClick={() => navigate('/add-money')}
                                            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 transition-colors"
                                        >
                                            Add Money
                                        </button>
                                    )}
                                </motion.div>
                            )}

                            {/* Plans Comparison Grid - No Inner Scroll */}
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-4">
                                {plansToDisplay.map((plan) => {
                                    const currentActivePrice = (activePlan && activePlan.price > 0 && !activePlan.isExpired)
                                        ? parseFloat(String(activePlan.price || 0))
                                        : (summary?.currentPlanPrice > 0 && !summary?.isExpired ? parseFloat(String(summary.currentPlanPrice || 0)) : 0);

                                    const isCurrent = (activePlan && (activePlan.id === plan.id || activePlan.planCode === plan.planCode)) ||
                                        (!activePlan && (plan.planCode === 'FREE' || plan.planName?.toLowerCase().includes('free')));

                                    const priceVal = parseFloat(String(plan.price || 0));
                                    const isUpgradingThis = upgradingPlanId === (plan.id || plan.planCode);
                                    const isHigherTier = isPaidActivePlan && !isCurrent && priceVal > currentActivePrice;
                                    const isLowerTier = isPaidActivePlan && !isCurrent && priceVal < currentActivePrice;
                                    const diffPrice = isHigherTier ? (priceVal - currentActivePrice) : priceVal;
                                    const effectivePrice = isHigherTier ? diffPrice : priceVal;
                                    const hasSufficientBalance = walletBalanceNum >= effectivePrice;
                                    const planDisplayName = getPlanDisplayName(plan);
                                    const planBadge = getPlanBadge(plan, isCurrent);

                                    // Dynamic Slabs: Prioritize activePlan slabs if this is the active plan
                                    const slabsList = (isCurrent && activePlan && activePlan.slabs && activePlan.slabs.length > 0)
                                        ? activePlan.slabs
                                        : (plan.slabs && plan.slabs.length > 0 ? plan.slabs : []);

                                    // Calculate live maximum commission from slab list
                                    const maxCommission = slabsList.length > 0
                                        ? Math.max(...slabsList.map(s => Number(s.retailerCommission || 0)))
                                        : Number(plan.maxComm || 9.00);

                                    return (
                                        <motion.div
                                            key={plan.id || plan.planCode}
                                            whileHover={{ y: -2, transition: { duration: 0.15 } }}
                                            className={`rounded-2xl sm:rounded-3xl p-4 sm:p-5 border flex flex-col justify-between transition-all relative ${isCurrent
                                                ? 'bg-gradient-to-b from-emerald-50/70 to-white border-emerald-300 shadow-md ring-2 ring-emerald-500/20'
                                                : isLowerTier
                                                ? 'bg-slate-50/80 border-slate-200/80 opacity-80'
                                                : 'bg-white hover:bg-slate-50/40 border-slate-200 shadow-xs hover:shadow-md'
                                                }`}
                                        >
                                            {/* Top Pill / Badge */}
                                            <div className="flex items-center justify-between gap-1.5 mb-2.5">
                                                <span className={`text-[8.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg ${isCurrent
                                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                                    : isLowerTier
                                                    ? 'bg-slate-200 text-slate-600 flex items-center gap-1'
                                                    : isHigherTier
                                                    ? 'bg-indigo-100 text-indigo-800'
                                                    : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    {isLowerTier && <Lock size={9} />}
                                                    {planBadge}
                                                </span>
                                                <span className="text-[9.5px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                                    Up to &#8377;{maxCommission.toFixed(2)}/txn
                                                </span>
                                            </div>

                                            {/* Plan Name & Price */}
                                            <div className="space-y-0.5 mb-2">
                                                <div className="min-h-[2.2rem] flex items-center">
                                                    <h3 className="text-[14.5px] sm:text-[15.5px] md:text-base font-black text-black tracking-tight leading-snug break-normal" title={planDisplayName}>
                                                        {planDisplayName}
                                                    </h3>
                                                </div>
                                                <div className="flex flex-wrap items-baseline gap-1.5 pt-0.5">
                                                    {isHigherTier ? (
                                                        <>
                                                            <span className="text-xs sm:text-sm font-bold text-slate-400 line-through font-mono">
                                                                ₹{priceVal.toLocaleString('en-IN')}
                                                            </span>
                                                            <span className="text-2xl sm:text-3xl font-black text-indigo-700 font-mono tracking-tight">
                                                                ₹{diffPrice.toLocaleString('en-IN')}
                                                            </span>
                                                            <span className="text-[9px] font-black text-indigo-800 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                                                                Upgrade Diff
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="text-2xl sm:text-3xl font-black text-black font-mono tracking-tight">
                                                                {priceVal === 0 ? 'FREE' : `₹${priceVal.toLocaleString('en-IN')}`}
                                                            </span>
                                                            {priceVal > 0 && (
                                                                <span className="text-[10px] font-black text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                                                    / Year
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                                {isHigherTier && activeExpiresAt && (
                                                    <p className="text-[9.5px] font-medium text-slate-500 pt-1 flex items-center gap-1">
                                                        <Timer size={10} className="text-indigo-600 shrink-0" />
                                                        <span className="truncate">Retains validity till {formatExpiryDate(activeExpiresAt)}</span>
                                                    </p>
                                                )}
                                                {isCurrent && isPaidActivePlan && activeExpiresAt && (
                                                    <p className="text-[9.5px] font-bold text-emerald-700 pt-1 flex items-center gap-1">
                                                        <Timer size={10} className="text-emerald-600 shrink-0" />
                                                        <span className="truncate">Expires in {timeRemaining.formatted}</span>
                                                    </p>
                                                )}
                                            </div>

                                            {/* Slabs breakdown list - Large, Bold & Dark Black */}
                                            <div className="space-y-1.5 py-2.5 border-y border-slate-200 mb-3">
                                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-800 mb-1">
                                                    COMMISSION RATES:
                                                </p>
                                                {slabsList.slice(0, 6).map((slab, sIdx) => (
                                                    <div key={sIdx} className="flex items-center justify-between leading-tight">
                                                        <span className="text-xs sm:text-[13px] font-bold font-mono text-black">
                                                            &#8377;{Number(slab.minAmount).toLocaleString('en-IN')} - &#8377;{Number(slab.maxAmount).toLocaleString('en-IN')}
                                                        </span>
                                                        <span className="text-xs sm:text-[13.5px] font-black text-emerald-700 font-mono">
                                                            +&#8377;{Number(slab.retailerCommission).toFixed(2)}
                                                        </span>
                                                    </div>
                                                ))}
                                                {slabsList.length > 6 && (
                                                    <div key={6} className="flex items-center justify-between leading-tight">
                                                        <span className="text-xs sm:text-[13px] font-bold font-mono text-black">
                                                            &#8377;{Number(slabsList[slabsList.length - 1].minAmount).toLocaleString('en-IN')} - &#8377;{Number(slabsList[slabsList.length - 1].maxAmount).toLocaleString('en-IN')}
                                                        </span>
                                                        <span className="text-xs sm:text-[13.5px] font-black text-emerald-700 font-mono">
                                                            +&#8377;{Number(slabsList[slabsList.length - 1].retailerCommission).toFixed(2)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action Button */}
                                            <div>
                                                {isCurrent ? (
                                                    <button
                                                        disabled
                                                        className="w-full py-2.5 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-not-allowed"
                                                    >
                                                        <CheckCircle2 size={13} className="text-emerald-600" />
                                                        Current Plan
                                                    </button>
                                                ) : isLowerTier ? (
                                                    <div className="space-y-1">
                                                        <button
                                                            disabled
                                                            className="w-full py-2.5 bg-slate-100 text-slate-400 rounded-xl text-[10.5px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-not-allowed border border-slate-200"
                                                        >
                                                            <Lock size={12} className="text-slate-400" />
                                                            Downgrade Locked
                                                        </button>
                                                        <p className="text-[9px] font-medium text-slate-400 text-center leading-tight">
                                                            Active plan valid till {formatExpiryDate(activeExpiresAt)}
                                                        </p>
                                                    </div>
                                                ) : hasSufficientBalance ? (
                                                    <button
                                                        onClick={() => handleUpgradePlan(plan)}
                                                        disabled={isUpgradingThis || upgradingPlanId !== null}
                                                        className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                                                    >
                                                        {isUpgradingThis ? (
                                                            <>
                                                                <RefreshCw size={13} className="animate-spin" />
                                                                <span>Upgrading...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Sparkles size={13} className="text-amber-300" />
                                                                <span>Pay &#8377;{effectivePrice.toLocaleString('en-IN')} {isHigherTier ? 'Upgrade' : '/Year & Upgrade'}</span>
                                                            </>
                                                        )}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            setUpgradeNotification({
                                                                type: 'error',
                                                                message: `Insufficient balance (₹${walletBalanceNum.toFixed(2)}). Need ₹${effectivePrice.toFixed(2)} for ${planDisplayName}. Please add money to proceed.`
                                                            });
                                                        }}
                                                        className="w-full py-2.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors border border-slate-200"
                                                    >
                                                        <AlertCircle size={12} className="text-rose-500" />
                                                        <span>Insufficient (₹{effectivePrice.toLocaleString('en-IN')})</span>
                                                    </button>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
