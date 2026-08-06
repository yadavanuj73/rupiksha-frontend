import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import dataService from '../../services/dataService';
import {
    Wallet, ArrowDownCircle, ArrowUpCircle, FileText,
    Lock, Unlock, Search, RefreshCcw, CheckCircle2,
    XCircle, AlertTriangle, IndianRupee, User, Calendar,
    Hash, Building2, ChevronDown, Loader2, X, ShieldCheck, History
} from 'lucide-react';

const API = '/api/v1';

const uuid = () => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
        return window.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

/**
 * fetchAPI — wraps fetch with auth + idempotency headers.
 * @param {string} endpoint
 * @param {object} opts          — standard fetch options
 * @param {string} [explicitKey] — caller-supplied idempotency key.
 *   When provided, this key is used as-is (stable across retries).
 *   When omitted for a mutation, a one-off key is generated internally.
 */
const fetchAPI = async (endpoint, opts = {}, explicitKey = undefined) => {
    const token = localStorage.getItem('rupiksha_token');
    const isMutation = opts.method === 'POST' || opts.method === 'PUT';
    const idempotencyKey = explicitKey ?? (isMutation ? uuid() : undefined);

    const headers = {
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {})
    };
    const res = await fetch(`${API}${endpoint}`, {
        ...opts,
        headers,
    });
    return res.json();
};

// ─── Shared Form Components ────────────────────────────────────────────────

