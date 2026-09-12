import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, Search, Download, UserPlus, ShieldCheck,
    CheckCircle2, AlertCircle, Clock, X, Eye, Wallet,
    Smartphone, Mail, MapPin, Zap, Package, Edit3, Trash2,
    Lock, Save, Loader2, Image as ImageIcon
} from 'lucide-react';
import { dataService, BACKEND_URL } from '../../services/dataService';
import { sharedDataService } from '../../services/sharedDataService';
import NetworkRegistrationForm from '../../components/shared/NetworkRegistrationForm';

const getToken = () => localStorage.getItem('rupiksha_token') || localStorage.getItem('rupiksha_distributor_token') || localStorage.getItem('rupiksha_admin_token');

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

const DEFAULT_SERVICES = [
    { serviceType: 'AEPS', label: 'AEPS Banking', enabled: true },
    { serviceType: 'BBPS', label: 'Bill Payment (BBPS)', enabled: true },
    { serviceType: 'RECHARGE', label: 'Mobile & DTH Recharge', enabled: true },
    { serviceType: 'PAYOUT', label: 'Payout / Money Transfer', enabled: true },
    { serviceType: 'WALLET_TRANSFER', label: 'Wallet Transfer', enabled: true },
    { serviceType: 'TICKET_SUPPORT', label: 'Ticket Support', enabled: true }
];

