import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import {
    RotateCcw, History, Search, FileSpreadsheet, Loader2, Sparkles
} from 'lucide-react';
import { UserSelector, fmtINR, fmtDateTime, fireCelebration, sanitizeCsvCell, fetchAPI, WalletTabSkeleton } from './walletShared';
import { dataService } from '../../../services/dataService';

const CmsRefundTab = ({ users = [], loading = false, onToast, onRefresh }) => {
    if (loading && users.length === 0) {
        return (
            <WalletTabSkeleton
                title="CMS Refund"
                subtitle="Fetching active retailer accounts and refund history..."
            />
        );
    }

    const [viewMode, setViewMode] = useState('FORM'); // 'FORM' | 'HISTORY'
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
        <div className="w-full max-w-6xl mx-auto space-y-2.5">
            {/* Page Identity Header Banner */}
            <div className="flex items-center justify-between bg-gradient-to-r from-amber-950 via-slate-900 to-slate-900 text-white px-4 py-2 sm:py-2.5 rounded-xl shadow-sm border border-amber-900/40">
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-inner">
                        <RotateCcw size={16} />
                    </div>
                    <h2 className="text-xs sm:text-sm font-black tracking-wide uppercase text-white">CMS Refund</h2>
                </div>

                {/* SubTab Toggle in Header */}
                <div className="flex items-center gap-1.5 bg-white/10 p-1 rounded-xl border border-white/10">
                    <button
                        type="button"
                        onClick={() => setViewMode('FORM')}
                        className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                            viewMode === 'FORM'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-300 hover:text-white'
                        }`}
                    >
                        <RotateCcw size={12} className={viewMode === 'FORM' ? 'text-amber-600' : 'text-slate-300'} />
                        Refund Form
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('HISTORY')}
                        className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                            viewMode === 'HISTORY'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-300 hover:text-white'
                        }`}
                    >
                        <History size={12} className={viewMode === 'HISTORY' ? 'text-amber-600' : 'text-slate-300'} />
                        Refund Log ({refunds.length})
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <AnimatePresence mode="wait">
                {viewMode === 'FORM' ? (
                    <motion.div
                        key="form"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 sm:p-4 md:p-5"
                    >
                        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 items-start">
                                {/* Left Column: User, Mode, Original Ref */}
                                <div className="space-y-2.5 sm:space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                                            <span>Select Beneficiary User *</span>
                                            {selectedUser && (
                                                <span className="text-amber-600 font-bold">
                                                    Bal: {fmtINR(selectedUser.balance || selectedUser.walletBalance || 0)}
                                                </span>
                                            )}
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
                                            initial={{ opacity: 0, scale: 0.98 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="px-3 py-2 bg-amber-50/80 border border-amber-200/90 rounded-xl flex items-center justify-between gap-2"
                                        >
                                            <div className="flex items-center gap-2.5 truncate">
                                                <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                                                    {(selectedUser.name || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="truncate">
                                                    <p className="text-xs font-black text-slate-900 truncate">{selectedUser.name}</p>
                                                    <p className="text-[10px] text-slate-500 font-medium">
                                                        {selectedUser.mobile || selectedUser.username} {selectedUser.partyCode && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedUser.partyCode) ? `· Code: ${selectedUser.partyCode}` : ''} · Role: <span className="font-bold text-amber-700">{selectedUser.role}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Current Balance</p>
                                                <p className="text-xs font-black text-slate-900">
                                                    {fmtINR(selectedUser.balance || selectedUser.walletBalance || 0)}
                                                </p>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* CMS Category */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            CMS Category *
                                        </label>
                                        <select
                                            value={category}
                                            onChange={e => setCategory(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-amber-500 focus:bg-white transition-colors"
                                        >
                                            <option value="CMS_CASH_COLLECTION">CMS Cash Collection Drop Reversal</option>
                                            <option value="CMS_BILL_PAYMENT">CMS Utility / Bill Payment Refund</option>
                                            <option value="CMS_AGENT_FLOAT">CMS Agent Float Settlement Adjustment</option>
                                            <option value="CMS_PAYOUT_FAILED">CMS Failed Payout Reversal</option>
                                            <option value="AEPS_CHARGEBACK_REFUND">AePS / DMT Chargeback Settlement Refund</option>
                                        </select>
                                    </div>

                                    {/* Original CMS Ref */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Original CMS / Transaction Ref ID *
                                        </label>
                                        <input
                                            type="text"
                                            value={originalRef}
                                            onChange={e => setOriginalRef(e.target.value)}
                                            placeholder="e.g. CMS-9842104 or BBPS-391028"
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-amber-500 focus:bg-white font-mono transition-colors"
                                        />
                                    </div>
                                </div>

                                {/* Right Column: Amount, Consumer No, Narration, Submit */}
                                <div className="space-y-2.5 sm:space-y-3">
                                    {/* Refund Amount */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Refund Amount (₹) *
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₹</span>
                                            <input
                                                type="number"
                                                min="1"
                                                step="0.01"
                                                value={amount}
                                                onChange={e => setAmount(e.target.value)}
                                                placeholder="0.00"
                                                disabled={submitting}
                                                className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-800 outline-none focus:border-amber-500 focus:bg-white transition-colors"
                                            />
                                        </div>
                                    </div>

                                    {/* Consumer / CA Identifier */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Consumer / CA Number (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={consumerNo}
                                            onChange={e => setConsumerNo(e.target.value)}
                                            placeholder="e.g. Consumer No or Mobile"
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-amber-500 focus:bg-white transition-colors"
                                        />
                                    </div>

                                    {/* Detailed Narration */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            Refund Reason & Note
                                        </label>
                                        <input
                                            type="text"
                                            value={remark}
                                            onChange={e => setRemark(e.target.value)}
                                            placeholder="e.g. Transaction timed out at bank end, verified with operator log"
                                            disabled={submitting}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-amber-500 focus:bg-white transition-colors"
                                        />
                                    </div>

                                    {/* Submit Button */}
                                    <div className="pt-1">
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="w-full py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-700 hover:to-orange-700 text-white font-black text-xs uppercase tracking-[0.15em] shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                                        >
                                            {submitting ? (
                                                <>
                                                    <Loader2 size={14} className="animate-spin" />
                                                    <span>PROCESSING CMS REFUND...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <RotateCcw size={14} />
                                                    <span>PROCESS & CREDIT CMS REFUND</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </motion.div>
                ) : (
                    /* Past CMS Refunds Table */
                    <motion.div
                        key="history"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 overflow-hidden space-y-3"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100">
                            <div>
                                <h4 className="font-black text-xs text-slate-800 uppercase tracking-wider">CMS Refund Audit Log</h4>
                                <p className="text-[10px] text-slate-400">Total {filteredRefunds.length} refund records</p>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-400 w-44 font-medium"
                                        placeholder="Search ref or user..."
                                    />
                                </div>
                                <button
                                    onClick={handleExportExcel}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                                >
                                    <FileSpreadsheet size={13} /> Export Excel
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-left text-slate-400 border-b border-slate-100 font-black text-[9px] uppercase tracking-wider">
                                        <th className="pb-2">Refund ID</th>
                                        <th className="pb-2">Beneficiary</th>
                                        <th className="pb-2">Category</th>
                                        <th className="pb-2">Amount Credited</th>
                                        <th className="pb-2">Original CMS Ref</th>
                                        <th className="pb-2">Date & Time</th>
                                        <th className="pb-2">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {filteredRefunds.map(rec => (
                                        <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="py-2.5 font-mono font-bold text-slate-500">{rec.id}</td>
                                            <td className="py-2.5 font-bold text-slate-800">
                                                <p>{rec.name}</p>
                                                <span className="text-[10px] text-slate-400 font-normal">{rec.mobile || rec.username}</span>
                                            </td>
                                            <td className="py-2.5 text-slate-600 font-semibold">{rec.category}</td>
                                            <td className="py-2.5 font-black text-emerald-600">+{fmtINR(rec.amount)}</td>
                                            <td className="py-2.5 font-mono font-bold text-amber-700">{rec.originalRef}</td>
                                            <td className="py-2.5 text-slate-400">{fmtDateTime(rec.refundedAt)}</td>
                                            <td className="py-2.5">
                                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-black uppercase">
                                                    {rec.status || 'REFUNDED'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredRefunds.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="py-10 text-center text-slate-400 font-semibold">
                                                No CMS refunds found matching your search
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CmsRefundTab;
