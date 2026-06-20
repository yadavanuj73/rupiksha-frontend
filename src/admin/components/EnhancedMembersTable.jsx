import React, { useState, useEffect } from 'react';
import { 
    Search, MapPin, Zap, Trash2, Edit3, Eye, X, CheckCircle2, 
    AlertTriangle, Lock, Unlock, Home, User, Smartphone, Mail, 
    Building2, Crown, Wallet, Calendar, Activity, ArrowLeft,
    Loader2, Save, ToggleRight, ToggleLeft, Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const _bDefault = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? 'https://rupiksha-backend-java.onrender.com/api/v1'
  : '/api/v1';
const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || _bDefault).replace(/\/$/, '');
const getToken = () => localStorage.getItem('rupiksha_token');

async function authFetch(url, options = {}) {
    const token = getToken();
    const headers = { ...(options.headers || {}), ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
    const res = await fetch(url, { ...options, headers });
    // Admin tab: NEVER redirect on 401 — caller handles errors via res.status check
    return res;
}

const EnhancedMembersTable = () => {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [selectedMember, setSelectedMember] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showServiceModal, setShowServiceModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [editSaving, setEditSaving] = useState(false);
    const [memberServices, setMemberServices] = useState([]);
    const [actionLoading, setActionLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [toast, setToast] = useState(null);
    const [activeActionRow, setActiveActionRow] = useState(null);

    const pageSize = 10;

    const fetchMembers = async () => {
        setLoading(true);
        try {
            const response = await authFetch(`${BACKEND_URL}/admin/users`);
            if (response.ok) {
                const data = await response.json();
                const list = (data.users || data.content || []).filter(u => {
                    const s = (u.status || '').toUpperCase();
                    return s === 'APPROVED' || s === 'ACTIVE';
                });
                setMembers(list);
                setTotalPages(Math.ceil(list.length / pageSize) || 1);
            }
        } catch (error) {
            console.error('Error fetching members:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMembers();
        const handler = () => fetchMembers();
        window.addEventListener('membersUpdated', handler);
        const interval = setInterval(fetchMembers, 30000);
        return () => {
            window.removeEventListener('membersUpdated', handler);
            clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        setPage(0);
    }, [search, roleFilter]);

    const fetchMemberDetail = async (userId) => {
        const found = members.find(m => m.id === userId || m._id === userId);
        return found || null;
    };

    const fetchMemberServices = async (userId) => {
        try {
            const response = await authFetch(`${BACKEND_URL}/admin/members/${userId}/services`);
            if (response.ok) {
                const data = await response.json();
                setMemberServices(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error('Error fetching services:', error);
        }
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
        } catch (error) {
            console.error('Error toggling service:', error);
        } finally {
            setActionLoading(false);
        }
    };

    const handleViewDetail = async (member) => {
        const detail = await fetchMemberDetail(member.id);
        if (detail) {
            setSelectedMember(detail);
            setShowDetailModal(true);
            setShowPassword(false);
        }
    };

    const handleViewServices = async (member) => {
        setSelectedMember(member);
        await fetchMemberServices(member.id);
        setShowServiceModal(true);
    };

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleLoginAsMember = async (member) => {
        if (!window.confirm(`Login as ${member.fullName || member.username}? This will open their portal in a new tab.`)) return;
        try {
            const res = await authFetch(`${BACKEND_URL}/admin/impersonate/${member.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (res.status === 401) { showToast('Session expired — please log in again', 'error'); return; }
            const text = await res.text();
            let data = {};
            try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
            console.log('[Impersonate] status:', res.status, 'body:', text.slice(0, 300));
            if (!res.ok) {
                const msg = data.message || data.error || `Server error ${res.status}`;
                showToast(`Impersonation failed: ${msg}`, 'error');
                return;
            }
            const token = data.accessToken || data.token;
            if (!token) { showToast(`Impersonation failed: no token in response (keys: ${Object.keys(data).join(', ')})`, 'error'); return; }
            const normalizeRole = (r) => {
                if (typeof r === 'string') return r.trim().replace(/^ROLE_/i, '').toUpperCase();
                if (typeof r === 'object' && r?.name) return String(r.name).trim().replace(/^ROLE_/i, '').toUpperCase();
                return '';
            };
            const rawRoles = Array.isArray(data.roles) ? data.roles : [data.role].filter(Boolean);
            const normalizedRoles = rawRoles.map(normalizeRole).filter(Boolean);
            const role = normalizedRoles[0] || 'RETAILER';
            console.log('[EnhancedMembersTable] Impersonation roles:', rawRoles, '->', normalizedRoles, 'primaryRole:', role);
            const portalPath = role === 'DISTRIBUTOR' ? '/distributor' : role === 'SUPER_DISTRIBUTOR' ? '/super-distributor' : '/dashboard';
            const impersonatedUser = {
                id: data.userId,
                username: data.username,
                mobile: data.mobile,
                fullName: data.fullName,
                name: data.fullName,
                roles: normalizedRoles,
                role: role,
                kycStatus: data.kycStatus || 'NOT_SUBMITTED',
                status: data.status || 'ACTIVE',
                impersonated: true
            };
            // Pass token + user via localStorage key so new tab can read it (sessionStorage is NOT shared between tabs)
            const key = `_imp_${Date.now()}`;
            localStorage.setItem(key, JSON.stringify({ token: token, user: impersonatedUser }));
            console.log('[EnhancedMembersTable] Set localStorage key:', key, 'opening:', portalPath);
            // Wait to ensure localStorage is committed before opening tab
            await new Promise(r => setTimeout(r, 500));
            // Use absolute URL to avoid popup blocking
            const url = `${window.location.origin}${portalPath}?_imp=${encodeURIComponent(key)}`;
            window.open(url, '_blank');
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
            if (res.ok) {
                showToast('Member updated successfully');
                setShowEditModal(false);
                fetchMembers();
            } else { showToast(data?.error || 'Update failed', 'error'); }
        } catch (e) { showToast(e.message, 'error'); }
        finally { setEditSaving(false); }
    };

    const handleDelete = async (member) => {
        if (!window.confirm(`Permanently delete ${member.fullName || member.username}? This cannot be undone.`)) return;
        try {
            const res = await authFetch(`${BACKEND_URL}/admin/users/${member.id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                showToast(`${member.fullName || member.username} deleted`);
                fetchMembers();
                return;
            }
            let msg = 'Delete failed';
            try { const d = await res.json(); msg = d?.error || d?.message || msg; } catch (_) {}
            showToast(msg, 'error');
        } catch (e) { showToast(e.message, 'error'); }
    };

    const filteredMembers = members.filter(m => {
        const roleMatch = roleFilter === 'ALL' || (m.roles || []).some(r => r === roleFilter);
        const q = search.trim().toLowerCase();
        const textMatch = !q || [m.fullName, m.username, m.mobile, m.email, m.businessName, m.partyCode]
            .some(v => v && String(v).toLowerCase().includes(q));
        return roleMatch && textMatch;
    });
    const pagedMembers = filteredMembers.slice(page * pageSize, (page + 1) * pageSize);

    const formatDate = (dateString) => {
        if (!dateString) return '—';
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const serviceLabels = {
        'AEPS': 'AEPS',
        'BBPS': 'BBPS',
        'RECHARGE': 'Recharge',
        'PAYOUT': 'Payout',
        'WALLET_TRANSFER': 'Wallet Transfer',
        'TICKET_SUPPORT': 'Ticket Support'
    };

    return (
        <div className="space-y-6" style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* Header Stats */}
            <div className="grid grid-cols-4 gap-4">
                {[
                    { label: 'Total Members', value: members.length, color: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-600' },
                    { label: 'Retailers', value: members.filter(m => (m.roles || []).includes('RETAILER')).length, color: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-600' },
                    { label: 'Distributors', value: members.filter(m => (m.roles || []).includes('DISTRIBUTOR')).length, color: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-600' },
                    { label: 'Super Dist.', value: members.filter(m => (m.roles || []).includes('SUPER_DISTRIBUTOR')).length, color: 'bg-purple-500', light: 'bg-purple-50', text: 'text-purple-600' }
                ].map((stat, idx) => (
                    <div key={idx} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
                        <div className={`w-12 h-12 ${stat.light} rounded-2xl flex items-center justify-center flex-shrink-0`}>
                            <div className={`w-3 h-3 ${stat.color} rounded-full`} />
                        </div>
                        <div>
                            <p className={`text-3xl font-black ${stat.text}`}>{stat.value}</p>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">{stat.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search and Filters */}
            <div className="flex gap-3 items-center bg-white px-4 py-3 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex-1 relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search by name, username, mobile, email or party code..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 placeholder:text-slate-400"
                    />
                </div>
                <select
                    value={roleFilter}
                    onChange={(e) => { setRoleFilter(e.target.value); setPage(0); }}
                    className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
                >
                    <option value="ALL">All Roles</option>
                    <option value="RETAILER">Retailer</option>
                    <option value="DISTRIBUTOR">Distributor</option>
                    <option value="SUPER_DISTRIBUTOR">Super Distributor</option>
                </select>
                <span className="text-xs text-slate-400 whitespace-nowrap font-medium">{filteredMembers.length} result{filteredMembers.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Members Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="w-full">
                    <table className="w-full border-collapse table-auto">
                        <thead>
                            <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
                                <th className="px-2.5 py-3.5 text-left text-[14px] font-bold text-slate-700 uppercase tracking-wider border-r border-slate-200">Member</th>
                                <th className="px-2.5 py-3.5 text-left text-[14px] font-bold text-slate-700 uppercase tracking-wider border-r border-slate-200">Contact Info</th>
                                <th className="px-2.5 py-3.5 text-left text-[14px] font-bold text-slate-700 uppercase tracking-wider border-r border-slate-200">Outlet</th>
                                <th className="px-2.5 py-3.5 text-left text-[14px] font-bold text-slate-700 uppercase tracking-wider border-r border-slate-200">Owner</th>
                                <th className="px-2.5 py-3.5 text-left text-[14px] font-bold text-slate-700 uppercase tracking-wider border-r border-slate-200">Location</th>
                                <th className="px-2.5 py-3.5 text-left text-[14px] font-bold text-slate-700 uppercase tracking-wider border-r border-slate-200">Joined</th>
                                <th className="px-2.5 py-3.5 text-left text-[14px] font-bold text-slate-700 uppercase tracking-wider border-r border-slate-200">Wallet</th>
                                <th className="px-2.5 py-3.5 text-left text-[14px] font-bold text-slate-700 uppercase tracking-wider border-r border-slate-200">Last AEPS</th>
                                <th className="px-2.5 py-3.5 text-center text-[14px] font-bold text-slate-700 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="9" className="px-2.5 py-12 text-center">
                                        <Loader2 className="animate-spin mx-auto text-indigo-500" size={32} />
                                        <p className="text-sm text-slate-400 mt-2">Loading members...</p>
                                    </td>
                                </tr>
                            ) : pagedMembers.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="px-2.5 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <User size={32} className="text-slate-300" />
                                            <p className="text-sm font-semibold text-slate-400">No members found</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                pagedMembers.map((member, idx) => {
                                    const roleBadge = member.roles?.includes('ADMIN')
                                        ? { bg: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Admin' }
                                        : member.roles?.includes('SUPER_DISTRIBUTOR')
                                        ? { bg: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Super Dist.' }
                                        : member.roles?.includes('DISTRIBUTOR')
                                        ? { bg: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Distributor' }
                                        : { bg: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Retailer' };
                                    const ownerLabel = member.addedByRole === 'ADMIN' ? 'Admin'
                                        : member.addedByRole === 'SUPER_DISTRIBUTOR' ? 'Super Dist.'
                                        : member.addedByRole === 'DISTRIBUTOR' ? 'Distributor'
                                        : member.addedByName ? member.addedByName : 'Self';
                                    return (
                                    <motion.tr
                                        key={member.id}
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.04 }}
                                        className="hover:bg-indigo-50/30 transition-colors group"
                                    >
                                        {/* Member */}
                                        <td className="px-2.5 py-3 border-r border-slate-100">
                                            <div className="flex flex-col gap-1 items-start">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${roleBadge.bg}`}>
                                                    {roleBadge.label}
                                                </span>
                                                <span className="text-[15px] font-bold text-slate-800 leading-tight">
                                                    {member.fullName || member.name || '—'}
                                                </span>
                                                <span className="text-[11px] font-mono font-semibold text-slate-400">
                                                    {member.partyCode || 'No Party Code'}
                                                </span>
                                            </div>
                                        </td>
                                        {/* Contact Info */}
                                        <td className="px-2.5 py-3 border-r border-slate-100">
                                            <div className="flex flex-col gap-1 text-left text-sm font-semibold text-slate-700">
                                                <span className="whitespace-nowrap">{member.mobile || '—'}</span>
                                                <span className="text-xs font-normal text-slate-500 truncate max-w-[150px]" title={member.email}>{member.email || '—'}</span>
                                            </div>
                                        </td>
                                        {/* Outlet */}
                                        <td className="px-2.5 py-3 border-r border-slate-100">
                                            <span className="text-sm font-bold text-slate-700 truncate block max-w-[130px]" title={member.businessName}>
                                                {member.businessName || <span className="text-slate-300">—</span>}
                                            </span>
                                        </td>
                                        {/* Owner */}
                                        <td className="px-2.5 py-3 border-r border-slate-100">
                                            <span className="text-sm font-semibold text-slate-600 whitespace-nowrap">
                                                {ownerLabel}
                                            </span>
                                        </td>
                                        {/* Location */}
                                        <td className="px-2.5 py-3 border-r border-slate-100">
                                            <span className="text-sm text-slate-600 block truncate max-w-[120px]" title={[member.city, member.stateName].filter(Boolean).join(', ')}>
                                                {[member.city, member.stateName].filter(Boolean).join(', ') || <span className="text-slate-300">—</span>}
                                            </span>
                                        </td>
                                        {/* Joined */}
                                        <td className="px-2.5 py-3 border-r border-slate-100">
                                            <span className="text-xs text-slate-500 whitespace-nowrap">
                                                {formatDate(member.createdAt)}
                                            </span>
                                        </td>
                                        {/* Wallet */}
                                        <td className="px-2.5 py-3 border-r border-slate-100">
                                            <span className="text-[15px] font-bold text-slate-800">
                                                ₹{(member.walletBalance || 0).toLocaleString('en-IN')}
                                            </span>
                                        </td>
                                        {/* Last AEPS */}
                                        <td className="px-2.5 py-3 border-r border-slate-100">
                                            {member.lastAepsTxnDate ? (
                                                <span className="text-xs text-emerald-600 font-semibold whitespace-nowrap">
                                                    {formatDate(member.lastAepsTxnDate)}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-slate-300">Never</span>
                                            )}
                                        </td>
                                        {/* Actions */}
                                        <td className="px-2.5 py-3 text-center">
                                            <div className="flex flex-col gap-1 w-full min-w-[140px] max-w-[170px] mx-auto">
                                                <button 
                                                    onClick={() => handleLoginAsMember(member)} 
                                                    className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-bold bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white border border-emerald-200 hover:border-emerald-600 rounded-lg transition-all"
                                                >
                                                    <Zap size={12} /> Login As Member
                                                </button>
                                                <button 
                                                    onClick={() => handleViewServices(member)} 
                                                    className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-bold bg-sky-50 hover:bg-sky-600 text-sky-600 hover:text-white border border-sky-200 hover:border-sky-600 rounded-lg transition-all"
                                                >
                                                    <Package size={12} /> Services
                                                </button>
                                                <button 
                                                    onClick={() => handleViewDetail(member)} 
                                                    className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-bold bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white border border-indigo-200 hover:border-indigo-600 rounded-lg transition-all"
                                                >
                                                    <Eye size={12} /> View Details
                                                </button>
                                                <button 
                                                    onClick={() => handleEditMember(member)} 
                                                    className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-bold bg-amber-50 hover:bg-amber-600 text-amber-600 hover:text-white border border-amber-200 hover:border-amber-600 rounded-lg transition-all"
                                                >
                                                    <Edit3 size={12} /> Edit
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(member)} 
                                                    className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-bold bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 hover:border-rose-600 rounded-lg transition-all"
                                                >
                                                    <Trash2 size={12} /> Delete
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                    <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="px-4 py-2 bg-white border border-slate-300 hover:bg-indigo-50 hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-slate-700 transition-colors shadow-sm"
                    >
                        ← Previous
                    </button>
                    <span className="text-sm font-semibold text-slate-600">
                        Page {page + 1} of {Math.max(1, Math.ceil(filteredMembers.length / pageSize))}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(Math.ceil(filteredMembers.length / pageSize) - 1, p + 1))}
                        disabled={page >= Math.ceil(filteredMembers.length / pageSize) - 1}
                        className="px-4 py-2 bg-white border border-slate-300 hover:bg-indigo-50 hover:border-indigo-400 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-slate-700 transition-colors shadow-sm"
                    >
                        Next →
                    </button>
                </div>
            </div>

            {/* Member Detail Modal */}
            <AnimatePresence>
                {showDetailModal && selectedMember && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                        onClick={() => setShowDetailModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="sticky top-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between">
                                <h2 className="text-xl font-black text-slate-800">Member Details</h2>
                                <button 
                                    onClick={() => setShowDetailModal(false)}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Basic Info */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Full Name</label>
                                        <p className="text-sm font-semibold text-slate-800">{selectedMember.fullName}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Username</label>
                                        <p className="text-sm font-mono text-slate-800">{selectedMember.username}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Mobile</label>
                                        <p className="text-sm text-slate-800">{selectedMember.mobile}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Email</label>
                                        <p className="text-sm text-slate-800">{selectedMember.email}</p>
                                    </div>
                                </div>

                                {/* Password (Admin Only) */}
                                {selectedMember.password && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-xs font-bold text-amber-700 uppercase flex items-center gap-2">
                                                <Lock size={14} />
                                                Password (Admin Access)
                                            </label>
                                            <button
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="text-xs text-amber-600 hover:text-amber-700 font-semibold"
                                            >
                                                {showPassword ? 'Hide' : 'Show'}
                                            </button>
                                        </div>
                                        <p className="text-sm font-mono text-amber-800">
                                            {showPassword ? selectedMember.password : '••••••••••••'}
                                        </p>
                                    </div>
                                )}

                                {/* Business Info */}
                                <div className="border-t border-slate-100 pt-4">
                                    <h3 className="text-sm font-bold text-slate-700 mb-3">Business Information</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-slate-500 uppercase">Business Name</label>
                                            <p className="text-sm text-slate-800">{selectedMember.businessName || '—'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-slate-500 uppercase">Address</label>
                                            <p className="text-sm text-slate-800">{selectedMember.addressLine1 || '—'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-slate-500 uppercase">City</label>
                                            <p className="text-sm text-slate-800">{selectedMember.city || '—'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-slate-500 uppercase">State</label>
                                            <p className="text-sm text-slate-800">{selectedMember.stateName || '—'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* KYC Info */}
                                <div className="border-t border-slate-100 pt-4">
                                    <h3 className="text-sm font-bold text-slate-700 mb-3">KYC Information</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-slate-500 uppercase">Aadhaar</label>
                                            <p className="text-sm text-slate-800">{selectedMember.aadhaarNumber || '—'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-slate-500 uppercase">PAN</label>
                                            <p className="text-sm text-slate-800">{selectedMember.panNumber || '—'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-slate-500 uppercase">KYC Status</label>
                                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                                                selectedMember.kycStatus === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                                selectedMember.kycStatus === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                                                'bg-slate-100 text-slate-700'
                                            }`}>
                                                {selectedMember.kycStatus}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Wallet & Stats */}
                                <div className="border-t border-slate-100 pt-4">
                                    <h3 className="text-sm font-bold text-slate-700 mb-3">Wallet & Statistics</h3>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-slate-50 rounded-xl p-4">
                                            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Balance</p>
                                            <p className="text-xl font-black text-slate-800">₹{selectedMember.walletBalance?.toLocaleString() || '0'}</p>
                                        </div>
                                        <div className="bg-slate-50 rounded-xl p-4">
                                            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">AEPS Txns</p>
                                            <p className="text-xl font-black text-slate-800">{selectedMember.totalAepsTxnCount || 0}</p>
                                        </div>
                                        <div className="bg-slate-50 rounded-xl p-4">
                                            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Last AEPS</p>
                                            <p className="text-sm font-semibold text-slate-800">{formatDate(selectedMember.lastAepsTxnDate)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Service Management Modal */}
            <AnimatePresence>
                {showServiceModal && selectedMember && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                        onClick={() => setShowServiceModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-2xl max-w-md w-full"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-black text-slate-800">Service Management</h2>
                                    <p className="text-xs text-slate-500">{selectedMember.fullName} ({selectedMember.username})</p>
                                </div>
                                <button 
                                    onClick={() => setShowServiceModal(false)}
                                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-4 space-y-3">
                                {actionLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="animate-spin text-indigo-500" size={24} />
                                    </div>
                                ) : (
                                    memberServices.map((service) => (
                                        <div 
                                            key={service.id}
                                            className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                                    service.isEnabled ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-400'
                                                }`}>
                                                    <Package size={18} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-700">
                                                        {serviceLabels[service.serviceType] || service.serviceType}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {service.isEnabled ? 'Enabled' : 'Disabled'}
                                                        {service.enabledBy && ` by ${service.enabledBy}`}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => toggleService(selectedMember.id, service.serviceType, !service.isEnabled)}
                                                className={`p-2 rounded-lg transition-colors ${
                                                    service.isEnabled 
                                                        ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                                                        : 'bg-slate-200 text-slate-400 hover:bg-slate-300'
                                                }`}
                                            >
                                                {service.isEnabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit Member Modal */}
            <AnimatePresence>
                {showEditModal && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                        onClick={() => setShowEditModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                                <h2 className="text-lg font-black text-slate-800">Edit Member</h2>
                                <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X size={18} /></button>
                            </div>
                            <div className="p-5 grid grid-cols-2 gap-4">
                                {[
                                    { label: 'Full Name', key: 'fullName' },
                                    { label: 'Email', key: 'email' },
                                    { label: 'Mobile', key: 'mobile' },
                                    { label: 'Business Name', key: 'businessName' },
                                    { label: 'Address', key: 'addressLine1' },
                                    { label: 'City', key: 'city' },
                                    { label: 'State', key: 'stateName' },
                                    { label: 'Pincode', key: 'pincode' }
                                ].map(({ label, key }) => (
                                    <div key={key} className="flex flex-col gap-1">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">{label}</label>
                                        <input
                                            value={editForm[key] || ''}
                                            onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className="p-5 border-t border-slate-100 flex justify-end gap-3">
                                <button onClick={() => setShowEditModal(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-semibold text-slate-600 transition-colors">Cancel</button>
                                <button onClick={handleSaveEdit} disabled={editSaving} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg text-sm font-semibold text-white transition-colors flex items-center gap-2">
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
                    <motion.div
                        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
                        className={`fixed bottom-6 right-6 z-[999] px-5 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 ${
                            toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                        }`}
                    >
                        {toast.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                        {toast.msg}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default EnhancedMembersTable;
