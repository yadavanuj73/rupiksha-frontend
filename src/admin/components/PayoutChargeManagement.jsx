import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
    IndianRupee, Save, RotateCcw, ShieldAlert, CheckCircle2,
    AlertTriangle, Search, Filter, History, RefreshCw, Layers,
    Sparkles, SendHorizontal, ShieldCheck, Check, ArrowRight
} from 'lucide-react';
import { payoutChargeService } from '../../services/payoutChargeService';
import { apiFetch } from '../../services/apiService';

export default function PayoutChargeManagement() {
    const [slabs, setSlabs] = useState([]);
    const [originalSlabs, setOriginalSlabs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState(null);

    // Audit logs state
    const [activeTab, setActiveTab] = useState('config'); // 'config' | 'audit'
    const [auditList, setAuditList] = useState([]);
    const [auditLoading, setAuditLoading] = useState(false);

    // Load charge slabs
    const fetchSlabs = async () => {
        setLoading(true);
        setNotification(null);
        try {
            const data = await payoutChargeService.getCharges();
            setSlabs(JSON.parse(JSON.stringify(data || [])));
            setOriginalSlabs(JSON.parse(JSON.stringify(data || [])));
        } catch (err) {
            setNotification({ type: 'error', message: err.message || 'Failed to load payout charges.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSlabs();
    }, []);

    // Handle base charge input changes with auto-GST computation
    const handleBaseChargeChange = (index, value) => {
        const updated = [...slabs];
        const numVal = value === '' ? '' : Math.max(0, parseFloat(value) || 0);
        const gstRate = parseFloat(updated[index].gstRate) || 18.0;
        const gstAmount = numVal === '' ? 0 : parseFloat((numVal * (gstRate / 100)).toFixed(2));
        const totalCharge = numVal === '' ? 0 : parseFloat((numVal + gstAmount).toFixed(2));

        updated[index] = {
            ...updated[index],
            baseCharge: numVal,
            gstAmount: gstAmount,
            totalCharge: totalCharge
        };
        setSlabs(updated);
    };

    // Reset edits
    const handleReset = () => {
        setSlabs(JSON.parse(JSON.stringify(originalSlabs)));
        setNotification({ type: 'info', message: 'Payout charges reverted to saved configuration.' });
    };

    // Validation
    const validationError = useMemo(() => {
        for (let i = 0; i < slabs.length; i++) {
            const s = slabs[i];
            const base = parseFloat(s.baseCharge);
            if (isNaN(base) || base < 0) {
                return `Slab #${i + 1} (₹${s.minAmount} - ₹${s.maxAmount}): Base charge must be a valid positive number.`;
            }
        }
        return null;
    }, [slabs]);

    // Check if changes exist
    const hasChanges = useMemo(() => {
        if (slabs.length !== originalSlabs.length) return true;
        return slabs.some((s, idx) => {
            const orig = originalSlabs[idx];
            if (!orig) return true;
            return Number(s.baseCharge) !== Number(orig.baseCharge);
        });
    }, [slabs, originalSlabs]);

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
                minAmount: Number(s.minAmount || 0),
                maxAmount: Number(s.maxAmount || 0),
                baseCharge: Number(s.baseCharge || 0),
                gstRate: Number(s.gstRate || 18.0),
                gstAmount: Number(s.gstAmount || 0),
                totalCharge: Number(s.totalCharge || 0),
                isActive: s.isActive ?? true
            }));

            const updated = await payoutChargeService.updateCharges(formattedSlabs);
            setSlabs(JSON.parse(JSON.stringify(updated || formattedSlabs)));
            setOriginalSlabs(JSON.parse(JSON.stringify(updated || formattedSlabs)));

            setNotification({
                type: 'success',
                message: 'Payout charges saved! 18% GST auto-applied to all live retailer payouts.'
            });

            confetti({
                particleCount: 60,
                spread: 50,
                origin: { y: 0.6 }
            });
        } catch (err) {
            setNotification({ type: 'error', message: err.message || 'Failed to save payout charges.' });
        } finally {
            setSaving(false);
        }
    };

    // Load audit transactions
    const fetchAudit = async () => {
        setAuditLoading(true);
        try {
            const res = await apiFetch('/payout/admin/beneficiaries');
            setAuditList(res || []);
        } catch (err) {
            console.error('Failed to load audit:', err);
        } finally {
            setAuditLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'audit') {
            fetchAudit();
        }
    }, [activeTab]);

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {/* ── NOTIFICATIONS / ALERTS ── */}
            <AnimatePresence>
                {notification && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className={`p-3 rounded-2xl border flex items-center justify-between shadow-2xs ${
                            notification.type === 'success'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                : notification.type === 'error'
                                ? 'bg-rose-50 border-rose-200 text-rose-900'
                                : 'bg-blue-50 border-blue-200 text-blue-900'
                        }`}
                    >
                        <div className="flex items-center gap-2.5">
                            {notification.type === 'success' && <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />}
                            {notification.type === 'error' && <AlertTriangle size={16} className="text-rose-600 shrink-0" />}
                            {notification.type === 'info' && <ShieldAlert size={16} className="text-blue-600 shrink-0" />}
                            <span className="text-xs font-bold">{notification.message}</span>
                        </div>
                        <button
                            onClick={() => setNotification(null)}
                            className="text-xs font-black opacity-70 hover:opacity-100 transition px-2 py-0.5"
                        >
                            ✕
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── TWO-COLUMN SPLIT: LEFT (CONTROLS & FORMULA) + RIGHT (SLABS TABLE) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                
                {/* ── LEFT COLUMN (4 cols): Heading, Target, Formula & Nav ── */}
                <div className="lg:col-span-4 space-y-3.5">
                    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-4">
                        
                        {/* Heading Block */}
                        <div className="flex items-start gap-3 pb-3.5 border-b border-slate-100">
                            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shrink-0 shadow-md shadow-blue-500/20">
                                <SendHorizontal size={20} />
                            </div>
                            <div className="min-w-0">
                                <span className="inline-block text-[9.5px] font-black uppercase tracking-widest text-blue-700">
                                    OPERATIONS &bull; MASTER
                                </span>
                                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-tight">
                                    Payout Charges
                                </h1>
                                <p className="text-[11px] text-slate-500 font-semibold mt-0.5 line-clamp-2">
                                    Configure customer payout fees with auto 18% GST.
                                </p>
                            </div>
                        </div>

                        {/* Rail Selector / Tab Pills */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Console View
                            </label>
                            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                                <button
                                    onClick={() => setActiveTab('config')}
                                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                                        activeTab === 'config'
                                            ? 'bg-white text-blue-700 shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <Layers size={13} />
                                    Fee Slabs
                                </button>
                                <button
                                    onClick={() => setActiveTab('audit')}
                                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                                        activeTab === 'audit'
                                            ? 'bg-white text-blue-700 shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <History size={13} />
                                    Audit
                                </button>
                            </div>
                        </div>

                        {/* Active Target Service Box */}
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
                            <div>
                                <p className="text-[9.5px] font-black uppercase tracking-wider text-slate-400">Target Service</p>
                                <p className="text-xs font-black text-slate-900 mt-0.5">Payout Hub (IMPS/NEFT/RTGS)</p>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
                                Active Rail
                            </span>
                        </div>

                        {/* GST Formula Summary Card */}
                        <div className="rounded-xl bg-gradient-to-br from-blue-50/60 to-indigo-50/40 p-3.5 border border-blue-100 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider text-blue-900 flex items-center gap-1">
                                    <Sparkles size={12} className="text-blue-600" />
                                    18% GST Engine
                                </span>
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-200/60 text-blue-900">
                                    Real-time
                                </span>
                            </div>
                            <div className="text-[11px] text-slate-600 space-y-1 font-medium leading-relaxed">
                                <p className="flex justify-between">
                                    <span>GST Calculation:</span>
                                    <strong className="font-mono text-slate-900">Base &times; 18%</strong>
                                </p>
                                <p className="flex justify-between">
                                    <span>Customer Fee:</span>
                                    <strong className="font-mono text-indigo-700">Base + GST</strong>
                                </p>
                                <p className="flex justify-between">
                                    <span>Wallet Debit:</span>
                                    <strong className="font-mono text-emerald-700">Amount + Total Fee</strong>
                                </p>
                            </div>
                        </div>

                    </div>
                </div>

                {/* ── RIGHT COLUMN (8 cols): Fee Slabs Table OR Audit View ── */}
                <div className="lg:col-span-8 space-y-3.5">
                    
                    {/* TAB 1: Slabs Configuration */}
                    {activeTab === 'config' && (
                        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                            {/* Table Header Bar */}
                            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
                                            Payout Fee Slabs
                                        </h2>
                                        <span className="text-[9.5px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 uppercase">
                                            Live Configuration
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                        Edit base charge below. GST (18%) and total customer charge auto-compute in real-time.
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                                    <button
                                        onClick={handleReset}
                                        disabled={!hasChanges || saving}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        <RotateCcw size={12} />
                                        Reset
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={!hasChanges || !!validationError || saving}
                                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-blue-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                                    >
                                        {saving ? (
                                            <>
                                                <RefreshCw size={12} className="animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Save size={12} />
                                                Save Charges
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Table Content */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50/70 text-[10.5px] font-black text-slate-500 uppercase tracking-wider">
                                            <th className="py-3 px-4">Slab Range (₹)</th>
                                            <th className="py-3 px-4 text-center">Base Charge (₹)</th>
                                            <th className="py-3 px-4 text-center">GST Rate</th>
                                            <th className="py-3 px-4 text-center">GST (18%) (₹)</th>
                                            <th className="py-3 px-4 text-center">Total Customer Fee (₹)</th>
                                            <th className="py-3 px-4 text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={6} className="py-10 text-center text-slate-400 font-bold">
                                                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-blue-500" />
                                                    Loading payout charge configuration...
                                                </td>
                                            </tr>
                                        ) : slabs.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="py-10 text-center text-slate-400">
                                                    No payout slabs found.
                                                </td>
                                            </tr>
                                        ) : (
                                            slabs.map((slab, idx) => {
                                                const minFmt = Number(slab.minAmount).toLocaleString('en-IN');
                                                const maxFmt = Number(slab.maxAmount).toLocaleString('en-IN');
                                                const baseVal = slab.baseCharge;
                                                const gstVal = Number(slab.gstAmount || 0).toFixed(2);
                                                const totalVal = Number(slab.totalCharge || 0).toFixed(2);

                                                return (
                                                    <tr key={slab.id || idx} className="hover:bg-blue-50/30 transition">
                                                        {/* Slab Range */}
                                                        <td className="py-3.5 px-4 font-mono font-black text-slate-900 text-xs sm:text-sm whitespace-nowrap">
                                                            ₹{minFmt} &ndash; ₹{maxFmt}
                                                        </td>

                                                        {/* Base Charge Input */}
                                                        <td className="py-3.5 px-4 text-center">
                                                            <div className="inline-flex items-center relative">
                                                                <span className="absolute left-2 text-slate-400 font-bold text-xs">₹</span>
                                                                <input
                                                                    type="number"
                                                                    step="0.10"
                                                                    min="0"
                                                                    value={baseVal}
                                                                    onChange={(e) => handleBaseChargeChange(idx, e.target.value)}
                                                                    className="w-20 pl-5 pr-1.5 py-1 text-center font-mono font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-blue-500 outline-none transition text-xs sm:text-sm"
                                                                />
                                                            </div>
                                                        </td>

                                                        {/* GST Rate */}
                                                        <td className="py-3.5 px-4 text-center font-bold text-slate-600">
                                                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                                                                18%
                                                            </span>
                                                        </td>

                                                        {/* Auto-Calculated GST Amount */}
                                                        <td className="py-3.5 px-4 text-center font-mono font-bold text-blue-700">
                                                            ₹ {gstVal}
                                                        </td>

                                                        {/* Total Charge To Customer */}
                                                        <td className="py-3.5 px-4 text-center font-mono font-black text-emerald-700 text-xs sm:text-sm">
                                                            <span className="px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200">
                                                                ₹ {totalVal}
                                                            </span>
                                                        </td>

                                                        {/* Status */}
                                                        <td className="py-3.5 px-4 text-right">
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9.5px] font-black uppercase tracking-wider">
                                                                <Check size={9} /> Active
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Table Footer */}
                            <div className="p-3.5 bg-slate-50/50 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                                <span className="font-semibold flex items-center gap-1 text-slate-600">
                                    <ShieldCheck size={14} className="text-blue-600" />
                                    Atomic wallet balance check and fee deduction active.
                                </span>
                                {hasChanges && (
                                    <span className="text-amber-700 font-bold animate-pulse">
                                        ● Unsaved changes pending
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 2: Audit Logs */}
                    {activeTab === 'audit' && (
                        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden p-4 sm:p-5 space-y-3">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                <div>
                                    <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
                                        Beneficiaries & Audit Ledger
                                    </h2>
                                    <p className="text-[11px] text-slate-500 font-medium">
                                        Retailer bank beneficiaries registered for payout routing.
                                    </p>
                                </div>
                                <button
                                    onClick={fetchAudit}
                                    disabled={auditLoading}
                                    className="flex items-center gap-1 px-3 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition cursor-pointer"
                                >
                                    <RefreshCw size={12} className={auditLoading ? 'animate-spin' : ''} />
                                    Refresh
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                            <th className="py-2.5 px-3">Beneficiary</th>
                                            <th className="py-2.5 px-3">Account No</th>
                                            <th className="py-2.5 px-3">IFSC</th>
                                            <th className="py-2.5 px-3">Bank Name</th>
                                            <th className="py-2.5 px-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                                        {auditLoading ? (
                                            <tr>
                                                <td colSpan={5} className="py-6 text-center text-slate-400 font-bold">
                                                    Loading audit records...
                                                </td>
                                            </tr>
                                        ) : auditList.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-6 text-center text-slate-400">
                                                    No beneficiary records found.
                                                </td>
                                            </tr>
                                        ) : (
                                            auditList.map((b, i) => (
                                                <tr key={b.id || i} className="hover:bg-slate-50/60 transition">
                                                    <td className="py-2.5 px-3 font-bold text-slate-900">{b.beneficiaryName}</td>
                                                    <td className="py-2.5 px-3 font-mono">{b.accountNumber}</td>
                                                    <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{b.ifsc}</td>
                                                    <td className="py-2.5 px-3 text-slate-600">{b.bankName || '—'}</td>
                                                    <td className="py-2.5 px-3">
                                                        <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase ${
                                                            b.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                                                            b.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                                                        }`}>
                                                            {b.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
