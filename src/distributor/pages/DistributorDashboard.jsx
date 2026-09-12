import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bell, ChevronRight, Send, Plus, ArrowUpRight, ArrowDownRight,
    Wallet, TrendingUp, Users, Activity, CheckCircle2, AlertCircle,
    MoreHorizontal, RefreshCcw, MapPin
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { sharedDataService } from '../../services/sharedDataService';
import { dataService } from '../../services/dataService';
import { getDistributorPlan, getRemainingRetailerSlots } from '../config/planConfig';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';

/* ─── Static demo data ──────────────────────────────────────── */
const financeData = [
    { date: '1 Feb', credit: 220, debit: 580 },
    { date: '2 Feb', credit: 450, debit: 340 },
    { date: '3 Feb', credit: 280, debit: 620 },
    { date: '4 Feb', credit: 780, debit: 178 },
    { date: '5 Feb', credit: 390, debit: 450 },
    { date: '6 Feb', credit: 860, debit: 300 },
    { date: '7 Feb', credit: 540, debit: 680 },
    { date: '8 Feb', credit: 920, debit: 240 },
];

const recentTxns = [
    { name: 'AEPS Withdrawal', type: 'AEPS', date: 'Feb 20, 2025', amount: '+₹4.00', up: true, color: '#6366f1' },
    { name: 'DMT Transfer', type: 'DMT', date: 'Feb 19, 2025', amount: '-₹12.50', up: false, color: '#10b981' },
    { name: 'BBPS Bill Pay', type: 'BBPS', date: 'Feb 18, 2025', amount: '+₹2.50', up: true, color: '#f59e0b' },
    { name: 'Wallet Top-up', type: 'Credit', date: 'Feb 17, 2025', amount: '+₹5000', up: true, color: '#3b82f6' },
    { name: 'CMS Collection', type: 'CMS', date: 'Feb 16, 2025', amount: '+₹7.00', up: true, color: '#a855f7' },
];

const quickContacts = [
    { name: 'Arun\nSharma', initials: 'AS', color: 'from-indigo-400 to-indigo-600' },
    { name: 'Priya\nSingh', initials: 'PS', color: 'from-rose-400 to-rose-600' },
    { name: 'Mohit\nVerma', initials: 'MV', color: 'from-emerald-400 to-emerald-600' },
    { name: 'Sunita\nPatel', initials: 'SP', color: 'from-amber-400 to-amber-600' },
];

/* ─── Custom chart tooltip ─────────────────────────────────── */
const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-[#1e293b] text-white rounded-xl px-4 py-3 shadow-2xl text-[10px] space-y-1 border border-white/10">
            <p className="font-black text-white/60 uppercase tracking-widest">{label}</p>
            {payload.map((p, i) => (
                <p key={i} className="font-black flex items-center gap-1.5" style={{ color: p.color }}>
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
                    {p.name === 'credit' ? 'Credit' : 'Debit'}: ₹{p.value.toLocaleString('en-IN')}
                </p>
            ))}
        </div>
    );
};

/* ─── Animated number ─────────────────────────────────────── */
const AnimNum = ({ n, prefix = '' }) => {
    const [v, setV] = useState(0);
    useEffect(() => {
        const target = typeof n === 'number' ? n : 0;
        const step = Math.max(1, Math.floor(target / 35));
        let cur = 0;
        const t = setInterval(() => {
            cur = Math.min(cur + step, target);
            setV(cur);
            if (cur >= target) clearInterval(t);
        }, 28);
        return () => clearInterval(t);
    }, [n]);
    return <>{prefix}{v.toLocaleString('en-IN')}</>;
};

