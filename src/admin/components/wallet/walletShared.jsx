import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { BACKEND_URL } from '../../../services/dataService';
import {
    Search, ChevronDown, CheckCircle2, XCircle, Loader2, IndianRupee
} from 'lucide-react';

export const API = BACKEND_URL;

export const uuid = () => {
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
 */
export const fetchAPI = async (endpoint, opts = {}, explicitKey = undefined) => {
    const token = localStorage.getItem('rupiksha_admin_token') || localStorage.getItem('rupiksha_token');
    const isMutation = opts.method === 'POST' || opts.method === 'PUT';
    const idempotencyKey = explicitKey ?? (isMutation ? uuid() : undefined);

    const headers = {
        'Content-Type': 'application/json',
        ...(opts.headers || {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {})
    };
    try {
        const res = await fetch(`${API}${endpoint}`, {
            ...opts,
            headers,
        });
        return await res.json();
    } catch (e) {
        console.warn(`[fetchAPI] Request to ${endpoint} failed:`, e);
        return { success: false, error: e.message };
    }
};

/** Fire canvas-confetti celebration */
export const fireCelebration = () => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try {
        confetti({
            particleCount: 85,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#10b981', '#06b6d4', '#6366f1', '#f59e0b', '#ec4899'],
            ticks: 120,
            gravity: 1.2,
            scalar: 0.9,
            zIndex: 9999
        });
    } catch (_) {}
};

/** Helper: format Instant string to Indian date+time */
export const fmtDateTime = (isoStr) => {
    if (!isoStr) return '—';
    try {
        return new Date(isoStr).toLocaleString('en-IN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: true
        });
    } catch { return isoStr; }
};

