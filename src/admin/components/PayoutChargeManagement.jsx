import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
    IndianRupee, Save, RotateCcw, ShieldAlert, CheckCircle2,
    AlertTriangle, Search, Filter, History, ChevronLeft, ChevronRight,
    RefreshCw, Layers, Sparkles, TrendingUp, HelpCircle, SendHorizontal,
    Zap, ArrowUpRight, ShieldCheck, Check
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
    const [auditSearch, setAuditSearch] = useState('');
    const [auditStatus, setAuditStatus] = useState('ALL');

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
        setNotification({ type: 'info', message: 'Payout charges reverted to current database configuration.' });
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
                message: 'Payout charges successfully saved! Real-time 18% GST auto-applied to all retailer payouts.'
            });

            // Trigger celebration
            confetti({
                particleCount: 70,
                spread: 60,
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
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* ── TOP BANNER & NAVIGATION BAR ── */}
            <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
                <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[11px] font-black uppercase tracking-widest text-blue-200">
                            <SendHorizontal size={13} className="text-blue-300" />
                            Operations &bull; Payout Fee Engine
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
                            Payout Charges Management
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-bold uppercase tracking-wider">
                                18% GST Auto-Calculated
                            </span>
                        </h1>
                        <p className="text-slate-300 text-xs sm:text-sm font-medium max-w-2xl leading-relaxed">
                            Configure customer fee slabs for instant Payout Hub banking transfers. When you set the base charge, 18% GST is automatically computed and debited atomically from retailer wallets during payout execution.
                        </p>
                    </div>

                    {/* Action Tabs */}
                    <div className="flex items-center bg-white/10 p-1.5 rounded-2xl backdrop-blur-md border border-white/10 self-start md:self-auto shrink-0">
                        <button
                            onClick={() => setActiveTab('config')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                                activeTab === 'config'
                                    ? 'bg-white text-slate-900 shadow-md'
                                    : 'text-white/80 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <Layers size={14} />
                            Charge Slabs
                        </button>
                        <button
                            onClick={() => setActiveTab('audit')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer ${
                                activeTab === 'audit'
                                    ? 'bg-white text-slate-900 shadow-md'
                                    : 'text-white/80 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            <History size={14} />
                            Beneficiaries & Audit
                        </button>
                    </div>
                </div>
            </div>

            {/* ── NOTIFICATIONS / ALERTS ── */}
            <AnimatePresence>
                {notification && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm ${
                            notification.type === 'success'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                : notification.type === 'error'
                                ? 'bg-rose-50 border-rose-200 text-rose-900'
                                : 'bg-blue-50 border-blue-200 text-blue-900'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            {notification.type === 'success' && <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />}
                            {notification.type === 'error' && <AlertTriangle size={18} className="text-rose-600 shrink-0" />}
                            {notification.type === 'info' && <ShieldAlert size={18} className="text-blue-600 shrink-0" />}
                            <span className="text-xs sm:text-sm font-bold">{notification.message}</span>
                        </div>
                        <button
                            onClick={() => setNotification(null)}
                            className="text-xs font-black opacity-70 hover:opacity-100 transition px-2 py-1"
                        >
                            ✕
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── MAIN CONTENT TAB 1: CHARGE SLABS CONFIGURATION ── */}
            {activeTab === 'config' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* ── LEFT COLUMN: Payout Info & Formula Card (4 cols) ── */}
                    <div className="lg:col-span-4 space-y-5">
                        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
                            <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
                                    <SendHorizontal size={20} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Active Rail Target</h3>
                                    <p className="text-xs text-slate-500 font-semibold">Payout Hub (IMPS / NEFT / RTGS)</p>
                                </div>
                            </div>

                            {/* Calculation Formula Card */}
                            <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/50 p-4 border border-blue-100 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                                        <Sparkles size={13} className="text-blue-600" />
                                        GST Calculation Logic
                                    </span>
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                                        Standard 18%
                                    </span>
                                </div>
                                <div className="text-xs text-slate-600 space-y-1.5 font-medium leading-relaxed">
                                    <p>• <strong>Base Charge:</strong> Admin-configured transaction processing fee.</p>
                                    <p>• <strong>GST (18%):</strong> Auto-computed as <code className="bg-white px-1.5 py-0.5 rounded text-blue-700 font-mono font-bold">Base × 0.18</code>.</p>
                                    <p>• <strong>Total Customer Fee:</strong> <code className="bg-white px-1.5 py-0.5 rounded text-indigo-700 font-mono font-bold">Base + GST</code>.</p>
                                    <p>• <strong>Wallet Debit:</strong> <code className="bg-white px-1.5 py-0.5 rounded text-emerald-700 font-mono font-bold">Amount + Total Fee</code>.</p>
                                </div>
                            </div>

                            {/* Summary Stats */}
                            <div className="grid grid-cols-2 gap-3 pt-1">
                                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Configured Slabs</p>
                                    <p className="text-xl font-black text-slate-900 mt-0.5">{slabs.length}</p>
                                </div>
                                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">GST Rate</p>
                                    <p className="text-xl font-black text-blue-600 mt-0.5">18.0%</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── RIGHT COLUMN: Payout Charges Table (8 cols) ── */}
                    <div className="lg:col-span-8 space-y-5">
                        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                            {/* Table Header Bar */}
                            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
                                            Payout Fee Slabs
                                        </h2>
                                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 uppercase">
                                            Live Configuration
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                                        Set the base charge below. GST (18%) and the final customer charge are auto-computed instantly.
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                                    <button
                                        onClick={handleReset}
                                        disabled={!hasChanges || saving}
                                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        <RotateCcw size={13} />
                                        Reset
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={!hasChanges || !!validationError || saving}
                                        className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-blue-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                                    >
                                        {saving ? (
                                            <>
                                                <RefreshCw size={13} className="animate-spin" />
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Save size={13} />
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
                                        <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                                            <th className="py-3.5 px-5">Slab Range (₹)</th>
                                            <th className="py-3.5 px-5 text-center">Base Charge (₹)</th>
                                            <th className="py-3.5 px-5 text-center">GST Rate</th>
                                            <th className="py-3.5 px-5 text-center">GST (18%) (₹)</th>
                                            <th className="py-3.5 px-5 text-center">Total Customer Fee (₹)</th>
                                            <th className="py-3.5 px-5 text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                                        {loading ? (
                                            <tr>
                                                <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                                                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-500" />
                                                    Loading payout charge configuration...
                                                </td>
                                            </tr>
                                        ) : slabs.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="py-12 text-center text-slate-400">
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
                                                        <td className="py-4 px-5 font-mono font-black text-slate-900 text-sm">
                                                            ₹{minFmt} &ndash; ₹{maxFmt}
                                                        </td>

                                                        {/* Base Charge Input */}
                                                        <td className="py-4 px-5 text-center">
                                                            <div className="inline-flex items-center relative">
                                                                <span className="absolute left-2.5 text-slate-400 font-bold text-xs">₹</span>
                                                                <input
                                                                    type="number"
                                                                    step="0.10"
                                                                    min="0"
                                                                    value={baseVal}
                                                                    onChange={(e) => handleBaseChargeChange(idx, e.target.value)}
                                                                    className="w-24 pl-6 pr-2 py-1.5 text-center font-mono font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition text-sm"
                                                                />
                                                            </div>
                                                        </td>

                                                        {/* GST Rate */}
                                                        <td className="py-4 px-5 text-center font-bold text-slate-600">
                                                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-xs">
                                                                18%
                                                            </span>
                                                        </td>

                                                        {/* Auto-Calculated GST Amount */}
                                                        <td className="py-4 px-5 text-center font-mono font-bold text-blue-700">
                                                            ₹ {gstVal}
                                                        </td>

                                                        {/* Total Charge To Customer */}
                                                        <td className="py-4 px-5 text-center font-mono font-black text-emerald-700 text-sm">
                                                            <span className="px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200">
                                                                ₹ {totalVal}
                                                            </span>
                                                        </td>

                                                        {/* Status */}
                                                        <td className="py-4 px-5 text-right">
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                                                                <Check size={10} /> Active
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
                            <div className="p-4 bg-slate-50/50 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
                                <span className="font-semibold flex items-center gap-1.5 text-slate-600">
                                    <ShieldCheck size={15} className="text-blue-600" />
                                    Dynamic auto-GST calculation applied on all live payout transactions.
                                </span>
                                {hasChanges && (
                                    <span className="text-amber-700 font-bold animate-pulse">
                                        ● Unsaved slab modifications pending
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── MAIN CONTENT TAB 2: AUDIT LOGS & BENEFICIARIES ── */}
            {activeTab === 'audit' && (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4 p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                        <div>
                            <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
                                Payout Beneficiaries & Audit Ledger
                            </h2>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                Verified retailer payout beneficiaries and transfer approval history.
                            </p>
                        </div>
                        <button
                            onClick={fetchAudit}
                            disabled={auditLoading}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition cursor-pointer"
                        >
                            <RefreshCw size={13} className={auditLoading ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                                    <th className="py-3 px-4">Beneficiary</th>
                                    <th className="py-3 px-4">Account No</th>
                                    <th className="py-3 px-4">IFSC</th>
                                    <th className="py-3 px-4">Bank Name</th>
                                    <th className="py-3 px-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                                {auditLoading ? (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-slate-400 font-bold">
                                            Loading audit records...
                                        </td>
                                    </tr>
                                ) : auditList.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-slate-400">
                                            No beneficiary records found.
                                        </td>
                                    </tr>
                                ) : (
                                    auditList.map((b, i) => (
                                        <tr key={b.id || i} className="hover:bg-slate-50/60 transition">
                                            <td className="py-3 px-4 font-bold text-slate-900">{b.beneficiaryName}</td>
                                            <td className="py-3 px-4 font-mono">{b.accountNumber}</td>
                                            <td className="py-3 px-4 font-mono font-bold text-blue-700">{b.ifsc}</td>
                                            <td className="py-3 px-4 text-slate-600">{b.bankName || '—'}</td>
                                            <td className="py-3 px-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
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
    );
}
