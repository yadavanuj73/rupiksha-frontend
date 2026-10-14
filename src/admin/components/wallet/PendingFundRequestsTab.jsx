import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Clock, CheckCircle2, XCircle, AlertTriangle, Search, RefreshCcw,
    IndianRupee, Copy, Check, FileText, User, ArrowDownCircle, Plus, X, Loader2
} from 'lucide-react';
import { fetchAPI, fireCelebration, fmtINR, fmtDateTime, UserSelector } from './walletShared';
import { dataService } from '../../../services/dataService';

const PendingFundRequestsTab = ({ users = [], onToast, onRefresh }) => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [copiedUtr, setCopiedUtr] = useState(null);

    // Modal states
    const [approveModalItem, setApproveModalItem] = useState(null);
    const [approveRemark, setApproveRemark] = useState('');
    const [approving, setApproving] = useState(false);

    const [declineModalItem, setDeclineModalItem] = useState(null);
    const [declineReason, setDeclineReason] = useState('Payment not received in company bank account');
    const [declineRemark, setDeclineRemark] = useState('');
    const [declining, setDeclining] = useState(false);

    // Create request modal
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState({
        userId: '',
        amount: '',
        method: 'UPI',
        utrNumber: '',
        remark: ''
    });
    const [creating, setCreating] = useState(false);

    const loadRequests = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchAPI('/admin/wallet/fund-requests');
            if (res && res.success && Array.isArray(res.requests)) {
                const pendings = res.requests.filter(
                    r => (r.status || 'PENDING').toUpperCase() === 'PENDING'
                );
                setRequests(pendings);
            } else {
                setRequests([]);
            }
        } catch (e) {
            console.error('Failed to load fund requests:', e);
            setRequests([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    const handleCopyUtr = (utr) => {
        if (!utr) return;
        navigator.clipboard?.writeText(utr);
        setCopiedUtr(utr);
        setTimeout(() => setCopiedUtr(null), 2000);
    };

    // ── Approve Action (Direct DB & Backend) ──
    const handleConfirmApprove = async () => {
        if (!approveModalItem) return;
        setApproving(true);
        const req = approveModalItem;
        const numAmount = parseFloat(req.amount) || 0;
        const targetUserId = req.userId || req.username;

        try {
            const res = await fetchAPI('/admin/wallet/approve-request', {
                method: 'POST',
                body: JSON.stringify({
                    requestId: req.id,
                    remark: approveRemark || 'Approved and credited by Admin',
                    adminRemark: approveRemark || 'Approved and credited by Admin'
                })
            });

            if (res && res.success) {
                fireCelebration();
                onToast({
                    type: 'success',
                    message: `Fund Request approved! ${fmtINR(numAmount)} has been credited to ${req.fullName || req.name || targetUserId}'s wallet.`
                });
                setApproveModalItem(null);
                setApproveRemark('');
                loadRequests();
                if (onRefresh) onRefresh();
            } else {
                onToast({
                    type: 'error',
                    message: res?.message || res?.error || 'Failed to approve fund request'
                });
            }
        } catch (e) {
            onToast({ type: 'error', message: 'Network error approving fund request' });
        } finally {
            setApproving(false);
        }
    };

    // ── Decline Action (Direct DB & Backend) ──
    const handleConfirmDecline = async () => {
        if (!declineModalItem) return;
        setDeclining(true);
        const req = declineModalItem;
        const fullDeclineNote = `${declineReason}${declineRemark ? ` - ${declineRemark}` : ''}`;

        try {
            const res = await fetchAPI('/admin/wallet/reject-request', {
                method: 'POST',
                body: JSON.stringify({
                    requestId: req.id,
                    remark: fullDeclineNote,
                    reason: fullDeclineNote,
                    adminRemark: fullDeclineNote
                })
            });

            if (res && res.success) {
                onToast({
                    type: 'error',
                    message: `Fund Request for ${fmtINR(req.amount)} was declined. Amount was NOT credited.`
                });
                setDeclineModalItem(null);
                setDeclineReason('Payment not received in company bank account');
                setDeclineRemark('');
                loadRequests();
                if (onRefresh) onRefresh();
            } else {
                onToast({
                    type: 'error',
                    message: res?.message || res?.error || 'Failed to decline fund request'
                });
            }
        } catch (e) {
            onToast({ type: 'error', message: 'Network error declining fund request' });
        } finally {
            setDeclining(false);
        }
    };

    // ── Create New Request on behalf of user (Direct DB & Backend) ──
    const handleCreateRequest = async (e) => {
        e.preventDefault();
        if (!createForm.userId) return onToast({ type: 'error', message: 'Please select a user' });
        const numAmt = parseFloat(createForm.amount);
        if (!numAmt || numAmt <= 0) return onToast({ type: 'error', message: 'Please enter a valid amount' });

        setCreating(true);
        try {
            const res = await fetchAPI('/admin/wallet/fund-request', {
                method: 'POST',
                body: JSON.stringify({
                    userId: createForm.userId,
                    amount: numAmt,
                    method: createForm.method,
                    utrNumber: createForm.utrNumber || `UTR${Date.now().toString().slice(-8)}`,
                    remark: createForm.remark || 'Manual fund request raised by Admin'
                })
            });

            if (res && res.success) {
                onToast({
                    type: 'success',
                    message: `Fund Request for ${fmtINR(numAmt)} submitted successfully to database.`
                });
                setShowCreateModal(false);
                setCreateForm({ userId: '', amount: '', method: 'UPI', utrNumber: '', remark: '' });
                loadRequests();
            } else {
                onToast({
                    type: 'error',
                    message: res?.message || res?.error || 'Failed to submit fund request'
                });
            }
        } catch (e) {
            onToast({ type: 'error', message: 'Network error submitting fund request' });
        } finally {
            setCreating(false);
        }
    };

    const filtered = requests.filter(r => {
        const matchesSearch =
            (r.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (r.username || '').toLowerCase().includes(search.toLowerCase()) ||
            String(r.mobile || '').includes(search) ||
            String(r.utrNumber || '').toLowerCase().includes(search.toLowerCase());

        const matchesRole = roleFilter === 'ALL' || (r.role || '').toUpperCase() === roleFilter;
        return matchesSearch && matchesRole;
    });

    const totalPendingAmount = requests.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

    const getRoleBadge = (role) => {
        const r = (role || 'RETAILER').toUpperCase();
        if (r.includes('SUPER')) return 'bg-purple-100 text-purple-700 border-purple-200';
        if (r.includes('DIST')) return 'bg-blue-100 text-blue-700 border-blue-200';
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    };

    return (
        <div className="max-w-5xl mx-auto space-y-3">
            {/* Page Identity Header Banner */}
            <div className="flex items-center justify-between bg-gradient-to-r from-amber-950 via-slate-900 to-slate-900 text-white px-5 py-3 rounded-2xl shadow-sm border border-amber-900/40">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-inner">
                        <Clock size={18} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-black tracking-wide uppercase">Pending Fund Requests</h2>
                            <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-400/30">
                                Approval Queue
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-300 font-medium">
                            Review and authorize manual float requests submitted with payment proof or bank UTR.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="hidden sm:inline-flex items-center px-3 py-1 bg-white/10 text-amber-200 border border-white/10 rounded-xl text-[10px] font-bold">
                        Pending: {requests.length} ({fmtINR(totalPendingAmount)})
                    </span>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                        <Plus size={13} /> Raise Request
                    </button>
                    <button
                        onClick={loadRequests}
                        title="Refresh"
                        className="p-1.5 text-amber-300 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                    >
                        <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Filter and Actions Bar */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5 flex-1">
                    {/* Search */}
                    <div className="relative min-w-[200px] flex-1 max-w-md">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-400 font-medium"
                            placeholder="Search by user, mobile, or UTR..."
                        />
                    </div>

                    {/* Role Filter */}
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
                        {['ALL', 'RETAILER', 'DISTRIBUTOR', 'SUPER_DISTRIBUTOR'].map(r => (
                            <button
                                key={r}
                                onClick={() => setRoleFilter(r)}
                                className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    roleFilter === r
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                {r.replace(/_/g, ' ')}
                            </button>
                        ))}
                    </div>
                </div>

                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Showing {filtered.length} of {requests.length} requests
                </p>
            </div>

            {/* Requests Cards / Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-left">
                                {['User / Requester', 'Requested Amount', 'UTR / Ref No.', 'Payment Mode & Bank', 'Date & Time', 'User Note', 'Admin Actions'].map(h => (
                                    <th key={h} className="px-5 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filtered.map(req => (
                                <tr key={req.id} className="hover:bg-amber-50/30 transition-colors">
                                    {/* User */}
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black text-xs shrink-0">
                                                {(req.name || 'U').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="truncate">
                                                <p className="text-xs font-black text-slate-900 truncate">{req.name}</p>
                                                <p className="text-[10px] text-slate-400 truncate">
                                                    {req.mobile || req.username}
                                                </p>
                                                <span className={`inline-block mt-0.5 px-2 py-0.5 text-[8px] font-black rounded uppercase border ${getRoleBadge(req.role)}`}>
                                                    {req.role}
                                                </span>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Amount */}
                                    <td className="px-5 py-4 whitespace-nowrap">
                                        <p className="text-base font-black text-emerald-600">
                                            {fmtINR(req.amount)}
                                        </p>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Float Requested</p>
                                    </td>

                                    {/* UTR */}
                                    <td className="px-5 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                                                {req.utrNumber || 'N/A'}
                                            </span>
                                            {req.utrNumber && (
                                                <button
                                                    onClick={() => handleCopyUtr(req.utrNumber)}
                                                    title="Copy UTR"
                                                    className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 transition-colors"
                                                >
                                                    {copiedUtr === req.utrNumber ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                                                </button>
                                            )}
                                        </div>
                                    </td>

                                    {/* Payment Mode & Bank */}
                                    <td className="px-5 py-4 whitespace-nowrap">
                                        <p className="text-xs font-bold text-slate-700">{req.method || 'NEFT/IMPS'}</p>
                                        <p className="text-[10px] text-slate-400">{req.bankName || 'Company Account'}</p>
                                    </td>

                                    {/* Date */}
                                    <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500">
                                        {fmtDateTime(req.created_at)}
                                    </td>

                                    {/* User Note */}
                                    <td className="px-5 py-4 max-w-[180px]">
                                        <p className="text-xs text-slate-600 truncate" title={req.remark}>
                                            {req.remark || '—'}
                                        </p>
                                    </td>

                                    {/* Actions */}
                                    <td className="px-5 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => {
                                                    setApproveModalItem(req);
                                                    setApproveRemark('');
                                                }}
                                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <CheckCircle2 size={13} /> Approve & Credit
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setDeclineModalItem(req);
                                                    setDeclineRemark('');
                                                }}
                                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer"
                                            >
                                                <XCircle size={13} /> Decline
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center text-xs text-slate-400 font-bold">
                                        <div className="max-w-xs mx-auto space-y-2">
                                            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto text-slate-300">
                                                <CheckCircle2 size={24} />
                                            </div>
                                            <p className="text-sm font-black text-slate-700">All caught up!</p>
                                            <p className="text-xs text-slate-400">There are no pending fund requests at this moment.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Approve Confirmation Modal ── */}
            <AnimatePresence>
                {approveModalItem && (
                    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden"
                        >
                            <div className="p-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                                        <CheckCircle2 size={22} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-base uppercase tracking-tight">Approve Fund Request</h3>
                                        <p className="text-xs text-emerald-100">Credit requested amount directly to user wallet</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setApproveModalItem(null)}
                                    className="p-1 hover:bg-white/20 rounded-xl text-white transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-6 space-y-5">
                                {/* Summary Box */}
                                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-2">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500 font-bold">Requester:</span>
                                        <span className="font-black text-slate-800">{approveModalItem.name} ({approveModalItem.role})</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500 font-bold">UTR / Reference:</span>
                                        <span className="font-mono font-bold text-slate-800">{approveModalItem.utrNumber || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500 font-bold">Payment Method:</span>
                                        <span className="font-bold text-slate-800">{approveModalItem.method}</span>
                                    </div>
                                    <div className="pt-2 border-t border-emerald-200 flex justify-between items-center">
                                        <span className="text-xs font-black text-emerald-900 uppercase">Amount to Credit</span>
                                        <span className="text-xl font-black text-emerald-700">{fmtINR(approveModalItem.amount)}</span>
                                    </div>
                                </div>

                                {/* Admin Remark */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Admin Approval Note (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={approveRemark}
                                        onChange={e => setApproveRemark(e.target.value)}
                                        placeholder="e.g. Verified with bank statement - funds credited"
                                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div className="flex items-center gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setApproveModalItem(null)}
                                        disabled={approving}
                                        className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleConfirmApprove}
                                        disabled={approving}
                                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        {approving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                        <span>Confirm & Credit {fmtINR(approveModalItem.amount)}</span>
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── Decline Confirmation Modal ── */}
            <AnimatePresence>
                {declineModalItem && (
                    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden"
                        >
                            <div className="p-6 bg-gradient-to-r from-rose-600 to-red-600 text-white flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                                        <XCircle size={22} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-base uppercase tracking-tight">Decline Fund Request</h3>
                                        <p className="text-xs text-rose-100">Amount will NOT be credited to the user</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setDeclineModalItem(null)}
                                    className="p-1 hover:bg-white/20 rounded-xl text-white transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-6 space-y-5">
                                {/* Warning Callout */}
                                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3">
                                    <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                                    <div className="text-xs text-rose-800">
                                        <p className="font-bold">Important Notice:</p>
                                        <p className="mt-0.5">
                                            Declining will reject this request for <strong>{fmtINR(declineModalItem.amount)}</strong>.
                                            No funds will be credited to {declineModalItem.name}'s wallet. The decline reason will be shown to the user.
                                        </p>
                                    </div>
                                </div>

                                {/* Reason Dropdown */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Primary Reason for Decline *
                                    </label>
                                    <select
                                        value={declineReason}
                                        onChange={e => setDeclineReason(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-rose-500"
                                    >
                                        <option value="Payment not received in company bank account">Payment not received in company bank account</option>
                                        <option value="UTR / Reference number not found in bank statement">UTR / Reference number not found in bank statement</option>
                                        <option value="Amount mismatch with bank credit receipt">Amount mismatch with bank credit receipt</option>
                                        <option value="Duplicate fund request submission">Duplicate fund request submission</option>
                                        <option value="Invalid or illegible payment slip uploaded">Invalid or illegible payment slip uploaded</option>
                                        <option value="Third-party payment not accepted as per policy">Third-party payment not accepted as per policy</option>
                                        <option value="Other administrative reason">Other administrative reason</option>
                                    </select>
                                </div>

                                {/* Detailed Remark */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Detailed Explanation for User (Optional)
                                    </label>
                                    <textarea
                                        rows={2}
                                        value={declineRemark}
                                        onChange={e => setDeclineRemark(e.target.value)}
                                        placeholder="e.g. Please verify your bank deduction and provide correct 12-digit UTR number."
                                        className="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-rose-500"
                                    />
                                </div>

                                <div className="flex items-center gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setDeclineModalItem(null)}
                                        disabled={declining}
                                        className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleConfirmDecline}
                                        disabled={declining}
                                        className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        {declining ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                                        <span>Confirm Decline</span>
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── Create New Request Modal ── */}
            <AnimatePresence>
                {showCreateModal && (
                    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden"
                        >
                            <div className="p-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between">
                                <h3 className="font-black text-base uppercase tracking-tight">Raise Fund Request</h3>
                                <button onClick={() => setShowCreateModal(false)} className="text-white/80 hover:text-white">
                                    <X size={18} />
                                </button>
                            </div>
                            <form onSubmit={handleCreateRequest} className="p-6 space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select User *</label>
                                    <UserSelector
                                        users={users}
                                        value={createForm.userId}
                                        onChange={v => setCreateForm(p => ({ ...p, userId: v }))}
                                        placeholder="Select user..."
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amount (₹) *</label>
                                        <input
                                            type="number"
                                            value={createForm.amount}
                                            onChange={e => setCreateForm(p => ({ ...p, amount: e.target.value }))}
                                            placeholder="0.00"
                                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Method</label>
                                        <select
                                            value={createForm.method}
                                            onChange={e => setCreateForm(p => ({ ...p, method: e.target.value }))}
                                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500"
                                        >
                                            <option>UPI</option>
                                            <option>NEFT/IMPS</option>
                                            <option>RTGS</option>
                                            <option>CASH</option>
                                            <option>CHEQUE</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">UTR / Reference No.</label>
                                    <input
                                        type="text"
                                        value={createForm.utrNumber}
                                        onChange={e => setCreateForm(p => ({ ...p, utrNumber: e.target.value }))}
                                        placeholder="e.g. UTR384910284"
                                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">User Note</label>
                                    <input
                                        type="text"
                                        value={createForm.remark}
                                        onChange={e => setCreateForm(p => ({ ...p, remark: e.target.value }))}
                                        placeholder="Optional remark..."
                                        className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={creating}
                                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg transition-all"
                                >
                                    {creating ? 'Creating...' : 'Submit Pending Fund Request'}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default PendingFundRequestsTab;
