import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Snowflake, ShieldAlert, CheckCircle2, AlertTriangle, Search,
    RefreshCcw, Unlock, UserX, Loader2, X, ShieldCheck
} from 'lucide-react';
import { UserSelector, fmtINR, fmtDateTime, fireCelebration, fetchAPI } from './walletShared';
import { dataService } from '../../../services/dataService';

const FreezeWalletTab = ({ users = [], onToast, onRefresh }) => {
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

    const frozenList = (users || []).filter(u => u.isFrozen || u.walletStatus === 'FROZEN' || u.status === 'FROZEN');
    const frozenIds = new Set(frozenList.map(f => String(f.id || f.userId || f.username)));

    // Active users eligible to be frozen
    const activeEligibleUsers = (users || []).filter(u =>
        !frozenIds.has(String(u.id)) && !frozenIds.has(String(u.username)) && !u.isFrozen && u.walletStatus !== 'FROZEN'
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
        const targetId = selectedUser ? (selectedUser.id || selectedUser.username) : userId;
        const targetName = selectedUser?.name || selectedUser?.fullName || targetId;
        const targetBal = parseFloat(String(selectedUser?.balance ?? selectedUser?.walletBalance ?? 0).replace(/,/g, '')) || 0;
        const finalRemark = remark.trim() || `Wallet frozen: ${reason.replace(/_/g, ' ')}`;

        const newFrozenEntry = {
            id: targetId,
            userId: targetId,
            username: selectedUser?.username || targetId,
            name: targetName,
            mobile: selectedUser?.mobile || '',
            role: selectedUser?.role || 'RETAILER',
            balance: targetBal,
            reason: reason.replace(/_/g, ' '),
            remark: finalRemark,
            frozenAt: new Date().toISOString(),
            frozenBy: 'Admin'
        };

        // Update dataService
        const appData = dataService.getData();
        if (appData.users) {
            const uIdx = appData.users.findIndex(u =>
                u.id == targetId || u._id == targetId || u.username === targetId || u.mobile === targetId
            );
            if (uIdx !== -1) {
                appData.users[uIdx] = {
                    ...appData.users[uIdx],
                    isFrozen: true,
                    walletStatus: 'FROZEN',
                    frozenReason: finalRemark,
                    frozenAt: new Date().toISOString()
                };
                dataService.saveData(appData);
            }
        }

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
    };

    // Handle Unfreeze
    const handleConfirmUnfreeze = async () => {
        if (!unfreezeModalUser) return;
        setUnfreezing(true);
        const targetId = unfreezeModalUser.id || unfreezeModalUser.userId || unfreezeModalUser.username;
        const targetName = unfreezeModalUser.name || targetId;


        // Restore active in dataService
        const appData = dataService.getData();
        if (appData.users) {
            const uIdx = appData.users.findIndex(u =>
                u.id == targetId || u._id == targetId || u.username === targetId || u.mobile === targetId
            );
            if (uIdx !== -1) {
                appData.users[uIdx] = {
                    ...appData.users[uIdx],
                    isFrozen: false,
                    walletStatus: 'ACTIVE',
                    unfrozenAt: new Date().toISOString(),
                    unfreezeRemark: unfreezeRemark
                };
                dataService.saveData(appData);
            }
        }

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
        <div className="space-y-6">
            {/* Sub-Tabs Selector & Stats */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit">
                    <button
                        onClick={() => setSubTab('FREEZE')}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                        subTab === 'FREEZE'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Snowflake size={14} className="text-blue-600" />
                    Freeze A User Wallet
                </button>
                <button
                    onClick={() => setSubTab('UNFREEZE')}
                    className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                        subTab === 'UNFREEZE'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Unlock size={14} className="text-emerald-600" />
                    Unfreeze Wallets ({frozenList.length})
                </button>
            </div>
            {frozenList.length > 0 && (
                <div className="flex items-center gap-2">
                    <span className="hidden sm:inline-flex items-center px-3 py-1.5 bg-cyan-50 text-cyan-800 border border-cyan-200 rounded-xl text-xs font-bold">
                        Currently Frozen: {frozenList.length} ({fmtINR(totalFrozenBalance)})
                    </span>
                </div>
            )}
        </div>

            {/* VIEW 1: FREEZE WALLET FORM */}
            {subTab === 'FREEZE' && (
                <div className="max-w-3xl bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8 space-y-6">
                    <form onSubmit={handleFreezeSubmit} className="space-y-6">
                        {/* Warning Box */}
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                            <div className="text-xs text-amber-800 leading-relaxed">
                                <p className="font-bold">Caution: Wallet Freeze Restrictions</p>
                                <p className="mt-0.5">
                                    Freezing will immediately prevent the user from performing AEPS withdrawals, money transfers, bill payments, and debit transactions.
                                    The wallet balance will remain intact in safety escrow until unfrozen by an Administrator.
                                </p>
                            </div>
                        </div>

                        {/* Select User */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Select Active User to Freeze *
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
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-center justify-between"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm">
                                        {(selectedUser.name || 'U').charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-slate-800">{selectedUser.name}</p>
                                        <p className="text-xs text-slate-500">
                                            {selectedUser.mobile || selectedUser.username} · Role: <span className="font-bold text-blue-700">{selectedUser.role}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-slate-500 font-bold uppercase">Balance to Freeze</p>
                                    <p className="text-base font-black text-slate-900">
                                        {fmtINR(selectedUser.balance || selectedUser.walletBalance || 0)}
                                    </p>
                                </div>
                            </motion.div>
                        )}

                        {/* Reason Dropdown */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Freeze Reason *
                            </label>
                            <select
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
                            >
                                <option value="SUSPICIOUS_ACTIVITY">Suspicious Transaction Pattern (High velocity / unusual)</option>
                                <option value="FRAUD_INVESTIGATION">Suspected Fraud / Biometric Anomaly</option>
                                <option value="KYC_DEFECT">Pending Re-KYC / Document Verification Failure</option>
                                <option value="LAW_ENFORCEMENT_HOLD">Cyber Crime / Law Enforcement Agency Order</option>
                                <option value="CHARGEBACK_EXCESS">Excessive Unsettled Chargebacks / Disputes</option>
                                <option value="ADMIN_DISCRETION">Administrative Security Hold</option>
                            </select>
                        </div>

                        {/* Remark */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Detailed Admin Narration
                            </label>
                            <input
                                type="text"
                                value={remark}
                                onChange={e => setRemark(e.target.value)}
                                placeholder="e.g. Account placed on temporary hold pending review by Fraud Risk unit"
                                disabled={submitting}
                                className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-800 hover:from-blue-800 hover:to-indigo-900 text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>FREEZING WALLET...</span>
                                </>
                            ) : (
                                <>
                                    <Snowflake size={16} />
                                    <span>CONFIRM & FREEZE USER WALLET</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>
            )}

            {/* VIEW 2: UNFREEZE WALLETS TABLE */}
            {subTab === 'UNFREEZE' && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden space-y-4">
                    <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">All Currently Frozen Wallets</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Showing {filteredFrozen.length} frozen accounts</p>
                        </div>
                        <div className="relative min-w-[240px]">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-emerald-400 font-medium"
                                placeholder="Search frozen user, ID, mobile..."
                            />
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100 text-left">
                                    {['User Details', 'Role', 'Balance Held', 'Freeze Reason', 'Date Frozen', 'Action'].map(h => (
                                        <th key={h} className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredFrozen.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-cyan-100 text-cyan-800 flex items-center justify-center font-black text-xs shrink-0">
                                                    {(item.name || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="truncate">
                                                    <p className="text-xs font-black text-slate-900 truncate">{item.name}</p>
                                                    <p className="text-[10px] text-slate-400 truncate">{item.mobile || item.username}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-0.5 text-[9px] font-black rounded uppercase border ${getRoleBadge(item.role)}`}>
                                                {item.role || 'Member'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap text-xs font-black text-slate-800">
                                            {fmtINR(item.balance)}
                                        </td>
                                        <td className="px-5 py-4 max-w-[220px]">
                                            <p className="text-xs font-bold text-rose-700 truncate">{item.reason}</p>
                                            <p className="text-[10px] text-slate-400 truncate" title={item.remark}>{item.remark}</p>
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500">
                                            {fmtDateTime(item.frozenAt)}
                                        </td>
                                        <td className="px-5 py-4 whitespace-nowrap">
                                            <button
                                                onClick={() => {
                                                    setUnfreezeModalUser(item);
                                                    setUnfreezeRemark('Compliance review cleared - wallet restored');
                                                }}
                                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-600/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <Unlock size={14} /> Unfreeze Wallet
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredFrozen.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="py-16 text-center text-xs text-slate-400 font-bold">
                                            <div className="max-w-xs mx-auto space-y-2">
                                                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto text-emerald-600">
                                                    <ShieldCheck size={24} />
                                                </div>
                                                <p className="text-sm font-black text-slate-800">No frozen wallets</p>
                                                <p className="text-xs text-slate-400">All user wallets are currently active and in good standing.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Unfreeze Modal ── */}
            <AnimatePresence>
                {unfreezeModalUser && (
                    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden"
                        >
                            <div className="p-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                                        <Unlock size={22} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-base uppercase tracking-tight">Unfreeze User Wallet</h3>
                                        <p className="text-xs text-emerald-100">Restore full transactional and withdrawal permissions</p>
                                    </div>
                                </div>
                                <button onClick={() => setUnfreezeModalUser(null)} className="text-white/80 hover:text-white">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-6 space-y-5">
                                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-2 text-xs">
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

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Unfreeze Remarks / Clearance Note *
                                    </label>
                                    <input
                                        type="text"
                                        value={unfreezeRemark}
                                        onChange={e => setUnfreezeRemark(e.target.value)}
                                        placeholder="e.g. KYC documents re-verified, authorization granted"
                                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div className="flex items-center gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setUnfreezeModalUser(null)}
                                        disabled={unfreezing}
                                        className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleConfirmUnfreeze}
                                        disabled={unfreezing}
                                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        {unfreezing ? <Loader2 size={16} className="animate-spin" /> : <Unlock size={16} />}
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
