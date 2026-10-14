import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { motion } from 'framer-motion';
import {
    RotateCcw, IndianRupee, CheckCircle2, History, Search,
    Download, FileSpreadsheet, Loader2, Sparkles, Receipt
} from 'lucide-react';
import { UserSelector, fmtINR, fmtDateTime, fireCelebration, sanitizeCsvCell, fetchAPI } from './walletShared';
import { dataService } from '../../../services/dataService';

const CmsRefundTab = ({ users = [], onToast, onRefresh }) => {
    const [userId, setUserId] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('CMS_CASH_COLLECTION');
    const [originalRef, setOriginalRef] = useState('');
    const [consumerNo, setConsumerNo] = useState('');
    const [remark, setRemark] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [search, setSearch] = useState('');

    const [refunds, setRefunds] = useState(() => {
        try {
            const appTx = dataService.getData()?.transactions || [];
            return appTx
                .filter(t => t.service === 'CMS_REFUND' || t.transactionContext === 'CMS_REFUND' || t.isCmsRefund)
                .map(t => ({
                    id: t.referenceNumber || t.id,
                    userId: t.userId || t.targetUsername,
                    username: t.targetUsername || t.userId,
                    name: t.name || t.targetUsername || 'Beneficiary',
                    role: t.role || 'RETAILER',
                    mobile: t.mobile || '',
                    amount: t.amount,
                    category: 'CMS REFUND',
                    originalRef: t.referenceNumber || '—',
                    consumerNo: '—',
                    narration: t.narration || t.remark,
                    refundedAt: t.createdAt || new Date().toISOString(),
                    status: 'REFUNDED'
                }));
        } catch (_) {
            return [];
        }
    });

    const selectedUser = users.find(u => u.username === userId || u.id == userId || u.userId == userId);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!userId) return onToast({ type: 'error', message: 'Please select a beneficiary user' });
        const numAmt = parseFloat(amount);
        if (!numAmt || numAmt <= 0) return onToast({ type: 'error', message: 'Please enter a valid refund amount' });
        if (!originalRef.trim()) return onToast({ type: 'error', message: 'Please enter the Original CMS / Transaction Reference ID' });

        setSubmitting(true);
        const targetId = selectedUser ? (selectedUser.id || selectedUser.username) : userId;
        const targetName = selectedUser?.name || selectedUser?.fullName || targetId;

        const categoryLabel = category.replace(/_/g, ' ');
        const finalNarration = `CMS Refund: ${categoryLabel} - Ref: ${originalRef.trim()}${remark ? ` (${remark.trim()})` : ''}`;

        // Credit to wallet with explicit CMS_REFUND context so it displays as CMS Refund
        dataService.adjustUserWalletBalance(targetId, numAmt, 'CREDIT', finalNarration);

        // Ensure transaction in dataService explicitly has service: 'CMS_REFUND'
        const appData = dataService.getData();
        if (appData.transactions && appData.transactions.length > 0) {
            appData.transactions[0].service = 'CMS_REFUND';
            appData.transactions[0].transactionContext = 'CMS_REFUND';
            appData.transactions[0].isCmsRefund = true;
            dataService.saveData(appData);
        }

        // Sync with backend API
        try {
            await fetchAPI('/wallet/cms-refund', {
                method: 'POST',
                body: JSON.stringify({
                    userId: String(targetId),
                    amount: numAmt,
                    narration: finalNarration,
                    remark: `CMS Refund - Ref: ${originalRef.trim()}`
                })
            });
        } catch (err) {
            console.warn('[CmsRefund] Backend sync note:', err);
        }

        // Save into CMS refund history
        const newRecord = {
            id: `CMS-REF-${Date.now().toString().slice(-5)}`,
            userId: targetId,
            username: selectedUser?.username || targetId,
            name: targetName,
            role: selectedUser?.role || 'RETAILER',
            mobile: selectedUser?.mobile || '',
            amount: numAmt,
            category: categoryLabel,
            originalRef: originalRef.trim(),
            consumerNo: consumerNo.trim() || '—',
            narration: finalNarration,
            refundedAt: new Date().toISOString(),
            status: 'REFUNDED'
        };

        setRefunds(prev => [newRecord, ...prev]);

        fireCelebration();
        onToast({
            type: 'success',
            message: `CMS Refund of ${fmtINR(numAmt)} credited to ${targetName}'s wallet successfully!`
        });

        setAmount('');
        setOriginalRef('');
        setConsumerNo('');
        setRemark('');
        setSubmitting(false);
        if (onRefresh) onRefresh();
        window.dispatchEvent(new CustomEvent('walletUpdated'));
    };

    const filteredRefunds = refunds.filter(r => {
        const q = search.trim().toLowerCase();
        return !q ||
            (r.name || '').toLowerCase().includes(q) ||
            (r.username || '').toLowerCase().includes(q) ||
            String(r.originalRef || '').toLowerCase().includes(q) ||
            String(r.mobile || '').includes(q);
    });

    const totalRefunded = refunds.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

    const handleExportExcel = () => {
        try {
            const dataToExport = filteredRefunds.map(r => ({
                'Refund ID': sanitizeCsvCell(r.id),
                'Beneficiary User': sanitizeCsvCell(r.name),
                'User Mobile / ID': sanitizeCsvCell(r.mobile || r.username),
                'Role': sanitizeCsvCell(r.role),
                'Refund Amount (INR)': parseFloat(r.amount) || 0,
                'Category': sanitizeCsvCell(r.category),
                'Original CMS Ref': sanitizeCsvCell(r.originalRef),
                'Consumer / Account No': sanitizeCsvCell(r.consumerNo),
                'Date & Time': fmtDateTime(r.refundedAt),
                'Status': 'REFUNDED',
                'Narration': sanitizeCsvCell(r.narration)
            }));
            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'CMS_Refunds');
            XLSX.writeFile(wb, `Rupiksha_CMS_Refunds_${new Date().toISOString().slice(0, 10)}.xlsx`);
            onToast({ type: 'success', message: 'CMS Refunds exported successfully' });
        } catch (_) {
            onToast({ type: 'error', message: 'Failed to export Excel' });
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header Banner */}
            <div className="bg-gradient-to-br from-amber-600 via-orange-600 to-amber-800 rounded-3xl p-7 text-white shadow-xl flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                            <RotateCcw size={24} className="text-white" />
                        </div>
                        <h2 className="text-2xl font-black uppercase tracking-tight">CMS Refund</h2>
                    </div>
                    <p className="text-amber-100 text-xs font-semibold max-w-xl">
                        Process and credit CMS reversals, cash collection drops, or bill payment refunds. Reflects specifically as a CMS Refund in the user's wallet.
                    </p>
                </div>

                <div className="text-right">
                    <p className="text-2xl font-black text-white">{fmtINR(totalRefunded)}</p>
                    <p className="text-[10px] text-amber-200 uppercase tracking-widest font-bold">Total CMS Refunded</p>
                </div>
            </div>

            {/* Form */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* User Selection */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Select Beneficiary User *
                        </label>
                        <UserSelector
                            users={users}
                            value={userId}
                            onChange={setUserId}
                            placeholder="Choose retailer, distributor or user..."
                            disabled={submitting}
                        />
                    </div>

                    {selectedUser && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center justify-between"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black text-sm">
                                    {(selectedUser.name || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-sm font-black text-slate-800">{selectedUser.name}</p>
                                    <p className="text-xs text-slate-500">
                                        {selectedUser.mobile || selectedUser.username} · Role: <span className="font-bold text-amber-700">{selectedUser.role}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-500 font-bold uppercase">Current Balance</p>
                                <p className="text-base font-black text-slate-900">
                                    {fmtINR(selectedUser.balance || selectedUser.walletBalance || 0)}
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {/* Amount & Category */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Refund Amount (₹) *
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">₹</span>
                                <input
                                    type="number"
                                    min="1"
                                    step="0.01"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    placeholder="0.00"
                                    disabled={submitting}
                                    className="w-full pl-8 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-base font-black text-slate-800 outline-none focus:border-amber-500"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                CMS Category *
                            </label>
                            <select
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                                className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:border-amber-500"
                            >
                                <option value="CMS_CASH_COLLECTION">CMS Cash Collection Drop Reversal</option>
                                <option value="CMS_BILL_PAYMENT">CMS Utility / Bill Payment Refund</option>
                                <option value="CMS_AGENT_FLOAT">CMS Agent Float Settlement Adjustment</option>
                                <option value="CMS_PAYOUT_FAILED">CMS Failed Payout Reversal</option>
                                <option value="AEPS_CHARGEBACK_REFUND">AePS / DMT Chargeback Settlement Refund</option>
                            </select>
                        </div>
                    </div>

                    {/* Original CMS Ref & Consumer Identifier */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Original CMS / Transaction Ref ID *
                            </label>
                            <input
                                type="text"
                                value={originalRef}
                                onChange={e => setOriginalRef(e.target.value)}
                                placeholder="e.g. CMS-9842104 or BBPS-391028"
                                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:border-amber-500 font-mono"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Consumer / CA Number (Optional)
                            </label>
                            <input
                                type="text"
                                value={consumerNo}
                                onChange={e => setConsumerNo(e.target.value)}
                                placeholder="e.g. Consumer No or Mobile"
                                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:border-amber-500"
                            />
                        </div>
                    </div>

                    {/* Detailed Narration */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Refund Reason & Note
                        </label>
                        <input
                            type="text"
                            value={remark}
                            onChange={e => setRemark(e.target.value)}
                            placeholder="e.g. Transaction timed out at bank end, verified with operator log"
                            disabled={submitting}
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 outline-none focus:border-amber-500"
                        />
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-700 hover:to-orange-700 text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-amber-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                        {submitting ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                <span>PROCESSING CMS REFUND...</span>
                            </>
                        ) : (
                            <>
                                <RotateCcw size={16} />
                                <span>PROCESS & CREDIT CMS REFUND</span>
                            </>
                        )}
                    </button>
                </form>
            </div>

            {/* Past CMS Refunds Table */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 overflow-hidden space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2">
                        <History size={16} className="text-slate-400" />
                        <h4 className="font-black text-xs text-slate-800 uppercase tracking-wider">CMS Refund Audit Log</h4>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-400 w-48 font-medium"
                                placeholder="Search ref or user..."
                            />
                        </div>
                        <button
                            onClick={handleExportExcel}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5"
                        >
                            <FileSpreadsheet size={13} /> Export Excel
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="text-left text-slate-400 border-b border-slate-100 font-black text-[9px] uppercase tracking-wider">
                                <th className="pb-3">Refund ID</th>
                                <th className="pb-3">Beneficiary</th>
                                <th className="pb-3">Category</th>
                                <th className="pb-3">Amount Credited</th>
                                <th className="pb-3">Original CMS Ref</th>
                                <th className="pb-3">Date & Time</th>
                                <th className="pb-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredRefunds.map(rec => (
                                <tr key={rec.id} className="py-2.5 hover:bg-slate-50/70">
                                    <td className="py-3 font-mono font-bold text-slate-500">{rec.id}</td>
                                    <td className="py-3 font-bold text-slate-800">
                                        <p>{rec.name}</p>
                                        <span className="text-[10px] text-slate-400 font-normal">{rec.mobile || rec.username}</span>
                                    </td>
                                    <td className="py-3 text-slate-600 font-semibold">{rec.category}</td>
                                    <td className="py-3 font-black text-emerald-600">+{fmtINR(rec.amount)}</td>
                                    <td className="py-3 font-mono font-bold text-amber-700">{rec.originalRef}</td>
                                    <td className="py-3 text-slate-400">{fmtDateTime(rec.refundedAt)}</td>
                                    <td className="py-3">
                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-black uppercase">
                                            {rec.status || 'REFUNDED'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {filteredRefunds.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="py-8 text-center text-slate-400 font-semibold">
                                        No CMS refunds found matching your search
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CmsRefundTab;