const Retailers = () => {
    const [retailers, setRetailers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [selectedRetailer, setSelectedRetailer] = useState(null);
    const [editingRetailer, setEditingRetailer] = useState(null);
    const [servicesModalRetailer, setServicesModalRetailer] = useState(null);
    const [memberServices, setMemberServices] = useState(DEFAULT_SERVICES);
    const [dist, setDist] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3500);
    };

    const normalizeStatus = (status) => {
        const s = String(status || '').trim().toUpperCase();
        if (s === 'APPROVED' || s === 'ACTIVE') return 'APPROVED';
        if (s === 'PENDING') return 'PENDING';
        if (s === 'REJECTED') return 'REJECTED';
        return s || 'APPROVED';
    };

    const loadData = async () => {
        setLoading(true);
        const session = sharedDataService.getCurrentDistributor();
        if (!session) {
            setLoading(false);
            return;
        }
        const freshDist = sharedDataService.getDistributorById(session.id) || session;
        setDist(freshDist);

        const distId = String(freshDist.id || freshDist._id || freshDist.userId || '').trim().toLowerCase();
        const distPartyCode = String(freshDist.partyCode || freshDist.userCode || '').trim().toUpperCase();
        const distMobile = String(freshDist.mobile || freshDist.phone || '').trim();
        const distUsername = String(freshDist.username || '').trim().toLowerCase();
        const distName = String(freshDist.name || freshDist.fullName || '').trim().toLowerCase();
        const assignedList = (freshDist.assignedRetailers || []).map(x => String(x || '').trim());
        const assignedSet = new Set(assignedList.map(x => x.toLowerCase()));

        let allUsers = [];
        try {
            allUsers = await dataService.getAllUsers();
            if (!Array.isArray(allUsers)) allUsers = [];
        } catch {
            const fallback = dataService.getData().users || [];
            allUsers = fallback;
        }

        // Also incorporate local data and user cache
        const localUsers = dataService.getData().users || [];
        const cachedUsersRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('rupiksha_users_cache') : null;
        let cachedUsers = [];
        try {
            if (cachedUsersRaw) cachedUsers = JSON.parse(cachedUsersRaw);
        } catch {}

        const userMap = new Map();
        [...allUsers, ...localUsers, ...cachedUsers].forEach((u) => {
            if (!u) return;
            const key = String(u.id || u._id || u.username || u.mobile || u.partyCode || '');
            if (key && !userMap.has(key)) {
                userMap.set(key, u);
            }
        });

        const combinedList = Array.from(userMap.values());

        const assigned = combinedList
            .filter((u) => {
                const rRole = String(u?.role || (u?.roles && u.roles[0]) || '').replace(/^ROLE_/i, '').toUpperCase();
                return rRole === 'RETAILER' || rRole === 'RETAILERS';
            })
            .filter((r) => {
                const rId = String(r.id || r._id || r.userId || '').trim().toLowerCase();
                const rUsername = String(r.username || '').trim().toLowerCase();
                const rMobile = String(r.mobile || r.phone || '').trim();
                const rPartyCode = String(r.partyCode || r.userCode || '').trim().toUpperCase();

                const rParentId = String(r.parentUserId || r.ownerId || r.addedByUserRef || r.parent_id || r.parentId || '').trim().toLowerCase();
                const rParentPartyCode = String(r.parentPartyCode || r.addedByPartyCode || r.ownerPartyCode || '').trim().toUpperCase();
                const rParentName = String(r.parentName || r.addedByName || r.ownerName || '').trim().toLowerCase();
                const rParentMobile = String(r.parentMobile || r.ownerMobile || r.addedByMobile || '').trim();

                // Direct assignment list check
                if (assignedSet.has(rUsername) || (rMobile && assignedSet.has(rMobile)) || (rPartyCode && assignedSet.has(rPartyCode.toLowerCase())) || (rId && assignedSet.has(rId))) {
                    return true;
                }

                // ID link check
                if (distId && (rParentId === distId || rParentId.includes(distId))) {
                    return true;
                }

                // Party Code link check (e.g. RPDMH78914)
                if (distPartyCode && rParentPartyCode && rParentPartyCode === distPartyCode) {
                    return true;
                }

                // Mobile link check
                if (distMobile && (rParentMobile === distMobile || rParentId === distMobile.toLowerCase())) {
                    return true;
                }

                // Username link check
                if (distUsername && (rParentId === distUsername || rParentName === distUsername)) {
                    return true;
                }

                // Owner Name link check
                if (distName && rParentName && (rParentName.includes(distName) || distName.includes(rParentName))) {
                    return true;
                }

                return false;
            })
            .map((u, idx) => ({
                ...u,
                id: u.id || u._id || u.userId || u.username || u.mobile || `ret-${idx}`,
                fullName: u.fullName || u.name || (u.firstName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : (u.username || 'Retailer')),
                username: u.username || u.mobile || `user_${idx}`,
                mobile: u.mobile || u.phone || '—',
                email: u.email || '—',
                partyCode: u.partyCode || u.userCode || `RPRBR${70000 + idx}`,
                role: 'RETAILER',
                roles: ['RETAILER'],
                status: normalizeStatus(u.status),
                kycStatus: String(u.kycStatus || 'APPROVED').toUpperCase(),
                walletBalance: parseFloat(String(u.walletBalance ?? u.balance ?? u.wallet?.balance ?? 0).replace(/,/g, '')) || 0,
                addressLine1: u.shopAddress || u.address || u.permanentAddress || '—',
                city: u.city || u.shopCity || '—',
                stateName: u.state || u.shopState || 'BIHAR',
                createdAt: u.createdAt || u.created_at || new Date().toISOString()
            }));

        setRetailers(assigned);
        setLoading(false);
    };

    useEffect(() => {
        loadData();
        const handleUpdate = () => { loadData(); };
        window.addEventListener('distributorDataUpdated', handleUpdate);
        window.addEventListener('dataUpdated', handleUpdate);
        window.addEventListener('membersUpdated', handleUpdate);
        return () => {
            window.removeEventListener('distributorDataUpdated', handleUpdate);
            window.removeEventListener('dataUpdated', handleUpdate);
            window.removeEventListener('membersUpdated', handleUpdate);
        };
    }, []);

    useEffect(() => {
        if (showSuccess) {
            import('canvas-confetti').then(module => {
                const confetti = module.default;
                const fire = (particleRatio, opts) => {
                    confetti({
                        ...opts,
                        particleCount: Math.floor(250 * particleRatio),
                        colors: ['#3B82F6', '#60A5FA', '#93C5FD', '#10B981', '#F59E0B'],
                        gravity: 1.2,
                        scalar: 1.2,
                        ticks: 200
                    });
                };
                setTimeout(() => {
                    fire(0.25, { spread: 26, startVelocity: 55, origin: { y: 0.6 } });
                    fire(0.2, { spread: 60, origin: { y: 0.6 } });
                    fire(0.35, { spread: 100, decay: 0.91, origin: { y: 0.6 } });
                }, 400);
            });
        }
    }, [showSuccess]);

    const handleRegistrationSuccess = () => {
        setShowAddModal(false);
        setShowSuccess(true);
        loadData();
    };

    // Impersonate / Login as Retailer
    const handleLoginAsMember = async (member) => {
        const token = getToken() || `imp_token_${Date.now()}`;
        const impersonatedUser = {
            id: member.id,
            username: member.username || member.mobile,
            mobile: member.mobile,
            fullName: member.fullName || member.name,
            name: member.fullName || member.name,
            roles: ['RETAILER'],
            role: 'RETAILER',
            kycStatus: 'APPROVED',
            status: 'APPROVED',
            impersonated: true
        };

        const key = `_imp_${Date.now()}`;
        localStorage.setItem(key, JSON.stringify({ token, user: impersonatedUser }));
        await new Promise(r => setTimeout(r, 200));
        window.open(`${window.location.origin}/dashboard?_imp=${encodeURIComponent(key)}`, '_blank');
        showToast(`Opened Retailer Portal as ${member.fullName}`);
    };

    // Open Services Modal
    const handleViewServices = (member) => {
        setServicesModalRetailer(member);
        setMemberServices(DEFAULT_SERVICES);
    };

    // Toggle a Service
    const handleToggleService = (serviceType) => {
        setMemberServices(prev =>
            prev.map(s => s.serviceType === serviceType ? { ...s, enabled: !s.enabled } : s)
        );
        showToast('Service permission updated');
    };

    // Edit Member Save
    const handleSaveEdit = (e) => {
        e.preventDefault();
        setRetailers(prev => prev.map(r => r.id === editingRetailer.id ? { ...r, ...editingRetailer } : r));
        showToast('Retailer details updated successfully');
        setEditingRetailer(null);
    };

    // Delete Member
    const handleDeleteRetailer = (member) => {
        if (!window.confirm(`Are you sure you want to remove retailer ${member.fullName} from your network?`)) return;
        setRetailers(prev => prev.filter(r => r.id !== member.id));
        showToast(`Retailer ${member.fullName} removed successfully`);
    };

    // Filtered members
    const filtered = retailers.filter(r => {
        const q = searchTerm.trim().toLowerCase();
        const matchesSearch = !q || [r.fullName, r.name, r.username, r.mobile, r.email, r.partyCode, r.businessName]
            .some(v => v && String(v).toLowerCase().includes(q));
        const matchesStatus = statusFilter === 'ALL'
            || (statusFilter === 'ACTIVE' && (r.status === 'APPROVED' || r.status === 'ACTIVE'))
            || (statusFilter === 'KYC_APPROVED' && (r.kycStatus === 'APPROVED' || r.status === 'APPROVED'));
        return matchesSearch && matchesStatus;
    });

    const activeCount = retailers.filter(r => r.status === 'APPROVED' || r.status === 'ACTIVE').length;
    const kycCount = retailers.filter(r => r.kycStatus === 'APPROVED' || r.status === 'APPROVED').length;
    const totalBalance = retailers.reduce((acc, curr) => acc + (parseFloat(curr.walletBalance) || 0), 0);

    return (
        <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-5 font-['Inter',sans-serif]">
            
            {/* Toast alert */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className={`fixed top-20 right-6 z-[200] px-4 py-2.5 rounded-xl shadow-xl text-xs font-black text-white flex items-center gap-2 ${
                            toast.type === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
                        }`}
                    >
                        <CheckCircle2 size={14} />
                        <span>{toast.msg}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Summary Cards (Matching Admin Style) ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                {[
                    { label: 'Total Retailers', value: retailers.length, color: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-600' },
                    { label: 'Active Partners', value: activeCount, color: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-600' },
                    { label: 'KYC Approved', value: kycCount, color: 'bg-indigo-500', light: 'bg-indigo-50', text: 'text-indigo-600' },
                    { label: 'Network Balance', value: fmtWallet(totalBalance), color: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-600' },
                ].map((s, i) => (
                    <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3">
                        <div className={`w-11 h-11 ${s.light} rounded-xl flex items-center justify-center shrink-0`}>
                            <div className={`w-3 h-3 ${s.color} rounded-full`} />
                        </div>
                        <div>
                            <p className={`text-xl sm:text-2xl font-black leading-none ${s.text}`}>{s.value}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Search + Filter + Action Bar ── */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center bg-white px-4 py-3 rounded-2xl shadow-sm border border-slate-100 justify-between">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Search by name, mobile, email or party code…"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400 font-medium"
                    />
                </div>

                <div className="flex items-center gap-2.5 justify-between sm:justify-end shrink-0">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                        <option value="ALL">All Retailers</option>
                        <option value="ACTIVE">Active Partners</option>
                        <option value="KYC_APPROVED">KYC Approved</option>
                    </select>

                    <button
                        onClick={() => setShowAddModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider shadow-md shadow-blue-600/20 transition-all flex items-center gap-1.5 shrink-0"
                    >
                        <UserPlus size={14} /> Add New Retailer
                    </button>
                </div>
            </div>

            {/* ══════════════════════════════════════════
                CLEAN 12-COLUMN TABLE (Exact Admin Design)
            ══════════════════════════════════════════ */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="w-full overflow-x-auto">
                    <table className="w-full border-collapse text-left min-w-[1100px]" style={{ tableLayout: 'auto' }}>
                        <thead>
                            <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                                <th className="px-2.5 py-3 text-center border-r border-slate-200 w-10">#</th>
                                <th className="px-3 py-3 text-left border-r border-slate-200">Name</th>
                                <th className="px-3 py-3 text-left border-r border-slate-200">Party Code</th>
                                <th className="px-3 py-3 text-left border-r border-slate-200">Owner</th>
                                <th className="px-3 py-3 text-left border-r border-slate-200">Address</th>
                                <th className="px-3 py-3 text-center border-r border-slate-200">Mobile</th>
                                <th className="px-3 py-3 text-left border-r border-slate-200">Email</th>
                                <th className="px-3 py-3 text-center border-r border-slate-200">Role & Status</th>
                                <th className="px-3 py-3 text-right border-r border-slate-200">Wallet</th>
                                <th className="px-3 py-3 text-center border-r border-slate-200">Activity</th>
                                <th className="px-3 py-3 text-center border-r border-slate-200">Joined</th>
                                <th className="px-3 py-3 text-center">Actions</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100 text-xs">
                            {loading ? (
                                <tr>
                                    <td colSpan={12} className="py-14 text-center">
                                        <Loader2 className="animate-spin mx-auto text-blue-500" size={28} />
                                        <p className="text-xs text-slate-400 mt-2 font-semibold">Loading retailers…</p>
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={12} className="py-14 text-center">
                                        <Users size={32} className="text-slate-300 mx-auto" />
                                        <p className="text-xs text-slate-400 mt-2 font-bold uppercase tracking-wider">No retailers found in network</p>
                                    </td>
                                </tr>
                            ) : filtered.map((member, idx) => {
                                const addr = [member.addressLine1, member.city, member.stateName].filter(Boolean).join(', ');
                                return (
                                    <tr key={member.id || idx} className="hover:bg-blue-50/20 transition-colors">
                                        {/* Sr No */}
                                        <td className="px-2.5 py-3 text-center text-[12px] text-slate-400 font-semibold border-r border-slate-100">
                                            {idx + 1}
                                        </td>

                                        {/* Name */}
                                        <td className="px-3 py-3 border-r border-slate-100 font-bold text-[13px] text-slate-800 leading-snug">
                                            <div>{member.fullName}</div>
                                            {member.businessName && member.businessName !== member.fullName && (
                                                <div className="text-[10px] text-slate-400 font-medium">{member.businessName}</div>
                                            )}
                                        </td>

                                        {/* Party Code */}
                                        <td className="px-3 py-3 border-r border-slate-100 text-[12px] font-bold text-slate-700 font-mono">
                                            {member.partyCode || '—'}
                                        </td>

                                        {/* Owner Column (Distributor Name, Party Code, Mobile) */}
                                        <td className="px-3 py-3 border-r border-slate-100 text-left">
                                            <div className="flex flex-col gap-0.5 leading-tight">
                                                <span className="font-black text-[12px] text-slate-800">
                                                    {dist?.fullName || dist?.name || 'Distributor'}
                                                </span>
                                                <span className="text-[10px] font-mono font-bold text-blue-600">
                                                    {dist?.partyCode || dist?.username || 'RPDMH78914'}
                                                </span>
                                                <span className="text-[10px] text-slate-500 font-semibold">
                                                    {dist?.mobile || '—'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Address */}
                                        <td className="px-3 py-3 border-r border-slate-100 text-slate-600 text-[11px] max-w-[180px] truncate" title={addr}>
                                            {addr || '—'}
                                        </td>

                                        {/* Mobile */}
                                        <td className="px-3 py-3 text-center font-mono font-semibold text-slate-700 border-r border-slate-100">
                                            {member.mobile || '—'}
                                        </td>

                                        {/* Email */}
                                        <td className="px-3 py-3 text-slate-600 text-[11px] border-r border-slate-100 max-w-[160px] truncate" title={member.email}>
                                            {member.email || '—'}
                                        </td>

                                        {/* Role & Status Pills */}
                                        <td className="px-3 py-3 text-center border-r border-slate-100">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-200">
                                                    RETAILER
                                                </span>
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200">
                                                    APPROVED
                                                </span>
                                            </div>
                                        </td>

                                        {/* Wallet Balance */}
                                        <td className="px-3 py-3 text-right font-black text-slate-900 border-r border-slate-100 font-mono text-[13px]">
                                            {fmtWallet(member.walletBalance)}
                                        </td>

                                        {/* Activity / Last AEPS */}
                                        <td className="px-3 py-3 text-center text-slate-400 text-[11px] font-semibold border-r border-slate-100">
                                            Never
                                        </td>

                                        {/* Joined Date & Time */}
                                        <td className="px-3 py-3 text-center border-r border-slate-100 text-[11px] leading-tight">
                                            <div className="font-bold text-slate-700">{fmtDateOnly(member.createdAt)}</div>
                                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{fmtTime(member.createdAt)}</div>
                                        </td>

                                        {/* Actions (Stacked Clean Buttons Matching Admin) */}
                                        <td className="px-3 py-2.5 text-center">
                                            <div className="flex flex-col gap-1 w-[120px] mx-auto select-none">
                                                <button
                                                    onClick={() => handleLoginAsMember(member)}
                                                    className="w-full flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-black bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-[0.98] shadow-sm transition-all cursor-pointer"
                                                >
                                                    <Zap size={10} /> Login As Member
                                                </button>
                                                <button
                                                    onClick={() => handleViewServices(member)}
                                                    className="w-full flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-black bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-[0.98] shadow-sm transition-all cursor-pointer"
                                                >
                                                    <Package size={10} /> Services
                                                </button>
                                                <button
                                                    onClick={() => setSelectedRetailer(member)}
                                                    className="w-full flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-black bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-[0.98] shadow-sm transition-all cursor-pointer"
                                                >
                                                    <Eye size={10} /> View Details
                                                </button>
                                                <button
                                                    onClick={() => setEditingRetailer(member)}
                                                    className="w-full flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-black bg-amber-500 text-white rounded-lg hover:bg-amber-600 active:scale-[0.98] shadow-sm transition-all cursor-pointer"
                                                >
                                                    <Edit3 size={10} /> Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteRetailer(member)}
                                                    className="w-full flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-black bg-rose-500 text-white rounded-lg hover:bg-rose-600 active:scale-[0.98] shadow-sm transition-all cursor-pointer"
                                                >
                                                    <Trash2 size={10} /> Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── ADD RETAILER MODAL ── */}
            <AnimatePresence>
                {showAddModal && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 40 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 40 }}
                            className="bg-white w-full max-w-2xl sm:max-w-3xl rounded-[2.5rem] overflow-hidden shadow-2xl relative max-h-[92vh] flex flex-col"
                        >
                            <div className="px-6 sm:px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10 shrink-0">
                                <div>
                                    <h3 className="text-lg sm:text-xl font-black text-slate-800 uppercase tracking-tight">
                                        Register Partner
                                    </h3>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                                        Direct partner registration · Instant auto-approval
                                    </p>
                                </div>
                                <button onClick={() => setShowAddModal(false)} className="p-2.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-2xl transition-all">
                                    <X size={22} />
                                </button>
                            </div>

                            <div className="p-4 sm:p-6 overflow-y-auto">
                                <NetworkRegistrationForm
                                    roleLock="RETAILER"
                                    uplineId={dist?.id}
                                    uplineRole="DISTRIBUTOR"
                                    onCancel={() => setShowAddModal(false)}
                                    onSuccess={handleRegistrationSuccess}
                                    submitLabel="Register Retailer (Auto-Approved)"
                                />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── SUCCESS CELEBRATION MODAL ── */}
            <AnimatePresence>
                {showSuccess && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[150] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white px-8 py-10 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center relative overflow-hidden"
                        >
                            <div className="relative z-10 space-y-4">
                                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner ring-8 ring-emerald-50 text-3xl">
                                    🏆
                                </div>

                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Congratulations!</p>
                                    <h2 className="text-xl font-black text-slate-800 tracking-tight">Retailer Registered!</h2>
                                    <p className="text-xs font-semibold text-slate-400">Partner auto-approved & mapped to your network.</p>
                                </div>

                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs font-bold text-emerald-800">
                                    <p className="flex items-center justify-center gap-1.5 text-emerald-700">
                                        <CheckCircle2 size={14} /> STATUS: APPROVED & ACTIVE
                                    </p>
                                </div>

                                <button
                                    onClick={() => setShowSuccess(false)}
                                    className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                                >
                                    Done & Refresh
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── VIEW DETAILS MODAL ── */}
            <AnimatePresence>
                {selectedRetailer && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-white w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
                        >
                            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-black text-lg flex items-center justify-center shadow-md shadow-blue-600/20">
                                        {(selectedRetailer.fullName || selectedRetailer.username || 'R').charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-slate-800">{selectedRetailer.fullName}</h3>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] font-mono font-bold text-blue-600">{selectedRetailer.partyCode}</span>
                                            <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase">Active Retailer</span>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedRetailer(null)} className="p-2 text-slate-400 hover:text-slate-800 rounded-xl">
                                    <X size={22} />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Mobile</p>
                                        <p className="font-bold text-slate-900 mt-0.5">{selectedRetailer.mobile}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Email</p>
                                        <p className="font-bold text-slate-900 mt-0.5 truncate">{selectedRetailer.email}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Wallet Balance</p>
                                        <p className="font-black text-emerald-600 font-mono text-sm mt-0.5">{fmtWallet(selectedRetailer.walletBalance)}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Shop / Business</p>
                                        <p className="font-bold text-slate-900 mt-0.5">{selectedRetailer.businessName || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">City & State</p>
                                        <p className="font-bold text-slate-900 mt-0.5">{selectedRetailer.city}, {selectedRetailer.stateName}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">KYC Status</p>
                                        <p className="font-bold text-emerald-600 mt-0.5 uppercase">{selectedRetailer.kycStatus || 'APPROVED'}</p>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">KYC & Document Preview</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                        {[
                                            { label: 'Aadhaar Front', url: selectedRetailer.aadhaarPhotoUrl },
                                            { label: 'Aadhaar Back', url: selectedRetailer.aadhaarBackPhotoUrl },
                                            { label: 'PAN Card', url: selectedRetailer.panPhotoUrl },
                                            { label: 'Shop Photo', url: selectedRetailer.shopPhotoUrl },
                                        ].map((doc, i) => (
                                            <div key={i} className="bg-slate-50 p-2 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-center min-h-[90px]">
                                                {doc.url ? (
                                                    <img src={doc.url} alt={doc.label} className="w-full h-16 object-cover rounded-lg mb-1" />
                                                ) : (
                                                    <div className="h-16 flex flex-col items-center justify-center text-slate-400">
                                                        <ImageIcon size={18} />
                                                        <span className="text-[8px] mt-1">Verified on file</span>
                                                    </div>
                                                )}
                                                <span className="text-[9px] font-bold text-slate-600">{doc.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="pt-2 flex gap-3">
                                    <button
                                        onClick={() => { setSelectedRetailer(null); handleLoginAsMember(selectedRetailer); }}
                                        className="flex-1 bg-blue-600 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider hover:bg-blue-700 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20"
                                    >
                                        <Zap size={14} /> Open Retailer Portal
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── EDIT RETAILER MODAL ── */}
            <AnimatePresence>
                {editingRetailer && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl"
                        >
                            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Edit Retailer Details</h3>
                                <button onClick={() => setEditingRetailer(null)} className="p-2 text-slate-400 hover:text-slate-800 rounded-xl">
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSaveEdit} className="p-6 space-y-3.5 text-xs">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Full Name</label>
                                    <input
                                        type="text"
                                        value={editingRetailer.fullName || ''}
                                        onChange={(e) => setEditingRetailer({ ...editingRetailer, fullName: e.target.value })}
                                        required
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-bold focus:outline-none focus:border-blue-600"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mobile</label>
                                        <input
                                            type="text"
                                            value={editingRetailer.mobile || ''}
                                            onChange={(e) => setEditingRetailer({ ...editingRetailer, mobile: e.target.value })}
                                            required
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-mono font-bold focus:outline-none focus:border-blue-600"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email</label>
                                        <input
                                            type="email"
                                            value={editingRetailer.email || ''}
                                            onChange={(e) => setEditingRetailer({ ...editingRetailer, email: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-600"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Shop / Business Name</label>
                                    <input
                                        type="text"
                                        value={editingRetailer.businessName || ''}
                                        onChange={(e) => setEditingRetailer({ ...editingRetailer, businessName: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-600"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">City</label>
                                        <input
                                            type="text"
                                            value={editingRetailer.city || ''}
                                            onChange={(e) => setEditingRetailer({ ...editingRetailer, city: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-600"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">State</label>
                                        <input
                                            type="text"
                                            value={editingRetailer.stateName || ''}
                                            onChange={(e) => setEditingRetailer({ ...editingRetailer, stateName: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-blue-600"
                                        />
                                    </div>
                                </div>

                                <div className="pt-2 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setEditingRetailer(null)}
                                        className="flex-1 bg-slate-100 text-slate-600 font-bold py-2.5 rounded-xl text-xs uppercase hover:bg-slate-200 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs uppercase shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-1"
                                    >
                                        <Save size={14} /> Save Changes
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── SERVICES MODAL ── */}
            <AnimatePresence>
                {servicesModalRetailer && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-white w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl"
                        >
                            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                <div>
                                    <h3 className="text-base font-black text-slate-800">Partner Services</h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{servicesModalRetailer.fullName}</p>
                                </div>
                                <button onClick={() => setServicesModalRetailer(null)} className="p-2 text-slate-400 hover:text-slate-800 rounded-xl">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-2.5">
                                {memberServices.map((s) => (
                                    <div key={s.serviceType} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                            <span className="text-xs font-bold text-slate-800">{s.label}</span>
                                        </div>
                                        <button
                                            onClick={() => handleToggleService(s.serviceType)}
                                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${
                                                s.enabled
                                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                    : 'bg-slate-200 text-slate-500'
                                            }`}
                                        >
                                            {s.enabled ? 'ACTIVE' : 'DISABLED'}
                                        </button>
                                    </div>
                                ))}

                                <button
                                    onClick={() => setServicesModalRetailer(null)}
                                    className="w-full mt-4 bg-slate-900 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider"
                                >
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
};

export default Retailers;
