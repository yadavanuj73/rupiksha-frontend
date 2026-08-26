import React, { useState, useEffect } from 'react';
import {
    Search, Zap, Trash2, Edit3, Eye, X, CheckCircle2,
    AlertTriangle, Lock, User, UserCheck, Loader2, Save, ToggleRight, ToggleLeft, Package, Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import dataService, { BACKEND_URL } from '../../services/dataService';
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

const statusBadgeOf = (status) => {
    const s = String(status || 'PENDING').toUpperCase();
    if (s === 'APPROVED' || s === 'ACTIVE' || s === 'SUCCESS') {
        return { bg: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'APPROVED' };
    }
    if (s === 'PENDING' || s === 'AWAITING') {
        return { bg: 'bg-amber-100 text-amber-700 border-amber-200', label: 'PENDING' };
    }
    if (s === 'REJECTED' || s === 'BLOCKED' || s === 'SUSPENDED' || s === 'INACTIVE') {
        return { bg: 'bg-rose-100 text-rose-700 border-rose-200', label: s };
    }
    return { bg: 'bg-slate-100 text-slate-700 border-slate-200', label: s };
};

const StatusPill = ({ status }) => {
    const { bg, label } = statusBadgeOf(status);
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider whitespace-nowrap ${bg}`}>
            {label}
        </span>
    );
};

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

const ALL_PLATFORM_SERVICES = [
    { serviceType: 'AEPS', label: 'AEPS Banking' },
    { serviceType: 'BBPS', label: 'Bill Payment (BBPS)' },
    { serviceType: 'RECHARGE', label: 'Mobile & DTH Recharge' },
    { serviceType: 'PAYOUT', label: 'Payout / Money Transfer' },
    { serviceType: 'WALLET_TRANSFER', label: 'Wallet Transfer' },
    { serviceType: 'TICKET_SUPPORT', label: 'Ticket Support' }
];

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
    const [activeLightboxImg, setActiveLightboxImg] = useState(null);
    const [toast, setToast]                 = useState(null);
    const [newMemberNotify, setNewMemberNotify] = useState(null);

    const PAGE_SIZE = 10;

    /* ── data fetching ── */
    const fetchMembers = async () => {
        setLoading(true);
        try {
            let rawList = [];
            const res = await authFetch(`${BACKEND_URL}/admin/users`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    rawList = data;
                } else if (data && typeof data === 'object') {
                    rawList = data.users || data.content || data.data || data.members || [];
                }
            }

            if (!rawList || rawList.length === 0) {
                try {
                    const fallback = await dataService.getAllUsers();
                    if (Array.isArray(fallback) && fallback.length > 0) {
                        rawList = fallback;
                    }
                } catch (e) {
                    console.error('Fallback dataService.getAllUsers error:', e);
                }
            }

            const normalizeRole = (r) => {
                let s = String(r || '').trim().replace(/[\s-]+/g, '_').toUpperCase();
                if (s.startsWith('ROLE_')) s = s.replace('ROLE_', '');
                return s;
            };

            const list = (rawList || []).map((u, idx) => {
                const rawRoles = Array.isArray(u.roles) ? u.roles : [];
                const rolesArr = rawRoles
                    .map(r => (typeof r === 'string' ? r : (r?.name || '')))
                    .filter(Boolean)
                    .map(r => normalizeRole(r));

                const primaryRole = normalizeRole(u.role) || rolesArr[0] || 'RETAILER';
                const finalRoles = Array.from(new Set(rolesArr.length ? rolesArr : [primaryRole]));

                return {
                    ...u,
                    id: u.id || u._id || u.userId || u.username || u.mobile || `usr-${idx}`,
                    fullName: u.fullName || u.name || u.username || 'User',
                    username: u.username || u.mobile || `user_${idx}`,
                    mobile: u.mobile || u.phone || 'N/A',
                    partyCode: u.partyCode || u.userCode || `RPRM${1000 + idx}`,
                    roles: finalRoles,
                    role: primaryRole,
                    status: String(u.status || 'APPROVED').toUpperCase(),
                    walletBalance: parseFloat(String(u.walletBalance ?? u.balance ?? u.wallet?.balance ?? 0).replace(/,/g, '')) || 0,
                    createdAt: u.createdAt || u.created_at || new Date().toISOString()
                };
            }).filter(u => !(u.roles || []).includes('ADMIN') && u.username !== 'admin' && String(u.role).toUpperCase() !== 'ADMIN');

            setMembers(list);
        } catch (e) {
            console.error('fetchMembers error:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMembers();

        const onMembersUpdated = (e) => {
            fetchMembers();
            if (e?.detail?.name) {
                setNewMemberNotify({
                    name: e.detail.name,
                    role: e.detail.role || 'RETAILER',
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
                setTimeout(() => setNewMemberNotify(null), 8000);
            }
        };

        const onWalletUpdated = () => {
            fetchMembers();
        };

        window.addEventListener('membersUpdated', onMembersUpdated);
        window.addEventListener('walletUpdated',  onWalletUpdated);

        return () => {
            window.removeEventListener('membersUpdated', onMembersUpdated);
            window.removeEventListener('walletUpdated',  onWalletUpdated);
        };
    }, []);

    useEffect(() => { setPage(0); }, [search, roleFilter]);

    /* ── service fetch / toggle ── */
    const fetchMemberServices = async (userId) => {
        try {
            const res = await authFetch(`${BACKEND_URL}/admin/members/${userId}/services`);
            if (res.ok) { 
                const d = await res.json(); 
                const backendList = Array.isArray(d) ? d : (d.services || []);
                
                const merged = backendList.map(s => {
                    const st = (s.serviceType || s.type || '').toUpperCase();
                    const isEnabled = s.isEnabled !== undefined ? !!s.isEnabled : !!s.enabled;
                    return { ...s, serviceType: st, isEnabled, enabled: isEnabled };
                });

                setMemberServices(merged); 
                return;
            }
        } catch (e) {
            console.error('[fetchMemberServices] error:', e);
        }
        setMemberServices([]);
    };

    const toggleService = async (userId, serviceType, enable) => {
        setActionLoading(true);
        try {
            const stUpper = serviceType.toUpperCase();
            
            const res = await authFetch(`${BACKEND_URL}/admin/members/${userId}/services/toggle`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serviceType, enable, remarks: `Service ${enable ? 'enabled' : 'disabled'} by admin` })
            });

            if (!res.ok) {
                let errorMsg = `HTTP ${res.status}`;
                try {
                    const d = await res.json();
                    errorMsg = d.error || d.message || errorMsg;
                } catch (_) {}
                throw new Error(`Failed to update service: ${errorMsg}`);
            }

            setMemberServices(prev => {
                const exists = (prev || []).some(s => (s.serviceType || s.type || '').toUpperCase() === stUpper);
                if (exists) {
                    return prev.map(s => (s.serviceType || s.type || '').toUpperCase() === stUpper ? { ...s, isEnabled: enable, enabled: enable } : s);
                } else {
                    return [...(prev || []), { serviceType: stUpper, isEnabled: enable, enabled: enable }];
                }
            });

            showToast(`Service ${serviceType} ${enable ? 'Enabled' : 'Disabled'} successfully`);
        } catch (e) {
            showToast(e.message, 'error');
        } finally {
            setActionLoading(false);
        }
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
        if (!window.confirm(`Login as ${member.fullName || member.name || member.username}? This will open their portal in a new tab.`)) return;

        const normalizeRole = r => typeof r === 'string'
            ? r.trim().replace(/^ROLE_/i, '').toUpperCase()
            : (r?.name ? String(r.name).trim().replace(/^ROLE_/i, '').toUpperCase() : '');
        const memberRoles = (Array.isArray(member.roles) && member.roles.length > 0 ? member.roles : [member.role]).map(normalizeRole).filter(Boolean);
        const role = memberRoles[0] || 'RETAILER';
        const portalPath = role === 'DISTRIBUTOR' ? '/distributor' : role === 'SUPER_DISTRIBUTOR' ? '/super-distributor' : '/dashboard';

        let impersonatedUser = null;
        let token = getToken() || `imp_token_${Date.now()}`;

        try {
            const res = await authFetch(`${BACKEND_URL}/admin/impersonate/${member.id}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }
            });
            if (res.ok) {
                const data = await res.json();
                token = data.accessToken || data.token || token;
                const rawRoles = Array.isArray(data.roles) ? data.roles : [data.role].filter(Boolean);
                const normalizedRoles = rawRoles.map(normalizeRole).filter(Boolean);
                const apiRole = normalizedRoles[0] || role;
                impersonatedUser = {
                    id: data.userId || member.id,
                    username: data.username || member.username || member.mobile,
                    mobile: data.mobile || member.mobile,
                    fullName: data.fullName || member.fullName || member.name,
                    name: data.fullName || member.name || member.fullName,
                    roles: normalizedRoles.length > 0 ? normalizedRoles : [apiRole],
                    role: apiRole,
                    kycStatus: data.kycStatus || member.kycStatus || 'APPROVED',
                    status: data.status || member.status || 'APPROVED',
                    impersonated: true
                };
            }
        } catch (e) {
            console.warn("Backend impersonation API error, performing resilient local impersonation:", e);
        }

        if (!impersonatedUser) {
            impersonatedUser = {
                id: member.id || member._id || member.userId,
                username: member.username || member.mobile,
                mobile: member.mobile || member.username,
                fullName: member.fullName || member.name || member.username,
                name: member.name || member.fullName || member.username,
                roles: memberRoles.length > 0 ? memberRoles : [role],
                role: role,
                kycStatus: member.kycStatus || 'APPROVED',
                status: member.status || 'APPROVED',
                impersonated: true
            };
        }

        const key = `_imp_${Date.now()}`;
        localStorage.setItem(key, JSON.stringify({ token, user: impersonatedUser }));
        await new Promise(r => setTimeout(r, 300));
        window.open(`${window.location.origin}${portalPath}?_imp=${encodeURIComponent(key)}`, '_blank');
        showToast(`Opened portal as ${impersonatedUser.fullName || impersonatedUser.username}`);
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
            const targetId = member.id || member._id || member.username;
            const res = await dataService.deleteUser(targetId);
            if (res && (res.success || res.status === 200)) {
                showToast(`${member.fullName || member.username} deleted successfully`);
                fetchMembers();
                return;
            }
            showToast(res?.error || res?.message || 'Delete failed', 'error');
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
        <div className={`flex flex-col ${compact ? 'gap-1' : 'gap-1.5'} w-full select-none`}>
            <button onClick={() => handleLoginAsMember(member)}
                className="w-full flex items-center justify-center gap-1 px-2.5 py-1.5 text-[11px] font-extrabold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 active:scale-[0.98] shadow-sm transition-all duration-150 cursor-pointer">
                <Zap size={11} /> Login As Member
            </button>
            <button onClick={() => handleViewServices(member)}
                className="w-full flex items-center justify-center gap-1 px-2.5 py-1.5 text-[11px] font-extrabold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 active:scale-[0.98] shadow-sm transition-all duration-150 cursor-pointer">
                <Package size={11} /> Services
            </button>
            <button onClick={() => handleViewDetail(member)}
                className="w-full flex items-center justify-center gap-1 px-2.5 py-1.5 text-[11px] font-extrabold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 active:scale-[0.98] shadow-sm transition-all duration-150 cursor-pointer">
                <Eye size={11} /> View Details
            </button>
            <button onClick={() => handleEditMember(member)}
                className="w-full flex items-center justify-center gap-1 px-2.5 py-1.5 text-[11px] font-extrabold bg-amber-500 text-white rounded-lg hover:bg-amber-600 active:scale-[0.98] shadow-sm transition-all duration-150 cursor-pointer">
                <Edit3 size={11} /> Edit
            </button>
            <button onClick={() => handleDelete(member)}
                className="w-full flex items-center justify-center gap-1 px-2.5 py-1.5 text-[11px] font-extrabold bg-rose-500 text-white rounded-lg hover:bg-rose-600 active:scale-[0.98] shadow-sm transition-all duration-150 cursor-pointer">
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
                                    <tr
                                        key={member.id || idx}
                                        className="hover:bg-indigo-50/20 transition-colors"
                                    >
                                        {/* Sr No */}
                                        <td className="px-2 py-3 text-center text-[12px] text-slate-400 font-semibold border-r border-slate-100">
                                            {page * PAGE_SIZE + idx + 1}
                                        </td>

                                        {/* Name — Full Name only */}
                                        <td className="px-2.5 py-3 border-r border-slate-100 font-bold text-[13px] text-slate-800 leading-snug">
                                            {member.fullName || member.name || '—'}
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

                                        {/* Role & Status badge */}
                                        <td className="px-2 py-3 border-r border-slate-100 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <RolePill roles={member.roles || []} />
                                                <StatusPill status={member.status} />
                                            </div>
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
                                    </tr>
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
                                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                        <ImageIcon size={14} className="text-indigo-600" /> Uploaded Registration Documents & Photos
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {[
                                            { label: 'Aadhaar Front', url: selectedMember.aadhaarPhotoUrl },
                                            { label: 'Aadhaar Back', url: selectedMember.aadhaarBackPhotoUrl },
                                            { label: 'PAN Card', url: selectedMember.panPhotoUrl },
                                            { label: 'Bank Passbook / Cheque', url: selectedMember.bankPassbookUrl },
                                            { label: 'Shop Photo', url: selectedMember.shopPhotoUrl },
                                            { label: 'Live Selfie', url: selectedMember.liveSelfieUrl || selectedMember.photoUrl },
                                            { label: 'Driving Licence', url: selectedMember.drivingLicenceUrl },
                                            { label: 'Voter ID', url: selectedMember.voterIdUrl },
                                            { label: 'Passport', url: selectedMember.passportUrl },
                                        ].filter(d => d.url).length === 0 ? (
                                            <p className="text-xs text-slate-400 col-span-3 italic">No document photos uploaded by user.</p>
                                        ) : (
                                            [
                                                { label: 'Aadhaar Front', url: selectedMember.aadhaarPhotoUrl },
                                                { label: 'Aadhaar Back', url: selectedMember.aadhaarBackPhotoUrl },
                                                { label: 'PAN Card', url: selectedMember.panPhotoUrl },
                                                { label: 'Bank Passbook / Cheque', url: selectedMember.bankPassbookUrl },
                                                { label: 'Shop Photo', url: selectedMember.shopPhotoUrl },
                                                { label: 'Live Selfie', url: selectedMember.liveSelfieUrl || selectedMember.photoUrl },
                                                { label: 'Driving Licence', url: selectedMember.drivingLicenceUrl },
                                                { label: 'Voter ID', url: selectedMember.voterIdUrl },
                                                { label: 'Passport', url: selectedMember.passportUrl },
                                            ].map(doc => doc.url ? (
                                                <div key={doc.label} className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex flex-col justify-between group hover:border-indigo-400 transition-all">
                                                    <div>
                                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide truncate mb-1">{doc.label}</p>
                                                        <div 
                                                            onClick={() => setActiveLightboxImg({ title: doc.label, url: doc.url })}
                                                            className="relative w-full h-24 rounded-lg overflow-hidden border border-slate-200 cursor-pointer bg-slate-200 group-hover:shadow-md transition-all"
                                                        >
                                                            <img src={doc.url} alt={doc.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[11px] font-bold transition-opacity">
                                                                Click to View
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : null)
                                        )}
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
                {showServiceModal && selectedMember && (() => {
                    const mergedServices = ALL_PLATFORM_SERVICES.map(ps => {
                        const found = (memberServices || []).find(s =>
                            (s.serviceType || s.type || '').toUpperCase() === ps.serviceType
                        );
                        return {
                            id: found?.id || ps.serviceType,
                            serviceType: ps.serviceType,
                            label: ps.label,
                            isEnabled: found ? (found.isEnabled !== undefined ? !!found.isEnabled : !!found.enabled) : false,
                            enabledBy: found?.enabledBy || null
                        };
                    });

                    return (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4"
                            onClick={() => setShowServiceModal(false)}>
                            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                                className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden"
                                onClick={e => e.stopPropagation()}>
                                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                    <div className="text-left">
                                        <h2 className="text-base font-black text-slate-800">Service Management</h2>
                                        <p className="text-xs text-slate-500 font-semibold">{selectedMember.fullName || selectedMember.name} ({selectedMember.mobile || selectedMember.username})</p>
                                    </div>
                                    <button onClick={() => setShowServiceModal(false)} className="p-2 hover:bg-slate-200/60 rounded-lg text-slate-500 hover:text-slate-800 cursor-pointer"><X size={18} /></button>
                                </div>
                                <div className="p-4 space-y-2.5 max-h-[60vh] overflow-y-auto">
                                    {actionLoading ? (
                                        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-indigo-400" size={24} /></div>
                                    ) : (
                                        mergedServices.map(s => (
                                            <div key={s.serviceType} className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl hover:bg-slate-100/80 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${s.isEnabled ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-200 text-slate-500'}`}>
                                                        <Package size={18} />
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="text-sm font-black text-slate-800">{s.label}</p>
                                                        <p className="text-[11px] font-semibold text-slate-400">
                                                            Status: <span className={s.isEnabled ? 'text-emerald-600 font-bold' : 'text-slate-500'}>{s.isEnabled ? 'Active / Enabled' : 'Disabled'}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => toggleService(selectedMember.id, s.serviceType, !s.isEnabled)}
                                                    disabled={actionLoading}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                                                        s.isEnabled
                                                            ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                                                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                                    }`}
                                                >
                                                    {s.isEnabled ? (
                                                        <>
                                                            <ToggleRight size={18} /> Enabled
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ToggleLeft size={18} /> Disabled
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </motion.div>
                        </motion.div>
                    );
                })()}
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

            {/* Floating Top-Right User Registration Toast Notification */}
            <AnimatePresence>
                {newMemberNotify && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, x: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, x: 20, scale: 0.95 }}
                        className="fixed top-5 right-5 z-[9999] bg-slate-900/95 text-white p-4 rounded-2xl shadow-2xl border border-emerald-500/50 backdrop-blur-md flex items-center gap-3.5 max-w-sm"
                    >
                        <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
                            <UserCheck size={20} />
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full">
                                    User Joined
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">Just Now</span>
                            </div>
                            <p className="text-sm font-bold text-white truncate mt-1">
                                {newMemberNotify.name}
                            </p>
                            <p className="text-xs text-slate-300 font-medium">
                                Role: <span className="text-emerald-400 font-bold">{newMemberNotify.role}</span>
                            </p>
                        </div>
                        <button
                            onClick={() => setNewMemberNotify(null)}
                            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                        >
                            <X size={16} />
                        </button>
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

            {/* Lightbox Modal */}
            <AnimatePresence>
                {activeLightboxImg && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
                        onClick={() => setActiveLightboxImg(null)}>
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-slate-900 border border-slate-800 rounded-2xl p-4 max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative"
                            onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider">{activeLightboxImg.title}</h3>
                                <button onClick={() => setActiveLightboxImg(null)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"><X size={18} /></button>
                            </div>
                            <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-950 rounded-xl p-2 min-h-[300px]">
                                <img src={activeLightboxImg.url} alt={activeLightboxImg.title} className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg" />
                            </div>
                        </motion.div>
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
