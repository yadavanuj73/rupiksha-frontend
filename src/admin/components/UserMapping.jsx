import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
    Network,
    Search,
    UserCheck,
    Users,
    Shield,
    Building2,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    RefreshCw,
    X,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    HelpCircle,
    ExternalLink,
    MapPin,
    Phone,
    FileText,
    History,
    Sparkles,
    UserX,
    Filter
} from 'lucide-react';
import { userMappingService } from '../../services/apiService';

const UserMapping = () => {
    // ── Form State ──
    const [selectedUserType, setSelectedUserType] = useState('RETAILER'); // RETAILER, DISTRIBUTOR, SUPER_DISTRIBUTOR

    // Step 1: Retailer Search & Selection
    const [retailerSearch, setRetailerSearch] = useState('');
    const [retailerSuggestions, setRetailerSuggestions] = useState([]);
    const [retailerSearching, setRetailerSearching] = useState(false);
    const [retailerSearchError, setRetailerSearchError] = useState(null);
    const [selectedRetailer, setSelectedRetailer] = useState(null);
    const [showRetailerDropdown, setShowRetailerDropdown] = useState(false);
    const retailerAbortRef = useRef(null);

    // Step 2: Target Map To Role & Parent Search
    const [targetRole, setTargetRole] = useState('ADMIN'); // ADMIN, DISTRIBUTOR, SUPER_DISTRIBUTOR
    const [parentSearch, setParentSearch] = useState('');
    const [parentSuggestions, setParentSuggestions] = useState([]);
    const [parentSearching, setParentSearching] = useState(false);
    const [parentSearchError, setParentSearchError] = useState(null);
    const [selectedParent, setSelectedParent] = useState(null);
    const [showParentDropdown, setShowParentDropdown] = useState(false);
    const parentAbortRef = useRef(null);

    // Remarks & Confirmation
    const [reason, setReason] = useState('');
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [mappingSubmitting, setMappingSubmitting] = useState(false);
    const [mappingError, setMappingError] = useState(null);
    const [mappingSuccess, setMappingSuccess] = useState(null);

    // ── Section 2: Table State ──
    const [activeTab, setActiveTab] = useState('current'); // 'current' | 'history'
    const [tableSearch, setTableSearch] = useState('');
    const [tableRoleFilter, setTableRoleFilter] = useState('ALL');
    const [tablePage, setTablePage] = useState(0);
    const [tableSize, setTableSize] = useState(10);
    const [tableLoading, setTableLoading] = useState(false);
    const [tableData, setTableData] = useState({ content: [], totalElements: 0, totalPages: 0 });
    const [tableError, setTableError] = useState(null);

    // Details Modal
    const [detailsModalUser, setDetailsModalUser] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsData, setDetailsData] = useState(null);

    const formRef = useRef(null);
    const retailerInputRef = useRef(null);
    const parentInputRef = useRef(null);

    // ─── Trigger Celebration Confetti ───
    const triggerConfetti = () => {
        try {
            confetti({
                particleCount: 80,
                spread: 70,
                origin: { y: 0.6 }
            });
        } catch (_) {}
    };

    // ─── Retailer Autocomplete Search (Debounced & Cancellable) ───
    useEffect(() => {
        const query = retailerSearch.trim();
        if (query.length < 2) {
            setRetailerSuggestions([]);
            setShowRetailerDropdown(false);
            setRetailerSearching(false);
            return;
        }

        const timer = setTimeout(() => {
            if (retailerAbortRef.current) {
                retailerAbortRef.current.abort();
            }
            const controller = new AbortController();
            retailerAbortRef.current = controller;

            setRetailerSearching(true);
            setRetailerSearchError(null);

            userMappingService.searchRetailers(query, 0, 10, controller.signal)
                .then(res => {
                    const list = res?.content || res?.data?.content || (Array.isArray(res) ? res : []);
                    setRetailerSuggestions(list);
                    setShowRetailerDropdown(true);
                })
                .catch(err => {
                    if (err.name !== 'AbortError') {
                        setRetailerSearchError(err?.message || 'Failed to search retailers');
                    }
                })
                .finally(() => {
                    setRetailerSearching(false);
                });
        }, 300);

        return () => clearTimeout(timer);
    }, [retailerSearch]);

    // ─── Parent Autocomplete Search (Debounced & Cancellable) ───
    useEffect(() => {
        if (targetRole === 'ADMIN') {
            setParentSuggestions([]);
            setShowParentDropdown(false);
            return;
        }

        const query = parentSearch.trim();
        if (query.length < 2) {
            setParentSuggestions([]);
            setShowParentDropdown(false);
            setParentSearching(false);
            return;
        }

        const timer = setTimeout(() => {
            if (parentAbortRef.current) {
                parentAbortRef.current.abort();
            }
            const controller = new AbortController();
            parentAbortRef.current = controller;

            setParentSearching(true);
            setParentSearchError(null);

            const searchFn = targetRole === 'DISTRIBUTOR'
                ? userMappingService.searchDistributors
                : userMappingService.searchSuperDistributors;

            searchFn(query, 0, 10, controller.signal)
                .then(res => {
                    const list = res?.content || res?.data?.content || (Array.isArray(res) ? res : []);
                    setParentSuggestions(list);
                    setShowParentDropdown(true);
                })
                .catch(err => {
                    if (err.name !== 'AbortError') {
                        setParentSearchError(err?.message || 'Failed to search parents');
                    }
                })
                .finally(() => {
                    setParentSearching(false);
                });
        }, 300);

        return () => clearTimeout(timer);
    }, [parentSearch, targetRole]);

    // ─── Fetch Table Data (Current Mappings or History) ───
    const fetchTableData = useCallback(() => {
        setTableLoading(true);
        setTableError(null);

        if (activeTab === 'current') {
            userMappingService.getCurrentMappings({
                search: tableSearch.trim(),
                role: tableRoleFilter,
                page: tablePage,
                size: tableSize
            })
                .then(res => {
                    setTableData({
                        content: res?.content || [],
                        totalElements: res?.totalElements || 0,
                        totalPages: res?.totalPages || 0
                    });
                })
                .catch(err => {
                    setTableError(err?.message || 'Failed to load mappings list');
                })
                .finally(() => setTableLoading(false));
        } else {
            userMappingService.getMappingHistory({
                search: tableSearch.trim(),
                page: tablePage,
                size: tableSize
            })
                .then(res => {
                    setTableData({
                        content: res?.content || [],
                        totalElements: res?.totalElements || 0,
                        totalPages: res?.totalPages || 0
                    });
                })
                .catch(err => {
                    setTableError(err?.message || 'Failed to load mapping history');
                })
                .finally(() => setTableLoading(false));
        }
    }, [activeTab, tableSearch, tableRoleFilter, tablePage, tableSize]);

    useEffect(() => {
        fetchTableData();
    }, [fetchTableData]);

    // ─── Select Retailer Handler ───
    const handleSelectRetailer = (retailer) => {
        setSelectedRetailer(retailer);
        setRetailerSearch('');
        setShowRetailerDropdown(false);
        setMappingError(null);
    };

    // ─── Select Parent Handler ───
    const handleSelectParent = (parent) => {
        setSelectedParent(parent);
        setParentSearch('');
        setShowParentDropdown(false);
        setMappingError(null);
    };

    // ─── Reset Form ───
    const handleResetForm = () => {
        setSelectedRetailer(null);
        setRetailerSearch('');
        setTargetRole('ADMIN');
        setSelectedParent(null);
        setParentSearch('');
        setReason('');
        setMappingError(null);
    };

    // ─── Open Details Modal ───
    const handleViewDetails = (retailerId) => {
        setDetailsModalUser(retailerId);
        setDetailsLoading(true);
        setDetailsData(null);
        userMappingService.getMappingDetails(retailerId)
            .then(data => setDetailsData(data))
            .catch(err => console.error(err))
            .finally(() => setDetailsLoading(false));
    };

    // ─── Quick Load Retailer for Remapping ───
    const handleQuickRemap = (item) => {
        setSelectedRetailer({
            id: item.retailerId || item.id,
            fullName: item.retailerName,
            partyCode: item.partyCode,
            mobile: item.mobile,
            address: item.address,
            currentOwnerName: item.parentName,
            currentOwnerPartyCode: item.parentPartyCode,
            currentOwnerRole: item.mappedUnder,
            status: item.status
        });
        setTargetRole(item.mappedUnder === 'ADMIN' ? 'DISTRIBUTOR' : 'ADMIN');
        setSelectedParent(null);
        setMappingError(null);

        // Smooth scroll to form
        if (formRef.current) {
            formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    // ─── Execute Mapping Submission ───
    const handleConfirmMapping = async () => {
        if (!selectedRetailer) return;
        if (targetRole !== 'ADMIN' && !selectedParent) {
            setMappingError(`Please search and select a ${targetRole === 'DISTRIBUTOR' ? 'Distributor' : 'Super Distributor'}.`);
            setShowConfirmModal(false);
            return;
        }

        setMappingSubmitting(true);
        setMappingError(null);

        try {
            const payload = {
                retailerId: selectedRetailer.id,
                targetRole,
                targetParentId: targetRole === 'ADMIN' ? null : selectedParent?.id,
                reason: reason.trim() || undefined
            };

            const res = await userMappingService.mapUser(payload);
            setShowConfirmModal(false);
            triggerConfetti();

            setMappingSuccess({
                message: res?.message || `Retailer mapped successfully under ${targetRole}!`,
                retailer: selectedRetailer.fullName,
                parent: targetRole === 'ADMIN' ? 'Admin' : selectedParent?.fullName
            });

            setTimeout(() => setMappingSuccess(null), 6000);

            // Notify other platform components (like EnhancedMembersTable)
            window.dispatchEvent(new Event('membersUpdated'));

            // Refresh table data
            fetchTableData();

            // Reset parent selection and reason, keep retailer updated
            setSelectedRetailer(prev => ({
                ...prev,
                currentOwnerName: targetRole === 'ADMIN' ? 'Admin' : selectedParent?.fullName,
                currentOwnerPartyCode: targetRole === 'ADMIN' ? 'RPADM' : selectedParent?.partyCode,
                currentOwnerRole: targetRole
            }));
            setSelectedParent(null);
            setReason('');
        } catch (err) {
            setShowConfirmModal(false);
            setMappingError(err?.message || 'Failed to update mapping hierarchy.');
        } finally {
            setMappingSubmitting(false);
        }
    };

    // ─── Helper for role badge colors ───
    const getRoleBadgeStyle = (role) => {
        const r = (role || '').toUpperCase();
        if (r === 'ADMIN') {
            return 'bg-blue-50 text-blue-700 border-blue-200';
        } else if (r === 'DISTRIBUTOR') {
            return 'bg-amber-50 text-amber-700 border-amber-200';
        } else if (r === 'SUPER_DISTRIBUTOR') {
            return 'bg-purple-50 text-purple-700 border-purple-200';
        }
        return 'bg-slate-50 text-slate-700 border-slate-200';
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-200" ref={formRef}>
            {/* ── Page Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-[0_4px_25px_rgb(0,0,0,0.02)]">
                <div className="flex items-center gap-4">
                    <div className="w-13 h-13 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                        <Network size={26} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">User Mapping</h1>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                                Hierarchy Engine
                            </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-500 mt-1">
                            Manage Retailer hierarchy and assign Retailers to Admin, Distributor or Super Distributor.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchTableData}
                        className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-2xl border border-slate-200 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                        title="Refresh data"
                    >
                        <RefreshCw size={14} className={tableLoading ? 'animate-spin text-indigo-600' : ''} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* ── Success Notification Banner ── */}
            <AnimatePresence>
                {mappingSuccess && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-2xl flex items-center justify-between shadow-sm"
                    >
                        <div className="flex items-center gap-3">
                            <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                            <div>
                                <p className="text-xs font-black uppercase tracking-wider">{mappingSuccess.message}</p>
                                <p className="text-xs text-emerald-700 font-medium">
                                    <strong>{mappingSuccess.retailer}</strong> is now mapped under <strong>{mappingSuccess.parent}</strong>. Future commissions will distribute automatically.
                                </p>
                            </div>
                        </div>
                        <button onClick={() => setMappingSuccess(null)} className="text-emerald-600 hover:text-emerald-800 p-1">
                            <X size={16} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Error Banner ── */}
            <AnimatePresence>
                {mappingError && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-rose-50 border border-rose-200 text-rose-900 p-4 rounded-2xl flex items-center justify-between shadow-sm"
                    >
                        <div className="flex items-center gap-3">
                            <AlertCircle size={20} className="text-rose-600 shrink-0" />
                            <p className="text-xs font-bold">{mappingError}</p>
                        </div>
                        <button onClick={() => setMappingError(null)} className="text-rose-600 hover:text-rose-800 p-1">
                            <X size={16} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── SECTION 1: MAPPING FORM ── */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_25px_rgb(0,0,0,0.02)] p-6 md:p-8 space-y-8">
                {/* Step 0: User Type Selection */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                            Select User Type to Map
                        </label>
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                            Initial Production Workflow: Retailer Mapping
                        </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                            { id: 'RETAILER', label: 'Retailer', desc: 'Map retail merchant under an upline', active: true },
                            { id: 'DISTRIBUTOR', label: 'Distributor', desc: 'Direct node under Super Distributor / Admin', active: false },
                            { id: 'SUPER_DISTRIBUTOR', label: 'Super Distributor', desc: 'Top-tier master distributor', active: false },
                        ].map((ut) => (
                            <button
                                key={ut.id}
                                type="button"
                                onClick={() => {
                                    if (ut.id === 'RETAILER') {
                                        setSelectedUserType('RETAILER');
                                    }
                                }}
                                className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                                    selectedUserType === ut.id
                                        ? 'border-indigo-600 bg-indigo-50/50 shadow-sm ring-2 ring-indigo-600/10'
                                        : 'border-slate-200 bg-slate-50/50 opacity-60 hover:opacity-100 hover:border-slate-300'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm font-black text-slate-800">{ut.label}</span>
                                    {selectedUserType === ut.id && (
                                        <CheckCircle2 size={16} className="text-indigo-600" />
                                    )}
                                </div>
                                <p className="text-[11px] text-slate-500 font-medium">{ut.desc}</p>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="border-t border-slate-100 pt-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* ── LEFT COLUMN: Step 1 – Select Retailer ── */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center">
                                    1
                                </span>
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                                    Select Retailer
                                </h3>
                            </div>
                            {selectedRetailer && (
                                <button
                                    onClick={() => setSelectedRetailer(null)}
                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                                >
                                    Change Retailer
                                </button>
                            )}
                        </div>

                        {!selectedRetailer ? (
                            <div className="relative" ref={retailerInputRef}>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={retailerSearch}
                                        onChange={(e) => setRetailerSearch(e.target.value)}
                                        onFocus={() => {
                                            if (retailerSuggestions.length > 0) setShowRetailerDropdown(true);
                                        }}
                                        placeholder="Search by Mobile number or Party code (e.g. 9876543210 / RPRBR...)"
                                        className="w-full pl-11 pr-10 py-3.5 bg-slate-50/70 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 outline-none focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-600/10 transition-all placeholder:text-slate-400"
                                    />
                                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    {retailerSearching && (
                                        <RefreshCw size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-indigo-600 animate-spin" />
                                    )}
                                    {retailerSearch && !retailerSearching && (
                                        <button
                                            onClick={() => { setRetailerSearch(''); setRetailerSuggestions([]); }}
                                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>

                                {/* Autocomplete Dropdown */}
                                <AnimatePresence>
                                    {showRetailerDropdown && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 5 }}
                                            className="absolute z-30 left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-72 overflow-y-auto divide-y divide-slate-100"
                                        >
                                            {retailerSuggestions.length > 0 ? (
                                                retailerSuggestions.map((item) => (
                                                    <div
                                                        key={item.id}
                                                        onClick={() => handleSelectRetailer(item)}
                                                        className="p-3.5 hover:bg-indigo-50/60 cursor-pointer transition-colors flex items-start justify-between gap-3"
                                                    >
                                                        <div className="space-y-1 flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-black text-slate-900">{item.fullName}</span>
                                                                <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                                                    {item.partyCode || '—'}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-x-3 text-[11px] text-slate-500 font-medium">
                                                                <span className="flex items-center gap-1">
                                                                    <Phone size={11} className="text-slate-400" />
                                                                    {item.mobile}
                                                                </span>
                                                                <span className="flex items-center gap-1">
                                                                    <MapPin size={11} className="text-slate-400" />
                                                                    {item.address}
                                                                </span>
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 font-medium">
                                                                Current Owner: <span className="font-bold text-slate-600">{item.currentOwnerName}</span> ({item.currentOwnerRole})
                                                            </div>
                                                        </div>
                                                        <button className="px-2.5 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-700">
                                                            Select
                                                        </button>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-6 text-center text-xs text-slate-400">
                                                    No retailers found matching "{retailerSearch}"
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                {retailerSearchError && (
                                    <p className="text-[11px] font-bold text-rose-500 mt-1">{retailerSearchError}</p>
                                )}
                            </div>
                        ) : (
                            /* Selected Retailer Card */
                            <div className="bg-indigo-50/50 border-2 border-indigo-200/80 rounded-2xl p-5 space-y-3 shadow-sm">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center shadow-md">
                                            {selectedRetailer.fullName?.charAt(0) || 'R'}
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-black text-slate-900">{selectedRetailer.fullName}</h4>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[11px] font-mono font-bold text-indigo-700 bg-white px-1.5 py-0.2 rounded border border-indigo-200">
                                                    {selectedRetailer.partyCode || '—'}
                                                </span>
                                                <span className="text-xs text-slate-600 font-semibold">{selectedRetailer.mobile}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full uppercase">
                                        Selected
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-indigo-100/80 text-slate-600 font-medium">
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-indigo-400 block tracking-wider">Address</span>
                                        <span className="truncate block">{selectedRetailer.address || '—'}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-indigo-400 block tracking-wider">Current Owner</span>
                                        <span className="font-bold text-slate-800 block">
                                            {selectedRetailer.currentOwnerName}
                                            {selectedRetailer.currentOwnerRole ? ` (${selectedRetailer.currentOwnerRole})` : ''}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── RIGHT COLUMN: Step 2 – Map To ── */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center">
                                2
                            </span>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                                Map To (Target Parent)
                            </h3>
                        </div>

                        {/* 3 Map To Options */}
                        <div className="grid grid-cols-3 gap-2.5">
                            {[
                                { id: 'ADMIN', label: 'Admin', icon: Shield, desc: 'Direct mapping' },
                                { id: 'DISTRIBUTOR', label: 'Distributor', icon: Building2, desc: 'Assign upline' },
                                { id: 'SUPER_DISTRIBUTOR', label: 'Super Dist.', icon: Users, desc: 'Master upline' },
                            ].map((opt) => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => {
                                        setTargetRole(opt.id);
                                        setSelectedParent(null);
                                        setParentSearch('');
                                        setMappingError(null);
                                    }}
                                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                                        targetRole === opt.id
                                            ? 'border-indigo-600 bg-indigo-600 text-white shadow-md'
                                            : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-slate-100'
                                    }`}
                                >
                                    <opt.icon size={18} className={targetRole === opt.id ? 'text-white' : 'text-slate-500'} />
                                    <span className="text-xs font-black">{opt.label}</span>
                                    <span className={`text-[9px] font-medium ${targetRole === opt.id ? 'text-indigo-100' : 'text-slate-400'}`}>
                                        {opt.desc}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Option A: Admin */}
                        {targetRole === 'ADMIN' && (
                            <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 text-xs space-y-1.5">
                                <div className="flex items-center gap-2 text-indigo-700 font-black">
                                    <Shield size={16} />
                                    <span>Direct Admin Mapping</span>
                                </div>
                                <p className="text-slate-600 font-medium">
                                    The selected Retailer will be mapped directly under <strong>System Admin</strong>.
                                    No intermediate Distributor commissions will be generated.
                                </p>
                            </div>
                        )}

                        {/* Option B & C: Distributor or Super Distributor Search */}
                        {(targetRole === 'DISTRIBUTOR' || targetRole === 'SUPER_DISTRIBUTOR') && (
                            <div className="space-y-3">
                                {!selectedParent ? (
                                    <div className="relative" ref={parentInputRef}>
                                        <label className="text-[10px] font-black uppercase text-slate-400 block mb-1 tracking-wider">
                                            Search {targetRole === 'DISTRIBUTOR' ? 'Distributor' : 'Super Distributor'}
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={parentSearch}
                                                onChange={(e) => setParentSearch(e.target.value)}
                                                onFocus={() => {
                                                    if (parentSuggestions.length > 0) setShowParentDropdown(true);
                                                }}
                                                placeholder={`Type Mobile number or Party code of ${targetRole === 'DISTRIBUTOR' ? 'Distributor' : 'Super Distributor'}...`}
                                                className="w-full pl-11 pr-10 py-3.5 bg-slate-50/70 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 outline-none focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-600/10 transition-all placeholder:text-slate-400"
                                            />
                                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            {parentSearching && (
                                                <RefreshCw size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-indigo-600 animate-spin" />
                                            )}
                                        </div>

                                        {/* Dropdown Suggestions */}
                                        <AnimatePresence>
                                            {showParentDropdown && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 5 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 5 }}
                                                    className="absolute z-30 left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-72 overflow-y-auto divide-y divide-slate-100"
                                                >
                                                    {parentSuggestions.length > 0 ? (
                                                        parentSuggestions.map((item) => (
                                                            <div
                                                                key={item.id}
                                                                onClick={() => handleSelectParent(item)}
                                                                className="p-3.5 hover:bg-indigo-50/60 cursor-pointer transition-colors flex items-start justify-between gap-3"
                                                            >
                                                                <div className="space-y-1 flex-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-black text-slate-900">{item.fullName}</span>
                                                                        <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                                                            {item.partyCode || '—'}
                                                                        </span>
                                                                        <span className="text-[9px] px-1.5 py-0.2 rounded font-black bg-emerald-50 text-emerald-700">
                                                                            {item.status}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex flex-wrap items-center gap-x-3 text-[11px] text-slate-500 font-medium">
                                                                        <span className="flex items-center gap-1">
                                                                            <Phone size={11} className="text-slate-400" />
                                                                            {item.mobile}
                                                                        </span>
                                                                        <span className="flex items-center gap-1">
                                                                            <MapPin size={11} className="text-slate-400" />
                                                                            {item.address}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <button className="px-2.5 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-lg hover:bg-indigo-700">
                                                                    Select
                                                                </button>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="p-6 text-center text-xs text-slate-400">
                                                            No {targetRole.toLowerCase()} found matching "{parentSearch}"
                                                        </div>
                                                    )}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                        {parentSearchError && (
                                            <p className="text-[11px] font-bold text-rose-500 mt-1">{parentSearchError}</p>
                                        )}
                                    </div>
                                ) : (
                                    /* Selected Parent Detail Card */
                                    <div className="bg-slate-50 border-2 border-indigo-200 rounded-2xl p-4 space-y-2">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center">
                                                    {selectedParent.fullName?.charAt(0) || 'P'}
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-black text-slate-900">{selectedParent.fullName}</h4>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[10px] font-mono font-bold text-indigo-700 bg-white px-1.5 py-0.2 rounded border border-indigo-200">
                                                            {selectedParent.partyCode}
                                                        </span>
                                                        <span className="text-xs text-slate-600 font-semibold">{selectedParent.mobile}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setSelectedParent(null)}
                                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                                            >
                                                Change
                                            </button>
                                        </div>
                                        <p className="text-[11px] text-slate-500 truncate pt-1 border-t border-slate-200/60">
                                            <MapPin size={11} className="inline mr-1 text-slate-400" />
                                            {selectedParent.address}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Optional Reason / Remarks Field */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">
                                Reason / Remarks (Optional)
                            </label>
                            <input
                                type="text"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="e.g. Territory realignment, partner request..."
                                className="w-full px-4 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-600 focus:bg-white"
                            />
                        </div>

                        {/* Submit Actions */}
                        <div className="pt-2 flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setShowConfirmModal(true)}
                                disabled={
                                    !selectedRetailer ||
                                    (targetRole !== 'ADMIN' && !selectedParent) ||
                                    mappingSubmitting
                                }
                                className={`flex-1 py-3.5 px-6 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                    !selectedRetailer || (targetRole !== 'ADMIN' && !selectedParent) || mappingSubmitting
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 active:scale-[0.99]'
                                }`}
                            >
                                {mappingSubmitting ? (
                                    <>
                                        <RefreshCw size={15} className="animate-spin" />
                                        <span>Mapping User...</span>
                                    </>
                                ) : (
                                    <>
                                        <UserCheck size={16} />
                                        <span>Map User</span>
                                    </>
                                )}
                            </button>

                            {(selectedRetailer || selectedParent) && (
                                <button
                                    type="button"
                                    onClick={handleResetForm}
                                    className="py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all"
                                >
                                    Reset
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── SECTION 2: CURRENT MAPPINGS & AUDIT HISTORY TABLE ── */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_4px_25px_rgb(0,0,0,0.02)] overflow-hidden space-y-4">
                {/* Table Header & Controls */}
                <div className="p-6 border-b border-slate-100 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="flex p-1 bg-slate-100 rounded-2xl">
                                <button
                                    onClick={() => { setActiveTab('current'); setTablePage(0); }}
                                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                        activeTab === 'current'
                                            ? 'bg-white text-slate-900 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    Current Mappings
                                </button>
                                <button
                                    onClick={() => { setActiveTab('history'); setTablePage(0); }}
                                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                                        activeTab === 'history'
                                            ? 'bg-white text-slate-900 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <History size={13} />
                                    <span>Audit History</span>
                                </button>
                            </div>
                            <span className="text-xs text-slate-400 font-bold">
                                ({tableData.totalElements} records)
                            </span>
                        </div>

                        {/* Search & Role Filter */}
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative min-w-[220px]">
                                <input
                                    type="text"
                                    value={tableSearch}
                                    onChange={(e) => { setTableSearch(e.target.value); setTablePage(0); }}
                                    placeholder="Filter by name, party code, mobile..."
                                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-indigo-600 focus:bg-white"
                                />
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            </div>

                            {activeTab === 'current' && (
                                <div className="flex items-center gap-2">
                                    <Filter size={14} className="text-slate-400" />
                                    <select
                                        value={tableRoleFilter}
                                        onChange={(e) => { setTableRoleFilter(e.target.value); setTablePage(0); }}
                                        className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 py-2 px-3 rounded-xl outline-none focus:border-indigo-600 cursor-pointer"
                                    >
                                        <option value="ALL">All Roles</option>
                                        <option value="ADMIN">Admin (Direct)</option>
                                        <option value="DISTRIBUTOR">Distributor</option>
                                        <option value="SUPER_DISTRIBUTOR">Super Distributor</option>
                                    </select>
                                </div>
                            )}

                            <select
                                value={tableSize}
                                onChange={(e) => { setTableSize(Number(e.target.value)); setTablePage(0); }}
                                className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 py-2 px-2.5 rounded-xl outline-none cursor-pointer"
                            >
                                <option value={10}>10 / page</option>
                                <option value={25}>25 / page</option>
                                <option value={50}>50 / page</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Table Content */}
                <div className="overflow-x-auto">
                    {activeTab === 'current' ? (
                        /* Current Mappings Table */
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider border-y border-slate-200">
                                    <th className="px-4 py-3 text-center">#</th>
                                    <th className="px-4 py-3">Retailer Name</th>
                                    <th className="px-4 py-3">Party Code</th>
                                    <th className="px-4 py-3">Mobile</th>
                                    <th className="px-4 py-3">Address</th>
                                    <th className="px-4 py-3">Mapped Under</th>
                                    <th className="px-4 py-3">Parent Name</th>
                                    <th className="px-4 py-3">Parent Code</th>
                                    <th className="px-4 py-3">Mapping Date</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {tableLoading ? (
                                    [...Array(5)].map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={11} className="px-4 py-4 text-center text-slate-300">
                                                Loading mappings...
                                            </td>
                                        </tr>
                                    ))
                                ) : tableData.content.length > 0 ? (
                                    tableData.content.map((row, index) => (
                                        <tr key={row.retailerId || row.id || index} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-400">
                                                {tablePage * tableSize + index + 1}
                                            </td>
                                            <td className="px-4 py-3.5 font-bold text-slate-900">
                                                {row.retailerName}
                                            </td>
                                            <td className="px-4 py-3.5 font-mono font-bold text-indigo-600">
                                                {row.partyCode || '—'}
                                            </td>
                                            <td className="px-4 py-3.5 text-slate-600 font-medium">
                                                {row.mobile}
                                            </td>
                                            <td className="px-4 py-3.5 text-slate-500 truncate max-w-[180px]" title={row.address}>
                                                {row.address || '—'}
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${getRoleBadgeStyle(row.mappedUnder)}`}>
                                                    {row.mappedUnder || 'ADMIN'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 font-bold text-slate-800">
                                                {row.parentName || 'System Admin'}
                                            </td>
                                            <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500 font-semibold">
                                                {row.parentPartyCode || '—'}
                                            </td>
                                            <td className="px-4 py-3.5 text-slate-500 text-[11px]">
                                                {row.mappingDate ? new Date(row.mappingDate).toLocaleDateString('en-IN', {
                                                    day: '2-digit', month: 'short', year: 'numeric',
                                                    hour: '2-digit', minute: '2-digit'
                                                }) : '—'}
                                            </td>
                                            <td className="px-4 py-3.5 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                                    row.active || row.status === 'ACTIVE'
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                }`}>
                                                    {row.status || 'ACTIVE'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => handleViewDetails(row.retailerId || row.id)}
                                                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                                                        title="View Details"
                                                    >
                                                        Details
                                                    </button>
                                                    <button
                                                        onClick={() => handleQuickRemap(row)}
                                                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer shadow-sm"
                                                        title="Change Mapping"
                                                    >
                                                        Change
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={11} className="p-12 text-center text-slate-400">
                                            <UserX size={36} className="mx-auto text-slate-300 mb-2" />
                                            <p className="font-bold text-sm text-slate-600">No Retailer mappings found</p>
                                            <p className="text-xs text-slate-400 mt-1">Try adjusting your search or role filter.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    ) : (
                        /* Audit History Table */
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-wider border-y border-slate-200">
                                    <th className="px-4 py-3 text-center">#</th>
                                    <th className="px-4 py-3">Date & Time</th>
                                    <th className="px-4 py-3">Retailer</th>
                                    <th className="px-4 py-3">Party Code</th>
                                    <th className="px-4 py-3">Previous Parent</th>
                                    <th className="px-4 py-3">New Parent</th>
                                    <th className="px-4 py-3">Action Type</th>
                                    <th className="px-4 py-3">Admin</th>
                                    <th className="px-4 py-3">Reason</th>
                                    <th className="px-4 py-3 text-center">Audit Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs">
                                {tableLoading ? (
                                    [...Array(5)].map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={10} className="px-4 py-4 text-center text-slate-300">
                                                Loading audit history...
                                            </td>
                                        </tr>
                                    ))
                                ) : tableData.content.length > 0 ? (
                                    tableData.content.map((item, index) => (
                                        <tr key={item.mappingId || index} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-400">
                                                {tablePage * tableSize + index + 1}
                                            </td>
                                            <td className="px-4 py-3.5 text-slate-600 font-mono text-[11px]">
                                                {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN', {
                                                    day: '2-digit', month: 'short', year: 'numeric',
                                                    hour: '2-digit', minute: '2-digit'
                                                }) : '—'}
                                            </td>
                                            <td className="px-4 py-3.5 font-bold text-slate-900">
                                                {item.retailerName}
                                            </td>
                                            <td className="px-4 py-3.5 font-mono text-indigo-600 font-bold">
                                                {item.retailerPartyCode || '—'}
                                            </td>
                                            <td className="px-4 py-3.5 text-slate-600">
                                                {item.previousParentName ? (
                                                    <div>
                                                        <span className="font-semibold text-slate-800">{item.previousParentName}</span>
                                                        <span className="block text-[10px] text-slate-400 font-mono">
                                                            {item.previousParentRole || ''}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic">None / Initial</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <div className="font-bold text-slate-900">{item.newParentName}</div>
                                                <span className={`px-2 py-0.2 rounded text-[9px] font-black uppercase border ${getRoleBadgeStyle(item.newParentRole)}`}>
                                                    {item.newParentRole}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3.5 font-semibold text-slate-700">
                                                {item.actionType}
                                            </td>
                                            <td className="px-4 py-3.5 font-mono font-bold text-slate-600">
                                                {item.mappedByAdminUsername || 'admin'}
                                            </td>
                                            <td className="px-4 py-3.5 text-slate-500 italic max-w-[150px] truncate" title={item.reason}>
                                                {item.reason || '—'}
                                            </td>
                                            <td className="px-4 py-3.5 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                                    item.status === 'ACTIVE'
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                    {item.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={10} className="p-12 text-center text-slate-400">
                                            <History size={36} className="mx-auto text-slate-300 mb-2" />
                                            <p className="font-bold text-sm text-slate-600">No mapping audit history found</p>
                                            <p className="text-xs text-slate-400 mt-1">Changes made to Retailer hierarchies will appear here.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {tableData.totalPages > 1 && (
                    <div className="p-4 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-medium">
                            Showing page <strong>{tablePage + 1}</strong> of <strong>{tableData.totalPages}</strong> ({tableData.totalElements} items)
                        </span>

                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setTablePage(p => Math.max(0, p - 1))}
                                disabled={tablePage === 0}
                                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="px-3 py-1 bg-slate-100 rounded-xl text-xs font-black text-slate-700">
                                {tablePage + 1}
                            </span>
                            <button
                                onClick={() => setTablePage(p => Math.min(tableData.totalPages - 1, p + 1))}
                                disabled={tablePage >= tableData.totalPages - 1}
                                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── CONFIRMATION MODAL ── */}
            <AnimatePresence>
                {showConfirmModal && selectedRetailer && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl border border-slate-100"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center">
                                    <HelpCircle size={24} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900">Confirm Hierarchy Mapping</h3>
                                    <p className="text-xs text-slate-500 font-medium">Please review the proposed mapping relationship.</p>
                                </div>
                            </div>

                            <div className="bg-slate-50 rounded-2xl p-4 space-y-3 text-xs border border-slate-200">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                                    <span className="text-slate-500 font-semibold">Retailer:</span>
                                    <span className="font-bold text-slate-900">{selectedRetailer.fullName} ({selectedRetailer.partyCode})</span>
                                </div>
                                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                                    <span className="text-slate-500 font-semibold">Current Owner:</span>
                                    <span className="font-bold text-slate-700">{selectedRetailer.currentOwnerName || 'Admin / Direct'}</span>
                                </div>
                                <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-indigo-700 font-black">
                                    <span>New Target Upline:</span>
                                    <span>
                                        {targetRole === 'ADMIN' ? 'System Admin (Direct)' : `${selectedParent?.fullName} (${targetRole})`}
                                    </span>
                                </div>
                                {reason && (
                                    <div className="flex items-center justify-between text-slate-600 font-medium">
                                        <span>Remarks:</span>
                                        <span className="italic">{reason}</span>
                                    </div>
                                )}
                            </div>

                            <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 text-[11px] font-medium">
                                <strong>Financial Notice:</strong> Future eligible transactions by this Retailer will distribute commissions to the new upline. Past historical transactions and commissions are strictly preserved.
                            </div>

                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    onClick={() => setShowConfirmModal(false)}
                                    className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmMapping}
                                    disabled={mappingSubmitting}
                                    className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20"
                                >
                                    {mappingSubmitting ? (
                                        <>
                                            <RefreshCw size={14} className="animate-spin" />
                                            <span>Processing...</span>
                                        </>
                                    ) : (
                                        <span>Confirm & Map</span>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── DETAILS MODAL ── */}
            <AnimatePresence>
                {detailsModalUser && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-100"
                        >
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                    <FileText size={18} className="text-indigo-600" />
                                    <h3 className="text-sm font-black text-slate-900 uppercase">Mapping Details</h3>
                                </div>
                                <button
                                    onClick={() => setDetailsModalUser(null)}
                                    className="text-slate-400 hover:text-slate-600 p-1"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {detailsLoading ? (
                                <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                                    <RefreshCw size={20} className="animate-spin text-indigo-600" />
                                    <span>Loading details...</span>
                                </div>
                            ) : detailsData ? (
                                <div className="space-y-4 text-xs">
                                    <div className="bg-slate-50 p-4 rounded-2xl space-y-2 border border-slate-100">
                                        <div className="flex justify-between">
                                            <span className="text-slate-500 font-semibold">Retailer:</span>
                                            <span className="font-black text-slate-900">{detailsData.retailerName}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500 font-semibold">Party Code:</span>
                                            <span className="font-mono font-bold text-indigo-600">{detailsData.partyCode || '—'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500 font-semibold">Mobile:</span>
                                            <span className="font-semibold text-slate-800">{detailsData.mobile}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500 font-semibold">Address:</span>
                                            <span className="text-slate-700 truncate max-w-[200px]">{detailsData.address}</span>
                                        </div>
                                    </div>

                                    <div className="bg-indigo-50/60 p-4 rounded-2xl space-y-2 border border-indigo-100">
                                        <p className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">
                                            Current Assigned Upline
                                        </p>
                                        <div className="flex justify-between">
                                            <span className="text-slate-600 font-medium">Mapped Under:</span>
                                            <span className="font-bold text-indigo-900">{detailsData.currentOwnerRole}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-600 font-medium">Parent Name:</span>
                                            <span className="font-bold text-slate-900">{detailsData.currentOwnerName}</span>
                                        </div>
                                        {detailsData.currentOwnerPartyCode && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-600 font-medium">Parent Party Code:</span>
                                                <span className="font-mono font-semibold text-slate-700">{detailsData.currentOwnerPartyCode}</span>
                                            </div>
                                        )}
                                        {detailsData.currentOwnerMobile && (
                                            <div className="flex justify-between">
                                                <span className="text-slate-600 font-medium">Parent Mobile:</span>
                                                <span className="font-semibold text-slate-700">{detailsData.currentOwnerMobile}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="text-[11px] text-slate-500 space-y-1">
                                        <div className="flex justify-between">
                                            <span>Last Updated:</span>
                                            <span className="font-semibold text-slate-700">
                                                {detailsData.lastMappedAt ? new Date(detailsData.lastMappedAt).toLocaleString('en-IN') : '—'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Action By:</span>
                                            <span className="font-semibold text-slate-700">{detailsData.lastMappedByAdmin || 'admin'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Total Mapping Changes:</span>
                                            <span className="font-bold text-indigo-600">{detailsData.mappingHistoryCount}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            <button
                                onClick={() => setDetailsModalUser(null)}
                                className="w-full py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                            >
                                Close
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default UserMapping;
