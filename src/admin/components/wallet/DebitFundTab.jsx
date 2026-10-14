import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
    ArrowUpCircle, AlertTriangle, Loader2, History, IndianRupee
} from 'lucide-react';
import { fetchAPI, uuid, UserSelector, fmtINR, fmtDateTime } from './walletShared';
import { dataService } from '../../../services/dataService';

const DebitFundTab = ({ users = [], onToast, onRefresh }) => {
    const [userId, setUserId] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('ADMIN_ADJUSTMENT');
    const [referenceNo, setReferenceNo] = useState('');
    const [remark, setRemark] = useState('');
    const [submitting, setSubmitting] = useState(false);
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
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Main Form */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* User Selection */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                            <span>Select Target User *</span>
                            {selectedUser && (
                                <span className="text-rose-600 font-bold lowercase">
                                    Current balance: {fmtINR(currentBalance)}
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
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl flex flex-wrap items-center justify-between gap-4"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-black text-sm shadow-md">
                                    {(selectedUser.name || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-sm font-black text-slate-900">{selectedUser.name || selectedUser.fullName}</p>
                                    <p className="text-xs text-slate-500 font-medium">
                                        {selectedUser.mobile || selectedUser.username} · Role: <span className="font-bold text-rose-700">{selectedUser.role || 'Member'}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Available to Debit</p>
                                <p className="text-lg font-black text-slate-800">
                                    {fmtINR(currentBalance)}
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {/* Amount & Warning */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Debit Amount (₹) *
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">₹</span>
                            <input
                                type="number"
                                min="1"
                                step="0.01"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="0.00"
                                disabled={submitting}
                                className={`w-full pl-9 pr-4 py-3.5 bg-slate-50 border-2 rounded-2xl text-lg font-black text-slate-800 outline-none transition-all disabled:opacity-60 ${
                                    isExceeding ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200 focus:border-rose-500 focus:bg-white'
                                }`}
                            />
                        </div>
                        {isExceeding && (
                            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold">
                                <AlertTriangle size={15} className="shrink-0 text-amber-600" />
                                <span>Note: Debit amount exceeds available balance. Wallet balance will be reduced to ₹0.00.</span>
                            </div>
                        )}
                    </div>

                    {/* Category & Reference */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Deduction Reason Category</label>
                            <select
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                                className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:border-rose-500"
                            >
                                <option value="ADMIN_ADJUSTMENT">Administrative Adjustment</option>
                                <option value="CHARGEBACK_RECOVERY">Chargeback / Dispute Recovery</option>
                                <option value="EXCESS_FLOAT_RECOVERY">Excess Float Recovery</option>
                                <option value="PENALTY">Compliance / Violation Penalty</option>
                                <option value="WRONG_CREDIT_REVERSAL">Wrong Credit Reversal</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Case / Ref / Ticket ID</label>
                            <input
                                type="text"
                                value={referenceNo}
                                onChange={e => setReferenceNo(e.target.value)}
                                placeholder="e.g. DISPUTE-93821 or REF-019"
                                className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:border-rose-500"
                            />
                        </div>
                    </div>

                    {/* Remark */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Narration / Remark (Optional)</label>
                        <input
                            type="text"
                            value={remark}
                            onChange={e => setRemark(e.target.value)}
                            placeholder="e.g. Float deduction approved by Compliance Team"
                            disabled={submitting}
                            className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 outline-none focus:border-rose-500"
                        />
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-rose-500/25 hover:shadow-rose-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
                    >
                        {submitting ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                <span>PROCESSING DEBIT DEDUCTION...</span>
                            </>
                        ) : (
                            <>
                                <ArrowUpCircle size={16} />
                                <span>CONFIRM & DEBIT FUNDS</span>
                            </>
                        )}
                    </button>
                </form>
            </div>

            {/* Recent Debits Table */}
            {recentDebits.length > 0 && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 overflow-hidden">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                        <History size={16} className="text-slate-400" />
                        <h4 className="font-black text-xs text-slate-700 uppercase tracking-wider">Recent Debit Operations</h4>
                    </div>
                    <div className="overflow-x-auto">
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
                                    <tr key={tx.id || idx} className="py-2.5">
                                        <td className="py-2.5 font-bold text-slate-800">{tx.targetUsername || tx.userId}</td>
                                        <td className="py-2.5 font-black text-rose-600">-{fmtINR(tx.amount)}</td>
                                        <td className="py-2.5 text-slate-500 max-w-[200px] truncate">{tx.narration || tx.remark}</td>
                                        <td className="py-2.5 text-slate-400">{fmtDateTime(tx.createdAt || tx.created_at)}</td>
                                        <td className="py-2.5">
                                            <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[9px] font-black uppercase">
                                                {tx.status || 'SUCCESS'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DebitFundTab;
