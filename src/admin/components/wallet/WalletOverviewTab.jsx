import React, { useState, useEffect } from 'react';
import {
    Wallet, Lock, IndianRupee, Search, RefreshCcw, Snowflake,
    ArrowDownCircle, ArrowUpCircle, Clock, ShieldCheck, User, ExternalLink
} from 'lucide-react';
import { fmtINR, fetchAPI, WalletTabSkeleton } from './walletShared';

const WalletOverviewTab = ({ wallets = [], loading, onRefresh, onNavigate }) => {
    if (loading && wallets.length === 0) {
        return (
            <WalletTabSkeleton
                title="Wallet Overview"
                subtitle="Fetching global wallet float, locked escrows and system totals..."
            />
        );
    }

    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

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

    const enrichedWallets = wallets.map(w => {
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
                                placeholder="Search user, mobile, ID..."
                            />
                        </div>

                        {/* Role filter */}
                        <select
                            value={roleFilter}
                            onChange={e => setRoleFilter(e.target.value)}
                            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-600 outline-none focus:border-indigo-400"
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
                            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-600 outline-none focus:border-indigo-400"
                        >
                            <option value="ALL">All Status</option>
                            <option value="ACTIVE">Active Wallets</option>
                            <option value="FROZEN">Frozen Wallets</option>
                        </select>

                        {/* Refresh */}
                        <button
                            onClick={onRefresh}
                            title="Refresh data"
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
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
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-lg text-[9px] font-black uppercase">
                                                <Snowflake size={11} className="text-cyan-500" /> FROZEN
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[9px] font-black uppercase">
                                                <ShieldCheck size={11} className="text-emerald-500" /> ACTIVE
                                            </span>
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
                                                onClick={() => onNavigate && onNavigate('Wallet-Credit')}
                                                title="Credit funds to this user"
                                                className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-lg text-[10px] font-black transition-all flex items-center gap-1"
                                            >
                                                <ArrowDownCircle size={12} /> Credit
                                            </button>
                                            <button
                                                onClick={() => onNavigate && onNavigate('Wallet-Debit')}
                                                title="Debit funds from this user"
                                                className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white rounded-lg text-[10px] font-black transition-all flex items-center gap-1"
                                            >
                                                <ArrowUpCircle size={12} /> Debit
                                            </button>
                                            <button
                                                onClick={() => onNavigate && onNavigate(w.isFrozen ? 'Wallet-Freeze' : 'Wallet-Lock')}
                                                title={w.isFrozen ? 'Manage freeze state' : 'Lock funds'}
                                                className="px-2.5 py-1 bg-slate-100 text-slate-600 hover:bg-slate-800 hover:text-white rounded-lg text-[10px] font-black transition-all flex items-center gap-1"
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
        </div>
    );
};

export default WalletOverviewTab;
