import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, Search, Download, UserPlus,
    CheckCircle2, AlertCircle, Clock, X,
    Eye, Wallet, Smartphone, Mail, MapPin,
    Store, ShieldCheck, ShieldAlert,
    ShieldOff, Building2, Navigation
} from 'lucide-react';
import { dataService, BACKEND_URL } from '../../services/dataService';
import { sharedDataService } from '../../services/sharedDataService';
import NetworkRegistrationForm from '../../components/shared/NetworkRegistrationForm';

const KYCBadge = ({ done, label }) => (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${done
        ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
        : 'bg-red-50 text-red-500 border-red-100'
        }`}>
        {done ? <ShieldCheck size={10} /> : <ShieldOff size={10} />}
        {label}: {done ? 'Done' : 'Pending'}
    </div>
);

const Retailers = () => {
    const [retailers, setRetailers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [selectedRetailer, setSelectedRetailer] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showSuccessView, setShowSuccessView] = useState(false);
    const [createdCredentials, setCreatedCredentials] = useState(null);
    const [kycPingLoadingId, setKycPingLoadingId] = useState(null);
    const normalizeStatus = (status) => {
        const s = String(status || '').trim().toUpperCase();
        if (s === 'APPROVED' || s === 'ACTIVE') return 'Approved';
        if (s === 'PENDING') return 'Pending';
        if (s === 'REJECTED') return 'Rejected';
        return status || 'Pending';
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const allUsers = await dataService.getAllUsers();
            const sa = sharedDataService.getCurrentSuperDistributor();
            const users = Array.isArray(allUsers) ? allUsers : [];
            const myDistributorIds = new Set(
                users
                    .filter((u) => String(u?.role || '').toUpperCase() === 'DISTRIBUTOR')
                    .filter((u) => String(u?.addedByUserRef || '') === String(sa?.id || ''))
                    .map((u) => String(u?.id || ''))
            );
            const scopedRetailers = users
                .filter((u) => String(u?.role || '').toUpperCase() === 'RETAILER')
                .filter((u) => {
                    const addedBy = String(u?.addedByUserRef || '');
                    return addedBy === String(sa?.id || '') || myDistributorIds.has(addedBy);
                })
                .map((u) => ({
                    ...u,
                    status: normalizeStatus(u.status),
                    kycStatus: String(u.kycStatus || '').toUpperCase(),
                    displayStatus: (normalizeStatus(u.status) === 'Approved' && String(u.kycStatus || '').toUpperCase() !== 'APPROVED')
                        ? 'Pending KYC'
                        : normalizeStatus(u.status)
                }));
            setRetailers(scopedRetailers);
        } catch (err) {
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        const handleUpdate = () => loadData();
        window.addEventListener('dataUpdated', handleUpdate);
        window.addEventListener('SuperDistributorDataUpdated', handleUpdate);
        return () => {
            window.removeEventListener('dataUpdated', handleUpdate);
            window.removeEventListener('SuperDistributorDataUpdated', handleUpdate);
        };
    }, []);

    const handleOpenMap = (retailer) => {
        const address = retailer.address || retailer.shopAddress || `${retailer.city || ''}, ${retailer.state || ''}`;
        if (retailer.latitude && retailer.longitude) {
            window.open(`https://www.google.com/maps?q=${retailer.latitude},${retailer.longitude}`, '_blank');
        } else if (address.trim() && address.trim() !== ',') {
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
        } else {
            alert('Is retailer ka address available nahi hai.');
        }
    };

    const handleDelete = async (retailer) => {
        setDeleting(true);
        try {
            const token = localStorage.getItem('rupiksha_token');
            const res = await fetch(`${BACKEND_URL}/admin/users/${retailer.id || retailer.username}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success || res.ok) {
                setDeleteConfirm(null);
                setSelectedRetailer(null);
                loadData();
            } else {
                alert(data.error || 'Delete failed');
            }
        } catch (err) {
            alert('Delete Error: ' + err.message);
        } finally {
            setDeleting(false);
        }
    };
    const handleSendKycRequest = async (member) => {
        const id = String(member?.id || member?.username || '');
        if (!id) return;
        setKycPingLoadingId(id);
        try {
            await dataService.resendCredentials({
                ...member,
                name: member?.name || member?.fullName || member?.username,
                role: 'RETAILER'
            });
            alert('KYC reminder sent to member. Ask them to complete KYC for admin approval.');
        } catch {
            alert('Unable to send KYC reminder right now.');
        } finally {
            setKycPingLoadingId(null);
        }
    };

    const handleRegistrationSuccess = (applicant) => {
        // applicant is the form object from NetworkRegistrationForm — we echo
        // back the credentials so the SA can copy-share them before the
        // retailer receives the admin-approved email.
        const sa = sharedDataService.getCurrentSuperDistributor() || { id: 'ADMIN', name: 'Super Distributor' };
        setCreatedCredentials({
            to: applicant.email,
            name: applicant.name,
            loginId: applicant.mobile,
            password: applicant.password,
            addedBy: sa.name || 'Super Distributor',
            portalType: 'Retailer'
        });
        setShowAddModal(false);
        setShowSuccessView(true);
        loadData();
    };

    const filtered = retailers.filter(r => {
        const matchesSearch =
            String(r.name || r.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(r.mobile || '').includes(searchTerm) ||
            String(r.businessName || r.shopName || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All'
            || r.status === statusFilter
            || (statusFilter === 'Pending KYC' && r.status === 'Approved' && r.kycStatus !== 'APPROVED')
            || (statusFilter === 'KYC Approved' && r.status === 'Approved' && r.kycStatus === 'APPROVED');
        return matchesSearch && matchesStatus;
    });

    const active = retailers.filter(r => r.displayStatus === 'Approved');

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 font-['Montserrat',sans-serif]">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase italic underline decoration-amber-500/50">
                        Retailer Management
                    </h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                        Sabhi retailers ki poori jaankari — KYC, Address, Contacts
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors flex items-center gap-2">
                        <Download size={14} /> Export Data
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="group relative bg-[#1e40af] hover:bg-[#1d4ed8] text-white px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 transition-all active:scale-95 flex items-center gap-3 overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        <UserPlus size={16} className="text-blue-200" />
                        <span>Add New Retailer</span>
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { label: 'Total Retailers', val: retailers.length, icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-50' },
                    { label: 'Active / Verified', val: active.length, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                    { label: 'Pending KYC', val: retailers.filter(r => r.status === 'Pending' || r.status === 'PENDING').length, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{stat.label}</p>
                            <p className="text-3xl font-black text-slate-800 mt-1">{stat.val}</p>
                        </div>
                        <div className={`w-12 h-12 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center shadow-inner`}>
                            <stat.icon size={26} strokeWidth={1.5} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Naam, Mobile ya Shop ke naam se search karein..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 focus:bg-white text-sm transition-all font-semibold"
                    />
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                    {['All', 'Pending', 'Pending KYC', 'KYC Approved', 'Rejected'].map(status => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border
                                ${statusFilter === status
                                    ? (status === 'All' ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20' :
                                       status === 'Approved' ? 'bg-amber-400 border-amber-400 text-black shadow-md shadow-amber-400/20' :
                                       'bg-red-500 border-red-500 text-white shadow-md shadow-red-500/20')
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                        >
                            {status}
                        </button>
                    ))}
                </div>
            </div>

            {/* Cards Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                    <Users size={64} strokeWidth={1} />
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] mt-4">Koi Retailer Nahi Mila</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    <AnimatePresence>
                        {filtered.map((r, i) => {
                            const profileKyc = !!(r.kycDone || r.kyc_done || r.kyc_status === 'Approved' || r.profileKyc);

                            const shopName = r.businessName || r.shopName || r.business_name || null;
                            const shopAddress = r.address || r.shopAddress || r.shop_address || (r.city ? `${r.city}, ${r.state}` : null);

                            return (
                                <motion.div
                                    key={r.id || r.username || i}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ delay: i * 0.04 }}
                                    className="bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-lg transition-all overflow-hidden group"
                                >
                                    {/* Card Header */}
                                    <div className="bg-gradient-to-br from-[#0d1b2e] to-[#1e3a5f] p-5 relative overflow-hidden">
                                        <div className="absolute -top-6 -right-6 w-24 h-24 bg-amber-500/10 rounded-full" />
                                        <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-blue-500/10 rounded-full" />
                                        <div className="flex items-center gap-4 relative z-10">
                                            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-xl font-black shadow-xl">
                                                {(r.name || r.username || 'R').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white font-black text-sm truncate">{r.name || r.username}</p>
                                                <p className="text-white/40 text-[9px] font-bold uppercase tracking-widest truncate">
                                                    ID: {r.username}
                                                </p>
                                            </div>
                                            <span className={`shrink-0 px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider border
                                                ${r.displayStatus === 'Approved' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                                                    r.displayStatus === 'Pending' || r.displayStatus === 'Pending KYC' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
                                                        'bg-red-500/20 text-red-300 border-red-500/30'}`}>
                                                {r.displayStatus === 'Approved' ? 'Active' : r.displayStatus === 'Pending' || r.displayStatus === 'Pending KYC' ? 'Pending KYC' : 'Rejected'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Card Body */}
                                    <div className="p-5 space-y-4">

                                        {/* Contact Info */}
                                        <div className="space-y-2.5">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                                                    <Smartphone size={13} className="text-blue-500" />
                                                </div>
                                                <div>
                                                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Mobile No.</p>
                                                    <p className="text-xs font-black text-slate-700">{r.mobile || r.phone || '—'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 bg-purple-50 rounded-lg flex items-center justify-center shrink-0">
                                                    <Mail size={13} className="text-purple-500" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Email</p>
                                                    <p className="text-xs font-black text-slate-700 truncate">{r.email || '—'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Shop Info */}
                                        <div className="bg-slate-50 rounded-2xl p-3 space-y-2">
                                            <div className="flex items-start gap-2.5">
                                                <div className="w-7 h-7 bg-amber-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                                                    <Store size={13} className="text-amber-500" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Shop Name</p>
                                                    <p className="text-xs font-black text-slate-700">{shopName || '—'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2.5">
                                                <div className="w-7 h-7 bg-rose-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                                                    <MapPin size={13} className="text-rose-500" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Shop Address</p>
                                                    <p className="text-xs font-semibold text-slate-600 leading-relaxed">{shopAddress || '—'}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* KYC Status */}
                                        <div>
                                            <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest mb-2">KYC Status</p>
                                            <div className="flex flex-wrap gap-2">
                                                <KYCBadge done={profileKyc} label="Profile KYC" />
                                            </div>
                                        </div>

                                        {/* Wallet */}
                                        <div className="flex items-center justify-between py-2 border-t border-slate-100">
                                            <div className="flex items-center gap-2">
                                                <Wallet size={14} className="text-emerald-500" />
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Wallet</p>
                                            </div>
                                            <p className="text-sm font-black text-slate-800 font-mono">
                                                ₹ {parseFloat(r.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </p>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="grid grid-cols-2 gap-2 pt-1">
                                            <button
                                                onClick={() => setSelectedRetailer(r)}
                                                className="flex flex-col items-center gap-1 py-2.5 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 text-slate-500 rounded-2xl transition-all border border-slate-100"
                                                title="Details Dekho"
                                            >
                                                <Eye size={16} />
                                                <span className="text-[8px] font-black uppercase tracking-wider">View</span>
                                            </button>
                                            <button
                                                onClick={() => handleOpenMap(r)}
                                                className="flex flex-col items-center gap-1 py-2.5 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-600 text-slate-500 rounded-2xl transition-all border border-slate-100"
                                                title="Google Maps par dekho"
                                            >
                                                <Navigation size={16} />
                                                <span className="text-[8px] font-black uppercase tracking-wider">Map</span>
                                            </button>
                                        </div>
                                        {r.displayStatus === 'Pending KYC' && (
                                            <button
                                                onClick={() => handleSendKycRequest(r)}
                                                disabled={kycPingLoadingId === String(r.id || r.username || '')}
                                                className="w-full mt-2 py-2 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
                                            >
                                                {kycPingLoadingId === String(r.id || r.username || '') ? 'Sending...' : 'Send KYC Request'}
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}

            {/* FAB */}
            <button
                onClick={() => setShowAddModal(true)}
                className="fixed bottom-8 right-8 z-[60] bg-[#1e40af] text-white p-5 rounded-full shadow-[0_15px_40px_rgba(30,64,175,0.4)] hover:scale-110 active:scale-95 transition-all group lg:hidden"
                title="Add New Retailer"
            >
                <UserPlus size={28} />
            </button>

            {/* ============ DETAILS MODAL ============ */}
            <AnimatePresence>
                {selectedRetailer && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-white w-full max-w-lg rounded-[3rem] overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
                        >
                            {/* Modal Header */}
                            <div className="bg-gradient-to-br from-[#0d1b2e] to-[#1e3a5f] px-8 py-6 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-2xl font-black shadow-xl">
                                        {(selectedRetailer.name || selectedRetailer.username).charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-white uppercase italic">{selectedRetailer.name || selectedRetailer.username}</h3>
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase mt-1
                                            ${selectedRetailer.displayStatus === 'Approved' ? 'bg-emerald-500/30 text-emerald-300' :
                                                selectedRetailer.displayStatus === 'Pending' || selectedRetailer.displayStatus === 'Pending KYC' ? 'bg-amber-500/30 text-amber-300' : 'bg-red-500/30 text-red-300'}`}>
                                            {selectedRetailer.displayStatus || selectedRetailer.status}
                                        </span>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedRetailer(null)} className="p-2.5 text-white/50 hover:text-white hover:bg-white/10 rounded-2xl transition-all">
                                    <X size={22} />
                                </button>
                            </div>

                            <div className="p-8 space-y-6">
                                {/* Contact Details */}
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-l-4 border-blue-500 pl-3 mb-4">Contact Details</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-blue-50 rounded-2xl p-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Smartphone size={12} className="text-blue-500" />
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Mobile No.</p>
                                            </div>
                                            <p className="text-sm font-black text-slate-800">{selectedRetailer.mobile || selectedRetailer.phone || '—'}</p>
                                        </div>
                                        <div className="bg-purple-50 rounded-2xl p-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Mail size={12} className="text-purple-500" />
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Email</p>
                                            </div>
                                            <p className="text-xs font-black text-slate-800 break-all">{selectedRetailer.email || '—'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Shop Details */}
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-l-4 border-amber-500 pl-3 mb-4">Shop Details</p>
                                    <div className="space-y-3">
                                        <div className="bg-amber-50 rounded-2xl p-4 flex items-start gap-3">
                                            <Store size={16} className="text-amber-500 mt-0.5 shrink-0" />
                                            <div>
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Shop Name</p>
                                                <p className="text-sm font-black text-slate-800 mt-0.5">
                                                    {selectedRetailer.businessName || selectedRetailer.shopName || selectedRetailer.business_name || '—'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="bg-rose-50 rounded-2xl p-4 flex items-start gap-3">
                                            <MapPin size={16} className="text-rose-500 mt-0.5 shrink-0" />
                                            <div className="flex-1">
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Shop Address</p>
                                                <p className="text-sm font-semibold text-slate-700 mt-0.5 leading-relaxed">
                                                    {selectedRetailer.address || selectedRetailer.shopAddress ||
                                                        (selectedRetailer.city ? `${selectedRetailer.city}, ${selectedRetailer.state}` : '—')}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleOpenMap(selectedRetailer)}
                                                className="shrink-0 w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow border border-rose-100 hover:bg-rose-500 hover:text-white text-rose-400 transition-all"
                                                title="Google Maps par Dekho"
                                            >
                                                <Navigation size={15} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* KYC Status */}
                                <div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-l-4 border-emerald-500 pl-3 mb-4">KYC Verification</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        {[
                                            {
                                                label: 'Profile KYC',
                                                done: !!(selectedRetailer.kycDone || selectedRetailer.kyc_done || selectedRetailer.kyc_status === 'Approved' || selectedRetailer.profileKyc),
                                                icon: ShieldCheck
                                            },

                                        ].map(({ label, done, icon: Icon }) => (
                                            <div key={label} className={`rounded-2xl p-4 border-2 ${done ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-100'}`}>
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${done ? 'bg-emerald-100' : 'bg-red-100'}`}>
                                                    {done
                                                        ? <ShieldCheck size={20} className="text-emerald-600" />
                                                        : <ShieldOff size={20} className="text-red-400" />}
                                                </div>
                                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">{label}</p>
                                                <p className={`text-sm font-black mt-0.5 ${done ? 'text-emerald-600' : 'text-red-500'}`}>
                                                    {done ? 'âœ“ Completed' : 'âœ— Pending'}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Wallet */}
                                <div className="bg-[#0d1b2e] rounded-2xl p-5 text-white flex items-center justify-between">
                                    <div>
                                        <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest">Wallet Balance</p>
                                        <p className="text-2xl font-black italic mt-1">
                                            ₹ {parseFloat(selectedRetailer.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                    <Wallet size={32} className="text-white/20" />
                                </div>

                                {/* Action Buttons */}
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => handleOpenMap(selectedRetailer)}
                                        className="flex flex-col items-center gap-1.5 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-2xl font-black text-[9px] uppercase tracking-wider transition-all border border-emerald-100"
                                    >
                                        <Navigation size={18} />
                                        Map
                                    </button>
                                    <button
                                        onClick={() => {
                                            if ((selectedRetailer.displayStatus || selectedRetailer.status) === 'Pending KYC') {
                                                handleSendKycRequest(selectedRetailer);
                                            }
                                        }}
                                        disabled={(selectedRetailer.displayStatus || selectedRetailer.status) !== 'Pending KYC'}
                                        className="flex flex-col items-center gap-1.5 py-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-2xl font-black text-[9px] uppercase tracking-wider transition-all border border-blue-100 disabled:opacity-50"
                                    >
                                        <AlertCircle size={18} />
                                        Send KYC Request
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ============ ADD RETAILER MODAL ============ */}
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
                            className="bg-white w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl relative"
                        >
                            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">Naya Retailer Jodo</h3>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Same form as portal sign-up · Admin approval required</p>
                                </div>
                                <button onClick={() => setShowAddModal(false)} className="p-3 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-2xl transition-all">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="p-8">
                                <NetworkRegistrationForm
                                    roleLock="RETAILER"
                                    uplineId={(sharedDataService.getCurrentSuperDistributor() || {}).id}
                                    uplineRole="SUPER_DISTRIBUTOR"
                                    onCancel={() => setShowAddModal(false)}
                                    onSuccess={handleRegistrationSuccess}
                                    submitLabel="Submit for Admin Approval"
                                />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ============ SUCCESS MODAL ============ */}
            <AnimatePresence>
                {showSuccessView && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            className="bg-white w-full max-w-md rounded-[3rem] overflow-hidden shadow-2xl text-center p-10 relative"
                        >
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 via-emerald-400 to-blue-400"></div>
                            <div className="flex justify-center mb-6">
                                <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-xl">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-10 h-10">
                                        <path d="M20 6L9 17L4 12" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                            </div>
                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] mb-2">Request Sent!</p>
                            <h2 className="text-2xl font-black text-slate-800 italic mb-2">Awaiting Admin Approval</h2>
                            <p className="text-[11px] font-bold text-slate-500 px-4 mb-4">The retailer will be notified once the admin approves their registration. They can then log in and complete KYC.</p>
                            <div className="bg-slate-50 border-2 border-slate-100 rounded-3xl p-5 mb-6 text-left space-y-3 mt-2">
                                <div className="flex justify-between text-xs font-black uppercase tracking-wider">
                                    <span className="text-slate-400">Login ID:</span>
                                    <span className="text-slate-800">{createdCredentials?.loginId}</span>
                                </div>
                                <div className="flex justify-between text-xs font-black uppercase tracking-wider">
                                    <span className="text-slate-400">Password:</span>
                                    <span className="text-amber-600 font-mono">{createdCredentials?.password}</span>
                                </div>
                                <p className="text-[9px] font-bold text-slate-400 pt-2 border-t border-slate-200">Credentials will be emailed to the retailer once the admin approves the request.</p>
                            </div>
                            <button onClick={() => setShowSuccessView(false)} className="w-full bg-[#0d1b2e] text-white font-black py-4 rounded-2xl text-[11px] uppercase tracking-[0.25em] shadow-xl active:scale-95 transition-all">
                                Dashboard Par Jaao
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Retailers;