/* ═══════════════════════ MAIN ═══════════════════════════════ */
const DistributorDashboard = () => {
    const navigate = useNavigate();
    const [dist, setDist] = useState(null);
    const [retailers, setRetailers] = useState([]);
    const [transferAmt, setTransferAmt] = useState('');
    const [selectedContact, setSelectedContact] = useState(null);

    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);

    const load = async () => {
        setLoading(true);
        const s = sharedDataService.getCurrentDistributor();
        if (!s) return;

        // Fetch real balance
        const userBal = await dataService.getWalletBalance(s.id);
        const fresh = { ...s, wallet: { balance: userBal } };
        setDist(fresh);

        // Fetch all users to find assigned retailers
        let allUsers = [];
        try {
            allUsers = await dataService.getAllUsers();
            if (!Array.isArray(allUsers)) allUsers = [];
        } catch {
            allUsers = dataService.getData().users || [];
        }

        const distId = String(fresh.id || fresh._id || fresh.userId || '').trim().toLowerCase();
        const distPartyCode = String(fresh.partyCode || fresh.userCode || '').trim().toUpperCase();
        const distMobile = String(fresh.mobile || fresh.phone || '').trim();
        const distUsername = String(fresh.username || '').trim().toLowerCase();
        const distName = String(fresh.name || fresh.fullName || '').trim().toLowerCase();
        const assignedList = (fresh.assignedRetailers || []).map(x => String(x || '').trim());
        const assignedSet = new Set(assignedList.map(x => x.toLowerCase()));

        const localUsers = dataService.getData().users || [];
        const cachedUsersRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('rupiksha_users_cache') : null;
        let cachedUsers = [];
        try { if (cachedUsersRaw) cachedUsers = JSON.parse(cachedUsersRaw); } catch {}

        const userMap = new Map();
        [...allUsers, ...localUsers, ...cachedUsers].forEach((u) => {
            if (!u) return;
            const key = String(u.id || u._id || u.username || u.mobile || u.partyCode || '');
            if (key && !userMap.has(key)) userMap.set(key, u);
        });

        const myRetailers = Array.from(userMap.values()).filter(r => {
            const rRole = String(r?.role || (r?.roles && r.roles[0]) || '').replace(/^ROLE_/i, '').toUpperCase();
            if (rRole !== 'RETAILER' && rRole !== 'RETAILERS') return false;

            const rId = String(r.id || r._id || r.userId || '').trim().toLowerCase();
            const rUsername = String(r.username || '').trim().toLowerCase();
            const rMobile = String(r.mobile || r.phone || '').trim();
            const rPartyCode = String(r.partyCode || r.userCode || '').trim().toUpperCase();

            const rParentId = String(r.parentUserId || r.ownerId || r.addedByUserRef || r.parent_id || r.parentId || '').trim().toLowerCase();
            const rParentPartyCode = String(r.parentPartyCode || r.addedByPartyCode || r.ownerPartyCode || '').trim().toUpperCase();
            const rParentName = String(r.parentName || r.addedByName || r.ownerName || '').trim().toLowerCase();
            const rParentMobile = String(r.parentMobile || r.ownerMobile || r.addedByMobile || '').trim();

            return (assignedSet.has(rUsername) || (rMobile && assignedSet.has(rMobile)) || (rPartyCode && assignedSet.has(rPartyCode.toLowerCase())) || (rId && assignedSet.has(rId))) ||
                (distId && (rParentId === distId || rParentId.includes(distId))) ||
                (distPartyCode && rParentPartyCode && rParentPartyCode === distPartyCode) ||
                (distMobile && (rParentMobile === distMobile || rParentId === distMobile.toLowerCase())) ||
                (distUsername && (rParentId === distUsername || rParentName === distUsername)) ||
                (distName && rParentName && (rParentName.includes(distName) || distName.includes(rParentName)));
        });
        setRetailers(myRetailers);

        // Fetch transactions for this distributor's network if needed
        const personalTxns = await dataService.getUserTransactions(s.id);
        setTransactions(personalTxns);
        setLoading(false);
    };

    useEffect(() => {
        load();
        window.addEventListener('distributorDataUpdated', load);
        return () => window.removeEventListener('distributorDataUpdated', load);
    }, []);

    const activeUsers = retailers.filter(r => r.status === 'Approved');
    const walletBal = dist?.wallet?.balance || '0.00';
    const distName = dist?.name || 'DISTRIBUTOR';
    const distId = dist?.id || 'DIST-0001';
    const planCfg = getDistributorPlan(dist);
    const maxR = planCfg.maxRetailers;
    const remainingSlots = getRemainingRetailerSlots(dist, retailers.length);
    const usagePct = maxR === Infinity ? 100 : Math.min(100, Math.round((retailers.length / maxR) * 100));

    const stats = [
        { label: 'Wallet Balance', val: walletBal, prefix: '₹', icon: Wallet, iconColor: 'var(--brand-color)', bg: 'var(--brand-color)' },
        { label: 'Commission', val: '0', prefix: '₹', icon: TrendingUp, iconColor: 'var(--brand-color)', bg: 'var(--brand-color)' },
        { label: 'Transactions', val: String(transactions.length), prefix: '', icon: Activity, iconColor: 'var(--brand-color)', bg: 'var(--brand-color)' },
        {
            label: maxR === Infinity ? 'Total Retailers' : `Retailers (${retailers.length}/${maxR})`,
            val: String(retailers.length || 0),
            prefix: '', icon: Users, iconColor: 'var(--brand-color)', bg: 'var(--brand-color)'
        },
    ];



    return (
        /* outer wrapper — light gray page bg */
        <div className="h-full overflow-y-auto bg-[#f8f9fb] font-['Inter',sans-serif]">
            <div className="max-w-[1400px] mx-auto p-6 md:p-8">

                {/* ── Page header ───────────────────────────────── */}
                <div className="flex items-center justify-between mb-7">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Dashboard</h1>
                        <span
                            className="inline-flex items-center gap-1.5 mt-1 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full text-white"
                            style={{ background: 'var(--brand-color)', color: 'black' }}
                        >
                            {planCfg.label}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="relative p-2 text-slate-500 hover:text-slate-800 transition-colors">
                            <Bell size={20} />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                        </button>
                        <button className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-[11px] font-black shadow-md shadow-amber-400/30">
                            {distName.charAt(0)}
                        </button>
                    </div>
                </div>

                {/* ── Two‑column grid ───────────────────────────── */}
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">

                    {/* ════════════ LEFT COLUMN ════════════ */}
                    <div className="space-y-6 min-w-0">

                        {/* Stat row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {stats.map((s, i) => (
                                <motion.div key={i}
                                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.07 }}
                                    whileHover={{ y: -2 }}
                                    className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 cursor-default hover:border-[var(--brand-color)] transition-all"
                                    style={{ backgroundColor: `rgba(var(--brand-color-rgb), 0.05)` }}
                                >
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${s.bg}15`, opacity: 0.8 }}>
                                        <s.icon size={17} style={{ color: 'black' }} />
                                    </div>
                                    <p className="text-xl font-black text-slate-900 leading-none">
                                        {s.prefix}{i === 0 ? walletBal : <AnimNum n={parseInt(s.val.replace(/,/g, ''))} />}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-400 mt-1.5 uppercase tracking-widest">{s.label}</p>
                                </motion.div>
                            ))}
                        </div>

                        {/* Finances chart */}
                        <motion.div
                            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.25 }}
                            className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 hover:border-[var(--brand-color)] transition-all"
                            style={{ backgroundColor: `rgba(var(--brand-color-rgb), 0.05)` }}
                        >
                            <div className="flex items-center justify-between mb-5">
                                <h2 className="text-base font-black text-slate-900">Finances</h2>
                                <div className="flex items-center gap-4 text-[10px] font-black">
                                    <span className="flex items-center gap-1.5 text-slate-500">
                                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                                        Credit
                                    </span>
                                    <span className="flex items-center gap-1.5 text-slate-500">
                                        <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" />
                                        Debit
                                    </span>
                                </div>
                            </div>
                            <ResponsiveContainer width="100%" height={220}>
                                <LineChart data={financeData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                                        axisLine={false} tickLine={false}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }}
                                        axisLine={false} tickLine={false}
                                        tickFormatter={v => `₹${v}`}
                                    />
                                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 2 }} />
                                    <Line
                                        type="monotone" dataKey="credit" stroke="#6366f1"
                                        strokeWidth={2.5} dot={false}
                                        activeDot={{ r: 5, fill: '#6366f1', strokeWidth: 0 }}
                                    />
                                    <Line
                                        type="monotone" dataKey="debit" stroke="#f87171"
                                        strokeWidth={2.5} dot={false} strokeDasharray="0"
                                        activeDot={{ r: 5, fill: '#f87171', strokeWidth: 0 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </motion.div>

                        {/* Transaction History */}
                        <motion.div
                            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:border-[var(--brand-color)] transition-all"
                            style={{ backgroundColor: `rgba(var(--brand-color-rgb), 0.03)` }}
                        >
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
                                <h2 className="text-base font-black text-slate-900">Transaction History</h2>
                                <button
                                    onClick={() => navigate('/distributor/transactions/distributor-receipt')}
                                    className="text-[10px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-widest flex items-center gap-1"
                                >
                                    View All <ChevronRight size={12} />
                                </button>
                            </div>

                            {/* Table header */}
                            <div className="grid grid-cols-[2fr_1fr_1.2fr_auto] gap-4 px-6 py-2.5 bg-slate-50 border-b border-slate-100">
                                {['Name', 'Type', 'Date', 'Amount'].map(h => (
                                    <p key={h} className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{h}</p>
                                ))}
                            </div>

                            {transactions.length > 0 ? transactions.slice(0, 8).map((t, i) => (
                                <motion.div key={i}
                                    whileHover={{ backgroundColor: '#f8faff' }}
                                    className="grid grid-cols-[2fr_1fr_1.2fr_auto] gap-4 items-center px-6 py-3.5 border-b border-slate-50 last:border-0 transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[9px] font-black shrink-0 shadow-sm bg-indigo-500">
                                            {t.service_type?.charAt(0) || 'T'}
                                        </div>
                                        <p className="text-xs font-black text-slate-800 truncate">{t.service_type}</p>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{t.status}</p>
                                    <p className="text-[10px] font-bold text-slate-400">{new Date(t.created_at).toLocaleDateString()}</p>
                                    <p className={`text-xs font-black text-right ${t.status === 'SUCCESS' ? 'text-emerald-600' : 'text-red-500'}`}>
                                        ₹{t.amount}
                                    </p>
                                </motion.div>
                            )) : (
                                <div className="py-10 text-center text-slate-300 text-[10px] font-black uppercase tracking-[0.25em]">No recent activity</div>
                            )}
                        </motion.div>
                    </div>

                    {/* ════════════ RIGHT COLUMN ════════════ */}
                    <div className="space-y-5">



                        {/* Managed Retailers */}
                        <motion.div
                            initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100"
                        >
                            <div className="flex items-center justify-between mb-5">
                                <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                                    <Activity size={18} className="text-emerald-500" />
                                    Live Retailers
                                </h2>
                                <button
                                    onClick={() => navigate('/distributor/retailers/details')}
                                    className="text-[10px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-widest flex items-center gap-1"
                                >
                                    ALL <ChevronRight size={12} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {retailers.length > 0 ? (
                                    retailers.slice(0, 4).map((r, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group">
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-100 to-indigo-50 border border-slate-100 flex items-center justify-center text-indigo-600 text-xs font-black shadow-sm">
                                                        {r.name?.charAt(0) || 'R'}
                                                    </div>
                                                    <span className="absolute -right-0.5 -bottom-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white shadow-sm" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-slate-800">{r.name || r.username}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-tight pt-0.5">
                                                        <MapPin size={10} className="text-slate-300" /> {r.city || 'Location N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className="text-[8px] font-black px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 uppercase tracking-tighter italic">
                                                        Active Today
                                                    </span>
                                                    <p className="text-[8px] font-bold text-slate-300">Logged in 2m ago</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="py-10 text-center space-y-3">
                                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto border border-slate-100">
                                            <Users size={20} className="text-slate-300" />
                                        </div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">No retailers found under your ID</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>

                        {/* Plan Status Card */}
                        <motion.div
                            initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.18 }}
                            className="rounded-2xl p-5 shadow-lg text-black relative overflow-hidden"
                            style={{ background: 'var(--brand-color)' }}
                        >
                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/5 rounded-full" />
                            <div className="absolute -right-2 bottom-2 w-16 h-16 bg-white/5 rounded-full" />
                            <div className="relative z-10">
                                <p className="text-[9px] font-black uppercase tracking-widest text-white/50 mb-1">Active Plan</p>
                                <h3 className="text-lg font-black text-white uppercase tracking-tight">{planCfg.label}</h3>

                                {/* Retailer usage bar */}
                                <div className="mt-4">
                                    <div className="flex justify-between items-center mb-1.5">
                                        <p className="text-[9px] font-black text-white/60 uppercase tracking-wider">Retailer IDs Used</p>
                                        <p className="text-[10px] font-black text-white">
                                            {retailers.length} / {maxR === Infinity ? '∞' : maxR}
                                        </p>
                                    </div>
                                    <div className="bg-white/10 rounded-full h-1.5 overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: maxR === Infinity ? '30%' : `${usagePct}%` }}
                                            transition={{ delay: 0.5, duration: 0.8, ease: 'easeOut' }}
                                            className="h-1.5 rounded-full bg-white/80"
                                        />
                                    </div>
                                    {maxR !== Infinity && remainingSlots <= 2 && remainingSlots > 0 && (
                                        <p className="text-[9px] font-black text-yellow-300 mt-1.5">⚠ Only {remainingSlots} slot{remainingSlots > 1 ? 's' : ''} left!</p>
                                    )}
                                    {maxR !== Infinity && remainingSlots === 0 && (
                                        <p className="text-[9px] font-black text-red-300 mt-1.5">✕ Retailer limit reached — Upgrade plan</p>
                                    )}
                                </div>

                                {/* Sub-distributor */}
                                {planCfg.features.subDistributors && (
                                    <div className="mt-3">
                                        <div className="flex justify-between items-center">
                                            <p className="text-[9px] font-black text-white/60 uppercase tracking-wider">Sub-Distributor IDs</p>
                                            <p className="text-[10px] font-black text-white">
                                                0 / {planCfg.maxSubDistributors === Infinity ? '∞' : planCfg.maxSubDistributors}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {planCfg.id !== 'premium' && (
                                    <button
                                        onClick={() => navigate('/distributor-plans')}
                                        className="mt-4 w-full bg-white/15 hover:bg-white/25 text-white text-[9px] font-black uppercase tracking-widest py-2 rounded-xl border border-white/20 transition-all"
                                    >
                                        ↑ Upgrade Plan
                                    </button>
                                )}
                            </div>
                        </motion.div>



                    </div>
                    {/* ════════════ END RIGHT COLUMN ════════════ */}
                </div>
            </div>
        </div>
    );
};

export default DistributorDashboard;
