import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Wallet, Lock, IndianRupee, Search, RefreshCcw, Snowflake,
    ArrowDownCircle, ArrowUpCircle, Clock, ShieldCheck, User, X,
    Loader2, CheckCircle2, AlertTriangle, ExternalLink, Sparkles,
    Unlock, ChevronRight
} from 'lucide-react';
import { fmtINR, fetchAPI, WalletTabSkeleton, fireCelebration, uuid } from './walletShared';
import { dataService } from '../../../services/dataService';

const WalletOverviewTab = ({ wallets = [], loading, onRefresh, onNavigate, onToast }) => {
    if (loading && wallets.length === 0) {
        return (
            <WalletTabSkeleton
                title="Wallet Overview"
                subtitle="Fetching global wallet float, locked escrows and system totals..."
            />
        );
    }

    const [localWallets, setLocalWallets] = useState(wallets);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

    // Modal state for direct quick actions
    const [actionModal, setActionModal] = useState(null); // { type: 'CREDIT' | 'DEBIT' | 'LOCK' | 'FREEZE' | 'UNFREEZE', user: ... }
    const [modalAmount, setModalAmount] = useState('');
    const [modalRemark, setModalRemark] = useState('');
    const [modalCategory, setModalCategory] = useState('ADMIN_TOPUP');
    const [modalReason, setModalReason] = useState('SECURITY_HOLD');
    const [modalSubmitting, setModalSubmitting] = useState(false);
    const [modalError, setModalError] = useState('');

    // Keep local wallets in sync with incoming props
    useEffect(() => {
        setLocalWallets(wallets);
    }, [wallets]);

    // Fetch live pending fund requests count directly from backend
    useEffect(() => {
        let mounted = true;
        fetchAPI('/admin/wallet/fund-requests')
            .then(res => {
                if (mounted && res && res.success && Array.isArray(res.requests)) {
                    const pending = res.requests.filter(r => (r.status || 'PENDING').toUpperCase() === 'PENDING').length;
                    setPendingRequestsCount(pending);
                }
            })
            .catch(() => {});
        return () => { mounted = false; };
    }, []);

    const enrichedWallets = localWallets.map(w => {
        const isFrozen = Boolean(w.isFrozen || w.walletStatus === 'FROZEN' || w.status === 'FROZEN');
        const bal = parseFloat(String(w.balance || 0).replace(/,/g, '')) || 0;
        const locked = parseFloat(String(w.lockedAmount || 0).replace(/,/g, '')) || 0;
        const available = Math.max(0, bal - locked);
        return {
            ...w,
            isFrozen,
            balance: bal,
            lockedAmount: locked,
            availableBalance: available
        };
    });

    const filtered = enrichedWallets.filter(w => {
        const matchesSearch =
            (w.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (w.username || '').toLowerCase().includes(search.toLowerCase()) ||
            String(w.mobile || '').includes(search) ||
            String(w.partyCode || '').toLowerCase().includes(search.toLowerCase());

        const matchesRole = roleFilter === 'ALL' || (w.role || '').toUpperCase() === roleFilter;
        const matchesStatus = statusFilter === 'ALL' ||
            (statusFilter === 'FROZEN' ? w.isFrozen : !w.isFrozen);

        return matchesSearch && matchesRole && matchesStatus;
    });

    const totalBalance = enrichedWallets.reduce((s, w) => s + w.balance, 0);
    const totalLocked = enrichedWallets.reduce((s, w) => s + w.lockedAmount, 0);
    const totalAvailable = enrichedWallets.reduce((s, w) => s + w.availableBalance, 0);
    const totalFrozenCount = enrichedWallets.filter(w => w.isFrozen).length;

    const getRoleBadge = (role) => {
        const r = (role || 'RETAILER').toUpperCase();
        if (r.includes('SUPER')) return 'bg-purple-100 text-purple-700 border-purple-200';
        if (r.includes('DIST')) return 'bg-blue-100 text-blue-700 border-blue-200';
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    };

    const triggerToast = (msg, type = 'success') => {
        if (onToast) onToast({ type, message: msg });
    };

    // Open Quick Action Modal
    const handleOpenModal = (type, user) => {
        setActionModal({ type, user });
        setModalAmount('');
        setModalRemark('');
        setModalError('');
        if (type === 'CREDIT') {
            setModalCategory('ADMIN_TOPUP');
        } else if (type === 'DEBIT') {
            setModalCategory('ADMIN_ADJUSTMENT');
        } else if (type === 'LOCK') {
            setModalReason('SECURITY_HOLD');
        } else if (type === 'FREEZE') {
            setModalRemark('Suspicious activity detected - temporarily frozen');
        } else if (type === 'UNFREEZE') {
            setModalRemark('Compliance review cleared - wallet restored to Active');
        }
    };

    const handleCloseModal = () => {
        setActionModal(null);
        setModalAmount('');
        setModalRemark('');
        setModalError('');
        setModalSubmitting(false);
    };

    // Execute Quick Modal Action
    const handleExecuteAction = async (e) => {
        if (e) e.preventDefault();
        if (!actionModal) return;

        const { type, user } = actionModal;
        const targetId = user.id || user.userId || user.username || user.mobile;
        const numAmt = parseFloat(modalAmount) || 0;

        if (['CREDIT', 'DEBIT', 'LOCK'].includes(type) && (!numAmt || numAmt <= 0)) {
            setModalError('Please enter a valid amount greater than ₹0');
            return;
        }

        if (type === 'DEBIT' && numAmt > user.balance) {
            setModalError(`Cannot debit more than total balance of ${fmtINR(user.balance)}`);
            return;
        }

        if (type === 'LOCK' && numAmt > user.availableBalance) {
            setModalError(`Cannot lock more than available balance of ${fmtINR(user.availableBalance)}`);
            return;
        }

        setModalSubmitting(true);
        setModalError('');

        try {
            if (type === 'CREDIT') {
                const note = modalRemark.trim() || `Admin Credit Fund (${modalCategory.replace(/_/g, ' ')})`;
                const res = await fetchAPI('/wallet/credit', {
                    method: 'POST',
                    body: JSON.stringify({
                        userId: targetId,
                        amount: numAmt,
                        remark: note,
                        narration: note,
                        category: modalCategory
                    })
                });

                if (res && res.success) {
                    dataService.adjustUserWalletBalance(targetId, numAmt, 'CREDIT', note);
                    fireCelebration();
                    triggerToast(res.message || `Successfully credited ${fmtINR(numAmt)} to ${user.name || targetId}!`);

                    // Instantly update in local table state
                    setLocalWallets(prev => prev.map(w => {
                        const mId = w.id || w.userId || w.username;
                        if (mId === targetId || w.username === user.username) {
                            const newBal = (w.balance || 0) + numAmt;
                            return { ...w, balance: newBal, availableBalance: Math.max(0, newBal - (w.lockedAmount || 0)) };
                        }
                        return w;
                    }));

                    handleCloseModal();
                    if (onRefresh) onRefresh();
                    window.dispatchEvent(new CustomEvent('walletUpdated'));
                } else {
                    setModalError(res?.message || res?.error || 'Failed to credit wallet. Please try again.');
                }

            } else if (type === 'DEBIT') {
                const note = modalRemark.trim() || `Admin Debit Fund (${modalCategory.replace(/_/g, ' ')})`;
                const res = await fetchAPI('/wallet/debit', {
                    method: 'POST',
                    body: JSON.stringify({
                        userId: targetId,
                        amount: numAmt,
                        remark: note,
                        narration: note,
                        category: modalCategory
                    })
                });

                if (res && res.success) {
                    dataService.adjustUserWalletBalance(targetId, numAmt, 'DEBIT', note);
                    triggerToast(res.message || `Successfully debited ${fmtINR(numAmt)} from ${user.name || targetId}!`);

                    // Instantly update in local table state
                    setLocalWallets(prev => prev.map(w => {
                        const mId = w.id || w.userId || w.username;
                        if (mId === targetId || w.username === user.username) {
                            const newBal = Math.max(0, (w.balance || 0) - numAmt);
                            return { ...w, balance: newBal, availableBalance: Math.max(0, newBal - (w.lockedAmount || 0)) };
                        }
                        return w;
                    }));

                    handleCloseModal();
                    if (onRefresh) onRefresh();
                    window.dispatchEvent(new CustomEvent('walletUpdated'));
                } else {
                    setModalError(res?.message || res?.error || 'Failed to debit wallet. Please verify balance and try again.');
                }

            } else if (type === 'LOCK') {
                const note = modalRemark.trim() || `Amount Locked: ${modalReason.replace(/_/g, ' ')}`;
                const res = await fetchAPI('/wallet/lock', {
                    method: 'POST',
                    body: JSON.stringify({
                        userId: targetId,
                        amount: numAmt,
                        remark: note,
                        narration: note,
                        reason: modalReason
                    })
                });

                if (res && res.success) {
                    triggerToast(res.message || `Successfully locked ${fmtINR(numAmt)} for ${user.name || targetId}!`);

                    // Instantly update in local table state
                    setLocalWallets(prev => prev.map(w => {
                        const mId = w.id || w.userId || w.username;
                        if (mId === targetId || w.username === user.username) {
                            const newLock = (w.lockedAmount || 0) + numAmt;
                            return { ...w, lockedAmount: newLock, availableBalance: Math.max(0, (w.balance || 0) - newLock) };
                        }
                        return w;
                    }));

                    handleCloseModal();
                    if (onRefresh) onRefresh();
                    window.dispatchEvent(new CustomEvent('walletUpdated'));
                } else {
                    setModalError(res?.message || res?.error || 'Failed to lock amount. Please try again.');
                }

            } else if (type === 'FREEZE' || type === 'UNFREEZE') {
                const newStatus = type === 'FREEZE' ? 'FROZEN' : 'ACTIVE';
                const note = modalRemark.trim() || (type === 'FREEZE' ? 'Admin froze wallet' : 'Admin restored wallet');

                const res = await fetchAPI('/wallet/status', {
                    method: 'POST',
                    body: JSON.stringify({
                        userId: String(targetId),
                        status: newStatus,
                        remark: note
                    })
                });

                if (res && res.success) {
                    // Update localStorage freeze flags
                    try {
                        const isFrz = type === 'FREEZE';
                        const keys = [targetId, user.id, user.userId, user.username, user.mobile].filter(Boolean);
                        keys.forEach(k => {
                            if (isFrz) localStorage.setItem(`rupiksha_frozen_${k}`, 'true');
                            else localStorage.removeItem(`rupiksha_frozen_${k}`);
                        });
                    } catch (_) {}

                    if (type === 'UNFREEZE') fireCelebration();
                    triggerToast(`Wallet for ${user.name || targetId} has been ${type === 'FREEZE' ? 'frozen' : 'unfrozen and restored'}!`);

                    // Instantly update in local table state
                    setLocalWallets(prev => prev.map(w => {
                        const mId = w.id || w.userId || w.username;
                        if (mId === targetId || w.username === user.username) {
                            return { ...w, isFrozen: type === 'FREEZE', walletStatus: newStatus };
                        }
                        return w;
                    }));

                    handleCloseModal();
                    if (onRefresh) onRefresh();
                    window.dispatchEvent(new CustomEvent('walletUpdated'));
                } else {
                    setModalError(res?.message || res?.error || `Failed to ${type.toLowerCase()} wallet.`);
                }
            }
        } catch (err) {
            setModalError(err?.message || 'Server connection error. Please try again.');
        } finally {
            setModalSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    {
                        label: 'Total System Float',
                        value: fmtINR(totalBalance),
                        color: '#6366f1',
                        bg: '#eef2ff',
                        icon: IndianRupee,
                        desc: 'Sum of all user balances'
                    },
                    {
                        label: 'Total Locked Amount',
                        value: fmtINR(totalLocked),
                        color: '#8b5cf6',
                        bg: '#f5f3ff',
                        icon: Lock,
                        desc: 'Held funds under dispute/security'
                    },
                    {
                        label: 'Total Available Balance',
                        value: fmtINR(totalAvailable),
                        color: '#10b981',
                        bg: '#ecfdf5',
                        icon: Wallet,
                        desc: 'Net active spendable balance'
                    },
                    {
                        label: 'Pending Requests & Frozen',
                        value: `${pendingRequestsCount} Req / ${totalFrozenCount} Frz`,
                        color: totalFrozenCount > 0 || pendingRequestsCount > 0 ? '#f59e0b' : '#64748b',
                        bg: '#fffbeb',
                        icon: Clock,
                        desc: 'Pending approvals & frozen wallets'
                    },
                ].map((s, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</span>
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.bg }}>
                                <s.icon size={18} style={{ color: s.color }} />
                            </div>
                        </div>
                        <p className="text-xl font-black text-slate-900 tracking-tight">{s.value}</p>
                        <p className="text-[10px] text-slate-400 mt-1 font-medium">{s.desc}</p>
                    </div>
                ))}
            </div>

            {/* Wallets Table Section */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">All User Wallets</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Showing {filtered.length} of {enrichedWallets.length} active wallets</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Search */}
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 w-52 transition-all font-medium"
                                placeholder="Search user, mobile, party code..."
                            />
                        </div>

                        {/* Role filter */}
                        <select
                            value={roleFilter}
                            onChange={e => setRoleFilter(e.target.value)}
                            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-600 outline-none focus:border-indigo-400 cursor-pointer"
                        >
                            <option value="ALL">All Roles</option>
                            <option value="RETAILER">Retailers</option>
                            <option value="DISTRIBUTOR">Distributors</option>
                            <option value="SUPER_DISTRIBUTOR">Super Distributors</option>
                        </select>

                        {/* Status filter */}
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-600 outline-none focus:border-indigo-400 cursor-pointer"
                        >
                            <option value="ALL">All Status</option>
                            <option value="ACTIVE">Active Wallets</option>
                            <option value="FROZEN">Frozen Wallets</option>
                        </select>

                        {/* Refresh */}
                        <button
                            onClick={onRefresh}
                            title="Refresh data from server"
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer"
                        >
                            <RefreshCcw size={15} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-left">
                                {['User Details', 'Role', 'Status', 'Total Balance', 'Locked Amount', 'Available Balance', 'Quick Actions'].map(h => (
                                    <th key={h} className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filtered.map((w, i) => (
                                <tr key={w.id || i} className="hover:bg-slate-50/70 transition-colors">
                                    {/* User Details */}
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-black shadow-sm shrink-0">
                                                {(w.name || w.fullName || 'U').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="truncate">
                                                <p className="text-xs font-black text-slate-800 truncate">{w.name || w.fullName}</p>
                                                <p className="text-[10px] text-slate-400 truncate">
                                                    {w.mobile || w.phone || w.username} {w.partyCode && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(w.partyCode) ? `· ${w.partyCode}` : ''}
                                                </p>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Role */}
                                    <td className="px-5 py-3.5 whitespace-nowrap">
                                        <span className={`px-2.5 py-1 text-[9px] font-black rounded-lg uppercase tracking-wider border ${getRoleBadge(w.role)}`}>
                                            {w.role || 'RETAILER'}
                                        </span>
                                    </td>

                                    {/* Status */}
                                    <td className="px-5 py-3.5 whitespace-nowrap">
                                        {w.isFrozen ? (
                                            <button
                                                onClick={() => handleOpenModal('UNFREEZE', w)}
                                                title="Click to unfreeze wallet"
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 rounded-lg text-[9px] font-black uppercase transition-all cursor-pointer"
                                            >
                                                <Snowflake size={11} className="text-cyan-500" /> FROZEN
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleOpenModal('FREEZE', w)}
                                                title="Click to freeze wallet"
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[9px] font-black uppercase transition-all cursor-pointer"
                                            >
                                                <ShieldCheck size={11} className="text-emerald-500" /> ACTIVE
                                            </button>
                                        )}
                                    </td>

                                    {/* Total Balance */}
                                    <td className="px-5 py-3.5 whitespace-nowrap text-xs font-black text-slate-800">
                                        {fmtINR(w.balance)}
                                    </td>

                                    {/* Locked Amount */}
                                    <td className="px-5 py-3.5 whitespace-nowrap">
                                        <span className={`text-xs font-black ${w.lockedAmount > 0 ? 'text-purple-600 font-bold' : 'text-slate-400'}`}>
                                            {fmtINR(w.lockedAmount)}
                                        </span>
                                    </td>

                                    {/* Available Balance */}
                                    <td className="px-5 py-3.5 whitespace-nowrap text-xs font-black text-emerald-600">
                                        {fmtINR(w.availableBalance)}
                                    </td>

                                    {/* Quick Actions */}
                                    <td className="px-5 py-3.5 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => handleOpenModal('CREDIT', w)}
                                                title={`Quick Credit to ${w.name || w.username}`}
                                                className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                            >
                                                <ArrowDownCircle size={12} /> Credit
                                            </button>
                                            <button
                                                onClick={() => handleOpenModal('DEBIT', w)}
                                                title={`Quick Debit from ${w.name || w.username}`}
                                                className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white rounded-lg text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                            >
                                                <ArrowUpCircle size={12} /> Debit
                                            </button>
                                            <button
                                                onClick={() => handleOpenModal(w.isFrozen ? 'UNFREEZE' : 'LOCK', w)}
                                                title={w.isFrozen ? 'Manage freeze state' : 'Lock funds in escrow'}
                                                className="px-2.5 py-1 bg-slate-100 text-slate-600 hover:bg-slate-800 hover:text-white rounded-lg text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                            >
                                                <Lock size={12} /> {w.lockedAmount > 0 ? 'Locked' : 'Lock'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="py-14 text-center text-xs text-slate-400 font-bold">
                                        No wallets found matching your filter criteria
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Quick Action Modal ── */}
            <AnimatePresence>
                {actionModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden"
                        >
                            {/* Modal Header */}
                            <div className={`p-6 text-white ${
                                actionModal.type === 'CREDIT' ? 'bg-gradient-to-r from-emerald-600 to-teal-700' :
                                actionModal.type === 'DEBIT' ? 'bg-gradient-to-r from-rose-600 to-red-700' :
                                actionModal.type === 'LOCK' ? 'bg-gradient-to-r from-purple-600 to-indigo-700' :
                                'bg-gradient-to-r from-cyan-600 to-blue-700'
                            }`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white">
                                            {actionModal.type === 'CREDIT' && <ArrowDownCircle size={22} />}
                                            {actionModal.type === 'DEBIT' && <ArrowUpCircle size={22} />}
                                            {actionModal.type === 'LOCK' && <Lock size={22} />}
                                            {(actionModal.type === 'FREEZE' || actionModal.type === 'UNFREEZE') && <Snowflake size={22} />}
                                        </div>
                                        <div>
                                            <h3 className="text-base font-black tracking-tight">
                                                {actionModal.type === 'CREDIT' && 'Quick Credit Funds'}
                                                {actionModal.type === 'DEBIT' && 'Quick Debit Funds'}
                                                {actionModal.type === 'LOCK' && 'Lock Wallet Balance'}
                                                {actionModal.type === 'FREEZE' && 'Freeze User Wallet'}
                                                {actionModal.type === 'UNFREEZE' && 'Unfreeze User Wallet'}
                                            </h3>
                                            <p className="text-[10px] text-white/80 font-bold uppercase tracking-widest mt-0.5">
                                                Instant Real-Time Balance Update
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleCloseModal}
                                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                {/* User Quick Summary Pill */}
                                <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between text-xs">
                                    <div>
                                        <p className="font-black text-white text-sm">{actionModal.user.name || actionModal.user.fullName}</p>
                                        <p className="text-[10px] text-white/80">{actionModal.user.mobile} {actionModal.user.partyCode ? `· ${actionModal.user.partyCode}` : ''}</p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[9px] uppercase tracking-wider text-white/80 font-bold">Current Bal</span>
                                        <p className="font-black text-white text-sm">{fmtINR(actionModal.user.balance)}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Form Body */}
                            <form onSubmit={handleExecuteAction} className="p-6 space-y-4">
                                {modalError && (
                                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-bold animate-in fade-in">
                                        <AlertTriangle size={15} className="shrink-0 text-rose-500" />
                                        <span>{modalError}</span>
                                    </div>
                                )}

                                {/* Amount Input (for Credit, Debit, Lock) */}
                                {['CREDIT', 'DEBIT', 'LOCK'].includes(actionModal.type) && (
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                            {actionModal.type === 'LOCK' ? 'Amount to Lock (₹)' : 'Transaction Amount (₹)'}
                                        </label>
                                        <div className="relative">
                                            <IndianRupee size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="number"
                                                step="any"
                                                min="0.01"
                                                required
                                                autoFocus
                                                value={modalAmount}
                                                onChange={e => setModalAmount(e.target.value)}
                                                placeholder="0.00"
                                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-base font-black text-slate-800 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                                            />
                                        </div>

                                        {/* Quick Amount Chips */}
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            {[100, 500, 1000, 2000, 5000].map(amt => (
                                                <button
                                                    key={amt}
                                                    type="button"
                                                    onClick={() => setModalAmount(String(amt))}
                                                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                                                >
                                                    +{amt}
                                                </button>
                                            ))}
                                            {actionModal.type === 'LOCK' && actionModal.user.availableBalance > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setModalAmount(String(actionModal.user.availableBalance))}
                                                    className="px-2.5 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-[10px] font-black transition-all cursor-pointer"
                                                >
                                                    Max Avail ({fmtINR(actionModal.user.availableBalance)})
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Category (for Credit/Debit) */}
                                {actionModal.type === 'CREDIT' && (
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Adjustment Category</label>
                                        <select
                                            value={modalCategory}
                                            onChange={e => setModalCategory(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-400"
                                        >
                                            <option value="ADMIN_TOPUP">Admin Top-up (Float Transfer)</option>
                                            <option value="AEPS_SETTLEMENT">AEPS Settlement Float</option>
                                            <option value="CASH_COLLECTION">Cash Collection Credit</option>
                                            <option value="REVERSAL">Transaction Reversal Refund</option>
                                            <option value="MANUAL_CORRECTION">Manual Ledger Correction</option>
                                        </select>
                                    </div>
                                )}

                                {actionModal.type === 'DEBIT' && (
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Debit Category</label>
                                        <select
                                            value={modalCategory}
                                            onChange={e => setModalCategory(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-400"
                                        >
                                            <option value="ADMIN_ADJUSTMENT">Admin Adjustment Debit</option>
                                            <option value="PENALTY">Compliance Penalty</option>
                                            <option value="RECOVERY">Disputed Recovery</option>
                                            <option value="REVERSAL">Correction Reversal</option>
                                        </select>
                                    </div>
                                )}

                                {actionModal.type === 'LOCK' && (
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Hold Reason</label>
                                        <select
                                            value={modalReason}
                                            onChange={e => setModalReason(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-400"
                                        >
                                            <option value="SECURITY_HOLD">Security Hold</option>
                                            <option value="DISPUTE">Chargeback / Dispute</option>
                                            <option value="COMPLIANCE_REVIEW">Compliance Review</option>
                                            <option value="FRAUD_ALERT">Risk / Fraud Alert</option>
                                        </select>
                                    </div>
                                )}

                                {/* Remark Input */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Remark / Narration</label>
                                    <input
                                        type="text"
                                        value={modalRemark}
                                        onChange={e => setModalRemark(e.target.value)}
                                        placeholder={
                                            actionModal.type === 'CREDIT' ? 'e.g. Authorized admin topup' :
                                            actionModal.type === 'DEBIT' ? 'e.g. Monthly float adjustment' :
                                            actionModal.type === 'LOCK' ? 'e.g. Held pending KYC verification' :
                                            'e.g. Cleared compliance review'
                                        }
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400 focus:bg-white transition-all"
                                    />
                                </div>

                                {/* Modal Actions */}
                                <div className="pt-2 flex items-center justify-end gap-2.5">
                                    <button
                                        type="button"
                                        onClick={handleCloseModal}
                                        className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={modalSubmitting}
                                        className={`px-5 py-2.5 text-xs font-black text-white rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 ${
                                            actionModal.type === 'CREDIT' ? 'bg-emerald-600 hover:bg-emerald-700' :
                                            actionModal.type === 'DEBIT' ? 'bg-rose-600 hover:bg-rose-700' :
                                            actionModal.type === 'LOCK' ? 'bg-purple-600 hover:bg-purple-700' :
                                            'bg-cyan-600 hover:bg-cyan-700'
                                        }`}
                                    >
                                        {modalSubmitting ? (
                                            <>
                                                <Loader2 size={14} className="animate-spin" />
                                                <span>Processing...</span>
                                            </>
                                        ) : (
                                            <>
                                                {actionModal.type === 'CREDIT' && <span>Confirm Credit</span>}
                                                {actionModal.type === 'DEBIT' && <span>Confirm Debit</span>}
                                                {actionModal.type === 'LOCK' && <span>Confirm Lock</span>}
                                                {actionModal.type === 'FREEZE' && <span>Confirm Freeze</span>}
                                                {actionModal.type === 'UNFREEZE' && <span>Restore Active</span>}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default WalletOverviewTab;