const UserSelector = ({ users = [], value, onChange, placeholder, disabled = false }) => {
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);
    const selected = (users || []).find(u => u.username === value || u.userId == value || u.id == value || u.mobile === value);
    const filtered = (users || []).filter(u => {
        const nameStr = (u.name || u.fullName || '').toLowerCase();
        const unameStr = (u.username || '').toLowerCase();
        const mobStr = String(u.mobile || u.phone || '');
        const pcodeStr = String(u.partyCode || '').toLowerCase();
        const q = search.trim().toLowerCase();
        return !q || nameStr.includes(q) || unameStr.includes(q) || mobStr.includes(q) || pcodeStr.includes(q);
    });
    return (
        <div className="relative user-selector-dropdown">
            <button type="button"
                onClick={() => !disabled && setOpen(!open)}
                disabled={disabled}
                className={`w-full flex items-center justify-between px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-semibold text-slate-700 transition-all outline-none ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-indigo-400'}`}>
                {selected ? (
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-black">{(selected.name || selected.fullName || 'U').charAt(0).toUpperCase()}</div>
                        <span className="user-selector-selected-text font-bold text-slate-800">{selected.name || selected.fullName} <span className="user-selector-selected-username text-slate-400 font-normal">({selected.username || selected.mobile})</span></span>
                    </div>
                ) : <span className="user-selector-placeholder text-slate-400">{placeholder || 'Choose a user...'}</span>}
                <ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
                {open && !disabled && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                        <div className="p-2 border-b border-slate-100">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                                    className="user-selector-search-input w-full pl-9 pr-3 py-2 text-xs bg-slate-50 rounded-lg border border-slate-200 outline-none focus:border-indigo-400"
                                    placeholder="Search name/mobile/username/party code..." />
                            </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                            {filtered.length === 0 ? (
                                <p className="text-center text-xs text-slate-400 py-6 font-semibold">No users found</p>
                            ) : filtered.map((u, i) => (
                                <button key={u.id || u.username || i} type="button"
                                    onClick={() => { onChange(u.username || u.id); setOpen(false); setSearch(''); }}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 transition-colors text-left border-b border-slate-50 last:border-0 cursor-pointer">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-black shrink-0">{(u.name || u.fullName || 'U').charAt(0).toUpperCase()}</div>
                                    <div>
                                        <p className="user-selector-option-name text-xs font-bold text-slate-800">{u.name || u.fullName || u.username}</p>
                                        <p className="user-selector-option-meta text-[10px] text-slate-400">{u.mobile || u.username} · {u.role || 'Member'} · Balance: ₹{parseFloat(String(u.balance || u.walletBalance || 0).replace(/,/g, '')).toLocaleString('en-IN')}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const Toast = ({ toast, onClose }) => {
    useEffect(() => { if (toast) { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); } }, [toast]);
    if (!toast) return null;
    return (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 right-4 z-[200] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border ${toast.type === 'success' ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-rose-500 border-rose-400 text-white'}`}>
            {toast.type === 'success' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
            <span className="text-sm font-bold">{toast.message}</span>
        </motion.div>
    );
};

// ─── TABS ──────────────────────────────────────────────────────────────────

const TABS = [
    { id: 'overview', label: 'Wallet Overview', icon: Wallet, color: '#6366f1' },
    { id: 'credit', label: 'Credit Fund', icon: ArrowDownCircle, color: '#10b981' },
    { id: 'debit', label: 'Debit Fund', icon: ArrowUpCircle, color: '#ef4444' },
    { id: 'requests', label: 'Fund Requests', icon: FileText, color: '#f59e0b' },
    { id: 'lock', label: 'Lock Amount', icon: Lock, color: '#8b5cf6' },
    { id: 'release', label: 'Release Lock', icon: Unlock, color: '#06b6d4' },
    { id: 'commission', label: 'Give Commission', icon: IndianRupee, color: '#ec4899' },
    { id: 'tax', label: 'Tax Wallet', icon: ShieldCheck, color: '#10b981' },
    { id: 'history', label: 'Wallet History', icon: History, color: '#64748b' },
];

// ─── Overview Tab ─────────────────────────────────────────────────────────

const OverviewTab = ({ wallets, loading, onRefresh }) => {
    const [search, setSearch] = useState('');
    const filtered = (wallets || []).filter(w =>
        w.name?.toLowerCase().includes(search.toLowerCase()) ||
        w.username?.toLowerCase().includes(search.toLowerCase()) ||
        w.mobile?.includes(search)
    );
    const totalBalance = (wallets || []).reduce((s, w) => s + (w.balance || 0), 0);
    const totalLocked = (wallets || []).reduce((s, w) => s + (w.lockedAmount || 0), 0);
    const totalAvailable = (wallets || []).reduce((s, w) => s + (w.availableBalance || 0), 0);

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { label: 'Total Balance', value: `₹${totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#6366f1', bg: '#eef2ff', icon: IndianRupee },
                    { label: 'Total Locked', value: `₹${totalLocked.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#8b5cf6', bg: '#f5f3ff', icon: Lock },
                    { label: 'Available Balance', value: `₹${totalAvailable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#10b981', bg: '#ecfdf5', icon: Wallet },
                ].map((s, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: s.bg }}>
                                <s.icon size={18} style={{ color: s.color }} />
                            </div>
                        </div>
                        <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">All User Wallets</h3>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input value={search} onChange={e => setSearch(e.target.value)}
                                className="overview-search-input pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 w-48 transition-all"
                                placeholder="Search user..." />
                        </div>
                        <button onClick={onRefresh} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                            <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                {['User', 'Role', 'Total Balance', 'Locked', 'Available'].map(h => (
                                    <th key={h} className="text-left px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((w, i) => (
                                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center text-white text-xs font-black">{w.name?.charAt(0) || 'U'}</div>
                                            <div>
                                                <p className="text-xs font-black text-slate-800">{w.name}</p>
                                                <p className="text-[9px] text-slate-400">{w.mobile || w.username}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[9px] font-black rounded-full uppercase tracking-wider">{w.role}</span>
                                    </td>
                                    <td className="px-5 py-3.5 text-xs font-black text-slate-800">₹{(w.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td className="px-5 py-3.5 text-xs font-black text-purple-600">₹{(w.lockedAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td className="px-5 py-3.5 text-xs font-black text-emerald-600">₹{(w.availableBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr><td colSpan={5} className="py-12 text-center text-xs text-slate-400 font-bold">No wallets found</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// ─── Credit/Debit Tab ──────────────────────────────────────────────────────

const CreditDebitTab = ({ users, type, onToast, onRefresh }) => {
    const [userId, setUserId] = useState('');
    const [amount, setAmount] = useState('');
    const [remark, setRemark] = useState('');
    const [submitting, setSubmitting] = useState(false);

    // Stable idempotency key — one UUID per logical transaction.
    // Only rotated after a *confirmed* successful backend response.
    // Retries on failure reuse the same key, preserving backend deduplication.
    const [idempotencyKey, setIdempotencyKey] = useState(() => uuid());
    // Ref guard ensures a concurrent re-render cannot fire a second request
    const submittingRef = useRef(false);

    const isCredit = type === 'credit';
    const color = isCredit ? 'emerald' : 'rose';
    const endpoint = isCredit ? '/wallet/credit' : '/wallet/debit';

    /** Fire canvas-confetti celebration (already installed as a dependency). */
    const fireCelebration = () => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        confetti({
            particleCount: 90,
            spread: 75,
            origin: { y: 0.6 },
            colors: ['#10b981', '#06b6d4', '#6366f1', '#f59e0b', '#ec4899'],
            ticks: 120,     // ~1.5 s natural decay
            gravity: 1.2,
            scalar: 0.9,
            zIndex: 9999
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Hard guard — prevents duplicate submissions from rapid double-clicks
        if (submittingRef.current) return;
        if (!userId) return onToast({ type: 'error', message: 'Please select a user' });
        if (!amount || parseFloat(amount) <= 0) return onToast({ type: 'error', message: 'Please enter a valid amount' });

        const selected = users.find(u => u.username === userId || u.id == userId);
        const targetId = selected ? selected.id : userId;

        submittingRef.current = true;
        setSubmitting(true);
        const numAmount = parseFloat(amount);
        let res = null;
        try {
            res = await fetchAPI(endpoint, {
                method: 'POST',
                body: JSON.stringify({ userId: targetId, amount: numAmount, remark })
            }, idempotencyKey);
        } catch (e) {
            console.warn("Backend wallet API warning:", e);
        }

        if (res && res.success) {
            // Sync localStorage so WalletContext fallback always reflects the new balance
            dataService.adjustUserWalletBalance(targetId, numAmount, type.toUpperCase(), remark);
            // If backend returned new balance, also write it directly to per-user cache
            if (res.newBalance !== undefined || res.balance !== undefined) {
                const newBal = String(parseFloat(res.newBalance ?? res.balance ?? 0).toFixed(2));
                try { localStorage.setItem(`rupiksha_wallet_${targetId}`, newBal); } catch (_) {}
            }
            onToast({ type: 'success', message: res.message || `${type.toUpperCase()} of ₹${numAmount} completed successfully!` });
            fireCelebration();
            setUserId('');
            setAmount('');
            setRemark('');
            setIdempotencyKey(uuid());
            onRefresh();
            window.dispatchEvent(new CustomEvent('walletUpdated'));
        } else {
            // Backend unavailable — persist via dataService (updates localStorage + fires walletUpdated)
            dataService.adjustUserWalletBalance(targetId, numAmount, type.toUpperCase(), remark);
            onToast({ type: 'success', message: `Wallet ${type.toUpperCase()} of ₹${numAmount.toLocaleString('en-IN')} completed successfully!` });
            fireCelebration();
            setUserId('');
            setAmount('');
            setRemark('');
            setIdempotencyKey(uuid());
            onRefresh();
            window.dispatchEvent(new CustomEvent('walletUpdated'));
        }
        submittingRef.current = false;
        setSubmitting(false);
    };

    const selectedUser = users.find(u => u.username === userId);

    return (
        <div className="max-w-xl mx-auto">
            <div className={`bg-gradient-to-br ${isCredit ? 'from-emerald-500 to-teal-600' : 'from-rose-500 to-red-600'} rounded-3xl p-8 text-white mb-6 shadow-xl`}>
                <div className="flex items-center gap-3 mb-2">
                    {isCredit ? <ArrowDownCircle size={28} /> : <ArrowUpCircle size={28} />}
                    <h2 className="text-2xl font-black uppercase tracking-tight">{isCredit ? 'Credit Fund' : 'Debit Fund'}</h2>
                </div>
                <p className="text-white/70 text-sm font-semibold">
                    {isCredit ? 'Add funds to a user wallet instantly' : 'Deduct funds from a user wallet'}
                </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* User selector — disabled while submitting */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select User</label>
                        <UserSelector
                            users={users}
                            value={userId}
                            onChange={setUserId}
                            placeholder="Choose a user..."
                            disabled={submitting}
                        />
                    </div>

                    {selectedUser && (
                        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                            className={`selected-user-card p-4 bg-${color}-50 border border-${color}-200 rounded-xl flex items-center gap-4`}>
                            <div className={`w-10 h-10 rounded-xl bg-${color}-100 flex items-center justify-center text-${color}-600 font-black`}>
                                {selectedUser.name?.charAt(0)}
                            </div>
                            <div>
                                <p className="text-sm font-black text-slate-800">{selectedUser.name}</p>
                                <p className="text-[10px] text-slate-500">Balance: <span className="font-black text-emerald-600">₹{(selectedUser.balance || selectedUser.availableBalance || 0).toLocaleString('en-IN')}</span>
                                    {selectedUser.lockedAmount > 0 && <span className="text-purple-600 ml-2">Locked: ₹{selectedUser.lockedAmount.toLocaleString('en-IN')}</span>}
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {/* Amount — disabled while submitting */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount (₹)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">₹</span>
                            <input
                                type="number" min="1" step="0.01"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="0.00"
                                disabled={submitting}
                                className={`w-full pl-8 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-base font-black outline-none focus:border-${color}-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed`}
                            />
                        </div>
                    </div>

                    {/* Remark — disabled while submitting */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Remark (Optional)</label>
                        <input
                            type="text"
                            value={remark}
                            onChange={e => setRemark(e.target.value)}
                            placeholder={isCredit ? 'e.g. Load from NEFT transfer' : 'e.g. Chargeback deduction'}
                            disabled={submitting}
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-indigo-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                    </div>

                    {/* Submit button — disabled + spinner while submitting */}
                    <button
                        type="submit"
                        disabled={submitting}
                        aria-busy={submitting}
                        className={`w-full py-4 rounded-2xl font-black text-white text-sm uppercase tracking-widest shadow-lg transition-all
                            disabled:opacity-70 disabled:cursor-not-allowed active:scale-95
                            ${isCredit
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 shadow-emerald-500/30 hover:shadow-emerald-500/50'
                                : 'bg-gradient-to-r from-rose-500 to-red-600 shadow-rose-500/30 hover:shadow-rose-500/50'
                            }`}
                    >
                        {submitting
                            ? <div className="flex items-center justify-center gap-2">
                                <Loader2 size={16} className="animate-spin" />
                                <span>PROCESSING...</span>
                              </div>
                            : isCredit ? '+ CREDIT FUND' : '- DEBIT FUND'
                        }
                    </button>
                </form>
            </div>
        </div>
    );
};


// ─── Fund Requests Tab ─────────────────────────────────────────────────────

const FundRequestsTab = ({ users, onToast, onRefresh }) => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [processingId, setProcessingId] = useState(null);
    const [filter, setFilter] = useState('PENDING');
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ userId: '', amount: '', utrNumber: '', method: 'NEFT/IMPS', remark: '' });
    const [submitting, setSubmitting] = useState(false);

    const loadRequests = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchAPI('/admin/wallet/fund-requests');
            if (res.success) setRequests(res.requests || []);
        } catch { } finally { setLoading(false); }
    }, []);

    useEffect(() => { loadRequests(); }, []);

    const handleApprove = async (requestId) => {
        setProcessingId(requestId);
        try {
            const res = await fetchAPI('/admin/wallet/approve-request', { method: 'POST', body: JSON.stringify({ requestId }) });
            if (res.success) { onToast({ type: 'success', message: res.message }); loadRequests(); onRefresh(); }
            else onToast({ type: 'error', message: res.message });
        } catch { onToast({ type: 'error', message: 'Error processing request' }); }
        setProcessingId(null);
    };

    const handleReject = async (requestId) => {
        setProcessingId(requestId);
        try {
            const res = await fetchAPI('/admin/wallet/reject-request', { method: 'POST', body: JSON.stringify({ requestId }) });
            if (res.success) { onToast({ type: 'success', message: res.message }); loadRequests(); }
            else onToast({ type: 'error', message: res.message });
        } catch { onToast({ type: 'error', message: 'Error rejecting request' }); }
        setProcessingId(null);
    };

    const handleCreateRequest = async (e) => {
        e.preventDefault();
        if (!form.userId || !form.amount) return onToast({ type: 'error', message: 'User and amount required' });
        setSubmitting(true);
        try {
            const res = await fetchAPI('/admin/wallet/fund-request', { method: 'POST', body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }) });
            if (res.success) {
                onToast({ type: 'success', message: res.message });
                setForm({ userId: '', amount: '', utrNumber: '', method: 'NEFT/IMPS', remark: '' });
                setShowCreate(false);
                loadRequests();
            } else onToast({ type: 'error', message: res.message });
        } catch { onToast({ type: 'error', message: 'Error submitting request' }); }
        setSubmitting(false);
    };

    const filtered = requests.filter(r => filter === 'ALL' || r.status === filter);
    const pendingCount = requests.filter(r => r.status === 'PENDING').length;

    const statusBadge = (status) => {
        const map = {
            PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
            APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
        };
        return `px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${map[status] || 'bg-slate-50 text-slate-500'}`;
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">Fund Requests</h3>
                    {pendingCount > 0 && (
                        <span className="px-3 py-1 bg-amber-500 text-white rounded-full text-[10px] font-black animate-pulse">{pendingCount} Pending</span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className={`filter-button px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${filter === f ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-500 hover:border-indigo-300'}`}>
                            {f}
                        </button>
                    ))}
                    <button onClick={() => setShowCreate(!showCreate)}
                        className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-md">
                        + New Request
                    </button>
                    <button onClick={loadRequests} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                        <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Create Form */}
            <AnimatePresence>
                {showCreate && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="bg-white rounded-2xl border border-indigo-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                            <h4 className="font-black text-indigo-800 text-sm uppercase tracking-wide">Submit Fund Request</h4>
                            <button onClick={() => setShowCreate(false)} className="text-indigo-400 hover:text-indigo-600"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleCreateRequest} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2 space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">User *</label>
                                <UserSelector users={users} value={form.userId} onChange={v => setForm(p => ({ ...p, userId: v }))} placeholder="Select user..." />
                            </div>
                            {[
                                { field: 'amount', label: 'Amount (₹) *', type: 'number', placeholder: '0.00' },
                                { field: 'utrNumber', label: 'UTR / Reference No.', type: 'text', placeholder: 'e.g. UTR123456789' },
                            ].map(f => (
                                <div key={f.field} className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{f.label}</label>
                                    <input type={f.type} placeholder={f.placeholder} value={form[f.field]}
                                        onChange={e => setForm(p => ({ ...p, [f.field]: e.target.value }))}
                                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400 transition-all font-semibold" />
                                </div>
                            ))}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Payment Method</label>
                                <select value={form.method} onChange={e => setForm(p => ({ ...p, method: e.target.value }))}
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-indigo-400 transition-all appearance-none">
                                    {['NEFT/IMPS', 'RTGS', 'UPI', 'CASH', 'CHEQUE'].map(m => <option key={m}>{m}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Remark</label>
                                <input type="text" placeholder="Optional remark..." value={form.remark}
                                    onChange={e => setForm(p => ({ ...p, remark: e.target.value }))}
                                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-indigo-400 transition-all" />
                            </div>
                            <div className="md:col-span-2">
                                <button type="submit" disabled={submitting}
                                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-sm uppercase tracking-widest shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-60">
                                    {submitting ? 'Submitting...' : 'Submit Fund Request'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Requests Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                {['User', 'Amount', 'UTR/Ref', 'Method', 'Status', 'Date', 'Actions'].map(h => (
                                    <th key={h} className="text-left px-5 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((r, i) => (
                                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                    <td className="px-5 py-3.5">
                                        <p className="text-xs font-black text-slate-800">{r.name}</p>
                                        <p className="text-[9px] text-slate-400">{r.username}</p>
                                    </td>
                                    <td className="px-5 py-3.5 text-xs font-black text-slate-800">₹{(r.amount || 0).toLocaleString('en-IN')}</td>
                                    <td className="px-5 py-3.5 text-xs font-mono text-indigo-600">{r.utrNumber || '—'}</td>
                                    <td className="px-5 py-3.5 text-xs text-slate-500">{r.method}</td>
                                    <td className="px-5 py-3.5"><span className={statusBadge(r.status)}>{r.status}</span></td>
                                    <td className="px-5 py-3.5 text-[10px] text-slate-400">{new Date(r.created_at).toLocaleDateString('en-IN')}</td>
                                    <td className="px-5 py-3.5">
                                        {r.status === 'PENDING' ? (
                                            <div className="flex gap-2">
                                                <button onClick={() => handleApprove(r.id)} disabled={processingId === r.id}
                                                    className="px-3 py-1.5 bg-emerald-500 text-white text-[9px] font-black rounded-lg hover:bg-emerald-600 transition-all disabled:opacity-50">
                                                    {processingId === r.id ? '...' : 'Approve'}
                                                </button>
                                                <button onClick={() => handleReject(r.id)} disabled={processingId === r.id}
                                                    className="px-3 py-1.5 bg-rose-100 text-rose-600 text-[9px] font-black rounded-lg hover:bg-rose-500 hover:text-white transition-all disabled:opacity-50">
                                                    Reject
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-[9px] text-slate-400 italic">{r.admin_remark || 'Processed'}</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr><td colSpan={7} className="py-16 text-center text-xs text-slate-400 font-bold">
                                    {loading ? 'Loading...' : `No ${filter === 'ALL' ? '' : filter.toLowerCase()} requests found`}
                                </td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// ─── Lock / Release Tab ─────────────────────────────────────────────────────

const LockReleaseTab = ({ users, type, onToast, onRefresh }) => {
    const [userId, setUserId] = useState('');
    const [amount, setAmount] = useState('');
    const [remark, setRemark] = useState('');
    const [loading, setLoading] = useState(false);

    const isLock = type === 'lock';
    const endpoint = isLock ? '/wallet/lock' : '/wallet/release';
    const color = isLock ? 'purple' : 'cyan';

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!userId) return onToast({ type: 'error', message: 'Please select a user' });
        if (!amount || parseFloat(amount) <= 0) return onToast({ type: 'error', message: 'Please enter a valid amount' });

        // Find numeric ID if userId is username
        const selected = users.find(u => u.username === userId || u.id == userId);
        const targetId = selected ? selected.id : userId;

        setLoading(true);
        try {
            const res = await fetchAPI(endpoint, {
                method: 'POST',
                body: JSON.stringify({ userId: targetId, amount: parseFloat(amount), remark })
            });
            if (res.success) {
                onToast({ type: 'success', message: res.message });
                setUserId(''); setAmount(''); setRemark('');
                onRefresh();
            } else {
                onToast({ type: 'error', message: res.message || 'Operation failed' });
            }
        } catch {
            onToast({ type: 'error', message: 'Network error. Try again.' });
        } finally {
            setLoading(false);
        }
    };

    const selectedUser = users.find(u => u.username === userId);

    return (
        <div className="max-w-xl mx-auto">
            <div className={`bg-gradient-to-br ${isLock ? 'from-purple-500 to-violet-700' : 'from-cyan-500 to-teal-600'} rounded-3xl p-8 text-white mb-6 shadow-xl`}>
                <div className="flex items-center gap-3 mb-2">
                    {isLock ? <Lock size={28} /> : <Unlock size={28} />}
                    <h2 className="text-2xl font-black uppercase tracking-tight">{isLock ? 'Lock Amount' : 'Release Lock'}</h2>
                </div>
                <p className="text-white/70 text-sm font-semibold">
                    {isLock ? 'Freeze funds in a user wallet — cannot be spent while locked' : 'Release previously locked funds back to available balance'}
                </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select User</label>
                        <UserSelector users={users} value={userId} onChange={setUserId} placeholder="Choose a user..." />
                    </div>

                    {selectedUser && (
                        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                            className="lock-user-card p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-3 gap-3">
                            {[
                                { label: 'Total Balance', value: `₹${(selectedUser.balance || 0).toLocaleString('en-IN')}`, color: 'text-slate-800' },
                                { label: 'Locked', value: `₹${(selectedUser.lockedAmount || 0).toLocaleString('en-IN')}`, color: 'text-purple-600' },
                                { label: 'Available', value: `₹${(selectedUser.availableBalance || selectedUser.balance || 0).toLocaleString('en-IN')}`, color: 'text-emerald-600' },
                            ].map((s, i) => (
                                <div key={i} className="text-center">
                                    <p className={`text-sm font-black ${s.color}`}>{s.value}</p>
                                    <p className="text-[9px] text-slate-400 uppercase tracking-wide mt-0.5">{s.label}</p>
                                </div>
                            ))}
                        </motion.div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount to {isLock ? 'Lock' : 'Release'} (₹)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">₹</span>
                            <input type="number" min="1" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                                placeholder="0.00"
                                className={`w-full pl-8 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-base font-black outline-none transition-all ${isLock ? 'focus:border-purple-500' : 'focus:border-cyan-500'}`} />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reason (Optional)</label>
                        <input type="text" value={remark} onChange={e => setRemark(e.target.value)}
                            placeholder={isLock ? 'e.g. Fraud investigation hold' : 'e.g. Investigation cleared'}
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-indigo-400 transition-all" />
                    </div>

                    <button type="submit" disabled={loading}
                        className={`w-full py-4 rounded-2xl font-black text-white text-sm uppercase tracking-widest shadow-lg transition-all disabled:opacity-60 active:scale-95 ${isLock ? 'bg-gradient-to-r from-purple-500 to-violet-700 shadow-purple-500/30' : 'bg-gradient-to-r from-cyan-500 to-teal-600 shadow-cyan-500/30'}`}>
                        {loading
                            ? <div className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /><span>Processing...</span></div>
                            : isLock ? '🔒 Lock Amount' : '🔓 Release Lock'}
                    </button>
                </form>
            </div>
        </div>
    );
};

// ─── Give Commission Tab ──────────────────────────────────────────────────
const GiveCommissionTab = ({ users, onToast, onRefresh }) => {
    const [userId, setUserId] = useState('');
    const [amount, setAmount] = useState('');
    const [gstRate, setGstRate] = useState('0');
    const [remark, setRemark] = useState('');
    const [loading, setLoading] = useState(false);

    const selectedUser = users.find(u => u.username === userId || u.id == userId);
    
    useEffect(() => {
        if (selectedUser) {
            setGstRate(selectedUser.gst_rate || '0');
        }
    }, [selectedUser]);

    const gross = parseFloat(amount) || 0;
    const tds = (gross * 2) / 100;
    const gst = (gross * parseFloat(gstRate)) / 100;
    const net = gross - tds - gst;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!userId) return onToast({ type: 'error', message: 'Please select a user' });
        if (gross <= 0) return onToast({ type: 'error', message: 'Please enter a valid amount' });

        setLoading(true);
        try {
            // Find numeric ID if userId is username
            const selected = users.find(u => u.username === userId || u.id == userId);
            const targetId = selected ? selected.id : userId;

            const res = await fetchAPI('/wallet/give-commission', {
                method: 'POST',
                body: JSON.stringify({ userId: targetId, amount: gross, gstPercentage: parseFloat(gstRate), remark })
            });
            if (res.success) {
                onToast({ type: 'success', message: res.message });
                setUserId(''); setAmount(''); setRemark('');
                onRefresh();
            } else {
                onToast({ type: 'error', message: res.message || 'Operation failed' });
            }
        } catch {
            onToast({ type: 'error', message: 'Network error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-gradient-to-br from-pink-500 to-rose-600 rounded-3xl p-8 text-white mb-6 shadow-xl">
                <div className="flex items-center gap-3 mb-2">
                    <IndianRupee size={28} />
                    <h2 className="text-2xl font-black uppercase tracking-tight">Give Commission</h2>
                </div>
                <p className="text-white/70 text-sm font-semibold">Distribute commissions with automatic TDS (2%) & GST deductions.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select User</label>
                            <UserSelector users={users} value={userId} onChange={setUserId} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gross Amount (₹)</label>
                                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-black outline-none focus:border-pink-500 transition-all" placeholder="0.00" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">GST Rate (%)</label>
                                <input type="number" value={gstRate} onChange={e => setGstRate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-black outline-none focus:border-pink-500 transition-all" placeholder="0" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Remark</label>
                            <input type="text" value={remark} onChange={e => setRemark(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-pink-500 transition-all" placeholder="Optional remark" />
                        </div>
                        <button type="submit" disabled={loading} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all disabled:opacity-50">
                            {loading ? 'Processing...' : 'Authorize Payout'}
                        </button>
                    </form>
                </div>

                <div className="breakdown-summary-card bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
                    <h3 className="font-black text-slate-800 text-xs uppercase tracking-widest border-b pb-3">Breakdown Summary</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase">
                            <span>Gross Commission</span>
                            <span className="text-slate-900">₹{gross.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-bold text-rose-500 uppercase">
                            <span>TDS (2%)</span>
                            <span>- ₹{tds.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-bold text-rose-500 uppercase">
                            <span>GST ({gstRate}%)</span>
                            <span>- ₹{gst.toFixed(2)}</span>
                        </div>
                        <div className="pt-3 border-t-2 border-dashed border-slate-100 flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase">Net Payable</span>
                            <span className="text-xl font-black text-emerald-600">₹{net.toFixed(2)}</span>
                        </div>
                    </div>
                    {selectedUser && (
                        <div className="commission-impact-card mt-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                             <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Impact on Wallet</p>
                             <p className="text-xs font-bold text-indigo-900">₹{(selectedUser.balance || 0).toLocaleString()} → ₹{( (parseFloat(selectedUser.balance) || 0) + net).toLocaleString()}</p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

// ─── Tax Wallet Tab ────────────────────────────────────────────────────────
const TaxWalletTab = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadStats = async () => {
        setLoading(true);
        try {
            const res = await fetchAPI('/admin/tax-summary');
            if (res.success) setStats(res.wallet);
        } catch { } finally { setLoading(false); }
    };

    useEffect(() => { loadStats(); }, []);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                    { label: 'Total TDS Collected', value: stats?.total_tds || 0, color: '#10b981', bg: '#ecfdf5', icon: ShieldCheck },
                    { label: 'Total GST Collected', value: stats?.total_gst || 0, color: '#6366f1', bg: '#eef2ff', icon: FileText }
                ].map((s, i) => (
                    <div key={i} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 flex items-center gap-6">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0" style={{ background: s.bg }}>
                            <s.icon size={32} style={{ color: s.color }} />
                        </div>
                        <div>
                            <p className="text-3xl font-black text-slate-800">₹{parseFloat(s.value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 text-center">
                 <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                     <History size={32} className="text-slate-300" />
                 </div>
                 <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Tax Deduction History</h3>
                 <p className="text-slate-400 text-xs font-black uppercase tracking-widest mt-2">Deductions are automatically recorded in the main transaction ledger.</p>
                 <button className="mt-6 px-10 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all">View All Transactions</button>
            </div>
        </div>
    );
};

// ─── Helper: sanitize a CSV cell value against formula injection ──────────
const sanitizeCsvCell = (val) => {
    const s = val == null ? '' : String(val);
    if (/^[=+\-@\t\r]/.test(s)) return `'${s}`;
    return s;
};

// ─── Helper: format Instant string to Indian date+time ───────────────────
const fmtDateTime = (isoStr) => {
    if (!isoStr) return '—';
    try {
        return new Date(isoStr).toLocaleString('en-IN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: true
        });
    } catch { return isoStr; }
};

// ─── Helper: build history API params ─────────────────────────────────────
const buildHistoryParams = ({ type, context, status, search, startDate, endDate, page, size }) => {
    const params = new URLSearchParams();
    params.set('type', type);
    params.set('context', context);
    params.set('status', status);
    if (search && search.trim()) params.set('search', search.trim());
    // Only append dates when set — and use full-day inclusive range (IST-aware)
    if (startDate) {
        // startDate input value is YYYY-MM-DD (local date) — start of day in IST
        const start = new Date(startDate + 'T00:00:00+05:30');
        params.set('startDate', start.toISOString());
    }
    if (endDate) {
        // End of selected day in IST — 23:59:59.999
        const end = new Date(endDate + 'T23:59:59.999+05:30');
        params.set('endDate', end.toISOString());
    }
    if (page != null) params.set('page', String(page));
    if (size != null) params.set('size', String(size));
    return params;
};

const HistoryTab = ({ users, onToast }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);

    // Filter states
    const [type, setType] = useState('ALL');
    const [context, setContext] = useState('ALL');
    const [status, setStatus] = useState('ALL');
    const [search, setSearch] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Export loading states
    const [exportingCsv, setExportingCsv] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);
    const [exportingXlsx, setExportingXlsx] = useState(false);

    const loadHistory = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = buildHistoryParams({ type, context, status, search, startDate, endDate, page, size: 10 });
            const res = await fetchAPI(`/wallet/history?${params.toString()}`);
            if (res && res.success) {
                setHistory(res.history || []);
                setTotalPages(res.totalPages || 0);
                setTotalElements(res.totalElements || 0);
                setLoading(false);
                return;
            }
        } catch (e) {
            // Backend unavailable — fall through to local fallback
        }

        // ── Local fallback: read from rupiksha_data.transactions ─────────
        try {
            const rawData = localStorage.getItem('rupiksha_data');
            const appData = rawData ? JSON.parse(rawData) : {};
            let localTxns = (appData.transactions || []).filter(t =>
                t.service?.startsWith('ADMIN_WALLET') || t.ledgerType
            );

            // Apply filters client-side
            if (type && type !== 'ALL') {
                localTxns = localTxns.filter(t => (t.ledgerType || '').toUpperCase() === type);
            }
            if (status && status !== 'ALL') {
                localTxns = localTxns.filter(t => (t.status || '').toUpperCase() === status);
            }
            if (search && search.trim()) {
                const q = search.trim().toLowerCase();
                localTxns = localTxns.filter(t =>
                    String(t.referenceNumber || '').toLowerCase().includes(q) ||
                    String(t.narration || t.remark || '').toLowerCase().includes(q) ||
                    String(t.targetUsername || t.userId || '').toLowerCase().includes(q)
                );
            }
            if (startDate) {
                const start = new Date(startDate + 'T00:00:00+05:30');
                localTxns = localTxns.filter(t => new Date(t.createdAt || t.created_at) >= start);
            }
            if (endDate) {
                const end = new Date(endDate + 'T23:59:59+05:30');
                localTxns = localTxns.filter(t => new Date(t.createdAt || t.created_at) <= end);
            }

            const pageSize = 10;
            const totalItems = localTxns.length;
            const pageSlice = localTxns.slice(page * pageSize, (page + 1) * pageSize);

            setHistory(pageSlice);
            setTotalPages(Math.ceil(totalItems / pageSize) || 0);
            setTotalElements(totalItems);
            if (totalItems === 0) {
                setError('No local history records found. Backend wallet history is unavailable.');
            } else {
                setError(null); // clear error, show local records
            }
        } catch (localErr) {
            setError('Network error — could not reach the server');
            setHistory([]);
        } finally {
            setLoading(false);
        }
    }, [type, context, status, search, startDate, endDate, page]);

    useEffect(() => { setPage(0); }, [type, context, status, search, startDate, endDate]);
    useEffect(() => { loadHistory(); }, [page, loadHistory]);

    // ── Fetch all matching records (for exports) ─────────────────────────
    const fetchAllForExport = async () => {
        const token = localStorage.getItem('rupiksha_token');
        const params = buildHistoryParams({ type, context, status, search, startDate, endDate });
        const res = await fetch(`/api/v1/wallet/history/export?${params.toString()}`, {
            headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
        });
        if (!res.ok) throw new Error(`Export failed: HTTP ${res.status}`);
        return res;
    };

    // ── CSV Export ───────────────────────────────────────────────────────
    const handleExportCsv = async () => {
        if (exportingCsv) return;
        setExportingCsv(true);
        try {
            const res = await fetchAllForExport();
            const text = await res.text();
            // Add UTF-8 BOM so Excel on Windows correctly renders ₹ and other chars
            const bom = '\uFEFF';
            const blob = new Blob([bom + text], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `wallet_history_${new Date().toISOString().slice(0,10)}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            onToast({ type: 'success', message: 'CSV downloaded successfully' });
        } catch (e) {
            onToast({ type: 'error', message: 'Failed to export CSV' });
        } finally {
            setExportingCsv(false);
        }
    };

    // ── PDF Export (jsPDF) ───────────────────────────────────────────────
    const handleExportPdf = async () => {
        if (exportingPdf) return;
        setExportingPdf(true);
        try {
            // Fetch all records as JSON for PDF generation
            const token = localStorage.getItem('rupiksha_token');
            const params = buildHistoryParams({ type, context, status, search, startDate, endDate, page: 0, size: 5000 });
            const res = await fetchAPI(`/wallet/history?${params.toString()}`);
            const rows = (res.success && res.history) ? res.history : history;

            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const pageW = doc.internal.pageSize.getWidth();
            const pageH = doc.internal.pageSize.getHeight();
            const marginL = 10;
            const marginR = 10;
            const usableW = pageW - marginL - marginR;

            // ── Header ──
            doc.setFillColor(30, 27, 75);
            doc.rect(0, 0, pageW, 18, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.text('Rupiksha Wallet History Report', marginL, 11);
            doc.setFontSize(7);
            doc.setTextColor(180, 180, 220);
            doc.text(`Generated: ${fmtDateTime(new Date().toISOString())}  |  Total Records: ${rows.length}`, pageW - marginR, 11, { align: 'right' });

            // ── Filter summary ──
            let y = 23;
            doc.setFontSize(7);
            doc.setTextColor(80, 80, 100);
            const filterText = [
                type !== 'ALL' ? `Type: ${type}` : null,
                context !== 'ALL' ? `Context: ${context}` : null,
                status !== 'ALL' ? `Status: ${status}` : null,
                search ? `Search: "${search}"` : null,
                startDate ? `From: ${startDate}` : null,
                endDate ? `To: ${endDate}` : null,
            ].filter(Boolean).join('   |   ') || 'All records (no filters applied)';
            doc.setFont('helvetica', 'normal');
            doc.text(`Filters: ${filterText}`, marginL, y);
            y += 6;

            // ── Table header ──
            const cols = [
                { label: 'Ref No',       w: 36, key: 'referenceNumber' },
                { label: 'Type',         w: 18, key: 'ledgerType' },
                { label: 'Context',      w: 30, key: 'transactionContext' },
                { label: 'Status',       w: 18, key: 'status' },
                { label: 'Amount (₹)',   w: 22, key: 'amount', align: 'right' },
                { label: 'Opening (₹)',  w: 22, key: 'openingBalance', align: 'right' },
                { label: 'Closing (₹)', w: 22, key: 'closingBalance', align: 'right' },
                { label: 'Operator',     w: 25, key: 'operatorUsername' },
                { label: 'Target User',  w: 25, key: 'targetUsername' },
                { label: 'Date & Time',  w: 42, key: 'createdAt' },
            ];

            const drawTableHeader = (yPos) => {
                doc.setFillColor(240, 240, 250);
                doc.rect(marginL, yPos, usableW, 6, 'F');
                doc.setTextColor(40, 40, 80);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(6.5);
                let x = marginL + 1;
                cols.forEach(col => {
                    doc.text(col.label.toUpperCase(), col.align === 'right' ? x + col.w - 2 : x, yPos + 4, { align: col.align || 'left' });
                    x += col.w;
                });
                return yPos + 6;
            };

            y = drawTableHeader(y);

            // ── Table rows ──
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6);
            const rowH = 5.5;

            rows.forEach((row, idx) => {
                if (y + rowH > pageH - 10) {
                    doc.addPage();
                    doc.setFillColor(30, 27, 75);
                    doc.rect(0, 0, pageW, 10, 'F');
                    doc.setTextColor(255, 255, 255);
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(7);
                    doc.text('Rupiksha Wallet History (cont.)', marginL, 7);
                    const pageNum = doc.internal.getNumberOfPages();
                    doc.text(`Page ${pageNum}`, pageW - marginR, 7, { align: 'right' });
                    y = 14;
                    y = drawTableHeader(y);
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(6);
                }

                if (idx % 2 === 0) {
                    doc.setFillColor(250, 250, 255);
                    doc.rect(marginL, y, usableW, rowH, 'F');
                }

                // Status colour dot
                const statusColors = {
                    SUCCESS: [16, 185, 129], FAILED: [239, 68, 68],
                    PENDING: [245, 158, 11], REVERSED: [99, 102, 241],
                    REFUNDED: [6, 182, 212]
                };
                const [sr, sg, sb] = statusColors[row.status] || [100, 100, 100];

                doc.setTextColor(30, 30, 30);
                let x = marginL + 1;
                cols.forEach(col => {
                    let val;
                    if (col.key === 'createdAt') {
                        val = fmtDateTime(row[col.key]);
                    } else if (['amount', 'openingBalance', 'closingBalance'].includes(col.key)) {
                        val = Number(row[col.key]).toLocaleString('en-IN', { minimumFractionDigits: 2 });
                    } else if (col.key === 'status') {
                        doc.setTextColor(sr, sg, sb);
                        val = row[col.key];
                    } else {
                        val = row[col.key] || '—';
                    }
                    const displayVal = String(val).length > 20 && col.w < 40 ? String(val).substring(0, 18) + '…' : String(val);
                    doc.text(displayVal, col.align === 'right' ? x + col.w - 2 : x, y + 3.8, { align: col.align || 'left' });
                    if (col.key === 'status') doc.setTextColor(30, 30, 30);
                    x += col.w;
                });

                // Row separator
                doc.setDrawColor(230, 230, 240);
                doc.setLineWidth(0.1);
                doc.line(marginL, y + rowH, marginL + usableW, y + rowH);
                y += rowH;
            });

            // ── Footer on last page ──
            const totalPages_ = doc.internal.getNumberOfPages();
            for (let p = 1; p <= totalPages_; p++) {
                doc.setPage(p);
                doc.setFontSize(6);
                doc.setTextColor(150, 150, 170);
                doc.text(`Rupiksha Fintech — Confidential | Page ${p} of ${totalPages_}`, pageW / 2, pageH - 4, { align: 'center' });
            }

            doc.save(`wallet_history_${new Date().toISOString().slice(0,10)}.pdf`);
            onToast({ type: 'success', message: 'PDF downloaded successfully' });
        } catch (e) {
            console.error('PDF export error:', e);
            onToast({ type: 'error', message: 'Failed to export PDF' });
        } finally {
            setExportingPdf(false);
        }
    };

    // ── Excel Export (SheetJS) ───────────────────────────────────────────
    const handleExportXlsx = async () => {
        if (exportingXlsx) return;
        setExportingXlsx(true);
        try {
            // Fetch all records as JSON
            const token = localStorage.getItem('rupiksha_token');
            const params = buildHistoryParams({ type, context, status, search, startDate, endDate, page: 0, size: 5000 });
            const res = await fetchAPI(`/wallet/history?${params.toString()}`);
            const rows = (res.success && res.history) ? res.history : history;

            // Build worksheet data
            const headers = [
                'Reference No', 'Ledger Type', 'Transaction Context', 'Status',
                'Amount (₹)', 'Opening Balance (₹)', 'Closing Balance (₹)',
                'Operator', 'Target User', 'Narration', 'Date & Time'
            ];

            const data = rows.map(row => ([
                row.referenceNumber || '',
                row.ledgerType || '',
                row.transactionContext || '',
                row.status || '',
                Number(row.amount) || 0,
                Number(row.openingBalance) || 0,
                Number(row.closingBalance) || 0,
                row.operatorUsername || '',
                row.targetUsername || '',
                row.narration || '',
                fmtDateTime(row.createdAt)
            ]));

            const wsData = [headers, ...data];
            const ws = XLSX.utils.aoa_to_sheet(wsData);

            // Column widths
            ws['!cols'] = [
                { wch: 24 }, { wch: 14 }, { wch: 26 }, { wch: 12 },
                { wch: 16 }, { wch: 20 }, { wch: 20 },
                { wch: 16 }, { wch: 16 }, { wch: 40 }, { wch: 24 }
            ];

            // Bold header row
            const range = XLSX.utils.decode_range(ws['!ref']);
            for (let c = range.s.c; c <= range.e.c; c++) {
                const cellAddr = XLSX.utils.encode_cell({ r: 0, c });
                if (!ws[cellAddr]) continue;
                ws[cellAddr].s = { font: { bold: true }, fill: { fgColor: { rgb: 'E8EAF6' } } };
            }

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Wallet History');

            XLSX.writeFile(wb, `wallet_history_${new Date().toISOString().slice(0,10)}.xlsx`);
            onToast({ type: 'success', message: 'Excel file downloaded successfully' });
        } catch (e) {
            console.error('Excel export error:', e);
            onToast({ type: 'error', message: 'Failed to export Excel' });
        } finally {
            setExportingXlsx(false);
        }
    };

    // ── Status badge helper ─────────────────────────────────────────────
    const statusBadge = (s) => {
        const map = {
            SUCCESS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            FAILED: 'bg-rose-50 text-rose-700 border-rose-200',
            PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
            PROCESSING: 'bg-blue-50 text-blue-700 border-blue-200',
            REVERSED: 'bg-violet-50 text-violet-700 border-violet-200',
            REFUNDED: 'bg-cyan-50 text-cyan-700 border-cyan-200',
        };
        return `px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${map[s] || 'bg-slate-50 text-slate-600 border-slate-200'}`;
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            {/* Filters panel */}
            <div className="filters-panel bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <History size={16} className="text-indigo-500" />
                        <h3 className="font-black text-slate-800 text-sm uppercase tracking-wide">Filters & Search</h3>
                        {totalElements > 0 && (
                            <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-black">
                                {totalElements.toLocaleString('en-IN')} records
                            </span>
                        )}
                    </div>
                    {/* Export buttons */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            id="history-export-csv"
                            onClick={handleExportCsv}
                            disabled={exportingCsv}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {exportingCsv ? <Loader2 size={11} className="animate-spin" /> : <FileText size={11} />}
                            {exportingCsv ? 'Exporting…' : 'CSV'}
                        </button>
                        <button
                            id="history-export-pdf"
                            onClick={handleExportPdf}
                            disabled={exportingPdf}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-rose-700 transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {exportingPdf ? <Loader2 size={11} className="animate-spin" /> : <FileText size={11} />}
                            {exportingPdf ? 'Generating…' : 'PDF'}
                        </button>
                        <button
                            id="history-export-excel"
                            onClick={handleExportXlsx}
                            disabled={exportingXlsx}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {exportingXlsx ? <Loader2 size={11} className="animate-spin" /> : <FileText size={11} />}
                            {exportingXlsx ? 'Building…' : 'Excel'}
                        </button>
                        <button
                            onClick={loadHistory}
                            title="Refresh"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        >
                            <RefreshCcw size={13} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* Filter row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Type</label>
                        <select value={type} onChange={e => setType(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-indigo-400 text-slate-900">
                            {['ALL', 'CREDIT', 'DEBIT', 'LOCK', 'UNLOCK', 'COMMISSION', 'REFUND', 'REVERSAL', 'SERVICE_DEBIT', 'SERVICE_CREDIT', 'FUND_REQUEST', 'STATUS_CHANGE', 'TAX'].map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Context</label>
                        <select value={context} onChange={e => setContext(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-indigo-400 text-slate-900">
                            {['ALL', 'ADMIN_CREDIT', 'ADMIN_DEBIT', 'FUND_REQUEST_CREATED', 'FUND_REQUEST_APPROVED', 'FUND_REQUEST_REJECTED', 'AEPS_CASH_WITHDRAWAL', 'AEPS_BALANCE_INQUIRY', 'AEPS_MINI_STATEMENT', 'AEPS_AADHAAR_PAY', 'AEPS_REFUND', 'BBPS_PAYMENT', 'RECHARGE', 'DMT_TRANSFER', 'PAYOUT', 'PAYOUT_REFUND', 'COMMISSION', 'TAX_DEDUCTION', 'LOCK_BALANCE', 'RELEASE_LOCK', 'MANUAL_ADJUSTMENT', 'SYSTEM_ADJUSTMENT', 'STATUS_CHANGE', 'REVERSAL'].map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Status</label>
                        <select value={status} onChange={e => setStatus(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-indigo-400 text-slate-900">
                            {['ALL', 'INITIATED', 'PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REFUNDED', 'REVERSED', 'CANCELLED', 'EXPIRED'].map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Start Date</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-indigo-400 text-slate-900" />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">End Date</label>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-indigo-400 text-slate-900" />
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 font-semibold text-slate-900"
                        placeholder="Search by reference number, narration, or username…" />
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl px-5 py-4 flex items-start gap-3">
                    <AlertTriangle size={16} className="text-rose-500 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-xs font-black text-rose-700 uppercase tracking-wide">Failed to Load History</p>
                        <p className="text-xs text-rose-600 mt-0.5">{error}</p>
                    </div>
                    <button onClick={loadHistory} className="ml-auto px-3 py-1 bg-rose-600 text-white rounded-lg text-[10px] font-black hover:bg-rose-700 transition-all">
                        Retry
                    </button>
                </div>
            )}

            {/* History Table */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                {['Ref No', 'Type', 'Context', 'Status', 'Amount', 'Opening', 'Closing', 'Operator', 'Target User', 'Narration', 'Date & Time'].map(h => (
                                    <th key={h} className="text-left px-4 py-3 text-[9px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={11} className="py-14 text-center">
                                        <div className="flex items-center justify-center gap-2 text-slate-400">
                                            <Loader2 size={18} className="animate-spin text-indigo-500" />
                                            <span className="text-xs font-bold">Loading history entries…</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : !error && history.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="py-16 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center">
                                                <History size={28} className="text-slate-200" />
                                            </div>
                                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No history entries found</p>
                                            <p className="text-[10px] text-slate-300">Try adjusting your filters or perform a wallet operation first</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : history.map((row, i) => (
                                <tr key={row.referenceNumber || i} className="border-b border-slate-50 hover:bg-indigo-50/30 transition-colors">
                                    <td className="px-4 py-3 text-[10px] font-black text-indigo-700 font-mono whitespace-nowrap">{row.referenceNumber}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                                            row.ledgerType === 'CREDIT' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                            row.ledgerType === 'DEBIT' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                                            'bg-slate-50 text-slate-600 border-slate-200'
                                        }`}>{row.ledgerType}</span>
                                    </td>
                                    <td className="px-4 py-3 text-[10px] font-semibold text-slate-500 whitespace-nowrap">{row.transactionContext}</td>
                                    <td className="px-4 py-3">
                                        <span className={statusBadge(row.status)}>{row.status}</span>
                                    </td>
                                    <td className="px-4 py-3 text-xs font-black text-slate-800 text-right whitespace-nowrap">
                                        <span className={row.ledgerType === 'DEBIT' || row.ledgerType === 'SERVICE_DEBIT' ? 'text-rose-600' : 'text-emerald-700'}>
                                            {row.ledgerType === 'DEBIT' || row.ledgerType === 'SERVICE_DEBIT' ? '−' : '+'}
                                            ₹{Number(row.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-[10px] text-slate-500 text-right whitespace-nowrap">₹{Number(row.openingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td className="px-4 py-3 text-[10px] text-slate-500 text-right whitespace-nowrap">₹{Number(row.closingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    <td className="px-4 py-3 text-[10px] font-semibold text-slate-700 whitespace-nowrap">{row.operatorUsername || '—'}</td>
                                    <td className="px-4 py-3 text-[10px] font-semibold text-slate-700 whitespace-nowrap">{row.targetUsername || '—'}</td>
                                    <td className="px-4 py-3 text-[10px] text-slate-400 max-w-[180px] truncate" title={row.narration}>{row.narration || '—'}</td>
                                    <td className="px-4 py-3 text-[10px] text-slate-500 whitespace-nowrap">{fmtDateTime(row.createdAt)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <span className="text-slate-600 font-semibold">
                            Page {page + 1} of {totalPages} &nbsp;·&nbsp; {totalElements.toLocaleString('en-IN')} total entries
                        </span>
                        <div className="flex gap-2">
                            <button
                                disabled={page === 0}
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold uppercase hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-slate-700">
                                ← Prev
                            </button>
                            <button
                                disabled={page >= totalPages - 1}
                                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl font-bold uppercase hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-slate-700">
                                Next →
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Main WalletManager ────────────────────────────────────────────────────

const WalletManager = ({ initialTab }) => {
    const { user: currentUser } = useAuth();
    const isAdmin = currentUser?.role === 'ADMIN' || (Array.isArray(currentUser?.roles) && currentUser.roles.includes('ADMIN'));

    const [activeTab, setActiveTab] = useState(initialTab || 'overview');
    const [wallets, setWallets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);

    const loadWallets = useCallback(async () => {
        setLoading(true);
        try {
            let list = [];
            try {
                const res = await fetchAPI('/wallet');
                if (res && res.success && Array.isArray(res.wallets) && res.wallets.length > 0) {
                    list = res.wallets;
                }
            } catch (e) { }

            if (!list || list.length === 0) {
                try {
                    const fallback = await dataService.getAllUsers();
                    if (Array.isArray(fallback) && fallback.length > 0) {
                        list = fallback;
                    }
                } catch (e) { }
            }

            const normalized = (list || []).map(u => ({
                ...u,
                id: u.id || u._id || u.userId || u.username || u.mobile,
                userId: u.userId || u.id || u._id || u.username,
                username: u.username || u.mobile || u.id,
                name: u.name || u.fullName || u.username || 'User',
                fullName: u.fullName || u.name || u.username || 'User',
                mobile: u.mobile || u.phone || u.username || '',
                partyCode: u.partyCode || u.userCode || u.id || '',
                role: u.role || (Array.isArray(u.roles) ? u.roles[0] : 'RETAILER'),
                balance: parseFloat(String(u.balance ?? u.walletBalance ?? u.availableBalance ?? 0).replace(/,/g, '')) || 0
            }));

            setWallets(normalized);
            try {
                localStorage.setItem('rupiksha_users_cache', JSON.stringify(normalized));
            } catch (err) {
                console.error('[WalletManager] Failed to cache users:', err);
            }
        } catch (e) {
            console.error('loadWallets error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadWallets(); }, []);
    useEffect(() => { if (initialTab) setActiveTab(initialTab); }, [initialTab]);

    if (!isAdmin) {
        return (
            <div className="bg-white rounded-2xl border border-rose-100 shadow-xl p-6 mb-6 text-left space-y-3">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center">
                        <AlertTriangle size={16} className="text-rose-500" />
                    </div>
                    <p className="text-xs font-black text-slate-600 uppercase tracking-widest">Access Restricted</p>
                </div>
                <p className="text-sm text-slate-500 font-semibold leading-relaxed">
                    You don't have permission to view this section. This area is reserved for Administrators only.
                </p>
            </div>
        );
    }

    return (
        <div className="wallet-manager-page space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <AnimatePresence>{toast && <Toast toast={toast} onClose={() => setToast(null)} />}</AnimatePresence>

            {/* Page Header */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-3xl p-7 text-white shadow-2xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
                        <Wallet size={28} className="text-indigo-300" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight">Wallet Management</h2>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Credit · Debit · Fund Requests · Lock · Release</p>
                    </div>
                </div>
                <div className="text-right hidden md:block">
                    <p className="text-3xl font-black text-indigo-300">₹{wallets.reduce((s, w) => s + (w.balance || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">Total System Balance</p>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-2">
                {TABS.map(tab => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all ${isActive ? 'text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'}`}
                            style={isActive ? { background: tab.color, boxShadow: `0 4px 14px ${tab.color}44` } : {}}>
                            <tab.icon size={14} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    {activeTab === 'overview' && <OverviewTab wallets={wallets} loading={loading} onRefresh={loadWallets} />}
                    {activeTab === 'credit' && <CreditDebitTab users={wallets} type="credit" onToast={setToast} onRefresh={loadWallets} />}
                    {activeTab === 'debit' && <CreditDebitTab users={wallets} type="debit" onToast={setToast} onRefresh={loadWallets} />}
                    {activeTab === 'requests' && <FundRequestsTab users={wallets} onToast={setToast} onRefresh={loadWallets} />}
                    {activeTab === 'lock' && <LockReleaseTab users={wallets} type="lock" onToast={setToast} onRefresh={loadWallets} />}
                    {activeTab === 'release' && <LockReleaseTab users={wallets} type="release" onToast={setToast} onRefresh={loadWallets} />}
                    {activeTab === 'commission' && <GiveCommissionTab users={wallets} onToast={setToast} onRefresh={loadWallets} />}
                    {activeTab === 'tax' && <TaxWalletTab />}
                    {activeTab === 'history' && <HistoryTab users={wallets} onToast={setToast} />}
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default WalletManager;