/** Helper: format currency */
export const fmtINR = (val) => {
    const n = parseFloat(String(val || 0).replace(/,/g, '')) || 0;
    return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/** Helper: sanitize a CSV cell value against formula injection */
export const sanitizeCsvCell = (val) => {
    const s = val == null ? '' : String(val);
    if (/^[=+\-@\t\r]/.test(s)) return `'${s}`;
    return s;
};

/** Toast notification component */
export const Toast = ({ toast, onClose }) => {
    useEffect(() => {
        if (toast) {
            const t = setTimeout(onClose, 4000);
            return () => clearTimeout(t);
        }
    }, [toast, onClose]);

    if (!toast) return null;
    return (
        <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-5 right-5 z-[300] flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border ${
                toast.type === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-rose-600 border-rose-500 text-white'
            }`}
        >
            {toast.type === 'success' ? <CheckCircle2 size={20} className="shrink-0" /> : <XCircle size={20} className="shrink-0" />}
            <span className="text-sm font-bold tracking-wide">{toast.message}</span>
        </motion.div>
    );
};

/** Searchable User Selector component */
export const UserSelector = ({ users = [], value, onChange, placeholder, disabled = false, filterRole }) => {
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    let pool = users || [];
    if (filterRole) {
        pool = pool.filter(u => (u.role || '').toUpperCase() === filterRole.toUpperCase());
    }

    const selected = pool.find(u =>
        u.username === value || u.userId == value || u.id == value || u.mobile === value
    ) || (users || []).find(u => u.username === value || u.userId == value || u.id == value || u.mobile === value);

    const filtered = pool.filter(u => {
        const nameStr = (u.name || u.fullName || '').toLowerCase();
        const unameStr = (u.username || '').toLowerCase();
        const mobStr = String(u.mobile || u.phone || '');
        const pcodeStr = String(u.partyCode || '').toLowerCase();
        const q = search.trim().toLowerCase();
        return !q || nameStr.includes(q) || unameStr.includes(q) || mobStr.includes(q) || pcodeStr.includes(q);
    });

    const getRoleBadge = (role) => {
        const r = (role || 'RETAILER').toUpperCase();
        if (r.includes('SUPER')) return 'bg-purple-100 text-purple-700 border-purple-200';
        if (r.includes('DIST')) return 'bg-blue-100 text-blue-700 border-blue-200';
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    };

    return (
        <div className="relative user-selector-dropdown" ref={containerRef}>
            <button
                type="button"
                onClick={() => !disabled && setOpen(!open)}
                disabled={disabled}
                className={`w-full flex items-center justify-between px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm font-semibold text-slate-700 transition-all outline-none ${
                    disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-indigo-400 focus:border-indigo-500'
                }`}
            >
                {selected ? (
                    <div className="flex items-center gap-2.5 truncate">
                        <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-black shrink-0">
                            {(selected.name || selected.fullName || 'U').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-800 truncate">
                            {selected.name || selected.fullName}
                            <span className="text-slate-400 font-normal text-xs ml-1.5">
                                ({selected.mobile || selected.username})
                            </span>
                        </span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase border shrink-0 ${getRoleBadge(selected.role)}`}>
                            {selected.role || 'Member'}
                        </span>
                    </div>
                ) : (
                    <span className="text-slate-400">{placeholder || 'Choose a user...'}</span>
                )}
                <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {open && !disabled && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="absolute z-50 w-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden max-h-72 flex flex-col"
                    >
                        <div className="p-2.5 border-b border-slate-100 bg-slate-50">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    autoFocus
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-xl border border-slate-200 outline-none focus:border-indigo-400 font-medium"
                                    placeholder="Search by name, mobile, username or party code..."
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
                            {filtered.length === 0 ? (
                                <p className="text-center text-xs text-slate-400 py-8 font-semibold">No users matching search</p>
                            ) : (
                                filtered.map((u, i) => {
                                    const bal = parseFloat(String(u.balance ?? u.walletBalance ?? 0).replace(/,/g, '')) || 0;
                                    return (
                                        <button
                                            key={u.id || u.username || i}
                                            type="button"
                                            onClick={() => {
                                                onChange(u.username || u.id);
                                                setOpen(false);
                                                setSearch('');
                                            }}
                                            className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-indigo-50/70 transition-colors text-left cursor-pointer group"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-black shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                    {(u.name || u.fullName || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="truncate">
                                                    <p className="text-xs font-bold text-slate-800 truncate">{u.name || u.fullName || u.username}</p>
                                                    <p className="text-[10px] text-slate-400 truncate">
                                                        {u.mobile || u.username} · {u.partyCode ? `Code: ${u.partyCode} · ` : ''}
                                                        <span className="font-semibold text-slate-600">{u.role || 'Member'}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="text-xs font-black text-emerald-600">₹{bal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                                <p className="text-[9px] text-slate-400 uppercase tracking-wider">Balance</p>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

/**
 * WalletTabSkeleton - High-end shimmer loading skeleton with animated halo & spinner
 */
export const WalletTabSkeleton = ({ title = "Wallet Management", subtitle = "Fetching live balance escrow and user records..." }) => (
    <div className="max-w-5xl mx-auto space-y-3">
        {/* Banner Skeleton */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white px-5 py-3 shadow-sm border border-slate-800/60">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white/50">
                        <Loader2 size={18} className="animate-spin text-emerald-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-black tracking-wide uppercase text-white">{title}</span>
                            <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                Synchronizing
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">{subtitle}</p>
                    </div>
                </div>
                <div className="h-7 w-28 bg-white/10 rounded-xl animate-pulse hidden sm:block" />
            </div>
        </div>

        {/* Form / Content Card Skeleton */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="h-3.5 w-44 bg-slate-100 rounded-lg animate-pulse" />
                <div className="h-3.5 w-24 bg-slate-100 rounded-lg animate-pulse" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                    <div className="space-y-1">
                        <div className="h-2.5 w-28 bg-slate-100 rounded animate-pulse" />
                        <div className="h-9 bg-slate-50 border border-slate-100 rounded-xl animate-pulse" />
                    </div>
                    <div className="space-y-1">
                        <div className="h-2.5 w-20 bg-slate-100 rounded animate-pulse" />
                        <div className="h-9 bg-slate-50 border border-slate-100 rounded-xl animate-pulse" />
                    </div>
                </div>
                <div className="space-y-3">
                    <div className="space-y-1">
                        <div className="h-2.5 w-24 bg-slate-100 rounded animate-pulse" />
                        <div className="h-9 bg-slate-50 border border-slate-100 rounded-xl animate-pulse" />
                    </div>
                    <div className="pt-2">
                        <div className="h-9 bg-slate-100 rounded-xl animate-pulse" />
                    </div>
                </div>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2 text-slate-400 text-xs font-bold uppercase tracking-wider">
                <Loader2 size={14} className="animate-spin text-emerald-600" />
                <span>Loading live server data...</span>
            </div>
        </div>
    </div>
);
