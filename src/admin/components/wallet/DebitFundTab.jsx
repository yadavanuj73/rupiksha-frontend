import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowUpCircle, AlertTriangle, Loader2, History, IndianRupee
} from 'lucide-react';
import { fetchAPI, uuid, UserSelector, fmtINR, fmtDateTime, WalletTabSkeleton } from './walletShared';
import { dataService } from '../../../services/dataService';

const DebitFundTab = ({ users = [], loading = false, onToast, onRefresh }) => {
    if (loading && users.length === 0) {
        return (
            <WalletTabSkeleton
                title="Debit Fund"
                subtitle="Fetching active user accounts and float balances from server..."
            />
        );
    }

    const [userId, setUserId] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('ADMIN_ADJUSTMENT');
    const [referenceNo, setReferenceNo] = useState('');
    const [remark, setRemark] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [idempotencyKey, setIdempotencyKey] = useState(() => uuid());
    const submittingRef = useRef(false);

    const selectedUser = users.find(u => u.username === userId || u.id == userId || u.userId == userId);
    const currentBalance = parseFloat(String(selectedUser?.balance ?? selectedUser?.walletBalance ?? 0).replace(/,/g, '')) || 0;
    const numAmount = parseFloat(amount) || 0;
    const isExceeding = numAmount > currentBalance && currentBalance > 0;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submittingRef.current) return;
        if (!userId) return onToast({ type: 'error', message: 'Please select a user to debit funds from' });
        if (!numAmount || numAmount <= 0) return onToast({ type: 'error', message: 'Please enter a valid debit amount (greater than 0)' });

        const targetId = selectedUser ? (selectedUser.id || selectedUser.username) : userId;
        submittingRef.current = true;
        setSubmitting(true);

        const debitRemark = remark.trim() || `Admin Debit Fund (${category.replace(/_/g, ' ')}) ${referenceNo ? `- Ref: ${referenceNo}` : ''}`.trim();

        let res = null;
        try {
            res = await fetchAPI('/wallet/debit', {
                method: 'POST',
                body: JSON.stringify({
                    userId: targetId,
                    amount: numAmount,
                    remark: debitRemark,
                    category,
                    referenceNo: referenceNo.trim()
                })
            }, idempotencyKey);
        } catch (err) {
            console.warn('[DebitFund] API call warning:', err);
        }

        // Always guarantee update via dataService for reliable live state sync
        const adjusted = dataService.adjustUserWalletBalance(targetId, numAmount, 'DEBIT', debitRemark);

        if ((res && res.success) || adjusted) {
            onToast({
                type: 'success',
                message: res?.message || `Successfully debited ${fmtINR(numAmount)} from ${(selectedUser?.name || targetId)}!`
            });

            setAmount('');
            setRemark('');
            setReferenceNo('');
            setIdempotencyKey(uuid());
            if (onRefresh) onRefresh();
            window.dispatchEvent(new CustomEvent('walletUpdated'));
        } else {
            onToast({ type: 'error', message: res?.message || 'Failed to debit funds. Please verify user balance and try again.' });
        }

        submittingRef.current = false;
        setSubmitting(false);
    };

    // Recent debit transactions
    const recentDebits = (() => {
        try {
            const txns = dataService.getData()?.transactions || [];
            return txns.filter(t => (t.ledgerType === 'DEBIT' || t.type === 'DEBIT') && (t.service?.includes('WALLET') || t.transactionContext?.includes('WALLET') || t.service === 'ADMIN_WALLET_DEBIT')).slice(0, 5);
        } catch (_) {
            return [];
        }
    })();

    return (
        <div className="w-full max-w-6xl mx-auto space-y-2.5">
            {/* Page Identity Header Banner */}
            <div className="flex items-center justify-between bg-gradient-to-r from-rose-950 via-slate-900 to-slate-900 text-white px-4 py-2 sm:py-2.5 rounded-xl shadow-sm border border-rose-900/40">
                <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-400 shadow-inner">
                        <ArrowUpCircle size={16} />
                    </div>
                    <h2 className="text-xs sm:text-sm font-black tracking-wide uppercase text-white">Debit Fund</h2>
                </div>
                {recentDebits.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setShowHistory(!showHistory)}
                        className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[10px] font-bold uppercase tracking-wider border border-white/10 transition-all cursor-pointer"
                    >
                        <History size={12} />
                        <span>{showHistory ? 'View Form' : `Recent Debits (${recentDebits.length})`}</span>
                    </button>
                )}
            </div>

            {/* Main Content Area */}
            <AnimatePresence mode="wait">
                {showHistory ? (
                    <motion.div
                        key="history"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 overflow-hidden"
                    >
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <History size={14} className="text-slate-400" />
                                <h4 className="font-black text-xs text-slate-700 uppercase tracking-wider">Recent Debit Operations</h4>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowHistory(false)}
                                className="text-[10px] font-black text-rose-600 uppercase tracking-wider hover:underline flex items-center gap-1 cursor-pointer"
                            >
                                Close History
                            </button>
                        </div>
                        <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="text-left text-slate-400 border-b border-slate-100 font-black text-[9px] uppercase tracking-wider">
                                        <th className="pb-2">User / Target</th>
                                        <th className="pb-2">Amount</th>
                                        <th className="pb-2">Narration</th>
                                        <th className="pb-2">Date & Time</th>
                                        <th className="pb-2">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {recentDebits.map((tx, idx) => (
                                        <tr key={tx.id || idx} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="py-2 font-bold text-slate-800">{tx.targetUsername || tx.userId}</td>
                                            <td className="py-2 font-black text-rose-600">-{fmtINR(tx.amount)}</td>
                                            <td className="py-2 text-slate-500 max-w-[220px] truncate">{tx.narration || tx.remark}</td>
                                            <td className="py-2 text-slate-400 text-[11px]">{fmtDateTime(tx.createdAt || tx.created_at)}</td>
                                            <td className="py-2">
                                                <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[9px] font-black uppercase">
                                                    {tx.status || 'SUCCESS'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="form"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5 sm:p-4 md:p-5"
                    >
                        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-3.5">
                            {/* 2-Column Responsive Grid */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 items-start">
                                {/* Left Column: Target User & Category & Ref */}
                                <div className="space-y-2.5 sm:space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                                            <span>Select Target User *</span>
                                            {selectedUser && (
                                                <span className="text-rose-600 font-bold">
                                                    Available: {fmtINR(currentBalance)}
                                                </span>
                                            )}
                                        </label>
                                        <UserSelector
                                            users={users}
                                            value={userId}
                                            onChange={setUserId}
                                            placeholder="Choose retailer, distributor or super distributor..."
                                            disabled={submitting}
                                        />
                                    </div>

                                    {/* Selected user preview card */}
                                    {selectedUser && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.98 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="px-3 py-2 bg-rose-50/80 border border-rose-200/90 rounded-xl flex items-center justify-between gap-2"
                                        >
                                            <div className="flex items-center gap-2.5 truncate">
                                                <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                                                    {(selectedUser.name || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="truncate">
                                                    <p className="text-xs font-black text-slate-900 truncate">{selectedUser.name || selectedUser.fullName}</p>
                                                    <p className="text-[10px] text-slate-500 font-medium">
                                                        {selectedUser.mobile || selectedUser.username} {selectedUser.partyCode && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedUser.partyCode) ? `· Code: ${selectedUser.partyCode}` : ''} · <span className="font-bold text-rose-700 uppercase">{selectedUser.role || 'Member'}</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Current Balance</p>
                                                <p className="text-xs font-black text-slate-800">
                                                    {fmtINR(currentBalance)}
                                                </p>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Category & Reference */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Deduction Reason</label>
                                            <select
                                                value={category}
                                                onChange={e => setCategory(e.target.value)}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-rose-500 focus:bg-white transition-colors"
                                            >
                                                <option value="ADMIN_ADJUSTMENT">Admin Adjustment</option>
                                                <option value="CHARGEBACK_RECOVERY">Chargeback / Dispute</option>
                                                <option value="EXCESS_FLOAT_RECOVERY">Excess Float Recovery</option>
                                                <option value="PENALTY">Violation Penalty</option>
                                                <option value="WRONG_CREDIT_REVERSAL">Credit Reversal</option>
                                            </select>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Case / Ref / Ticket ID</label>
                                            <input
                                                type="text"
                                                value={referenceNo}
                                                onChange={e => setReferenceNo(e.target.value)}
                                                placeholder="e.g. REF-019 or TICKET-842"
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-rose-500 focus:bg-white transition-colors"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Debit Amount & Narration */}
                                <div className="space-y-2.5 sm:space-y-3">
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Debit Amount (₹) *
                                            </label>
                                            {selectedUser && currentBalance > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setAmount(String(currentBalance))}
                                                    className="text-[9px] font-black text-rose-600 uppercase hover:underline cursor-pointer"
                                                >
                                                    Debit All ({fmtINR(currentBalance)})
                                                </button>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-base">₹</span>
                                            <input
                                                type="number"
                                                min="1"
                                                step="0.01"
                                                value={amount}
                                                onChange={e => setAmount(e.target.value)}
                                                placeholder="0.00"
                                                disabled={submitting}
                                                className={`w-full pl-8 pr-4 py-2 bg-slate-50 border rounded-xl text-base font-black text-slate-800 outline-none transition-all disabled:opacity-60 ${
                                                    isExceeding ? 'border-amber-400 bg-amber-50/40' : 'border-slate-200 focus:border-rose-500 focus:bg-white'
                                                }`}
                                            />
                                        </div>
                                        {isExceeding && (
                                            <p className="text-[10px] text-amber-700 font-bold flex items-center gap-1 mt-1">
                                                <AlertTriangle size={11} className="shrink-0" />
                                                Amount exceeds current balance. Balance will become ₹0.00.
                                            </p>
                                        )}
                                    </div>

                                    {/* Narration / Remark */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Narration / Remark (Optional)</label>
                                        <input
                                            type="text"
                                            value={remark}
                                            onChange={e => setRemark(e.target.value)}
                                            placeholder="e.g. Float deduction approved by Compliance Team"
                                            disabled={submitting}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-rose-500 focus:bg-white transition-colors"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 text-white font-black text-xs uppercase tracking-[0.2em] shadow-md shadow-rose-600/25 hover:shadow-rose-600/40 hover:scale-[1.002] active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 size={15} className="animate-spin" />
                                        <span>PROCESSING DEBIT...</span>
                                    </>
                                ) : (
                                    <>
                                        <ArrowUpCircle size={15} />
                                        <span>CONFIRM & DEBIT FUNDS</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default DebitFundTab;
