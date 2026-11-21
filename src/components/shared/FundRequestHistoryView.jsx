import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Clock, CheckCircle2, XCircle, Search, RefreshCcw, Copy,
    Check, Image as ImageIcon, IndianRupee, AlertCircle, FileText, ExternalLink
} from 'lucide-react';
import { walletFundRequestService } from '../../services/apiService';
import ProofPreviewModal from './ProofPreviewModal';

const fmtINR = (val) => {
    const num = parseFloat(val);
    if (isNaN(num)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
    }).format(num);
};

const fmtDateTime = (iso) => {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        return d.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
};

const FundRequestHistoryView = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [copiedField, setCopiedField] = useState(null);

    // Modal state for proof preview
    const [previewItem, setPreviewItem] = useState(null);

    const loadRequests = useCallback(async () => {
        setLoading(true);
        try {
            const res = await walletFundRequestService.getMyFundRequests();
            if (res && res.success && Array.isArray(res.requests)) {
                setRequests(res.requests);
            } else {
                setRequests([]);
            }
        } catch (err) {
            console.error('Failed to load my fund requests:', err);
            setRequests([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    const copyText = (text, key) => {
        if (!text) return;
        navigator.clipboard?.writeText(text);
        setCopiedField(key);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const filtered = requests.filter(r => {
        const matchesSearch =
            (r.id || '').toLowerCase().includes(search.toLowerCase()) ||
            (r.utrNumber || '').toLowerCase().includes(search.toLowerCase()) ||
            (r.receivingBankName || '').toLowerCase().includes(search.toLowerCase()) ||
            (r.paymentBank || '').toLowerCase().includes(search.toLowerCase());

        const matchesStatus = statusFilter === 'ALL' || (r.status || '').toUpperCase() === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const getStatusBadge = (status) => {
        const s = (status || 'PENDING').toUpperCase();
        if (s === 'APPROVED') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 size={12} /> Approved
                </span>
            );
        }
        if (s === 'REJECTED') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                    <XCircle size={12} /> Rejected
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                <Clock size={12} /> Pending
            </span>
        );
    };

    return (
        <div className="w-full max-w-5xl mx-auto space-y-4">
            {/* Header & Controls */}
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                    {/* Search */}
                    <div className="relative flex-1 max-w-sm">
                        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search by Request ID, UTR, Bank..."
                            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-600 font-medium"
                        />
                    </div>

                    {/* Status Tabs */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                        {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(st => (
                            <button
                                key={st}
                                onClick={() => setStatusFilter(st)}
                                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    statusFilter === st
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-800'
                                }`}
                            >
                                {st}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-[11px] font-bold text-slate-400">
                        {filtered.length} of {requests.length} requests
                    </span>
                    <button
                        onClick={loadRequests}
                        title="Refresh History"
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                    >
                        <RefreshCcw size={15} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                <th className="px-5 py-4">Request ID & Date</th>
                                <th className="px-5 py-4">Requested Amount</th>
                                <th className="px-5 py-4">UTR / Ref No.</th>
                                <th className="px-5 py-4">Receiving Account</th>
                                <th className="px-5 py-4">Payment Mode & Bank</th>
                                <th className="px-5 py-4">Proof</th>
                                <th className="px-5 py-4">Status & Remark</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filtered.map(req => (
                                <tr key={req.id} className="hover:bg-slate-50/50 transition-colors">
                                    {/* Request ID & Date */}
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-mono text-slate-900 font-bold">
                                                #{req.id?.slice(0, 8)}
                                            </span>
                                            <button
                                                onClick={() => copyText(req.id, `id-${req.id}`)}
                                                className="p-1 hover:bg-slate-200/60 rounded text-slate-400 hover:text-slate-700 transition-colors"
                                                title="Copy full Request ID"
                                            >
                                                {copiedField === `id-${req.id}` ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                                            {fmtDateTime(req.createdAt)}
                                        </p>
                                    </td>

                                    {/* Amount */}
                                    <td className="px-5 py-4 whitespace-nowrap">
                                        <p className="text-sm font-black text-slate-900">{fmtINR(req.amount)}</p>
                                    </td>

                                    {/* UTR */}
                                    <td className="px-5 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                {req.utrNumber || '—'}
                                            </span>
                                            {req.utrNumber && (
                                                <button
                                                    onClick={() => copyText(req.utrNumber, `utr-${req.id}`)}
                                                    className="p-1 hover:bg-slate-200/60 rounded text-slate-400 hover:text-slate-700 transition-colors"
                                                    title="Copy UTR"
                                                >
                                                    {copiedField === `utr-${req.id}` ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                                </button>
                                            )}
                                        </div>
                                    </td>

                                    {/* Receiving Account */}
                                    <td className="px-5 py-4">
                                        <p className="font-bold text-slate-800 truncate max-w-[160px]">{req.receivingBankName || 'Company Bank'}</p>
                                        <p className="font-mono text-[10px] text-slate-400">{req.receivingAccountMasked || '—'}</p>
                                    </td>

                                    {/* Payment Mode & Bank */}
                                    <td className="px-5 py-4">
                                        <p className="font-bold text-slate-800">{req.method || 'IMPS'}</p>
                                        <p className="text-[10px] text-slate-400 truncate max-w-[140px]">{req.paymentBank || 'Remitting Bank'}</p>
                                    </td>

                                    {/* Proof preview button */}
                                    <td className="px-5 py-4 whitespace-nowrap">
                                        {req.hasProof ? (
                                            <button
                                                onClick={() => setPreviewItem(req)}
                                                className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                                            >
                                                <ImageIcon size={13} /> View Slip
                                            </button>
                                        ) : (
                                            <span className="text-[10px] text-slate-400 font-medium">No Proof</span>
                                        )}
                                    </td>

                                    {/* Status & Remarks */}
                                    <td className="px-5 py-4 max-w-[200px]">
                                        <div className="space-y-1">
                                            {getStatusBadge(req.status)}
                                            {req.status === 'REJECTED' && (
                                                <p className="text-[11px] font-medium text-rose-700 bg-rose-50/80 p-1.5 rounded-lg border border-rose-100">
                                                    <strong>Reason:</strong> {req.rejectionReason || req.adminRemark || 'Declined by Admin'}
                                                </p>
                                            )}
                                            {req.status === 'APPROVED' && req.adminRemark && (
                                                <p className="text-[10px] text-slate-500 truncate" title={req.adminRemark}>
                                                    {req.adminRemark}
                                                </p>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center text-slate-400 font-medium">
                                        <div className="max-w-xs mx-auto space-y-2">
                                            <FileText size={32} className="mx-auto text-slate-300" />
                                            <p className="text-sm font-bold text-slate-700">No fund requests found</p>
                                            <p className="text-xs text-slate-400">
                                                {search ? 'Try adjusting your search criteria.' : 'Your submitted fund requests will appear here.'}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal for viewing proof */}
            {previewItem && (
                <ProofPreviewModal
                    isOpen={!!previewItem}
                    onClose={() => setPreviewItem(null)}
                    proofUrl={walletFundRequestService.getProofUrl(previewItem.id)}
                    title={`Receipt Proof — Req #${previewItem.id?.slice(0, 8)}`}
                    originalFilename={previewItem.proofOriginalFilename || 'proof.jpg'}
                />
            )}
        </div>
    );
};

export default FundRequestHistoryView;
