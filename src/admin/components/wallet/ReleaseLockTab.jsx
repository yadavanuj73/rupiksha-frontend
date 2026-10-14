import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Unlock, Lock, Search, RefreshCcw, X, Loader2, UserCheck
} from 'lucide-react';
import { fetchAPI, fireCelebration, fmtINR, fmtDateTime } from './walletShared';
import { dataService } from '../../../services/dataService';

const ReleaseLockTab = ({ users = [], onToast, onRefresh }) => {
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');

    // Modal state for releasing lock
    const [selectedUserToRelease, setSelectedUserToRelease] = useState(null);
    const [releaseAmount, setReleaseAmount] = useState('');
    const [releaseRemark, setReleaseRemark] = useState('Dispute resolved - funds released to available balance');
    const [submitting, setSubmitting] = useState(false);

    // Filter all users who have locked funds > 0
    const usersWithLocked = (users || []).map(u => {
        const bal = parseFloat(String(u.balance ?? u.walletBalance ?? 0).replace(/,/g, '')) || 0;
        const locked = parseFloat(String(u.lockedAmount || 0).replace(/,/g, '')) || 0;
        const avail = Math.max(0, bal - locked);
        return {
            ...u,
            balance: bal,
            lockedAmount: locked,
            availableBalance: avail
        };
    }).filter(u => u.lockedAmount > 0);

    const filtered = usersWithLocked.filter(u => {
        const matchesSearch =
            (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (u.username || '').toLowerCase().includes(search.toLowerCase()) ||
            String(u.mobile || '').includes(search);
        const matchesRole = roleFilter === 'ALL' || (u.role || '').toUpperCase() === roleFilter;
        return matchesSearch && matchesRole;
    });

    const totalSystemLocked = usersWithLocked.reduce((s, u) => s + u.lockedAmount, 0);

    const handleOpenReleaseModal = (user) => {
        setSelectedUserToRelease(user);
        setReleaseAmount(String(user.lockedAmount));
        setReleaseRemark('Dispute resolved - funds released to available balance');
    };

    const handleConfirmRelease = async () => {
        if (!selectedUserToRelease) return;
        const numToRelease = parseFloat(releaseAmount);
        if (!numToRelease || numToRelease <= 0) {
            return onToast({ type: 'error', message: 'Please enter a valid amount to release' });
        }
        if (numToRelease > selectedUserToRelease.lockedAmount) {
            return onToast({
                type: 'error',
                message: `Cannot release more than the locked amount of ${fmtINR(selectedUserToRelease.lockedAmount)}`
            });
        }

        setSubmitting(true);
        const targetId = selectedUserToRelease.id || selectedUserToRelease.username;
        const finalRemark = releaseRemark.trim() || 'Admin released locked funds';

        try {
            await fetchAPI('/wallet/release', {
                method: 'POST',
                body: JSON.stringify({
                    userId: targetId,
                    amount: numToRelease,
                    remark: finalRemark
                })
            });
        } catch (e) {
            console.warn('Backend release API call fallback:', e);
        }

        // Update dataService users
        const appData = dataService.getData();
        if (!appData.users) appData.users = [];
        let uIdx = appData.users.findIndex(u =>
            u.id == targetId || u._id == targetId || u.username === targetId || u.mobile === targetId
        );
        if (uIdx !== -1) {
            const currentU = appData.users[uIdx];
            const currentLocked = parseFloat(String(currentU.lockedAmount || 0).replace(/,/g, '')) || 0;
            const newLocked = Math.max(0, currentLocked - numToRelease).toFixed(2);
            appData.users[uIdx] = {
                ...currentU,
                lockedAmount: parseFloat(newLocked)
            };
            dataService.saveData(appData);
        }

        fireCelebration();
        onToast({
            type: 'success',
            message: `Successfully released ${fmtINR(numToRelease)} back to available balance for ${selectedUserToRelease.name}!`
        });

        setSelectedUserToRelease(null);
        setReleaseAmount('');
        setSubmitting(false);
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
        <div className="max-w-5xl mx-auto space-y-3">
            {/* Page Identity Header Banner */}
            <div className="flex items-center justify-between bg-gradient-to-r from-teal-950 via-slate-900 to-slate-900 text-white px-5 py-3 rounded-2xl shadow-sm border border-teal-900/40">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-400 shadow-inner">
                        <Unlock size={18} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-black tracking-wide uppercase">Release Lock Amount</h2>
                            <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-400/30">
                                Float Restoration
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-300 font-medium">
                            Unlock held float back into user's available balance upon resolution of disputes or verification.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="hidden sm:inline-flex items-center px-3 py-1 bg-white/10 text-teal-200 border border-white/10 rounded-xl text-[10px] font-bold">
                        Locked: {fmtINR(totalSystemLocked)} ({usersWithLocked.length} Users)
                    </span>
                    <button
                        onClick={onRefresh}
                        title="Refresh"
                        className="p-1.5 text-teal-300 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                    >
                        <RefreshCcw size={14} />
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 overflow-hidden space-y-3">
                {/* Search & Filter Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2 flex-1 max-w-md">
                        <div className="relative flex-1">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-teal-400 font-medium"
                                placeholder="Search user with locked balance..."
                            />
                        </div>

                        <select
                            value={roleFilter}
                            onChange={e => setRoleFilter(e.target.value)}
                            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-teal-400"
                        >
                            <option value="ALL">All Roles</option>
                            <option value="RETAILER">Retailers</option>
                            <option value="DISTRIBUTOR">Distributors</option>
                            <option value="SUPER_DISTRIBUTOR">Super Distributors</option>
                        </select>
                    </div>

                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Showing {filtered.length} of {usersWithLocked.length} accounts
                    </p>
                </div>

                {/* Users with Locked Balance Table */}
                <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-left">
                                {['User Details', 'Role', 'Total Balance', 'Locked Amount', 'Available Balance', 'Action'].map(h => (
                                    <th key={h} className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filtered.map(user => (
                                <tr key={user.id || user.username} className="hover:bg-slate-50/70 transition-colors">
                                    <td className="px-3 py-2.5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-black text-xs shrink-0">
                                                {(user.name || 'U').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="truncate">
                                                <p className="text-xs font-black text-slate-900 truncate">{user.name}</p>
                                                <p className="text-[10px] text-slate-400 truncate">{user.mobile || user.username}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                        <span className={`px-2 py-0.5 text-[9px] font-black rounded uppercase border ${getRoleBadge(user.role)}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 whitespace-nowrap text-xs font-black text-slate-800">
                                        {fmtINR(user.balance)}
                                    </td>
                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-800 rounded-lg text-xs font-black border border-purple-200">
                                            <Lock size={10} className="text-purple-600" />
                                            {fmtINR(user.lockedAmount)}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 whitespace-nowrap text-xs font-black text-emerald-600">
                                        {fmtINR(user.availableBalance)}
                                    </td>
                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                        <button
                                            onClick={() => handleOpenReleaseModal(user)}
                                            className="px-3 py-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm hover:scale-105 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                                        >
                                            <Unlock size={12} /> Release Lock
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-xs text-slate-400 font-bold">
                                        <div className="max-w-xs mx-auto space-y-1.5">
                                            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center mx-auto text-teal-600">
                                                <UserCheck size={20} />
                                            </div>
                                            <p className="text-xs font-black text-slate-800">No locked balances</p>
                                            <p className="text-[10px] text-slate-400">There are currently no user wallets with locked funds.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Release Lock Modal ── */}
            <AnimatePresence>
                {selectedUserToRelease && (
                    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden"
                        >
                            <div className="p-4 bg-gradient-to-r from-teal-600 to-emerald-600 text-white flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                                        <Unlock size={18} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-xs uppercase tracking-tight">Release Locked Funds</h3>
                                        <p className="text-[10px] text-teal-100">Unlock float back into user's available balance</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedUserToRelease(null)} className="text-white/80 hover:text-white cursor-pointer">
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="p-4 space-y-3">
                                {/* User Details Card */}
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <span className="text-slate-400 font-bold block text-[10px]">User:</span>
                                        <span className="font-black text-slate-800">{selectedUserToRelease.name}</span>
                                        <span className="text-[10px] text-slate-400 block">{selectedUserToRelease.mobile || selectedUserToRelease.username}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-slate-400 font-bold block text-[10px]">Currently Locked:</span>
                                        <span className="text-sm font-black text-purple-700">{fmtINR(selectedUserToRelease.lockedAmount)}</span>
                                    </div>
                                </div>

                                {/* Amount to release input */}
                                <div className="space-y-1">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Amount to Release (₹) *
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setReleaseAmount(String(selectedUserToRelease.lockedAmount))}
                                            className="text-[10px] font-bold text-teal-700 hover:underline cursor-pointer"
                                        >
                                            Full ({fmtINR(selectedUserToRelease.lockedAmount)})
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                                        <input
                                            type="number"
                                            max={selectedUserToRelease.lockedAmount}
                                            step="0.01"
                                            value={releaseAmount}
                                            onChange={e => setReleaseAmount(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black outline-none focus:border-teal-500"
                                        />
                                    </div>
                                </div>

                                {/* Reason / Remark */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Release Reason / Remark
                                    </label>
                                    <input
                                        type="text"
                                        value={releaseRemark}
                                        onChange={e => setReleaseRemark(e.target.value)}
                                        placeholder="e.g. Investigation completed, dispute cleared"
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-teal-500"
                                    />
                                </div>

                                <div className="flex items-center gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedUserToRelease(null)}
                                        disabled={submitting}
                                        className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleConfirmRelease}
                                        disabled={submitting}
                                        className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        {submitting ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
                                        <span>Confirm Release</span>
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

export default ReleaseLockTab;
