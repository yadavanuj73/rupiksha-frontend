import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, Search, Filter, MoreHorizontal,
    Plus, Download, UserPlus, Shield,
    CheckCircle2, AlertCircle, Clock, X,
    Eye, Edit2, Wallet, Smartphone, Mail, MapPin
} from 'lucide-react';
import { sharedDataService } from '../../services/sharedDataService';
import { dataService } from '../../services/dataService';
import NetworkRegistrationForm from '../../components/shared/NetworkRegistrationForm';

const Distributors = () => {
    const [distributors, setDistributors] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [selectedDistributor, setSelectedDistributor] = useState(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
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
        const sa = sharedDataService.getCurrentSuperDistributor();
        if (!sa) return;
        const all = await dataService.getAllUsers();
        const myDists = (Array.isArray(all) ? all : [])
            .filter((u) => String(u?.role || '').toUpperCase() === 'DISTRIBUTOR')
            .filter((d) =>
                String(d?.addedByUserRef || '') === String(sa.id || '') ||
                String(d?.ownerId || '') === String(sa.id || '')
            )
            .map((d) => ({
                ...d,
                status: normalizeStatus(d.status),
                kycStatus: String(d.kycStatus || '').toUpperCase(),
                displayStatus: (normalizeStatus(d.status) === 'Approved' && String(d.kycStatus || '').toUpperCase() !== 'APPROVED')
                    ? 'Pending KYC'
                    : normalizeStatus(d.status)
            }));
        setDistributors(myDists);
    };

    const handleRegistrationSuccess = (applicant) => {
        setCreatedCredentials({
            loginId: applicant.mobile,
            password: applicant.password,
            portalType: 'Distributor'
        });
        setIsAddModalOpen(false);
        setShowSuccessView(true);
        loadData();
    };

    useEffect(() => {
        loadData();
        window.addEventListener('distributorDataUpdated', loadData);
        window.addEventListener('SuperDistributorDataUpdated', loadData);
        return () => {
            window.removeEventListener('distributorDataUpdated', loadData);
            window.removeEventListener('SuperDistributorDataUpdated', loadData);
        };
    }, []);

    const filtered = distributors.filter(d => {
        const matchesSearch = String(d.name || d.username || d.businessName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(d.mobile || '').includes(searchTerm);
        const matchesStatus = statusFilter === 'All'
            || d.status === statusFilter
            || (statusFilter === 'Pending KYC' && d.status === 'Approved' && d.kycStatus !== 'APPROVED')
            || (statusFilter === 'KYC Approved' && d.status === 'Approved' && d.kycStatus === 'APPROVED');
        return matchesSearch && matchesStatus;
    });

    const handleSendKycRequest = async (member) => {
        const id = String(member?.id || member?.username || '');
        if (!id) return;
        setKycPingLoadingId(id);
        try {
            await dataService.resendCredentials({
                ...member,
                name: member?.name || member?.fullName || member?.username,
                role: 'DISTRIBUTOR'
            });
            alert('KYC reminder sent to member. Ask them to complete KYC so admin can approve.');
        } catch {
            alert('Unable to send KYC reminder right now.');
        } finally {
            setKycPingLoadingId(null);
        }
    };

    const active = distributors.filter(d => d.displayStatus === 'Approved');

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 text-slate-900">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase italic">Distributor Control</h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Manage and track all registered distributors</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors flex items-center gap-2">
                        <Download size={14} /> Export
                    </button>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="bg-amber-500 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/30 hover:bg-amber-600 transition-colors flex items-center gap-2"
                    >
                        <UserPlus size={14} /> Add Distributor
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search by name, business or mobile..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-500 focus:bg-white text-sm transition-all"
                    />
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                    {['All', 'Pending', 'Pending KYC', 'KYC Approved'].map(status => (
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

            {/* Table */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Distributor</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Business</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Wallet</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filtered.length > 0 ? filtered.map((d, i) => (
                                <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center text-amber-700 font-black italic shadow-inner">
                                                {(d.name || 'D').charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-slate-800">{d.name}</p>
                                                <p className="text-[9px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded inline-block">ID: {d.id}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="space-y-1">
                                            <p className="text-xs font-bold text-slate-600 flex items-center gap-1.5"><Smartphone size={12} className="text-amber-500" /> {d.mobile}</p>
                                            <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 truncate max-w-[140px]"><Mail size={12} className="shrink-0" /> {d.email || '—'}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-[11px] font-black text-slate-600 uppercase italic opacity-80">{d.businessName || '—'}</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5 tracking-tighter">{d.city}, {d.state}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Wallet size={14} className="text-emerald-500" />
                                            <p className="text-xs font-black text-emerald-700 italic">₹ {d.wallet?.balance || '0.00'}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border
                                            ${d.displayStatus === 'Approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                d.displayStatus === 'Pending' || d.displayStatus === 'Pending KYC' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                    'bg-red-50 text-red-600 border-red-100'}`}>
                                            {d.displayStatus === 'Approved' ? <CheckCircle2 size={10} /> :
                                                d.displayStatus === 'Pending' || d.displayStatus === 'Pending KYC' ? <Clock size={10} /> : <AlertCircle size={10} />}
                                            {d.displayStatus || 'Unknown'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center gap-2">
                                            {(d.displayStatus === 'Pending' || d.displayStatus === 'Pending KYC') && (
                                                <span
                                                    className="px-2.5 py-1 bg-amber-50 text-amber-600 border border-amber-100 rounded-lg text-[9px] font-black uppercase tracking-wider"
                                                    title="Pending admin approval"
                                                >
                                                    Admin Review
                                                </span>
                                            )}
                                            {d.displayStatus === 'Pending KYC' && (
                                                <button
                                                    onClick={() => handleSendKycRequest(d)}
                                                    disabled={kycPingLoadingId === String(d.id || d.username || '')}
                                                    className="px-2.5 py-1 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg text-[9px] font-black uppercase tracking-wider disabled:opacity-60"
                                                    title="Send KYC completion reminder"
                                                >
                                                    {kycPingLoadingId === String(d.id || d.username || '') ? 'Sending...' : 'Send KYC Request'}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setSelectedDistributor(d)}
                                                className="p-2 bg-slate-50 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                                title="View Details"
                                            >
                                                <Eye size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="6" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="bg-slate-50 p-6 rounded-full border border-slate-100">
                                                <Users size={48} className="text-slate-200" />
                                            </div>
                                            <p className="text-slate-400 font-bold text-base uppercase tracking-widest italic">No distributors found</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                    { label: 'Network Reach', val: active.length, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50', sub: 'Active Distributors' },
                    { label: 'Pending Apps', val: distributors.filter(d => d.displayStatus === 'Pending' || d.displayStatus === 'Pending KYC').length, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50', sub: 'Applications' },
                    { label: 'Retailer Base', val: filtered.reduce((acc, curr) => acc + (curr.assignedRetailers?.length || 0), 0), icon: Users, color: 'text-blue-500', bg: 'bg-blue-50', sub: 'Linked Retailers' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm flex items-center justify-between group hover:border-amber-500 transition-all">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{stat.label}</p>
                            <p className="text-3xl font-black text-slate-800 mt-1">{stat.val}</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5 tracking-tighter">{stat.sub}</p>
                        </div>
                        <div className={`w-14 h-14 rounded-3xl ${stat.bg} ${stat.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                            <stat.icon size={28} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Details Modal */}
            <AnimatePresence>
                {selectedDistributor && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 30 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 30 }}
                            className="bg-white w-full max-w-3xl rounded-[3rem] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)]"
                        >
                            <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-[#f8fafc]">
                                <div className="flex items-center gap-5">
                                    <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center text-2xl font-black italic shadow-2xl shadow-amber-500/40 border-4 border-white">
                                        {(selectedDistributor.name || 'D').charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">{selectedDistributor.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[9px] font-black bg-blue-600 text-white px-3 py-0.5 rounded-full uppercase tracking-[0.1em]">Distributor Account</span>
                                            <span className={`text-[9px] font-black px-3 py-0.5 rounded-full uppercase tracking-[0.1em]
                                                ${selectedDistributor.displayStatus === 'Approved' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                                                {selectedDistributor.displayStatus || selectedDistributor.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedDistributor(null)} className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-200 rounded-2xl transition-all">
                                    <X size={28} />
                                </button>
                            </div>

                            <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-8">
                                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2 italic"><Users size={12} className="text-amber-500" /> General Info</p>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase">Username</p>
                                                <p className="text-xs font-black text-slate-700">{selectedDistributor.username}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase">Registered on</p>
                                                <p className="text-xs font-black text-slate-700">{new Date(selectedDistributor.createdAt).toLocaleDateString()}</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-[9px] font-bold text-slate-400 uppercase">Business Enterprise</p>
                                                <p className="text-xs font-black text-amber-600 uppercase italic">{selectedDistributor.businessName || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-6 px-4">
                                        <div className="flex items-center justify-between">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 italic"><MapPin size={12} className="text-amber-500" /> Location Details</p>
                                            <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${selectedDistributor.city}+${selectedDistributor.state}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-[9px] font-black text-amber-600 hover:underline uppercase"
                                            >
                                                Open Google Maps
                                            </a>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4">
                                            <div>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase">State / Territory</p>
                                                <p className="text-xs font-black text-slate-700">{selectedDistributor.state}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase">City & Pincode</p>
                                                <p className="text-xs font-black text-slate-700">{selectedDistributor.city} - {selectedDistributor.pincode}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-8 h-full flex flex-col">
                                    <div className="bg-gradient-to-br from-[#0d1b2e] to-[#162543] rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[140px]">
                                        <div className="relative z-10">
                                            <p className="text-[9px] font-black text-amber-400 uppercase tracking-[0.2em] mb-1">Corporate Wallet</p>
                                            <h2 className="text-3xl font-black italic">₹ {selectedDistributor.wallet?.balance || '0.00'}</h2>
                                        </div>
                                        <div className="flex justify-between items-end relative z-10">
                                            <div>
                                                <p className="text-[8px] font-black text-white/40 uppercase">Earnings</p>
                                                <p className="text-[10px] font-black text-emerald-400 italic">₹ {selectedDistributor.commissionEarned || '0.00'}</p>
                                            </div>
                                            <Shield size={24} className="text-amber-500 opacity-30" />
                                        </div>
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                                    </div>

                                    <div className="flex-1 min-h-0 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] p-6 flex flex-col gap-4">
                                        <div className="flex items-center justify-between px-2">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Linked Retailers</p>
                                            <span className="bg-amber-100 text-amber-700 text-[9px] font-black px-2 py-0.5 rounded-full">{(selectedDistributor.assignedRetailers || []).length} Units</span>
                                        </div>

                                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                                            {(selectedDistributor.assignedRetailers || []).length > 0 ? (
                                                selectedDistributor.assignedRetailers.map((username, idx) => (
                                                    <div key={idx} className="bg-white p-3 rounded-2xl border border-slate-200 flex items-center justify-between group/row">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black italic text-slate-500 group-hover/row:bg-amber-500 group-hover/row:text-white transition-all">
                                                                {idx + 1}
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] font-black text-slate-800 uppercase tracking-tight">{username}</p>
                                                                <p className="text-[8px] font-bold text-slate-400 uppercase">Registered Partner</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[10px] font-black text-blue-600 italic">₹ 0.00</p>
                                                            <p className="text-[8px] font-black text-slate-300 uppercase">Float</p>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                                                    <Users size={32} className="text-slate-200 mb-2" />
                                                    <p className="text-[10px] font-black text-slate-400 uppercase">No Retailers Linked</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-2 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">
                                            View-only for super distributor
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            {/* Add Distributor Modal */}
            <AnimatePresence>
                {isAddModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[110] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 30 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 30 }}
                            className="bg-white w-full max-w-2xl rounded-[3rem] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)]"
                        >
                            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-[#f8fafc]">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 uppercase italic tracking-tight">
                                        Add Partner Distributor
                                    </h3>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                        Same form as portal sign-up · Admin approval required
                                    </p>
                                </div>
                                <button onClick={() => setIsAddModalOpen(false)} className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-200 rounded-2xl transition-all">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="p-8">
                                <NetworkRegistrationForm
                                    roleLock="DISTRIBUTOR"
                                    uplineId={(sharedDataService.getCurrentSuperDistributor() || {}).id}
                                    uplineRole="SUPER_DISTRIBUTOR"
                                    onCancel={() => setIsAddModalOpen(false)}
                                    onSuccess={handleRegistrationSuccess}
                                    submitLabel="Submit for Admin Approval"
                                />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Success Modal */}
            <AnimatePresence>
                {showSuccessView && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 bg-[url('https://www.transparenttextures.com/patterns/confetti.png')]"
                    >
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            className="bg-white w-full max-w-md rounded-[3rem] overflow-hidden shadow-2xl text-center p-10 relative"
                        >
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 via-emerald-400 to-blue-400"></div>

                            <div className="flex justify-center mb-6">
                                <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center relative">
                                    <div className="absolute inset-0 bg-emerald-200 rounded-full animate-ping opacity-20"></div>
                                    <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-xl relative z-10">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-10 h-10">
                                            <path d="M20 6L9 17L4 12" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    </div>
                                </div>
                            </div>

                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] mb-2">REQUEST SUBMITTED</p>
                            <h2 className="text-3xl font-black text-slate-800 italic mb-2 tracking-tight">Awaiting Admin Approval</h2>
                            <p className="text-xs font-bold text-slate-500 mb-4 tracking-wide leading-relaxed px-4">
                                The distributor registration has been sent to the admin. They will be notified once approved and can then log in & complete KYC.
                            </p>

                            <div className="bg-slate-50 border-2 border-slate-100 rounded-3xl p-6 mb-8 text-left space-y-3">
                                <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider">
                                    <span className="text-slate-400">Login ID:</span>
                                    <span className="text-slate-800">{createdCredentials?.loginId}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider">
                                    <span className="text-slate-400">Password:</span>
                                    <span className="text-amber-600 font-mono text-sm">{createdCredentials?.password}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider pt-2 border-t border-slate-200">
                                    <span className="text-slate-400">Portal:</span>
                                    <span className="text-blue-600">{createdCredentials?.portalType}</span>
                                </div>
                            </div>

                            <button
                                onClick={() => setShowSuccessView(false)}
                                className="w-full bg-[#0d1b2e] text-white font-black py-5 rounded-2xl text-[11px] uppercase tracking-[0.25em] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                CONTINUE TO DASHBOARD
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Distributors;
