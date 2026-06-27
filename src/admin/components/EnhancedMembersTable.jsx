import React, { useState, useEffect } from 'react';
import {
    Search, Zap, Trash2, Edit3, Eye, X, CheckCircle2,
    AlertTriangle, Lock, User, Loader2, Save, ToggleRight, ToggleLeft, Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const _bDefault = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://rupiksha-backend-java.onrender.com/api/v1'
    : '/api/v1';
const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || _bDefault).replace(/\/$/, '');
const getToken = () => localStorage.getItem('rupiksha_token');

async function authFetch(url, options = {}) {
    const token = getToken();
    const headers = { ...(options.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    const res = await fetch(url, { ...options, headers });
    return res;
}

/* ─── helpers ─── */
const roleBadgeOf = (roles = []) =>
    roles.includes('ADMIN')
        ? { bg: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Admin' }
        : roles.includes('SUPER_DISTRIBUTOR')
        ? { bg: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Super Dist.' }
        : roles.includes('DISTRIBUTOR')
        ? { bg: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Distributor' }
        : { bg: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Retailer' };

const fmtWallet = (v) => {
    const n = parseFloat(String(v || 0).replace(/,/g, ''));
    return isNaN(n) ? '₹0.00' : '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDateOnly = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtTime = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

const fmtDateTime = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

const RolePill = ({ roles = [] }) => {
    const { bg, label } = roleBadgeOf(roles);
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black border uppercase tracking-wider whitespace-nowrap ${bg}`}>
            {label}
        </span>
    );
};

const serviceLabels = {
    AEPS: 'AEPS', BBPS: 'BBPS', RECHARGE: 'Recharge',
    PAYOUT: 'Payout', WALLET_TRANSFER: 'Wallet Transfer', TICKET_SUPPORT: 'Ticket Support'
};

/* ─── main component ─── */
const EnhancedMembersTable = () => {
    const [members, setMembers]             = useState([]);
    const [loading, setLoading]             = useState(true);
    const [search, setSearch]               = useState('');
    const [roleFilter, setRoleFilter]       = useState('ALL');
    const [page, setPage]                   = useState(0);
    const [selectedMember, setSelectedMember] = useState(null);
    const [showDetailModal, setShowDetailModal]   = useState(false);
    const [showServiceModal, setShowServiceModal] = useState(false);
    const [showEditModal, setShowEditModal]       = useState(false);
    const [editForm, setEditForm]           = useState({});
    const [editSaving, setEditSaving]       = useState(false);
    const [memberServices, setMemberServices] = useState([]);
    const [actionLoading, setActionLoading] = useState(false);
    const [showPassword, setShowPassword]   = useState(false);
    const [toast, setToast]                 = useState(null);

    const PAGE_SIZE = 10;

    /* ── data fetching ── */
    const fetchMembers = async () => {
        setLoading(true);
        try {
            const res = await authFetch(`${BACKEND_URL}/admin/users`);
            if (res.ok) {
                const data = await res.json();
                const list = (data.users || data.content || []).filter(u => {
                    const s = (u.status || '').toUpperCase();
                    return s === 'APPROVED' || s === 'ACTIVE';
                });
                setMembers(list);
            }
        } catch (err) { console.error('fetchMembers:', err); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        fetchMembers();
        const h = () => fetchMembers();
        window.addEventListener('membersUpdated', h);
        const t = setInterval(fetchMembers, 30000);
        return () => { window.removeEventListener('membersUpdated', h); clearInterval(t); };
    }, []);

    useEffect(() => { setPage(0); }, [search, roleFilter]);

    /* ── service fetch / toggle ── */
    const fetchMemberServices = async (userId) => {
        try {
            const res = await authFetch(`${BACKEND_URL}/admin/members/${userId}/services`);
            if (res.ok) { const d = await res.json(); setMemberServices(Array.isArray(d) ? d : []); }
        } catch (e) { console.error(e); }
    };

    const toggleService = async (userId, serviceType, enable) => {
        setActionLoading(true);
        try {
            const res = await authFetch(`${BACKEND_URL}/admin/members/${userId}/services/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serviceType, enable, remarks: `Service ${enable ? 'enabled' : 'disabled'} by admin` })
            });
            if (res.ok) await fetchMemberServices(userId);
        } catch (e) { console.error(e); }
        finally { setActionLoading(false); }
    };

    /* ── action handlers ── */
    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleViewDetail = async (member) => {
        const found = members.find(m => m.id === member.id || m._id === member.id);
        if (found) { setSelectedMember(found); setShowDetailModal(true); setShowPassword(false); }
    };

    const handleViewServices = async (member) => {
        setSelectedMember(member);
        await fetchMemberServices(member.id);
        setShowServiceModal(true);
    };

    const handleLoginAsMember = async (member) => {
        if (!window.confirm(`Login as ${member.fullName || member.username}? This will open their portal in a new tab.`)) return;
        try {
            const res = await authFetch(`${BACKEND_URL}/admin/impersonate/${member.id}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }
            });
            if (res.status === 401) { showToast('Session expired — please log in again', 'error'); return; }
            const text = await res.text();
            let data = {};
            try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
            if (!res.ok) { showToast(`Impersonation failed: ${data.message || data.error || `Server error ${res.status}`}`, 'error'); return; }
            const token = data.accessToken || data.token;
            if (!token) { showToast(`No token in response`, 'error'); return; }
            const normalizeRole = r => typeof r === 'string'
                ? r.trim().replace(/^ROLE_/i, '').toUpperCase()
                : (r?.name ? String(r.name).trim().replace(/^ROLE_/i, '').toUpperCase() : '');
            const rawRoles = Array.isArray(data.roles) ? data.roles : [data.role].filter(Boolean);
            const normalizedRoles = rawRoles.map(normalizeRole).filter(Boolean);
            const role = normalizedRoles[0] || 'RETAILER';
            const portalPath = role === 'DISTRIBUTOR' ? '/distributor' : role === 'SUPER_DISTRIBUTOR' ? '/super-distributor' : '/dashboard';
            const impersonatedUser = {
                id: data.userId, username: data.username, mobile: data.mobile,
                fullName: data.fullName, name: data.fullName,
                roles: normalizedRoles, role,
                kycStatus: data.kycStatus || 'NOT_SUBMITTED',
                status: data.status || 'ACTIVE', impersonated: true
            };
            const key = `_imp_${Date.now()}`;
            localStorage.setItem(key, JSON.stringify({ token, user: impersonatedUser }));
            await new Promise(r => setTimeout(r, 500));
            window.open(`${window.location.origin}${portalPath}?_imp=${encodeURIComponent(key)}`, '_blank');
            showToast(`Opened portal as ${data.fullName || data.username}`);
        } catch (e) { showToast(e.message, 'error'); }
    };

    const handleEditMember = (member) => {
        setEditForm({
            id: member.id,
            fullName: member.fullName || '',
            email: member.email || '',
            mobile: member.mobile || '',
            businessName: member.businessName || '',
            addressLine1: member.addressLine1 || '',
            city: member.city || '',
            stateName: member.stateName || '',
            pincode: member.pincode || ''
        });
        setShowEditModal(true);
    };

    const handleSaveEdit = async () => {
        setEditSaving(true);
        try {
            const res = await authFetch(`${BACKEND_URL}/admin/users/${editForm.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm)
            });
            const data = await res.json();
            if (res.ok) { showToast('Member updated successfully'); setShowEditModal(false); fetchMembers(); }
            else showToast(data?.error || 'Update failed', 'error');
        } catch (e) { showToast(e.message, 'error'); }
        finally { setEditSaving(false); }
    };

    const handleDelete = async (member) => {
        if (!window.confirm(`Permanently delete ${member.fullName || member.username}? This cannot be undone.`)) return;
        try {
            const res = await authFetch(`${BACKEND_URL}/admin/users/${member.id}`, { method: 'DELETE' });
            if (res.ok) { showToast(`${member.fullName || member.username} deleted`); fetchMembers(); return; }
            let msg = 'Delete failed';
            try { const d = await res.json(); msg = d?.error || d?.message || msg; } catch (_) {}
            showToast(msg, 'error');
        } catch (e) { showToast(e.message, 'error'); }
    };

    /* ── derived data ── */
    const filteredMembers = members.filter(m => {
        const roleMatch = roleFilter === 'ALL' || (m.roles || []).some(r => r === roleFilter);
        const q = search.trim().toLowerCase();
        const textMatch = !q || [m.fullName, m.username, m.mobile, m.email, m.businessName, m.partyCode]
            .some(v => v && String(v).toLowerCase().includes(q));
        return roleMatch && textMatch;
    });
    const pagedMembers  = filteredMembers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const totalPages    = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));

    /* ── action buttons shared ── */
    const ActionButtons = ({ member, compact = false }) => (
        <div className={`flex flex-col ${compact ? 'gap-1' : 'gap-1.5'} w-full`}>
            <button onClick={() => handleLoginAsMember(member)}
                className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-bold bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 hover:border-emerald-600 rounded-lg transition-all">
                <Zap size={11} /> Login As Member
            </button>
            <button onClick={() => handleViewServices(member)}
                className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-bold bg-sky-50 hover:bg-sky-600 text-sky-700 hover:text-white border border-sky-200 hover:border-sky-600 rounded-lg transition-all">
                <Package size={11} /> Services
            </button>
            <button onClick={() => handleViewDetail(member)}
                className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-bold bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 hover:border-indigo-600 rounded-lg transition-all">
                <Eye size={11} /> View Details
            </button>
            <button onClick={() => handleEditMember(member)}
                className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-bold bg-amber-50 hover:bg-amber-600 text-amber-700 hover:text-white border border-amber-200 hover:border-amber-600 rounded-lg transition-all">
                <Edit3 size={11} /> Edit
            </button>
            <button onClick={() => handleDelete(member)}
                className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-bold bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-rose-600 rounded-lg transition-all">
                <Trash2 size={11} /> Delete
            </button>
        </div>
    );

    /* ═══════════════════════════ RENDER ═══════════════════════════ */
    return (
        <div className="space-y-5" style={{ fontFamily: "'Inter', sans-serif" }}>

            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Total Members', value: members.length,                                                    color: 'bg-blue-500',    light: 'bg-blue-50',    text: 'text-blue-600'    },
                    { label: 'Retailers',      value: members.filter(m => (m.roles||[]).includes('RETAILER')).length,   color: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-600' },
                    { label: 'Distributors',   value: members.filter(m => (m.roles||[]).includes('DISTRIBUTOR')).length, color: 'bg-amber-500', light: 'bg-amber-50',   text: 'text-amber-600'   },
                    { label: 'Super Dist.',    value: members.filter(m => (m.roles||[]).includes('SUPER_DISTRIBUTOR')).length, color: 'bg-purple-500', light: 'bg-purple-50', text: 'text-purple-600' },
                ].map((s, i) => (
                    <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3">
                        <div className={`w-11 h-11 ${s.light} rounded-xl flex items-center justify-center shrink-0`}>
                            <div className={`w-3 h-3 ${s.color} rounded-full`} />
                        </div>
                        <div>
                            <p className={`text-2xl font-black leading-none ${s.text}`}>{s.value}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Search + Filter bar ── */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center bg-white px-4 py-3 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input
                        type="text"
                        placeholder="Search by name, mobile, email or party code…"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(0); }}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-400"
                    />
                </div>
                <div className="flex items-center gap-3 justify-between sm:justify-end shrink-0">
                    <select
                        value={roleFilter}
                        onChange={e => { setRoleFilter(e.target.value); setPage(0); }}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
                    >
                        <option value="ALL">All Roles</option>
                        <option value="RETAILER">Retailer</option>
                        <option value="DISTRIBUTOR">Distributor</option>
                        <option value="SUPER_DISTRIBUTOR">Super Distributor</option>
                    </select>
                    <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">
                        {filteredMembers.length} result{filteredMembers.length !== 1 ? 's' : ''}
                    </span>
                </div>
            </div>

            {/* ══════════════════════════════════════════
                DESKTOP / TABLET TABLE  (md and above)
            ══════════════════════════════════════════ */}
            <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="w-full overflow-hidden">
                    <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>

                        <thead>
                            <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                                <th className="px-2 py-3 text-center border-r border-slate-200">#</th>
                                <th className="px-2 py-3 text-left   border-r border-slate-200">Name</th>
                                <th className="px-2 py-3 text-left   border-r border-slate-200">Party Code</th>
                                <th className="px-2 py-3 text-left   border-r border-slate-200 hidden lg:table-cell">Address</th>
                                <th className="px-2 py-3 text-center border-r border-slate-200">Mobile</th>
                                <th className="px-2 py-3 text-left   border-r border-slate-200">Email</th>
                                <th className="px-2 py-3 text-center border-r border-slate-200">Role</th>
                                <th className="px-2 py-3 text-right  border-r border-slate-200">Wallet</th>
                                <th className="px-2 py-3 text-center border-r border-slate-200">Last AEPS</th>
                                <th className="px-2 py-3 text-center border-r border-slate-200">Joined</th>
                                <th className="px-2 py-3 text-center">Actions</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={11} className="py-14 text-center">
                                        <Loader2 className="animate-spin mx-auto text-indigo-400" size={28} />
                                        <p className="text-sm text-slate-400 mt-2">Loading members…</p>
                                    </td>
                                </tr>
                            ) : pagedMembers.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="py-14 text-center">
                                        <User size={28} className="text-slate-200 mx-auto" />
                                        <p className="text-sm text-slate-400 mt-2 font-semibold">No members found</p>
                                    </td>
                                </tr>
                            ) : pagedMembers.map((member, idx) => {
                                const rb = roleBadgeOf(member.roles || []);
                                const addr = [member.addressLine1, member.city, member.stateName].filter(Boolean).join(', ');
                                return (
                                    <motion.tr
                                        key={member.id || idx}
                                        initial={{ opacity: 0, y: 3 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.025, duration: 0.2 }}
                                        className="hover:bg-indigo-50/20 transition-colors"
                                    >
                                        {/* Sr No */}
                                        <td className="px-2 py-3 text-center text-[12px] text-slate-400 font-semibold border-r border-slate-100">
                                            {page * PAGE_SIZE + idx + 1}
                                        </td>

                                        {/* Name — Role badge / Full name / Party code */}
                                        <td className="px-2 py-3 border-r border-slate-100">
                                            <div className="flex flex-col gap-0.5 items-start">
                                                <RolePill roles={member.roles || []} />
                                                <span className="text-[13px] font-bold text-slate-800 leading-snug line-clamp-2 mt-0.5">
                                                    {member.fullName || member.name || '—'}
                                                </span>
                                                <span className="text-[11px] font-mono text-slate-400">
                                                    {member.partyCode || '—'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Party Code */}
                                        <td className="px-2 py-3 border-r border-slate-100 text-[12px] font-semibold text-slate-600 font-mono">
                                            {member.partyCode || '—'}
                                        </td>

                                        {/* Address (hidden on tablet md, visible on lg+) */}
                                        <td
                                            className="px-2 py-3 border-r border-slate-100 text-[12px] text-slate-500 hidden lg:table-cell"
                                            style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                                        >
                                            {addr || '—'}
                                        </td>

                                        {/* Mobile */}
                                        <td className="px-2 py-3 border-r border-slate-100 text-center text-[12px] font-bold text-slate-700">
                                            {member.mobile || '—'}
                                        </td>

                                        {/* Email */}
                                        <td
                                            className="px-2 py-3 border-r border-slate-100 text-[12px] text-slate-600"
                                            style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}
                                        >
                                            {member.email || '—'}
                                        </td>

                                        {/* Role badge */}
                                        <td className="px-2 py-3 border-r border-slate-100 text-center">
                                            <RolePill roles={member.roles || []} />
                                        </td>

                                        {/* Wallet */}
                                        <td className="px-2 py-3 border-r border-slate-100 text-right text-[12px] font-black text-slate-900">
                                            {fmtWallet(member.walletBalance)}
                                        </td>

                                        {/* Last AEPS */}
                                        <td className="px-2 py-3 border-r border-slate-100 text-center text-[11px]">
                                            {member.lastAepsTxnDate
                                                ? <span className="text-emerald-600 font-semibold">{fmtDateOnly(member.lastAepsTxnDate)}</span>
                                                : <span className="text-slate-300">Never</span>}
                                        </td>

                                        {/* Joined Date */}
                                        <td className="px-2 py-3 border-r border-slate-100 text-center">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[11px] font-semibold text-slate-700">{fmtDateOnly(member.createdAt)}</span>
                                                <span className="text-[10px] text-slate-400">{fmtTime(member.createdAt)}</span>
                                            </div>
                                        </td>

                                        {/* Actions */}
                                        <td className="px-2 py-3 text-center align-top">
                                            <ActionButtons member={member} compact />
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/40">
                    <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="px-4 py-2 bg-white border border-slate-200 hover:bg-indigo-50 hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-semibold text-slate-700 transition-all shadow-sm"
                    >← Prev</button>
                    <span className="text-sm font-semibold text-slate-500">
                        Page {page + 1} / {totalPages}
                        <span className="text-slate-400 font-normal ml-2">({filteredMembers.length} total)</span>
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                        className="px-4 py-2 bg-white border border-slate-200 hover:bg-indigo-50 hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-semibold text-slate-700 transition-all shadow-sm"
                    >Next →</button>
                </div>
            </div>

            {/* ══════════════════════════════════════════
                MOBILE CARDS  (below md)
            ══════════════════════════════════════════ */}
            <div className="block md:hidden space-y-3">
                {loading ? (
                    <div className="bg-white rounded-2xl p-8 border border-slate-100 text-center">
                        <Loader2 className="animate-spin mx-auto text-indigo-400" size={26} />
                        <p className="text-sm text-slate-400 mt-2">Loading members…</p>
                    </div>
                ) : pagedMembers.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 border border-slate-100 text-center">
                        <User size={26} className="text-slate-200 mx-auto" />
                        <p className="text-sm font-semibold text-slate-400 mt-2">No members found</p>
                    </div>
                ) : pagedMembers.map((member, idx) => {
                    const addr = [member.addressLine1, member.city, member.stateName].filter(Boolean).join(', ');
                    return (
                        <motion.div
                            key={member.id || idx}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.03 }}
                            className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
                        >
                            {/* Card header */}
                            <div className="flex items-start justify-between gap-3 p-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[14px] font-black text-slate-800 leading-tight truncate">
                                        {member.fullName || member.name || '—'}
                                    </p>
                                    <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                                        {member.partyCode || 'No Code'}
                                    </p>
                                </div>
                                <RolePill roles={member.roles || []} />
                            </div>

                            {/* Card body */}
                            <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-3 text-left">
                                <Field label="Mobile"   value={member.mobile  || '—'} />
                                <Field label="Wallet"   value={fmtWallet(member.walletBalance)} bold />
                                <Field label="Role"     value={<RolePill roles={member.roles || []} />} />
                                <Field label="Last AEPS" value={member.lastAepsTxnDate ? fmtDateOnly(member.lastAepsTxnDate) : 'Never'}
                                    className={member.lastAepsTxnDate ? 'text-emerald-600' : 'text-slate-300'} />
                                <Field label="Joined"   value={fmtDateOnly(member.createdAt)} />
                                <Field label="Time"     value={fmtTime(member.createdAt)} className="text-slate-400" />
                                <div className="col-span-2">
                                    <Field label="Email" value={member.email || '—'} truncate />
                                </div>
                                <div className="col-span-2">
                                    <Field label="Address" value={addr || 'No address provided'} truncate className="text-slate-500 italic" />
                                </div>
                            </div>

                            {/* Card actions */}
                            <div className="px-4 pb-4 space-y-2">
                                <button onClick={() => handleLoginAsMember(member)}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 text-[12px] font-bold bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 hover:border-emerald-600 rounded-xl transition-all">
                                    <Zap size={13} /> Login As Member
                                </button>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => handleViewServices(member)}
                                        className="flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold bg-sky-50 hover:bg-sky-600 text-sky-700 hover:text-white border border-sky-200 hover:border-sky-600 rounded-xl transition-all">
                                        <Package size={12} /> Services
                                    </button>
                                    <button onClick={() => handleViewDetail(member)}
                                        className="flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 hover:border-indigo-600 rounded-xl transition-all">
                                        <Eye size={12} /> View Details
                                    </button>
                                    <button onClick={() => handleEditMember(member)}
                                        className="flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold bg-amber-50 hover:bg-amber-600 text-amber-700 hover:text-white border border-amber-200 hover:border-amber-600 rounded-xl transition-all">
                                        <Edit3 size={12} /> Edit
                                    </button>
                                    <button onClick={() => handleDelete(member)}
                                        className="flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-rose-600 rounded-xl transition-all">
                                        <Trash2 size={12} /> Delete
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}

                {/* Mobile Pagination */}
                <div className="flex items-center justify-between pt-2">
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                        className="px-4 py-2 bg-white border border-slate-200 hover:bg-indigo-50 disabled:opacity-40 rounded-xl text-sm font-semibold text-slate-700 shadow-sm transition-all">
                        ← Prev
                    </button>
                    <span className="text-xs font-semibold text-slate-500">{page + 1} / {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                        className="px-4 py-2 bg-white border border-slate-200 hover:bg-indigo-50 disabled:opacity-40 rounded-xl text-sm font-semibold text-slate-700 shadow-sm transition-all">
                        Next →
                    </button>
                </div>
            </div>

            {/* ══════════════════════════════════════════ MODALS ══ */}

            {/* Member Detail Modal */}
            <AnimatePresence>
                {showDetailModal && selectedMember && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
                        onClick={() => setShowDetailModal(false)}>
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
                            onClick={e => e.stopPropagation()}>
                            <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
                                <h2 className="text-lg font-black text-slate-800">Member Details</h2>
                                <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><X size={18} /></button>
                            </div>
                            <div className="p-5 space-y-5 text-left">
                                <div className="grid grid-cols-2 gap-4">
                                    <DetailField label="Full Name"  value={selectedMember.fullName} />
                                    <DetailField label="Username"   value={selectedMember.username} mono />
                                    <DetailField label="Mobile"     value={selectedMember.mobile} />
                                    <DetailField label="Email"      value={selectedMember.email} />
                                </div>
                                {selectedMember.password && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-xs font-bold text-amber-700 uppercase flex items-center gap-1.5"><Lock size={13} /> Password</label>
                                            <button onClick={() => setShowPassword(p => !p)} className="text-xs text-amber-600 font-semibold">{showPassword ? 'Hide' : 'Show'}</button>
                                        </div>
                                        <p className="text-sm font-mono text-amber-800">{showPassword ? selectedMember.password : '••••••••••••'}</p>
                                    </div>
                                )}
                                <div className="border-t border-slate-100 pt-4">
                                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Business</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <DetailField label="Business Name" value={selectedMember.businessName || '—'} />
                                        <DetailField label="Address"       value={selectedMember.addressLine1 || '—'} />
                                        <DetailField label="City"          value={selectedMember.city || '—'} />
                                        <DetailField label="State"         value={selectedMember.stateName || '—'} />
                                    </div>
                                </div>
                                <div className="border-t border-slate-100 pt-4">
                                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">KYC</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <DetailField label="Aadhaar" value={selectedMember.aadhaarNumber || '—'} />
                                        <DetailField label="PAN"     value={selectedMember.panNumber || '—'} />
                                        <div className="col-span-2 space-y-1">
                                            <p className="text-[10px] font-semibold text-slate-400 uppercase">KYC Status</p>
                                            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                                                selectedMember.kycStatus === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                                selectedMember.kycStatus === 'PENDING'  ? 'bg-amber-100 text-amber-700' :
                                                'bg-slate-100 text-slate-600'}`}>
                                                {selectedMember.kycStatus || 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="border-t border-slate-100 pt-4">
                                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">Wallet & Stats</h3>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { label: 'Balance',   val: `₹${selectedMember.walletBalance?.toLocaleString('en-IN') || '0'}` },
                                            { label: 'AEPS Txns', val: selectedMember.totalAepsTxnCount || 0 },
                                            { label: 'Last AEPS', val: fmtDateOnly(selectedMember.lastAepsTxnDate) },
                                        ].map(({ label, val }) => (
                                            <div key={label} className="bg-slate-50 rounded-xl p-3">
                                                <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">{label}</p>
                                                <p className="text-sm font-black text-slate-800">{val}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Service Modal */}
            <AnimatePresence>
                {showServiceModal && selectedMember && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
                        onClick={() => setShowServiceModal(false)}>
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-2xl max-w-md w-full shadow-2xl"
                            onClick={e => e.stopPropagation()}>
                            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                                <div className="text-left">
                                    <h2 className="text-base font-black text-slate-800">Service Management</h2>
                                    <p className="text-xs text-slate-500">{selectedMember.fullName} ({selectedMember.username})</p>
                                </div>
                                <button onClick={() => setShowServiceModal(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
                            </div>
                            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
                                {actionLoading ? (
                                    <div className="flex justify-center py-8"><Loader2 className="animate-spin text-indigo-400" size={22} /></div>
                                ) : memberServices.length === 0 ? (
                                    <p className="text-sm text-slate-400 text-center py-6">No services assigned</p>
                                ) : memberServices.map(s => (
                                    <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.isEnabled ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-400'}`}>
                                                <Package size={16} />
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm font-bold text-slate-700">{serviceLabels[s.serviceType] || s.serviceType}</p>
                                                <p className="text-xs text-slate-500">{s.isEnabled ? 'Enabled' : 'Disabled'}{s.enabledBy && ` · ${s.enabledBy}`}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => toggleService(selectedMember.id, s.serviceType, !s.isEnabled)}
                                            className={`p-1.5 rounded-lg transition-colors ${s.isEnabled ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-slate-200 text-slate-400 hover:bg-slate-300'}`}>
                                            {s.isEnabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit Modal */}
            <AnimatePresence>
                {showEditModal && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
                        onClick={() => setShowEditModal(false)}>
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
                            onClick={e => e.stopPropagation()}>
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                                <h2 className="text-lg font-black text-slate-800">Edit Member</h2>
                                <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
                            </div>
                            <div className="p-5 grid grid-cols-2 gap-4 text-left">
                                {[
                                    { label: 'Full Name',     key: 'fullName' },
                                    { label: 'Email',         key: 'email' },
                                    { label: 'Mobile',        key: 'mobile' },
                                    { label: 'Business Name', key: 'businessName' },
                                    { label: 'Address',       key: 'addressLine1' },
                                    { label: 'City',          key: 'city' },
                                    { label: 'State',         key: 'stateName' },
                                    { label: 'Pincode',       key: 'pincode' },
                                ].map(({ label, key }) => (
                                    <div key={key} className="flex flex-col gap-1">
                                        <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</label>
                                        <input
                                            value={editForm[key] || ''}
                                            onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">
                                <button onClick={() => setShowEditModal(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-semibold text-slate-600 transition-colors">Cancel</button>
                                <button onClick={handleSaveEdit} disabled={editSaving}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl text-sm font-semibold text-white transition-colors flex items-center gap-2">
                                    {editSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    Save Changes
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toast */}
            <AnimatePresence>
                {toast && (
                    <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
                        className={`fixed bottom-6 right-6 z-[999] px-5 py-3 rounded-xl shadow-xl text-sm font-semibold flex items-center gap-2 ${
                            toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}`}>
                        {toast.type === 'error' ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                        {toast.msg}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

/* ─── tiny helper components ─── */
const Field = ({ label, value, bold, truncate, className = '' }) => (
    <div className="space-y-0.5">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</p>
        {typeof value === 'string' || typeof value === 'number'
            ? <p className={`text-[13px] font-${bold ? 'black' : 'semibold'} text-slate-700 ${truncate ? 'truncate' : ''} ${className}`}>{value}</p>
            : <div className={className}>{value}</div>}
    </div>
);

const DetailField = ({ label, value, mono }) => (
    <div className="space-y-1">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
        <p className={`text-sm text-slate-800 ${mono ? 'font-mono' : 'font-semibold'}`}>{value || '—'}</p>
    </div>
);

export default EnhancedMembersTable;
