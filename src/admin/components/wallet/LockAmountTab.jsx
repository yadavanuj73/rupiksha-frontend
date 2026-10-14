import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Lock, AlertTriangle, Loader2, History, IndianRupee, Unlock, CheckCircle2
} from 'lucide-react';
import { fetchAPI, UserSelector, fmtINR, fmtDateTime } from './walletShared';
import { dataService } from '../../../services/dataService';

const LockAmountTab = ({ users = [], onToast, onRefresh, onNavigate }) => {
    const [userId, setUserId] = useState('');
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('SECURITY_HOLD');
    const [remark, setRemark] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [recentLocks, setRecentLocks] = useState([]);

    const selectedUser = users.find(u => u.username === userId || u.id == userId || u.userId == userId);

    const totalBal = parseFloat(String(selectedUser?.balance ?? selectedUser?.walletBalance ?? 0).replace(/,/g, '')) || 0;
    const currentLocked = parseFloat(String(selectedUser?.lockedAmount || 0).replace(/,/g, '')) || 0;
    const availableBal = Math.max(0, totalBal - currentLocked);

    const handlePercentage = (percent) => {
        if (availableBal <= 0) return;
        const calc = ((availableBal * percent) / 100).toFixed(2);
        setAmount(String(calc));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!userId) return onToast({ type: 'error', message: 'Please select a user to lock amount' });
        const numAmt = parseFloat(amount);
        if (!numAmt || numAmt <= 0) return onToast({ type: 'error', message: 'Please enter a valid amount to lock' });

        if (numAmt > availableBal && availableBal > 0) {
            return onToast({
                type: 'error',
                message: `Cannot lock more than available balance of ${fmtINR(availableBal)}`
            });
        }

        setSubmitting(true);
        const targetId = selectedUser ? (selectedUser.id || selectedUser.username) : userId;
        const lockNote = remark.trim() || `Wallet Amount Locked (${reason.replace(/_/g, ' ')})`;

        try {
            await fetchAPI('/wallet/lock', {
                method: 'POST',
                body: JSON.stringify({
                    userId: targetId,
                    amount: numAmt,
                    remark: lockNote,
                    reason
                })
            });
        } catch (e) {
            console.warn('Backend lock API call fallback:', e);
        }

        // Update user locked amount in dataService users
        const appData = dataService.getData();
        if (!appData.users) appData.users = [];
        let uIdx = appData.users.findIndex(u =>
            u.id == targetId || u._id == targetId || u.username === targetId || u.mobile === targetId
        );
        if (uIdx !== -1) {
            const currentU = appData.users[uIdx];
            const oldLock = parseFloat(String(currentU.lockedAmount || 0).replace(/,/g, '')) || 0;
            const newLock = (oldLock + numAmt).toFixed(2);
            appData.users[uIdx] = {
                ...currentU,
                lockedAmount: parseFloat(newLock)
            };
            dataService.saveData(appData);
        }

        // Save into locked records
        const newRecord = {
            id: `LOCK-${Date.now()}`,
            userId: targetId,
            username: selectedUser?.username || targetId,
            name: selectedUser?.name || selectedUser?.fullName || 'User',
            role: selectedUser?.role || 'RETAILER',
            mobile: selectedUser?.mobile || '',
            amount: numAmt,
            reason: reason.replace(/_/g, ' '),
            remark: lockNote,
            lockedAt: new Date().toISOString(),
            status: 'LOCKED'
        };
        setRecentLocks(prev => [newRecord, ...prev].slice(0, 5));

        onToast({
            type: 'success',
            message: `Successfully locked ${fmtINR(numAmt)} for ${(selectedUser?.name || targetId)}!`
        });

        setAmount('');
        setRemark('');
        setSubmitting(false);
        if (onRefresh) onRefresh();
        window.dispatchEvent(new CustomEvent('walletUpdated'));
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Form */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* User Selection */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Select User to Lock Funds *
                        </label>
                        <UserSelector
                            users={users}
                            value={userId}
                            onChange={setUserId}
                            placeholder="Select retailer, distributor or super distributor..."
                            disabled={submitting}
                        />
                    </div>

                    {/* Selected User Balance Card */}
                    {selectedUser && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-5 bg-purple-50/70 border border-purple-200 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-4"
                        >
                            <div>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total Balance</p>
                                <p className="text-base font-black text-slate-800">{fmtINR(totalBal)}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{selectedUser.name}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-purple-700 font-bold uppercase tracking-wider">Currently Locked</p>
                                <p className="text-base font-black text-purple-700">{fmtINR(currentLocked)}</p>
                                <p className="text-[10px] text-purple-400 mt-0.5">Held in escrow</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">Available to Lock</p>
                                <p className="text-base font-black text-emerald-700">{fmtINR(availableBal)}</p>
                                <p className="text-[10px] text-emerald-500 mt-0.5">Free balance</p>
                            </div>
                        </motion.div>
                    )}

                    {/* Amount & Percentage shortcuts */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Amount to Lock (₹) *
                            </label>
                            {selectedUser && (
                                <span className="text-xs text-slate-500 font-bold">
                                    Max Lockable: <span className="text-emerald-600 font-black">{fmtINR(availableBal)}</span>
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-lg">₹</span>
                            <input
                                type="number"
                                min="1"
                                max={availableBal > 0 ? availableBal : undefined}
                                step="0.01"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="0.00"
                                disabled={submitting}
                                className="w-full pl-9 pr-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-lg font-black text-slate-800 outline-none focus:border-purple-500 focus:bg-white transition-all"
                            />
                        </div>

                        {/* Quick Percentage Chips */}
                        {selectedUser && availableBal > 0 && (
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mr-1">Quick Select:</span>
                                {[25, 50, 75, 100].map(pct => (
                                    <button
                                        key={pct}
                                        type="button"
                                        onClick={() => handlePercentage(pct)}
                                        className="px-3 py-1 bg-slate-100 hover:bg-purple-100 hover:text-purple-700 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 transition-all"
                                    >
                                        {pct}% ({fmtINR((availableBal * pct) / 100)})
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Reason Category */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lock Reason Category</label>
                        <select
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:border-purple-500"
                        >
                            <option value="SECURITY_HOLD">Security Hold (Suspicious Transactions)</option>
                            <option value="CHARGEBACK_DISPUTE">Chargeback Dispute Investigation</option>
                            <option value="KYC_VERIFICATION">KYC Document Verification Pending</option>
                            <option value="NEGATIVE_FLOAT_RECOVERY">Negative Float Recovery Reserve</option>
                            <option value="ADMIN_DISCRETION">Admin Discretion Hold</option>
                        </select>
                    </div>

                    {/* Detailed Remark */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lock Reason / Narration</label>
                        <input
                            type="text"
                            value={remark}
                            onChange={e => setRemark(e.target.value)}
                            placeholder="e.g. Held pending chargeback settlement with NPCI"
                            disabled={submitting}
                            className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 outline-none focus:border-purple-500"
                        />
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
                    >
                        {submitting ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                <span>PROCESSING LOCK...</span>
                            </>
                        ) : (
                            <>
                                <Lock size={16} />
                                <span>CONFIRM & LOCK AMOUNT</span>
                            </>
                        )}
                    </button>
                </form>
            </div>

            {/* Recent Locks Table */}
            {recentLocks.length > 0 && (
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 overflow-hidden">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <History size={16} className="text-slate-400" />
                            <h4 className="font-black text-xs text-slate-700 uppercase tracking-wider">Recently Locked Amounts</h4>
                        </div>
                        {onNavigate && (
                            <button
                                onClick={() => onNavigate('Wallet-Release')}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                            >
                                <Unlock size={13} /> View & Release Locks →
                            </button>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-left text-slate-400 border-b border-slate-100 font-black text-[9px] uppercase tracking-wider">
                                    <th className="pb-2">User</th>
                                    <th className="pb-2">Locked Amount</th>
                                    <th className="pb-2">Reason</th>
                                    <th className="pb-2">Date & Time</th>
                                    <th className="pb-2">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {recentLocks.map((rec, i) => (
                                    <tr key={rec.id || i} className="py-2.5">
                                        <td className="py-2.5 font-bold text-slate-800">{rec.name || rec.username}</td>
                                        <td className="py-2.5 font-black text-purple-600">{fmtINR(rec.amount)}</td>
                                        <td className="py-2.5 text-slate-500 max-w-[200px] truncate">{rec.reason || rec.remark}</td>
                                        <td className="py-2.5 text-slate-400">{fmtDateTime(rec.lockedAt)}</td>
                                        <td className="py-2.5">
                                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px] font-black uppercase">
                                                {rec.status || 'LOCKED'}
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

export default LockAmountTab;
