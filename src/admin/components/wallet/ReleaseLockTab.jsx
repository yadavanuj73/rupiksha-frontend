import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Unlock, Lock, Search, RefreshCcw, CheckCircle2, AlertTriangle,
    IndianRupee, X, Loader2, UserCheck
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
        <div className="space-y-6">
            {/* Filter Bar */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 flex-1">
                    <div className="relative min-w-[240px] flex-1 max-w-md">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-cyan-400 font-medium"
                            placeholder="Search user with locked balance..."
                        />
                    </div>

                    <select
                        value={roleFilter}
                        onChange={e => setRoleFilter(e.target.value)}
                        className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:border-cyan-400"
                    >
                        <option value="ALL">All Roles</option>
                        <option value="RETAILER">Retailers</option>
                        <option value="DISTRIBUTOR">Distributors</option>
                        <option value="SUPER_DISTRIBUTOR">Super Distributors</option>
                    </select>

                    <button
                        onClick={onRefresh}
                        title="Refresh"
                        className="p-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-xl transition-all"
                    >
                        <RefreshCcw size={15} />
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <span className="hidden sm:inline-flex items-center px-3 py-1.5 bg-cyan-50 text-cyan-800 border border-cyan-200 rounded-xl text-xs font-bold">
                        Total Locked: {fmtINR(totalSystemLocked)} ({usersWithLocked.length} Accounts)
                    </span>
                </div>
            </div>

            {/* Users with Locked Balance Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-left">
                                {['User Details', 'Role', 'Total Balance', 'Locked Amount', 'Available Balance', 'Action'].map(h => (
                                    <th key={h} className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filtered.map(user => (
                                <tr key={user.id || user.username} className="hover:bg-cyan-50/20 transition-colors">
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-xs shrink-0">
                                                {(user.name || 'U').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="truncate">
                                                <p className="text-xs font-black text-slate-900 truncate">{user.name}</p>
                                                <p className="text-[10px] text-slate-400 truncate">{user.mobile || user.username}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-0.5 text-[9px] font-black rounded uppercase border ${getRoleBadge(user.role)}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 whitespace-nowrap text-xs font-black text-slate-800">
                                        {fmtINR(user.balance)}
                                    </td>
                                    <td className="px-5 py-4 whitespace-nowrap">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-100 text-purple-800 rounded-xl text-xs font-black border border-purple-200">
                                            <Lock size={12} className="text-purple-600" />
                                            {fmtINR(user.lockedAmount)}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 whitespace-nowrap text-xs font-black text-emerald-600">
                                        {fmtINR(user.availableBalance)}
                                    </td>
                                    <td className="px-5 py-4 whitespace-nowrap">
                                        <button
                                            onClick={() => handleOpenReleaseModal(user)}
                                            className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-cyan-600/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <Unlock size={14} /> Release Lock
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-16 text-center text-xs text-slate-400 font-bold">
                                        <div className="max-w-xs mx-auto space-y-2">
                                            <div className="w-12 h-12 rounded-2xl bg-cyan-50 flex items-center justify-center mx-auto text-cyan-600">
                                                <UserCheck size={24} />
                                            </div>
                                            <p className="text-sm font-black text-slate-800">No locked balances</p>
                                            <p className="text-xs text-slate-400">There are currently no user wallets with locked funds.</p>
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
                            className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden"
                        >
                            <div className="p-6 bg-gradient-to-r from-cyan-600 to-teal-600 text-white flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                                        <Unlock size={22} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-base uppercase tracking-tight">Release Locked Funds</h3>
                                        <p className="text-xs text-cyan-100">Unlock float back into user's available balance</p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedUserToRelease(null)} className="text-white/80 hover:text-white">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-6 space-y-5">
                                {/* User Details Card */}
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <span className="text-slate-400 font-bold block">User:</span>
                                        <span className="font-black text-slate-800">{selectedUserToRelease.name}</span>
                                        <span className="text-[10px] text-slate-400 block">{selectedUserToRelease.mobile || selectedUserToRelease.username}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-slate-400 font-bold block">Currently Locked:</span>
                                        <span className="text-base font-black text-purple-700">{fmtINR(selectedUserToRelease.lockedAmount)}</span>
                                    </div>
                                </div>

                                {/* Amount to release input */}
                                <div className="space-y-1.5">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Amount to Release (₹) *
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setReleaseAmount(String(selectedUserToRelease.lockedAmount))}
                                            className="text-xs font-bold text-cyan-700 hover:underline"
                                        >
                                            Release Full Amount ({fmtINR(selectedUserToRelease.lockedAmount)})
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">₹</span>
                                        <input
                                            type="number"
                                            max={selectedUserToRelease.lockedAmount}
                                            step="0.01"
                                            value={releaseAmount}
                                            onChange={e => setReleaseAmount(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full pl-8 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-base font-black outline-none focus:border-cyan-500"
                                        />
                                    </div>
                                </div>

                                {/* Reason / Remark */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Release Reason / Remark
                                    </label>
                                    <input
                                        type="text"
                                        value={releaseRemark}
                                        onChange={e => setReleaseRemark(e.target.value)}
                                        placeholder="e.g. Investigation completed, dispute cleared"
                                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-cyan-500"
                                    />
                                </div>

                                <div className="flex items-center gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedUserToRelease(null)}
                                        disabled={submitting}
                                        className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleConfirmRelease}
                                        disabled={submitting}
                                        className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-cyan-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Unlock size={16} />}
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
