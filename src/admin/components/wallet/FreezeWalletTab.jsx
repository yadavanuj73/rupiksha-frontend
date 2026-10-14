import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Snowflake, AlertTriangle, Search, Unlock, Loader2, X, ShieldCheck
} from 'lucide-react';
import { UserSelector, fmtINR, fmtDateTime, fireCelebration, fetchAPI, WalletTabSkeleton } from './walletShared';
import { dataService } from '../../../services/dataService';

const FreezeWalletTab = ({ users = [], loading = false, onToast, onRefresh }) => {
    const [subTab, setSubTab] = useState('FREEZE'); // 'FREEZE' | 'UNFREEZE'
    const [userId, setUserId] = useState('');
    const [reason, setReason] = useState('SUSPICIOUS_ACTIVITY');
    const [remark, setRemark] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Unfreeze modal state
    const [unfreezeModalUser, setUnfreezeModalUser] = useState(null);
    const [unfreezeRemark, setUnfreezeRemark] = useState('Compliance review cleared - wallet restored');
    const [unfreezing, setUnfreezing] = useState(false);

    const [search, setSearch] = useState('');

    if (loading && users.length === 0) {
        return (
            <WalletTabSkeleton
                title="Freeze Wallet"
                subtitle="Fetching active and frozen user escrow accounts from server..."
            />
        );
    }

    const isUserFrozenCheck = (u) => Boolean(
        u.isFrozen || 
        u.walletStatus === 'FROZEN' || 
        u.status === 'FROZEN' ||
        localStorage.getItem(`rupiksha_frozen_${u.id}`) === 'true' ||
        localStorage.getItem(`rupiksha_frozen_${u.username}`) === 'true' ||
        localStorage.getItem(`rupiksha_frozen_${u.mobile}`) === 'true'
    );

    const frozenList = (users || []).filter(isUserFrozenCheck);
    const frozenIds = new Set(frozenList.map(f => String(f.id || f.userId || f.username)));

    // Active users eligible to be frozen
    const activeEligibleUsers = (users || []).filter(u =>
        !frozenIds.has(String(u.id)) && !frozenIds.has(String(u.username)) && !isUserFrozenCheck(u)
    );

    const selectedUser = users.find(u => u.username === userId || u.id == userId || u.userId == userId);

    // Filter frozen list
    const filteredFrozen = frozenList.filter(f => {
        const q = search.trim().toLowerCase();
        return !q ||
            (f.name || '').toLowerCase().includes(q) ||
            (f.username || '').toLowerCase().includes(q) ||
            String(f.mobile || '').includes(q) ||
            (f.reason || '').toLowerCase().includes(q);
    });

    const totalFrozenBalance = frozenList.reduce((s, f) => s + (parseFloat(f.balance) || 0), 0);

    // Handle Freeze Submission
    const handleFreezeSubmit = async (e) => {
        e.preventDefault();
        if (!userId) return onToast({ type: 'error', message: 'Please select a user to freeze wallet' });

        setSubmitting(true);
        const targetId = selectedUser ? (selectedUser.userId || selectedUser.id || selectedUser.username) : userId;
        const targetName = selectedUser?.name || selectedUser?.fullName || targetId;
        const targetBal = parseFloat(String(selectedUser?.balance ?? selectedUser?.walletBalance ?? 0).replace(/,/g, '')) || 0;
        const finalRemark = remark.trim() || `Wallet frozen: ${reason.replace(/_/g, ' ')}`;

        // Set local storage freeze flags for all user identifiers
        try {
            if (targetId) localStorage.setItem(`rupiksha_frozen_${targetId}`, 'true');
            if (selectedUser?.id) localStorage.setItem(`rupiksha_frozen_${selectedUser.id}`, 'true');
            if (selectedUser?.userId) localStorage.setItem(`rupiksha_frozen_${selectedUser.userId}`, 'true');
            if (selectedUser?.username) localStorage.setItem(`rupiksha_frozen_${selectedUser.username}`, 'true');
            if (selectedUser?.mobile) localStorage.setItem(`rupiksha_frozen_${selectedUser.mobile}`, 'true');
        } catch (_) {}

        // Update dataService
        const appData = dataService.getData();
        if (appData.users) {
            const uIdx = appData.users.findIndex(u =>
                u.id == targetId || u._id == targetId || u.username === targetId || u.mobile === targetId || u.userId == targetId
            );
            if (uIdx !== -1) {
                appData.users[uIdx] = {
                    ...appData.users[uIdx],
                    isFrozen: true,
                    walletStatus: 'FROZEN',
                    status: 'FROZEN',
                    frozenReason: finalRemark,
                    frozenAt: new Date().toISOString()
                };
                dataService.saveData(appData);
            }
        }

        // Update active session if target user is currently logged in
        try {
            for (const key of ['rupiksha_user', 'rupiksha_imp_user']) {
                const raw = localStorage.getItem(key);
                if (raw) {
                    const u = JSON.parse(raw);
                    if (u.id == targetId || u.username === targetId || u.mobile === targetId || u.userId == targetId) {
                        localStorage.setItem(key, JSON.stringify({
                            ...u,
                            isFrozen: true,
                            walletStatus: 'FROZEN',
                            status: 'FROZEN'
                        }));
                    }
                }
            }
        } catch (_) {}

        // Update backend database if connected
        try {
            await fetchAPI('/wallet/status', {
                method: 'POST',
                body: JSON.stringify({
                    userId: String(targetId),
                    status: 'FROZEN',
                    remark: finalRemark
                })
            });
        } catch (err) {
            console.warn('[Freeze] Backend API sync note:', err);
        }

        onToast({
            type: 'error',
            message: `Wallet for ${targetName} has been frozen. All transactions blocked.`
        });

        setUserId('');
        setRemark('');
        setSubmitting(false);
        setSubTab('UNFREEZE'); // Switch to view frozen list
        if (onRefresh) onRefresh();
        window.dispatchEvent(new CustomEvent('walletUpdated'));
        window.dispatchEvent(new CustomEvent('walletFrozenAlert', {
            detail: { userId: targetId, message: 'Your wallet is frozen. Please contact admin.' }
        }));
    };

    // Handle Unfreeze
    const handleConfirmUnfreeze = async () => {
        if (!unfreezeModalUser) return;
        setUnfreezing(true);
        const targetId = unfreezeModalUser.userId || unfreezeModalUser.id || unfreezeModalUser.username;
        const targetName = unfreezeModalUser.name || targetId;

        // Clear local storage freeze flags
        try {
            if (targetId) localStorage.removeItem(`rupiksha_frozen_${targetId}`);
            if (unfreezeModalUser?.id) localStorage.removeItem(`rupiksha_frozen_${unfreezeModalUser.id}`);
            if (unfreezeModalUser?.userId) localStorage.removeItem(`rupiksha_frozen_${unfreezeModalUser.userId}`);
            if (unfreezeModalUser?.username) localStorage.removeItem(`rupiksha_frozen_${unfreezeModalUser.username}`);
            if (unfreezeModalUser?.mobile) localStorage.removeItem(`rupiksha_frozen_${unfreezeModalUser.mobile}`);
        } catch (_) {}

        // Restore active in dataService
        const appData = dataService.getData();
        if (appData.users) {
            const uIdx = appData.users.findIndex(u =>
                u.id == targetId || u._id == targetId || u.username === targetId || u.mobile === targetId || u.userId == targetId
            );
            if (uIdx !== -1) {
                appData.users[uIdx] = {
                    ...appData.users[uIdx],
                    isFrozen: false,
                    walletStatus: 'ACTIVE',
                    status: 'ACTIVE',
                    unfrozenAt: new Date().toISOString(),
                    unfreezeRemark: unfreezeRemark
                };
                dataService.saveData(appData);
            }
        }

        // Update active session if target user is currently logged in
        try {
            for (const key of ['rupiksha_user', 'rupiksha_imp_user']) {
                const raw = localStorage.getItem(key);
                if (raw) {
                    const u = JSON.parse(raw);
                    if (u.id == targetId || u.username === targetId || u.mobile === targetId || u.userId == targetId) {
                        localStorage.setItem(key, JSON.stringify({
                            ...u,
                            isFrozen: false,
                            walletStatus: 'ACTIVE',
                            status: 'ACTIVE'
                        }));
                    }
                }
            }
        } catch (_) {}

        // Update backend database if connected
        try {
            await fetchAPI('/wallet/status', {
                method: 'POST',
                body: JSON.stringify({
                    userId: String(targetId),
                    status: 'ACTIVE',
                    remark: unfreezeRemark
                })
            });
        } catch (err) {
            console.warn('[Unfreeze] Backend API sync note:', err);
        }

        fireCelebration();
        onToast({
            type: 'success',
            message: `Wallet for ${targetName} has been successfully unfrozen and restored to Active status!`
        });

        setUnfreezeModalUser(null);
        setUnfreezing(false);
        if (onRefresh) onRefresh();
        window.dispatchEvent(new CustomEvent('walletUpdated'));
    };

    const getRoleBadge = (role) => {
        const r = (role || 'RETAILER').toUpperCase();
        if (r.includes('SUPER')) return 'bg-purple-100 text-purple-700 border-purple-200';
        if (r.includes('DIST')) return 'bg-blue-100 text-blue-700 border-blue-200';
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    };

    return (
        <div className="w-full max-w-6xl mx-auto space-y-2.5">
            {/* Page Identity Header Banner */}
            <div className="flex items-center justify-between bg-gradient-to-r from-sky-950 via-slate-900 to-slate-900 text-white px-4 py-2 sm:py-2.5 rounded-xl shadow-sm border border-sky-900/40">
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 shadow-inner">
                        <Snowflake size={16} />
                    </div>
                    <h2 className="text-xs sm:text-sm font-black tracking-wide uppercase text-white">Freeze Wallet</h2>
                </div>

                {/* SubTab Toggle in Header */}
                <div className="flex items-center gap-1.5 bg-white/10 p-1 rounded-xl border border-white/10">
                    <button
                        type="button"
                        onClick={() => setSubTab('FREEZE')}
                        className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                            subTab === 'FREEZE'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-300 hover:text-white'
                        }`}
                    >
                        <Snowflake size={12} className={subTab === 'FREEZE' ? 'text-sky-600' : 'text-slate-300'} />
                        Freeze Form
                    </button>
                    <button
                        type="button"
                        onClick={() => setSubTab('UNFREEZE')}
                        className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                            subTab === 'UNFREEZE'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-300 hover:text-white'
                        }`}
                    >
                        <Unlock size={12} className={subTab === 'UNFREEZE' ? 'text-emerald-600' : 'text-slate-300'} />
                        Frozen Wallets ({loading && users.length === 0 ? '...' : frozenList.length})
                    </button>
                </div>
            </div>

            {/* VIEW 1: FREEZE WALLET FORM */}
            <AnimatePresence mode="wait">
                {subTab === 'FREEZE' ? (
                    <motion.div
                        key="freeze-form"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 sm:p-4 md:p-5"
                    >
                        <form onSubmit={handleFreezeSubmit} className="space-y-3 sm:space-y-3.5">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 items-start">
                                {/* Left Column */}
                                <div className="space-y-2.5 sm:space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                                            <span>Select Active User to Freeze *</span>
                                            {selectedUser && (
                                                <span className="text-sky-600 font-bold">
                                                    Bal: {fmtINR(selectedUser.balance || selectedUser.walletBalance || 0)}
                                                </span>
                                            )}
                                        </label>
                                        <UserSelector
                                            users={activeEligibleUsers}
                                            value={userId}
                                            onChange={setUserId}
                                            placeholder="Choose an active user..."
                                            disabled={submitting}
                                        />
                                    </div>

                                    {/* Selected User Info */}
                                    {selectedUser && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.98 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="px-3 py-2 bg-sky-50/80 border border-sky-200/90 rounded-xl flex items-center justify-between gap-2"
                                        >
                                            <div className="flex items-center gap-2.5 truncate">
                                                <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                                                    {(selectedUser.name || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="truncate">
                                                    <p className="text-xs font-black text-slate-900 truncate">{selectedUser.name}</p>
                                                    <p className="text-[10px] text-slate-500 font-medium">
                                                        {selectedUser.mobile || selectedUser.username} · Role: <span className="font-bold text-sky-700">{selectedUser.role}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Balance to Freeze</p>
                                                <p className="text-xs font-black text-slate-900">
                                                    {fmtINR(selectedUser.balance || selectedUser.walletBalance || 0)}
                                                </p>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Reason Dropdown */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Freeze Reason *
                                        </label>
                                        <select
                                            value={reason}
                                            onChange={e => setReason(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-sky-500 focus:bg-white transition-colors"
                                        >
                                            <option value="SUSPICIOUS_ACTIVITY">Suspicious Transaction Pattern (High velocity)</option>
                                            <option value="FRAUD_INVESTIGATION">Suspected Fraud / Biometric Anomaly</option>
                                            <option value="KYC_DEFECT">Pending Re-KYC / Document Verification Failure</option>
                                            <option value="LAW_ENFORCEMENT_HOLD">Cyber Crime / Law Enforcement Agency Order</option>
                                            <option value="CHARGEBACK_EXCESS">Excessive Unsettled Chargebacks / Disputes</option>
                                            <option value="ADMIN_DISCRETION">Administrative Security Hold</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Right Column */}
                                <div className="space-y-2.5 sm:space-y-3">
                                    {/* Warning Box */}
                                    <div className="p-3 bg-amber-50/80 border border-amber-200/90 rounded-xl flex items-start gap-2.5">
                                        <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                                        <div className="text-[11px] text-amber-800 leading-relaxed">
                                            <p className="font-bold">Caution: Wallet Freeze Restrictions</p>
                                            <p className="text-[10px] mt-0.5 text-amber-700">
                                                Freezing will immediately block user transactions and cash withdrawals. Balance remains intact in safety escrow until unfrozen by Admin.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Remark */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Detailed Admin Narration
                                        </label>
                                        <input
                                            type="text"
                                            value={remark}
                                            onChange={e => setRemark(e.target.value)}
                                            placeholder="e.g. Account placed on temporary hold pending review"
                                            disabled={submitting}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-sky-500 focus:bg-white transition-colors"
                                        />
                                    </div>

                                    {/* Submit Button */}
                                    <div className="pt-1">
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="w-full py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-sky-700 to-blue-800 hover:from-sky-800 hover:to-blue-900 text-white font-black text-xs uppercase tracking-[0.15em] shadow-md shadow-sky-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                                        >
                                            {submitting ? (
                                                <>
                                                    <Loader2 size={14} className="animate-spin" />
                                                    <span>FREEZING WALLET...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Snowflake size={14} />
                                                    <span>CONFIRM & FREEZE USER WALLET</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </motion.div>
                ) : (
                    /* VIEW 2: UNFREEZE WALLETS TABLE */
                    <motion.div
                        key="unfreeze-table"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 overflow-hidden space-y-3"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100">
                            <div>
                                <h3 className="font-black text-slate-800 text-xs uppercase tracking-wide">All Currently Frozen Wallets</h3>
                                <p className="text-[10px] text-slate-400">Total {filteredFrozen.length} frozen accounts ({fmtINR(totalFrozenBalance)} held)</p>
                            </div>
                            <div className="relative min-w-[200px]">
                                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-sky-400 font-medium"
                                    placeholder="Search frozen user, ID..."
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100 text-left">
                                        {['User Details', 'Role', 'Balance Held', 'Freeze Reason', 'Date Frozen', 'Action'].map(h => (
                                            <th key={h} className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredFrozen.map(item => (
                                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="px-3 py-2.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-800 flex items-center justify-center font-black text-xs shrink-0">
                                                        {(item.name || 'U').charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="truncate">
                                                        <p className="text-xs font-black text-slate-900 truncate">{item.name}</p>
                                                        <p className="text-[10px] text-slate-400 truncate">{item.mobile || item.username}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5 whitespace-nowrap">
                                                <span className={`px-2 py-0.5 text-[9px] font-black rounded uppercase border ${getRoleBadge(item.role)}`}>
                                                    {item.role || 'Member'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 whitespace-nowrap text-xs font-black text-slate-800">
                                                {fmtINR(item.balance)}
                                            </td>
                                            <td className="px-3 py-2.5 max-w-[200px]">
                                                <p className="text-xs font-bold text-rose-700 truncate">{item.reason}</p>
                                                <p className="text-[10px] text-slate-400 truncate" title={item.remark}>{item.remark}</p>
                                            </td>
                                            <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-500">
                                                {fmtDateTime(item.frozenAt)}
                                            </td>
                                            <td className="px-3 py-2.5 whitespace-nowrap">
                                                <button
                                                    onClick={() => {
                                                        setUnfreezeModalUser(item);
                                                        setUnfreezeRemark('Compliance review cleared - wallet restored');
                                                    }}
                                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm hover:scale-105 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Unlock size={12} /> Unfreeze
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredFrozen.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="py-12 text-center text-xs text-slate-400 font-bold">
                                                <div className="max-w-xs mx-auto space-y-1.5">
                                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto text-emerald-600">
                                                        <ShieldCheck size={20} />
                                                    </div>
                                                    <p className="text-xs font-black text-slate-800">No frozen wallets</p>
                                                    <p className="text-[10px] text-slate-400">All user wallets are currently active and in good standing.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Unfreeze Modal ── */}
            <AnimatePresence>
                {unfreezeModalUser && (
                    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden"
                        >
                            <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                                        <Unlock size={18} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-xs uppercase tracking-tight">Unfreeze User Wallet</h3>
                                        <p className="text-[10px] text-emerald-100">Restore full transactional and withdrawal permissions</p>
                                    </div>
                                </div>
                                <button onClick={() => setUnfreezeModalUser(null)} className="text-white/80 hover:text-white cursor-pointer">
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="p-4 space-y-3">
                                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 space-y-1 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500 font-bold">User:</span>
                                        <span className="font-black text-slate-800">{unfreezeModalUser.name} ({unfreezeModalUser.role})</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500 font-bold">Wallet Balance:</span>
                                        <span className="font-black text-emerald-700">{fmtINR(unfreezeModalUser.balance)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500 font-bold">Original Reason:</span>
                                        <span className="font-semibold text-rose-700">{unfreezeModalUser.reason}</span>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Unfreeze Remarks / Clearance Note *
                                    </label>
                                    <input
                                        type="text"
                                        value={unfreezeRemark}
                                        onChange={e => setUnfreezeRemark(e.target.value)}
                                        placeholder="e.g. KYC documents re-verified, authorization granted"
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div className="flex items-center gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setUnfreezeModalUser(null)}
                                        disabled={unfreezing}
                                        className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleConfirmUnfreeze}
                                        disabled={unfreezing}
                                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        {unfreezing ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
                                        <span>Confirm Unfreeze</span>
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default FreezeWalletTab;
