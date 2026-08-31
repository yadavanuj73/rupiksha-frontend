import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
    IndianRupee, Save, RotateCcw, ShieldAlert, CheckCircle2,
    AlertTriangle, Search, Filter, History, ChevronLeft, ChevronRight,
    RefreshCw, Layers, Sparkles, TrendingUp, HelpCircle
} from 'lucide-react';
import { commissionService } from '../../services/commissionService';

export default function CommissionManagement() {
    const [services] = useState([
        { id: 'AEPS_1', label: 'AEPS 1 (Cash Withdrawal)' }
    ]);
    const [selectedService, setSelectedService] = useState('AEPS_1');

    const [plans, setPlans] = useState([]);
    const [selectedPlanId, setSelectedPlanId] = useState(null);
    const [slabs, setSlabs] = useState([]);
    const [originalSlabs, setOriginalSlabs] = useState([]);

    const [loadingPlans, setLoadingPlans] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState(null); // { type: 'success' | 'error', message: '' }

    // History state
    const [activeTab, setActiveTab] = useState('config'); // 'config' | 'history'
    const [historyList, setHistoryList] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyTotal, setHistoryTotal] = useState(0);
    const [historyPage, setHistoryPage] = useState(0);
    const [historySize] = useState(10);
    const [historySearch, setHistorySearch] = useState('');
    const [historyStatus, setHistoryStatus] = useState('ALL');

    // Fetch plans for selected service
    const fetchPlans = async () => {
        setLoadingPlans(true);
        setNotification(null);
        try {
            const data = await commissionService.getPlans(selectedService);
            setPlans(data || []);
            if (data && data.length > 0) {
                const currentSelected = selectedPlanId 
                    ? data.find(p => p.id === selectedPlanId) || data[0]
                    : (data.find(p => p.isDefault) || data[0]);
                
                setSelectedPlanId(currentSelected.id);
                setSlabs(JSON.parse(JSON.stringify(currentSelected.slabs || [])));
                setOriginalSlabs(JSON.parse(JSON.stringify(currentSelected.slabs || [])));
            }
        } catch (err) {
            setNotification({ type: 'error', message: err.message || 'Failed to load commission plans.' });
        } finally {
            setLoadingPlans(false);
        }
    };

    useEffect(() => {
        fetchPlans();
    }, [selectedService]);

    // When selecting another plan from list
    const handleSelectPlan = (plan) => {
        setSelectedPlanId(plan.id);
        setSlabs(JSON.parse(JSON.stringify(plan.slabs || [])));
        setOriginalSlabs(JSON.parse(JSON.stringify(plan.slabs || [])));
        setNotification(null);
    };

    // Handle slab input changes
    const handleSlabChange = (index, field, value) => {
        const updated = [...slabs];
        const numVal = value === '' ? '' : Math.max(0, parseFloat(value) || 0);
        updated[index] = {
            ...updated[index],
            [field]: numVal
        };
        setSlabs(updated);
    };

    // Reset edits
    const handleReset = () => {
        setSlabs(JSON.parse(JSON.stringify(originalSlabs)));
        setNotification({ type: 'info', message: 'Slab values reverted to saved database configuration.' });
    };

    // Validation
    const validationError = useMemo(() => {
        for (let i = 0; i < slabs.length; i++) {
            const s = slabs[i];
            const ret = parseFloat(s.retailerCommission);
            const dist = parseFloat(s.distributorCommission);
            const sd = parseFloat(s.superDistributorCommission);

            if (isNaN(ret) || ret < 0) return `Slab #${i + 1}: Retailer commission must be a valid positive amount.`;
            if (isNaN(dist) || dist < 0) return `Slab #${i + 1}: Distributor commission cannot be negative.`;
            if (isNaN(sd) || sd < 0) return `Slab #${i + 1}: Super Distributor commission cannot be negative.`;
        }
        return null;
    }, [slabs]);

    // Save changes
    const handleSave = async () => {
        if (validationError) {
            setNotification({ type: 'error', message: validationError });
            return;
        }
        setSaving(true);
        setNotification(null);
        try {
            const formattedSlabs = slabs.map(s => ({
                id: s.id,
                minAmount: Number(s.minAmount),
                maxAmount: Number(s.maxAmount),
                retailerCommission: Number(s.retailerCommission || 0),
                distributorCommission: Number(s.distributorCommission || 0),
                superDistributorCommission: Number(s.superDistributorCommission || 0),
                enabled: s.enabled ?? true
            }));

            const updatedPlan = await commissionService.updatePlanSlabs(selectedPlanId, formattedSlabs);
            setNotification({ type: 'success', message: 'Plan Saved Successfully' });

            // Trigger celebration effect
            try {
                confetti({
                    particleCount: 120,
                    spread: 70,
                    origin: { y: 0.6 },
                    colors: ['#10b981', '#6366f1', '#f59e0b', '#3b82f6', '#ec4899']
                });
                setTimeout(() => {
                    confetti({
                        particleCount: 60,
                        angle: 60,
                        spread: 55,
                        origin: { x: 0 },
                        colors: ['#10b981', '#6366f1', '#f59e0b']
                    });
                    confetti({
                        particleCount: 60,
                        angle: 120,
                        spread: 55,
                        origin: { x: 1 },
                        colors: ['#10b981', '#6366f1', '#f59e0b']
                    });
                }, 200);
            } catch {
                // Ignore if not supported
            }
            
            // Refresh plans in background
            setOriginalSlabs(JSON.parse(JSON.stringify(updatedPlan.slabs || [])));
            setSlabs(JSON.parse(JSON.stringify(updatedPlan.slabs || [])));
            
            setPlans(prev => prev.map(p => p.id === updatedPlan.id ? updatedPlan : p));
        } catch (err) {
            setNotification({ type: 'error', message: err.message || 'Failed to save commission configuration.' });
        } finally {
            setSaving(false);
        }
    };

    // Load History
    const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
            const res = await commissionService.getAdminTransactions({
                serviceType: selectedService,
                status: historyStatus,
                search: historySearch,
                page: historyPage,
                size: historySize
            });
            setHistoryList(res.content || []);
            setHistoryTotal(res.totalElements || 0);
        } catch (err) {
            console.error('Failed to load commission transactions:', err);
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'history') {
            fetchHistory();
        }
    }, [activeTab, historyPage, historyStatus, selectedService]);

    // Plan Name mapping helper for Admin
    const getAdminPlanDisplayName = (plan) => {
        if (!plan) return 'Free Plan';
        const code = String(plan.planCode || '').toUpperCase();
        const name = String(plan.planName || '');
        if (code === 'PLAN_2999' || name.includes('2999') || name.toLowerCase().includes('anand')) return 'Rupiksha Anand Plan';
        if (code === 'PLAN_4999' || name.includes('4999') || name.toLowerCase().includes('nidhi')) return 'Rupiksha Nidhi Plan';
        if (code === 'PLAN_7999' || name.includes('7999') || name.toLowerCase().includes('dhanbarsha')) return 'Rupiksha Dhanbarsha Plan';
        if (code === 'FREE' || name.toLowerCase().includes('free')) return 'Free Plan';
        return name || 'Commission Plan';
    };

    const activePlan = plans.find(p => p.id === selectedPlanId);

    const hasChanges = useMemo(() => {
        return JSON.stringify(slabs) !== JSON.stringify(originalSlabs);
    }, [slabs, originalSlabs]);

    return (
        <div className="space-y-6 max-w-7xl mx-auto font-['Inter',sans-serif]">
            {/* ── NOTIFICATION TOAST ────────────────────────────────────────────── */}
            <AnimatePresence>
                {notification && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`p-4 rounded-2xl flex items-center justify-between border text-xs font-bold ${
                            notification.type === 'success'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : notification.type === 'error'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-blue-50 text-blue-800 border-blue-200'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            {notification.type === 'success' && <CheckCircle2 size={18} className="text-emerald-600" />}
                            {notification.type === 'error' && <ShieldAlert size={18} className="text-rose-600" />}
                            {notification.type === 'info' && <HelpCircle size={18} className="text-blue-600" />}
                            <span>{notification.message}</span>
                        </div>
                        <button
                            onClick={() => setNotification(null)}
                            className="text-slate-400 hover:text-slate-600 text-sm font-black px-2 cursor-pointer"
                        >
                            &times;
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── 2-COLUMN SIDE-BY-SIDE LAYOUT ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* ── LEFT COLUMN: Commission Management & Plan Selectors ── */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
                        {/* Header */}
                        <div className="flex items-center gap-3.5 pb-3 border-b border-slate-100">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-sky-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
                                <IndianRupee size={24} strokeWidth={2.5} />
                            </div>
                            <div className="min-w-0">
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                                    Operations &bull; Master
                                </span>
                                <h1 className="text-xl font-black text-slate-800 tracking-tight mt-0.5 truncate">
                                    Commission Management
                                </h1>
                            </div>
                        </div>

                        {/* Service Selector */}
                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
                                Select Target Service
                            </label>
                            <div className="relative">
                                <select
                                    value={selectedService}
                                    onChange={(e) => setSelectedService(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                                >
                                    {services.map(s => (
                                        <option key={s.id} value={s.id}>{s.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Plan Selector Buttons - Vertical Stack */}
                        <div className="space-y-2">
                            <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
                                Select Commission Plan
                            </label>
                            <div className="flex flex-col gap-2">
                                {plans.map(p => {
                                    const isSelected = p.id === selectedPlanId;
                                    const displayName = getAdminPlanDisplayName(p);
                                    return (
                                        <button
                                            key={p.id}
                                            onClick={() => handleSelectPlan(p)}
                                            className={`w-full px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-between gap-2 text-left cursor-pointer ${
                                                isSelected
                                                    ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20 ring-2 ring-slate-900'
                                                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                {p.isDefault && <Sparkles size={13} className={isSelected ? 'text-amber-400' : 'text-amber-500'} />}
                                                <span className="truncate">{displayName}</span>
                                            </div>
                                            {p.price > 0 ? (
                                                <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-lg shrink-0 ${
                                                    isSelected ? 'bg-slate-800 text-indigo-200' : 'bg-slate-200/70 text-slate-600'
                                                }`}>
                                                    &#8377;{Number(p.price).toLocaleString('en-IN')}
                                                </span>
                                            ) : (
                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg shrink-0 ${
                                                    isSelected ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                }`}>
                                                    FREE
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── RIGHT COLUMN: Slabs Editor Table (Card 3) or Audit Ledger ── */}
                <div className="lg:col-span-8">
                    {activeTab === 'config' ? (
                        /* Slabs Editor Table */
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-black text-slate-800">
                                            {activePlan ? `${getAdminPlanDisplayName(activePlan)} Slabs` : 'Commission Slabs'}
                                        </h2>
                                        {activePlan?.isDefault && (
                                            <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-200">
                                                Default System Plan
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs font-medium text-slate-400 mt-0.5">
                                        Commission is a fixed rupee amount granted per successful transaction slab.
                                    </p>
                                </div>
                            </div>

                            {loadingPlans ? (
                                <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-2">
                                    <RefreshCw className="animate-spin text-indigo-500" size={24} />
                                    <span className="text-xs font-bold">Loading plans & slabs...</span>
                                </div>
                            ) : slabs.length === 0 ? (
                                <div className="p-12 text-center text-slate-400">
                                    <p className="text-sm font-bold">No slabs configured for this plan.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50/75 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                    <th className="py-4 px-5">Slab Range (&#8377;)</th>
                                                    <th className="py-4 px-3 text-center">Retailer (&#8377;)</th>
                                                    <th className="py-4 px-3 text-center">Distributor (&#8377;)</th>
                                                    <th className="py-4 px-3 text-center">Super Distributor (&#8377;)</th>
                                                    <th className="py-4 px-3 text-center">Total Distributed</th>
                                                    <th className="py-4 px-5 text-right">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                                                {slabs.map((slab, idx) => {
                                                    const ret = parseFloat(slab.retailerCommission) || 0;
                                                    const dist = parseFloat(slab.distributorCommission) || 0;
                                                    const sd = parseFloat(slab.superDistributorCommission) || 0;
                                                    const total = ret + dist + sd;
                                                    const isHighTotal = total > 20;

                                                    return (
                                                        <tr key={slab.id || idx} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="py-4 px-5">
                                                                <span className="font-mono text-sm font-black text-slate-800">
                                                                    &#8377;{Number(slab.minAmount).toLocaleString()} &ndash; &#8377;{Number(slab.maxAmount).toLocaleString()}
                                                                </span>
                                                            </td>

                                                            {/* Retailer Edit */}
                                                            <td className="py-3 px-3 text-center">
                                                                <div className="inline-flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus-within:border-indigo-500 focus-within:bg-white transition-all shadow-inner">
                                                                    <span className="text-slate-400 mr-1 text-xs">&#8377;</span>
                                                                    <input
                                                                        type="number"
                                                                        step="0.25"
                                                                        min="0"
                                                                        value={slab.retailerCommission}
                                                                        onChange={(e) => handleSlabChange(idx, 'retailerCommission', e.target.value)}
                                                                        className="w-16 bg-transparent text-sm font-black text-slate-800 text-center focus:outline-none"
                                                                    />
                                                                </div>
                                                            </td>

                                                            {/* Distributor Edit */}
                                                            <td className="py-3 px-3 text-center">
                                                                <div className="inline-flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus-within:border-indigo-500 focus-within:bg-white transition-all shadow-inner">
                                                                    <span className="text-slate-400 mr-1 text-xs">&#8377;</span>
                                                                    <input
                                                                        type="number"
                                                                        step="0.25"
                                                                        min="0"
                                                                        value={slab.distributorCommission}
                                                                        onChange={(e) => handleSlabChange(idx, 'distributorCommission', e.target.value)}
                                                                        className="w-16 bg-transparent text-sm font-black text-slate-800 text-center focus:outline-none"
                                                                    />
                                                                </div>
                                                            </td>

                                                            {/* Super Distributor Edit */}
                                                            <td className="py-3 px-3 text-center">
                                                                <div className="inline-flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus-within:border-indigo-500 focus-within:bg-white transition-all shadow-inner">
                                                                    <span className="text-slate-400 mr-1 text-xs">&#8377;</span>
                                                                    <input
                                                                        type="number"
                                                                        step="0.25"
                                                                        min="0"
                                                                        value={slab.superDistributorCommission}
                                                                        onChange={(e) => handleSlabChange(idx, 'superDistributorCommission', e.target.value)}
                                                                        className="w-16 bg-transparent text-sm font-black text-slate-800 text-center focus:outline-none"
                                                                    />
                                                                </div>
                                                            </td>

                                                            {/* Total Commission */}
                                                            <td className="py-4 px-3 text-center">
                                                                <div className="flex items-center justify-center gap-1.5">
                                                                    <span className="font-mono text-xs font-black text-indigo-600 bg-indigo-50/70 px-2.5 py-1 rounded-xl border border-indigo-100">
                                                                        &#8377;{total.toFixed(2)}
                                                                    </span>
                                                                    {isHighTotal && (
                                                                        <span title="High total commission warning" className="text-amber-500">
                                                                            <AlertTriangle size={14} />
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>

                                                            {/* Active / Enabled */}
                                                            <td className="py-4 px-5 text-right">
                                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                    Active
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Footer Action Bar */}
                                    <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <span className="text-xs font-bold text-slate-400">
                                            {hasChanges ? 'You have unsaved changes in slab rates.' : 'All slab changes are saved.'}
                                        </span>
                                        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                                            {hasChanges && (
                                                <button
                                                    onClick={handleReset}
                                                    disabled={saving}
                                                    className="px-4 py-2.5 rounded-2xl border border-slate-200 text-slate-600 text-xs font-black uppercase tracking-wider hover:bg-slate-100 transition-all flex items-center gap-2 cursor-pointer"
                                                >
                                                    <RotateCcw size={14} />
                                                    Reset
                                                </button>
                                            )}
                                            <button
                                                onClick={handleSave}
                                                disabled={saving || !hasChanges}
                                                className={`px-6 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 text-white shadow-lg cursor-pointer ${
                                                    saving || !hasChanges
                                                        ? 'bg-slate-300 shadow-none cursor-not-allowed text-slate-500'
                                                        : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                                                }`}
                                            >
                                                <Save size={14} />
                                                {saving ? 'Saving...' : 'Save Plan'}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        /* ── AUDIT LEDGER TAB ─────────────────────────────────────────── */
                        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-lg font-black text-slate-800">Commission Distribution Audit Ledger</h2>
                                    <p className="text-xs font-medium text-slate-400 mt-0.5">
                                        Permanent record of all distributed commissions, mapped transactions, beneficiaries, and role credits.
                                    </p>
                                </div>

                                {/* Search and filter */}
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Search by Txn ID / Ref..."
                                            value={historySearch}
                                            onChange={(e) => setHistorySearch(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') fetchHistory(); }}
                                            className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:border-indigo-500 w-52"
                                        />
                                    </div>

                                    <select
                                        value={historyStatus}
                                        onChange={(e) => setHistoryStatus(e.target.value)}
                                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
                                    >
                                        <option value="ALL">All</option>
                                        <option value="SUCCESS">Success</option>
                                        <option value="FAILED">Failed</option>
                                    </select>

                                    <button
                                        onClick={fetchHistory}
                                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                                        title="Refresh"
                                    >
                                        <RefreshCw size={14} className={historyLoading ? 'animate-spin' : ''} />
                                    </button>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/75 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            <th className="py-3 px-4">Date & Time</th>
                                            <th className="py-3 px-4">Commission Ref</th>
                                            <th className="py-3 px-4">Original Txn ID</th>
                                            <th className="py-3 px-4">Beneficiary</th>
                                            <th className="py-3 px-4">Role</th>
                                            <th className="py-3 px-4 text-right">Txn Amount</th>
                                            <th className="py-3 px-4 text-center">Slab</th>
                                            <th className="py-3 px-4 text-right">Commission</th>
                                            <th className="py-3 px-4 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                                        {historyLoading ? (
                                            <tr>
                                                <td colSpan={9} className="py-12 text-center text-slate-400">
                                                    <RefreshCw className="animate-spin mx-auto mb-2 text-indigo-500" size={20} />
                                                    Loading commission transactions...
                                                </td>
                                            </tr>
                                        ) : historyList.length === 0 ? (
                                            <tr>
                                                <td colSpan={9} className="py-12 text-center text-slate-400 font-bold">
                                                    No commission transactions found.
                                                </td>
                                            </tr>
                                        ) : (
                                            historyList.map(item => (
                                                <tr key={item.id} className="hover:bg-slate-50/50">
                                                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                                                        {new Date(item.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                                                    </td>
                                                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                                                        {item.commissionReference}
                                                    </td>
                                                    <td className="py-3 px-4 font-mono text-slate-600">
                                                        {item.originalTransactionId}
                                                    </td>
                                                    <td className="py-3 px-4 font-bold text-slate-800">
                                                        {item.beneficiaryName} <span className="text-slate-400 text-[10px]">({item.beneficiaryUsername})</span>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className={`inline-flex px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                                                            item.beneficiaryRole === 'RETAILER'
                                                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                                : item.beneficiaryRole === 'DISTRIBUTOR'
                                                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                                : 'bg-purple-50 text-purple-700 border border-purple-200'
                                                        }`}>
                                                            {item.beneficiaryRole}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                                                        &#8377;{Number(item.transactionAmount).toLocaleString()}
                                                    </td>
                                                    <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-600">
                                                        {item.slabRange}
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-mono font-black text-emerald-600">
                                                        +&#8377;{Number(item.commissionAmount).toFixed(2)}
                                                    </td>
                                                    <td className="py-3 px-4 text-center">
                                                        <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            {item.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {historyTotal > historySize && (
                                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                    <span className="text-xs text-slate-400 font-bold">
                                        Showing {historyPage * historySize + 1} to {Math.min((historyPage + 1) * historySize, historyTotal)} of {historyTotal} records
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setHistoryPage(p => Math.max(0, p - 1))}
                                            disabled={historyPage === 0}
                                            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                        >
                                            <ChevronLeft size={16} />
                                        </button>
                                        <span className="text-xs font-black text-slate-700 px-2">Page {historyPage + 1}</span>
                                        <button
                                            onClick={() => setHistoryPage(p => p + 1)}
                                            disabled={(historyPage + 1) * historySize >= historyTotal}
                                            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                        >
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
