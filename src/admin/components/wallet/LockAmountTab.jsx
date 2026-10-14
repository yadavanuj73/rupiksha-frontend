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

    const [showHistory, setShowHistory] = useState(false);

    return (
        <div className="max-w-5xl mx-auto space-y-3">
            {/* Page Identity Header Banner */}
            <div className="flex items-center justify-between bg-gradient-to-r from-purple-950 via-slate-900 to-slate-900 text-white px-5 py-3 rounded-2xl shadow-sm border border-purple-900/40">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-400 shadow-inner">
                        <Lock size={18} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-black tracking-wide uppercase">Lock Amount</h2>
                            <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-400/30">
                                Escrow Protection
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-300 font-medium">
                            Lock specific float into escrow hold without deducting from user's gross ledger balance.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {recentLocks.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowHistory(!showHistory)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-[10px] font-bold uppercase tracking-wider border border-white/10 transition-all cursor-pointer"
                        >
                            <History size={12} />
                            <span>{showHistory ? 'View Form' : `Locked (${recentLocks.length})`}</span>
                        </button>
                    )}
                    {onNavigate && (
                        <button
                            type="button"
                            onClick={() => onNavigate('Wallet-Release')}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/50 hover:bg-purple-600 text-white text-[10px] font-bold uppercase tracking-wider border border-purple-400/30 transition-all cursor-pointer"
                        >
                            <Unlock size={12} />
                            <span>Release Locks →</span>
                        </button>
                    )}
                </div>
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
                                <h4 className="font-black text-xs text-slate-700 uppercase tracking-wider">Recently Locked Amounts</h4>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowHistory(false)}
                                className="text-[10px] font-black text-purple-600 uppercase tracking-wider hover:underline flex items-center gap-1 cursor-pointer"
                            >
                                Close History
                            </button>
                        </div>
                        <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
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
                                        <tr key={rec.id || i} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="py-2 font-bold text-slate-800">{rec.name || rec.username}</td>
                                            <td className="py-2 font-black text-purple-600">{fmtINR(rec.amount)}</td>
                                            <td className="py-2 text-slate-500 max-w-[220px] truncate">{rec.reason || rec.remark}</td>
                                            <td className="py-2 text-slate-400 text-[11px]">{fmtDateTime(rec.lockedAt)}</td>
                                            <td className="py-2">
                                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px] font-black uppercase">
                                                    {rec.status || 'LOCKED'}
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
                        className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-5"
                    >
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* 2-Column Responsive Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                {/* Left Column: Target User & Category */}
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                                            <span>Select User to Lock Funds *</span>
                                            {selectedUser && (
                                                <span className="text-purple-600 font-bold">
                                                    Available: {fmtINR(availableBal)}
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

                                    {/* Selected User Balance Card */}
                                    {selectedUser && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.98 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="p-3 bg-purple-50/80 border border-purple-200/90 rounded-xl grid grid-cols-3 gap-2 text-center"
                                        >
                                            <div className="bg-white/70 py-1.5 px-2 rounded-lg border border-purple-100">
                                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Total Bal</p>
                                                <p className="text-xs font-black text-slate-800">{fmtINR(totalBal)}</p>
                                            </div>
                                            <div className="bg-white/70 py-1.5 px-2 rounded-lg border border-purple-100">
                                                <p className="text-[9px] text-purple-700 font-bold uppercase tracking-wider">Locked</p>
                                                <p className="text-xs font-black text-purple-700">{fmtINR(currentLocked)}</p>
                                            </div>
                                            <div className="bg-white/70 py-1.5 px-2 rounded-lg border border-purple-100">
                                                <p className="text-[9px] text-emerald-700 font-bold uppercase tracking-wider">Lockable</p>
                                                <p className="text-xs font-black text-emerald-700">{fmtINR(availableBal)}</p>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Reason Category */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lock Reason Category</label>
                                        <select
                                            value={reason}
                                            onChange={e => setReason(e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-purple-500 focus:bg-white transition-colors"
                                        >
                                            <option value="SECURITY_HOLD">Security Hold (Suspicious Operations)</option>
                                            <option value="CHARGEBACK_DISPUTE">Chargeback Dispute Investigation</option>
                                            <option value="KYC_VERIFICATION">KYC Document Verification Pending</option>
                                            <option value="NEGATIVE_FLOAT_RECOVERY">Negative Float Recovery Reserve</option>
                                            <option value="ADMIN_DISCRETION">Admin Discretion Hold</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Right Column: Amount & Narration */}
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                Amount to Lock (₹) *
                                            </label>
                                            {selectedUser && (
                                                <span className="text-[10px] text-slate-400 font-bold">
                                                    Max: <span className="text-purple-700 font-black">{fmtINR(availableBal)}</span>
                                                </span>
                                            )}
                                        </div>
                                        <div className="relative">
                                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-base">₹</span>
                                            <input
                                                type="number"
                                                min="1"
                                                max={availableBal > 0 ? availableBal : undefined}
                                                step="0.01"
                                                value={amount}
                                                onChange={e => setAmount(e.target.value)}
                                                placeholder="0.00"
                                                disabled={submitting}
                                                className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base font-black text-slate-800 outline-none focus:border-purple-500 focus:bg-white transition-all disabled:opacity-60"
                                            />
                                        </div>

                                        {/* Quick Percentage Chips */}
                                        {selectedUser && availableBal > 0 && (
                                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                                {[25, 50, 75, 100].map(pct => (
                                                    <button
                                                        key={pct}
                                                        type="button"
                                                        onClick={() => handlePercentage(pct)}
                                                        className="px-2.5 py-1 bg-slate-100 hover:bg-purple-100 hover:text-purple-700 border border-slate-200 rounded-lg text-[10px] font-black text-slate-600 transition-all cursor-pointer"
                                                    >
                                                        {pct}% ({fmtINR((availableBal * pct) / 100)})
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Detailed Remark */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Narration / Remark (Optional)</label>
                                        <input
                                            type="text"
                                            value={remark}
                                            onChange={e => setRemark(e.target.value)}
                                            placeholder="e.g. Held pending chargeback settlement with NPCI"
                                            disabled={submitting}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-purple-500 focus:bg-white transition-colors"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white font-black text-xs uppercase tracking-[0.2em] shadow-md shadow-purple-600/25 hover:shadow-purple-600/40 hover:scale-[1.005] active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 size={15} className="animate-spin" />
                                        <span>PROCESSING LOCK...</span>
                                    </>
                                ) : (
                                    <>
                                        <Lock size={15} />
                                        <span>CONFIRM & LOCK AMOUNT</span>
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

export default LockAmountTab;
